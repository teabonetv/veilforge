import { CONTENT, skillLevel, addXp, addItem, takeItem, bankCount, log, sumGear, recalcHp, guildBonuses, courseBonuses, chartBonuses, potionStats, petBonuses, stashItem } from "./state.js";
import { checkQuests } from "./quests.js";

const PRAYER_CAP = 2;
const MAX_VOW_CAP = 260;
const SHRED_MAX = 6;
const BLEED_TICK_MS = 650;
const POISON_TICK_MS = 700;
const DRY_LOG_MS = 2500;

const STYLE_BEATS = { might: "mark", mark: "weave", weave: "might" };

export function startFight(state, monsterId, opts = {}) {
  const m = CONTENT.monsters[monsterId];
  if (!m) return "No such foe.";
  if (!state.equipment.weapon) return "Equip a weapon.";
  if ((m.slayerReq || 0) > skillLevel(state, "bounty") && !opts.dungeon && !opts.respawn && !opts.chain) {
    return `Bounty ${m.slayerReq} required.`;
  }
  const foodN = bankCount(state, state.combat.foodId);
  const heal = CONTENT.items[state.combat.foodId]?.heal || 0;
  if (m.maxHit >= state.combat.maxHp * 0.6) {
    combatLog(state, `GEAR CHECK: ${m.name} can chunk ${m.maxHit} of your ${state.combat.maxHp} HP.`);
  }
  if (foodN * heal < m.maxHit * 3) {
    log(state, `${m.name} outpaces your larder (${foodN} food). Cook, or pick a weaker dock rat.`);
  }
  state.action = null;
  state.combat.fighting = true;
  state.combat.monsterId = monsterId;
  let hp = m.hp;
  if (opts.dungeon && opts.boss) hp = Math.floor(hp * 1.45);
  state.combat.monsterHp = hp;
  state.combat.monsterMaxHp = hp;
  state.combat.area = m.area;
  state.combat.shred = 0;
  state.combat.bleed = 0;
  state.combat.nextBleedAt = 0;
  state.combat.dryUntil = 0;
  const now = state.now || 0;
  if (!opts.chain) {
    state.combat.nextHitAt = now + playerInterval(state);
    state.combat.enemyNextAt = now + m.interval;
  } else {
    state.combat.enemyNextAt = now + Math.min(m.interval, 1600);
  }
  if (!opts.dungeon) {
    state.combat.dungeon = null;
    state.combat.dungeonIndex = 0;
    state.combat.poison = 0;
    state.combat.nextPoisonAt = 0;
  }
  if (!opts.chain && !opts.respawn) {
    const st = styleOf(state);
    const edge = triangleEdge(st, m.style);
    if (edge !== "even") {
      combatLog(state, edge === "adv"
        ? `${cap(st)} beats ${m.name}'s ${m.style}. Swap only if you must.`
        : `${cap(st)} loses to ${m.style}. Swap style or eat the tax.`);
    }
  }
  if (opts.dungeon) {
    const d = CONTENT.dungeons.find((x) => x.id === state.combat.dungeon);
    if (d) {
      const floor = (state.combat.dungeonIndex || 0) + 1;
      const tag = opts.boss ? " · BOSS" : "";
      combatLog(state, `${d.name} ${floor}/${d.sequence.length}${tag}: ${m.name}. No rest.`);
    }
  }
  return null;
}

export function startDungeon(state, dungeonId) {
  const d = CONTENT.dungeons.find((x) => x.id === dungeonId);
  if (!d) return "Unknown dungeon.";
  if (bankCount(state, "dungeon-key") < 1) return "Need a Citadel Key.";
  if (Math.max(skillLevel(state, "might"), skillLevel(state, "mark"), skillLevel(state, "weave")) < d.req) {
    return `Need a combat art at ${d.req}.`;
  }
  state.combat.dungeon = dungeonId;
  state.combat.dungeonIndex = 0;
  state.combat.poison = 0;
  state.combat.nextPoisonAt = 0;
  state.combat.ward = 0;
  const boss = d.sequence.length === 1;
  const err = startFight(state, d.sequence[0], { dungeon: true, boss });
  if (err) {
    state.combat.dungeon = null;
    state.combat.dungeonIndex = 0;
    return err;
  }
  takeItem(state, "dungeon-key", 1);
  log(state, `${d.name}: ${d.sequence.length} sequential kills. Spent a Citadel Key. Death resets the run.`);
  return null;
}

export function stopFight(state, reason = "abandon") {
  if (state.combat.dungeon && reason === "abandon") log(state, "Dungeon run abandoned. Progress lost.");
  state.combat.fighting = false;
  state.combat.monsterId = null;
  state.combat.dungeon = null;
  state.combat.dungeonIndex = 0;
  state.combat.shred = 0;
  state.combat.bleed = 0;
}

export function playerInterval(state) {
  const w = CONTENT.items[state.equipment.weapon];
  let iv = w?.interval || 2400;
  const pot = potionStats(state);
  iv /= (pot.speedMul || 1);
  if (styleOf(state) === "weave") {
    const sp = CONTENT.spells.find((s) => s.id === state.combat.spell);
    if (sp?.tag === "earth") iv *= 1.12;
  }
  return iv;
}

export function combatTick(state, ms) {
  if (!state.combat.fighting) return;
  const now = state.now || 0;
  clampPrayers(state);
  autoEat(state);
  regenVow(state, ms);
  tickBleed(state, now);
  tickPoison(state, now);
  if (!state.combat.fighting) return;
  if (now >= (state.combat.stunUntil || 0) && now >= state.combat.nextHitAt) {
    playerHit(state);
    if (!state.combat.fighting) return;
    state.combat.nextHitAt = now + playerInterval(state);
  }
  if (now >= state.combat.enemyNextAt && state.combat.fighting) {
    enemyHit(state);
    const m = CONTENT.monsters[state.combat.monsterId];
    if (m && state.combat.fighting) state.combat.enemyNextAt = now + m.interval;
  }
}

function clampPrayers(state) {
  if (state.combat.prayers.length > PRAYER_CAP) {
    state.combat.prayers = state.combat.prayers.slice(-PRAYER_CAP);
    log(state, `Only ${PRAYER_CAP} vows may be held.`);
  }
}

function regenVow(state, ms) {
  clampPrayers(state);
  if (state.combat.prayers.length === 0) {
    state.combat.vow = Math.min(state.combat.maxVow, state.combat.vow + ms * 0.004);
    return;
  }
  let drain = 0;
  for (const id of state.combat.prayers) {
    drain += CONTENT.prayers.find((p) => p.id === id)?.drain || 0;
  }
  state.combat.vow -= drain * (ms / 1000);
  if (state.combat.vow <= 0) {
    state.combat.vow = 0;
    state.combat.prayers = [];
    log(state, "Vows guttered. Prayers dropped. Bury bones to refill focus.");
    combatLog(state, "Prayers dropped — vow empty.");
  }
}

function prayerStats(state) {
  clampPrayers(state);
  const mul = { accMul: 1, strMul: 1, defMul: 1, rangedMul: 1, magicMul: 1 };
  const extra = { triangle: 0, leech: 0, smite: 0, preserveRune: 0 };
  for (const id of state.combat.prayers) {
    const p = CONTENT.prayers.find((x) => x.id === id);
    if (!p) continue;
    for (const [k, v] of Object.entries(p.stats)) {
      if (k in mul) mul[k] *= v;
      else extra[k] = (extra[k] || 0) + v;
    }
  }
  return { ...mul, ...extra };
}

function styleOf(state) {
  const w = CONTENT.items[state.equipment.weapon];
  return w?.style || state.combat.style || "might";
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function triangleEdge(pStyle, eStyle) {
  if (STYLE_BEATS[pStyle] === eStyle) return "adv";
  if (STYLE_BEATS[eStyle] === pStyle) return "dis";
  return "even";
}

function triangleMods(pStyle, eStyle, extra) {
  const x = extra || 0;
  const edge = triangleEdge(pStyle, eStyle);
  if (edge === "adv") return { acc: 1.28 + x, dmg: 1.22 + x, taken: 0.8 - x * 0.25, edge };
  if (edge === "dis") return { acc: 0.7 - x * 0.35, dmg: 0.76 - x * 0.2, taken: 1.32 + x * 0.35, edge };
  return { acc: 1, dmg: 1, taken: 1, edge };
}

export function playerStats(state) {
  const style = styleOf(state);
  const ps = prayerStats(state);
  const pot = potionStats(state);
  const cb = courseBonuses(state);
  const ch = chartBonuses(state);
  const gb = guildBonuses(state, style);
  const acc = 8 + skillLevel(state, style) + sumGear(state, "acc") + (gb.acc || 0) * 100;
  let power = 0;
  if (style === "might") power += skillLevel(state, "might") + sumGear(state, "str");
  if (style === "mark") power += skillLevel(state, "mark") + sumGear(state, "ranged");
  if (style === "weave") {
    const sp = CONTENT.spells.find((s) => s.id === state.combat.spell);
    power += skillLevel(state, "weave") + sumGear(state, "magic") + (sp?.maxHit || 0);
  }
  const def = 4 + skillLevel(state, "guard") + sumGear(state, "def") + (gb.def || 0) * 100;
  const accMul = (ps.accMul || 1) * (pot.accMul || 1) * (1 + (cb.accMul || 0)) * (1 + (ch.acc || 0));
  const pwrMul = style === "mark"
    ? (ps.rangedMul || 1) * (pot.rangedMul || 1) * (1 + (ch.ranged || 0))
    : style === "weave"
      ? (ps.magicMul || 1) * (pot.magicMul || 1) * (1 + (ch.magic || 0))
      : (ps.strMul || 1) * (pot.strMul || 1) * (1 + (ch.str || 0));
  const defMul = (ps.defMul || 1) * (pot.defMul || 1) * (1 + (cb.defMul || 0));
  const m = CONTENT.monsters[state.combat.monsterId];
  const tri = (state.combat.fighting && m) ? triangleMods(style, m.style, ps.triangle || 0) : { acc: 1, dmg: 1, taken: 1, edge: "even" };
  return {
    style,
    acc: acc * accMul * tri.acc,
    power: Math.max(1, power) * pwrMul * tri.dmg,
    def: def * defMul,
    takenMul: ps.takenMul || 1,
    ps, pot, cb, ch, tri
  };
}

function hitChance(att, eva) {
  const p = att / (att + eva + 8);
  return Math.min(0.95, Math.max(0.12, p));
}

function triTag(edge) {
  if (edge === "adv") return " [triangle+]";
  if (edge === "dis") return " [triangle-]";
  return "";
}

function ammoCount(state) {
  const ammo = state.equipment.ammo;
  if (!ammo) return 0;
  return bankCount(state, ammo) + 1;
}

function consumeAmmo(state, preserve) {
  if (Math.random() < preserve) return true;
  const ammo = state.equipment.ammo;
  if (!ammo) return false;
  if (bankCount(state, ammo) > 0) return takeItem(state, ammo, 1);
  state.equipment.ammo = null;
  return true;
}

function missingRune(state, sp) {
  for (const [rune, qty] of Object.entries(sp.runes || {})) {
    if (bankCount(state, rune) < qty) return rune;
  }
  return null;
}

function consumeRunes(state, sp, preserve) {
  for (const [rune, qty] of Object.entries(sp.runes || {})) {
    if (Math.random() < preserve) continue;
    if (!takeItem(state, rune, qty)) return false;
  }
  return true;
}

function dryLog(state, msg) {
  const now = state.now || 0;
  log(state, msg);
  combatLog(state, msg);
  state.combat.dryUntil = now + DRY_LOG_MS;
}

function playerHit(state, echoFollow = false) {
  const m = CONTENT.monsters[state.combat.monsterId];
  if (!m || !state.combat.fighting) return;
  const st = playerStats(state);
  const w = CONTENT.items[state.equipment.weapon];
  const now = state.now || 0;

  if (!echoFollow && st.style === "mark") {
    const ammo = state.equipment.ammo;
    if (!ammo || ammoCount(state) < 1) {
      if (now >= (state.combat.dryUntil || 0)) dryLog(state, "Out of ammo. Mark falls silent.");
      return;
    }
    const preserve = (st.ch.preserveAmmo || 0) + (w?.special === "pierce" ? 0.1 : 0);
    consumeAmmo(state, preserve);
  }
  if (!echoFollow && st.style === "weave") {
    const sp = CONTENT.spells.find((s) => s.id === state.combat.spell);
    if (!sp) {
      if (now >= (state.combat.dryUntil || 0)) dryLog(state, "No spell chosen.");
      return;
    }
    if (skillLevel(state, "weave") < sp.level) {
      if (now >= (state.combat.dryUntil || 0)) dryLog(state, `${sp.name} needs Weave ${sp.level}.`);
      return;
    }
    const miss = missingRune(state, sp);
    if (miss) {
      if (now >= (state.combat.dryUntil || 0)) {
        dryLog(state, `Out of ${CONTENT.items[miss]?.name || miss}. Weave falls silent.`);
      }
      return;
    }
    const preserve = (st.ps.preserveRune || 0) + (st.ch.preserveRune || 0) + (w?.special === "echo" ? 0.1 : 0);
    consumeRunes(state, sp, preserve);
  }

  if (!echoFollow) consumePotionCharge(state);

  let eva = m.eva * (1 - (state.combat.shred || 0) * 0.08);
  let ignoreDef = 0;
  if (w?.special === "pierce") {
    eva *= 0.55;
    ignoreDef = 0.45;
  }
  const sp = CONTENT.spells.find((s) => s.id === state.combat.spell);
  if (st.style === "weave" && sp?.tag === "void") ignoreDef = Math.max(ignoreDef, 0.2);

  const chance = hitChance(st.acc, Math.max(1, eva));
  if (Math.random() > chance) {
    combatLog(state, `You miss${triTag(st.tri.edge)}.`);
    return;
  }

  const defTax = Math.max(0, (m.def || 0) * 0.22 * (1 - ignoreDef) * (1 - (state.combat.shred || 0) * 0.1));
  let maxHit = Math.max(1, Math.floor(st.power / 4 - defTax));
  if (st.style === "weave") {
    if (sp?.tag === "void") maxHit = Math.floor(maxHit * 1.12);
    if (sp?.tag === "veil") maxHit = Math.floor(maxHit * 1.18);
  }
  if (state.combat.dungeon && st.ps.smite) maxHit = Math.floor(maxHit * (1 + st.ps.smite));
  let dmg = 1 + Math.floor(Math.random() * Math.max(1, maxHit));

  const notes = [];
  if (!echoFollow) {
    state.combat.spec = state.combat.spec || 0;
    if (state.combat.useSpec !== false && state.combat.spec >= 50) {
      state.combat.spec -= 50;
      const specName = w?.special || "surge";
      if (specName === "riposte") {
        notes.push("special: riposte");
        riposte(state, m, st, "special");
        if (!state.combat.fighting) return;
      } else if (specName === "shred") {
        state.combat.shred = Math.min(SHRED_MAX, (state.combat.shred || 0) + 2);
        notes.push("special: shred");
      } else if (specName === "bleed") {
        state.combat.bleed = (state.combat.bleed || 0) + 3;
        notes.push("special: bleed");
      } else if (specName === "pierce") {
        dmg = Math.floor(dmg * 1.25);
        ignoreDef = Math.max(ignoreDef, 0.7);
        notes.push("special: pierce");
      } else if (specName === "echo") {
        notes.push("special: echo");
        combatLog(state, "Special — echo.");
        playerHit(state, true);
        if (!state.combat.fighting) return;
      } else {
        dmg = Math.floor(dmg * 1.35);
        notes.push("special");
      }
    } else {
      state.combat.spec = Math.min(100, state.combat.spec + 14);
    }
  }
  if (w?.special === "pierce") {
    dmg = Math.floor(dmg * 1.12);
    notes.push("pierce");
  }
  if (w?.special === "shred") {
    state.combat.shred = Math.min(SHRED_MAX, (state.combat.shred || 0) + 1);
    notes.push(`shred ${state.combat.shred}`);
  }
  if (w?.special === "bleed" && Math.random() < 0.42) {
    state.combat.bleed = Math.min(8, (state.combat.bleed || 0) + 2);
    if (!state.combat.nextBleedAt) state.combat.nextBleedAt = now + BLEED_TICK_MS;
    notes.push(`bleed ${state.combat.bleed}`);
  }
  if (st.style === "weave" && sp?.tag === "star") {
    const splash = Math.max(1, Math.floor(dmg * 0.4));
    dmg += splash;
    notes.push(`starfall +${splash}`);
  }
  if (st.style === "weave" && sp?.tag === "fire") {
    state.combat.bleed = Math.min(8, (state.combat.bleed || 0) + 1);
    if (!state.combat.nextBleedAt) state.combat.nextBleedAt = now + BLEED_TICK_MS;
    notes.push("ember burn");
  }
  if (st.style === "weave" && sp?.tag === "water") {
    state.combat.ward = (state.combat.ward || 0) + 1;
    notes.push("tide ward");
  }

  dmg = Math.max(1, dmg);
  state.combat.monsterHp -= dmg;
  if (st.style === "weave" && sp?.tag === "blood") {
    const heal = Math.ceil(dmg * 0.15);
    state.combat.hp = Math.min(state.combat.maxHp, state.combat.hp + heal);
    notes.push(`pact +${heal}hp`);
  }
  if (st.ps.leech || st.cb.leech) {
    state.combat.hp = Math.min(state.combat.maxHp, state.combat.hp + Math.ceil(dmg * ((st.ps.leech || 0) + (st.cb.leech || 0))));
  }
  const extra = notes.length ? ` (${notes.join(", ")})` : "";
  combatLog(state, `${echoFollow ? "Echo hits" : "Hit"} ${m.name} for ${dmg}${triTag(st.tri.edge)}${extra}.`);

  if (state.combat.monsterHp <= 0) {
    kill(state, m);
    return;
  }
  if (!echoFollow && w?.special === "echo" && Math.random() < 0.28) {
    combatLog(state, "Echo — the crozier speaks twice.");
    playerHit(state, true);
  }
}

function tickBleed(state, now) {
  if ((state.combat.bleed || 0) <= 0) return;
  if (!state.combat.nextBleedAt) state.combat.nextBleedAt = now + BLEED_TICK_MS;
  if (now < state.combat.nextBleedAt) return;
  const m = CONTENT.monsters[state.combat.monsterId];
  if (!m) return;
  const maxHp = state.combat.monsterMaxHp || m.hp;
  const dmg = Math.max(2, 1 + state.combat.bleed + Math.floor(maxHp * 0.012));
  state.combat.monsterHp -= dmg;
  state.combat.bleed -= 1;
  state.combat.nextBleedAt = now + BLEED_TICK_MS;
  combatLog(state, `Bleed ticks ${dmg} on ${m.name}.`);
  if (state.combat.monsterHp <= 0) kill(state, m);
}

function tickPoison(state, now) {
  if ((state.combat.poison || 0) <= 0) return;
  if (!state.combat.nextPoisonAt) state.combat.nextPoisonAt = now + POISON_TICK_MS;
  if (now < state.combat.nextPoisonAt) return;
  const m = CONTENT.monsters[state.combat.monsterId];
  const bite = Math.max(2, 2 + Math.floor((m?.maxHit || 4) * 0.35) + Math.min(6, state.combat.poison));
  state.combat.hp -= bite;
  state.combat.poison -= 1;
  state.combat.nextPoisonAt = now + POISON_TICK_MS;
  combatLog(state, `Poison bites ${bite} — food must keep up.`);
  if (state.combat.hp <= 0) die(state);
}

function riposte(state, m, st, why) {
  const dmg = Math.max(1, Math.floor(st.power / 5));
  state.combat.monsterHp -= dmg;
  combatLog(state, `Riposte (${why}) ${dmg}.`);
  if (state.combat.monsterHp <= 0) kill(state, m);
}

function enemyHit(state) {
  const m = CONTENT.monsters[state.combat.monsterId];
  if (!m || !state.combat.fighting) return;
  const st = playerStats(state);
  const w = CONTENT.items[state.equipment.weapon];
  const now = state.now || 0;
  const dungeon = CONTENT.dungeons.find((x) => x.id === state.combat.dungeon);
  const boss = dungeon && state.combat.dungeonIndex === dungeon.sequence.length - 1;
  const chance = hitChance(m.acc * (st.tri.taken > 1 ? 1.08 : st.tri.taken < 1 ? 0.92 : 1), st.def);
  if (Math.random() > chance) {
    combatLog(state, `${m.name} misses${triTag(st.tri.edge)}.`);
    if (w?.special === "riposte" && Math.random() < 0.4) riposte(state, m, st, "whiff");
    return;
  }

  let dmg = 1 + Math.floor(Math.random() * m.maxHit);
  dmg = Math.max(1, Math.floor(dmg * st.tri.taken * (st.takenMul || 1)));
  if (boss) dmg = Math.floor(dmg * 1.18);
  if (state.combat.ward > 0) {
    dmg = Math.floor(dmg * 0.72);
    state.combat.ward -= 1;
    combatLog(state, "Tide ward takes the edge off.");
  }
  if (st.style === "weave") {
    const sp = CONTENT.spells.find((s) => s.id === state.combat.spell);
    if (sp?.tag === "water") dmg = Math.floor(dmg * 0.9);
  }

  const specialNotes = [];
  if (m.special === "burst" && Math.random() < (boss ? 0.28 : 0.2)) {
    dmg = Math.floor(dmg * (m.burstMul || 2.35) + (m.maxHit * 0.4));
    specialNotes.push("BURST");
  }
  if (m.special === "drain" && Math.random() < 0.32) {
    const steal = Math.max(3, Math.floor(dmg * 0.45));
    dmg += steal;
    state.combat.vow = Math.max(0, state.combat.vow - (12 + Math.floor(m.maxHit * 0.6)));
    state.combat.eatWound = Math.max(state.combat.eatWound || 0, 2);
    if (state.combat.vow <= 0 && state.combat.prayers.length) {
      state.combat.prayers = [];
      combatLog(state, "Drain snuffs your vows.");
    }
    specialNotes.push(`drain +${steal} (vow thins, food weakens)`);
  }
  if (m.special === "poison" && Math.random() < 0.38) {
    state.combat.poison = Math.min(12, (state.combat.poison || 0) + 4);
    state.combat.nextPoisonAt = now + 400;
    specialNotes.push(`poison ${state.combat.poison}`);
  }

  state.combat.hp -= dmg;
  const spec = specialNotes.length ? ` ${specialNotes.join(", ")}` : "";
  combatLog(state, `${m.name} hits you for ${dmg}${triTag(st.tri.edge)}${spec}.`);
  if (state.combat.hp <= 0) {
    die(state);
    return;
  }
  if (w?.special === "riposte" && Math.random() < 0.32) riposte(state, m, st, "afterblow");
}

function kill(state, m) {
  state.stats.kills += 1;
  state.combat.kills[m.id] = (state.combat.kills[m.id] || 0) + 1;
  grantKillXp(state, m);
  addXp(state, "bounty", 6 + m.slayerReq * 0.2);
  state.skills.bounty.actions += 1;
  bumpGuild(state, "bounty");
  for (const d of m.drops) {
    if (Math.random() < d.chance * (1 + (chartBonuses(state).rare || 0))) {
      stashItem(state, d.item, d.min + Math.floor(Math.random() * (d.max - d.min + 1)), "kill drop");
    }
  }
  if (m.unique && Math.random() < m.unique.chance) {
    stashItem(state, m.unique.item, 1, "unique drop");
    log(state, `Unique: ${CONTENT.items[m.unique.item]?.name}`);
  }
  if (state.bounty.monsterId === m.id) {
    state.bounty.have += 1;
    if (state.bounty.have >= state.bounty.need) {
      const tokens = 2 + Math.floor(state.bounty.streak / 3);
      stashItem(state, "bounty-token", tokens, "bounty");
      stashItem(state, "coins", 40 + m.slayerReq * 3, "bounty");
      state.bounty.streak += 1;
      state.quests.stats.bounties += 1;
      log(state, `Bounty complete. +${tokens} tokens.`);
      rollBounty(state);
    }
  }
  log(state, `${m.name} falls.`);
  combatLog(state, `${m.name} falls.`);
  checkQuests(state);
  rollCombatPet(state);

  if (state.combat.dungeon) {
    const d = CONTENT.dungeons.find((x) => x.id === state.combat.dungeon);
    if (!d?.sequence) {
      log(state, "The dungeon ledger is missing. The hunt ends.");
      stopFight(state, "clear");
      return;
    }
    state.combat.dungeonIndex += 1;
    if (state.combat.dungeonIndex >= d.sequence.length) {
      stashItem(state, d.reward.item, d.reward.qty, "dungeon reward");
      stashItem(state, "bounty-token", d.tokens, "dungeon tokens");
      stashItem(state, "dungeon-key", 1, "dungeon key");
      log(state, `${d.name} cleared. The line held.`);
      combatLog(state, `${d.name} cleared.`);
      state.combat.dungeonClears = state.combat.dungeonClears || {};
      state.combat.dungeonClears[d.id] = (state.combat.dungeonClears[d.id] || 0) + 1;
      stopFight(state, "clear");
      checkQuests(state);
      return;
    }
    const nextId = d.sequence[state.combat.dungeonIndex];
    const boss = state.combat.dungeonIndex === d.sequence.length - 1;
    startFight(state, nextId, { dungeon: true, chain: true, boss });
    return;
  }
  startFight(state, m.id, { respawn: true });
}

function die(state) {
  state.stats.deaths += 1;
  const tax = Math.max(3, Math.floor(state.coins * 0.12));
  if (state.coins >= tax) {
    state.coins -= tax;
    log(state, `Death tax: ${tax} veilmarks. The citadel is not a charity.`);
  }
  state.combat.hp = Math.max(1, Math.floor(state.combat.maxHp * 0.35));
  const d = CONTENT.dungeons.find((x) => x.id === state.combat.dungeon);
  if (d) {
    const floor = (state.combat.dungeonIndex || 0) + 1;
    log(state, `You fall on ${d.name} floor ${floor}/${d.sequence.length}. The run is dust.`);
    combatLog(state, `Death — ${d.name} reset.`);
    state.combat.dungeonDeaths = (state.combat.dungeonDeaths || 0) + 1;
  } else {
    log(state, "You fall. The citadel drags you back.");
    combatLog(state, "You fall.");
  }
  state.combat.poison = 0;
  state.combat.bleed = 0;
  state.combat.shred = 0;
  state.combat.eatWound = 0;
  stopFight(state, "death");
}

function autoEat(state) {
  const th = state.combat.autoEat;
  if (state.combat.hp > state.combat.maxHp * th) return;
  const ids = [state.combat.foodId, state.combat.foodId2].filter(Boolean);
  let food = ids.find((id) => bankCount(state, id) > 0);
  if (!food) {
    const now = state.now || 0;
    if (now >= (state.combat.dryUntil || 0)) dryLog(state, "No food left on either pipe. Auto-eat has nothing.");
    return;
  }
  const it = CONTENT.items[food];
  if (!it?.heal) return;
  if (!takeItem(state, food, 1)) return;
  let heal = it.heal;
  if (state.shopBought["shop-eat2"]) heal = Math.floor(heal * 1.08);
  heal = Math.floor(heal * (1 + (potionStats(state).eatBoost || 0)));
  if (state.combat.eatWound > 0) {
    heal = Math.floor(heal * 0.55);
    state.combat.eatWound -= 1;
    combatLog(state, `Auto-eat ${it.name} +${heal} (drain-sick).`);
  }
  state.combat.hp = Math.min(state.combat.maxHp, state.combat.hp + heal);
}

function combatLog(state, msg) {
  state._clog = state._clog || [];
  state._clog.unshift(msg);
  if (state._clog.length > 14) state._clog.pop();
  const m = /for (\d+)/.exec(msg);
  if (m) {
    state._floaters = state._floaters || [];
    const foeHit = /hits you/.test(msg);
    state._floaters.push({ n: m[1], foe: foeHit, id: (state._floaterSeq = (state._floaterSeq || 0) + 1) });
    if (state._floaters.length > 8) state._floaters.shift();
  }
}

export function consumePotionCharge(state) {
  if (!state.combat.potionId || state.combat.potionCharges <= 0) return;
  state.combat.potionCharges -= 1;
  if (state.combat.potionCharges <= 0) {
    log(state, `${CONTENT.items[state.combat.potionId].name} empty.`);
    state.combat.potionId = null;
  }
}

export function drinkPotion(state, id) {
  const it = CONTENT.items[id];
  if (!it?.potion) return "Not a draught.";
  if (!takeItem(state, id, 1)) return "None left.";
  state.combat.potionId = id;
  state.combat.potionCharges = it.charges;
  return null;
}

export function equipItem(state, id) {
  const it = CONTENT.items[id];
  if (!it || it.category !== "equipment" && it.category !== "ammo" && it.category !== "tool") return "Cannot equip.";
  if (it.category === "tool") {
    const slot = it.toolSlot;
    if (!slot) return "Cannot equip.";
    if (state.tools[slot] === id) return null;
    if (!bankCount(state, id)) return "Not in bank.";
    const prev = state.tools[slot];
    if (prev) {
      const parked = addItem(state, prev, 1);
      if (!parked) return "Vault full — free a stack before swapping tools.";
    }
    if (!takeItem(state, id, 1)) {
      if (prev) takeItem(state, prev, 1);
      return "Not in bank.";
    }
    state.tools[slot] = id;
    return null;
  }
  const slot = it.slot;
  if (state.equipment[slot] === id) return null;
  if (!bankCount(state, id)) return "Not in bank.";
  const prev = state.equipment[slot];
  if (prev) {
    const parked = addItem(state, prev, 1);
    if (!parked) return "Vault full — free a stack before swapping kit.";
  }
  if (!takeItem(state, id, 1)) {
    if (prev) takeItem(state, prev, 1);
    return "Not in bank.";
  }
  state.equipment[slot] = id;
  recalcHp(state);
  return null;
}

export function unequip(state, slot) {
  if (state.tools && slot in state.tools) {
    const id = state.tools[slot];
    if (!id) return null;
    if (!addItem(state, id, 1)) return "Vault full — free a stack before unequipping.";
    state.tools[slot] = null;
    return null;
  }
  const id = state.equipment[slot];
  if (!id) return null;
  if (!addItem(state, id, 1)) return "Vault full — free a stack before unequipping.";
  state.equipment[slot] = null;
  recalcHp(state);
  return null;
}

function grantKillXp(state, m) {
  const skill = styleOf(state);
  const pet = 1 + petBonuses(state, skill).xp;
  const ups = addXp(state, skill, (m.xp[skill] || 8) * 3 * pet);
  addXp(state, "vitality", (m.xp.vitality || 4) * 2);
  addXp(state, "guard", Math.floor((m.xp.guard || 4) * 0.7));
  state.skills[skill].actions += 1;
  bumpGuild(state, skill);
  const sp = CONTENT.spells.find((s) => s.id === state.combat.spell);
  if (sp && skill === "weave") addXp(state, "weave", sp.xp);
  ups.forEach((n) => log(state, `Level up: ${n}`));
}

function bumpGuild(state, skill) {
  const sk = state.skills[skill];
  if (!sk) return;
  sk.guildProgress += 1;
  const next = (CONTENT.guildTasks[skill] || [])[sk.guildRank];
  if (next && sk.guildProgress >= next.need) {
    sk.guildRank += 1;
    log(state, `${next.name} complete.`);
    state.quests.stats.guildMax = Math.max(state.quests.stats.guildMax, sk.guildRank);
  }
}

export function rollBounty(state) {
  const had = state.bounty?.monsterId;
  if (had) {
    if (!takeItem(state, "bounty-token", 1)) return "Rerolling a live contract costs 1 bounty token.";
  }
  const blocked = new Set(state.bounty?.block || []);
  if (had) blocked.add(had);
  const lvl = skillLevel(state, "bounty");
  const pool = Object.values(CONTENT.monsters).filter((m) => !m.dungeonOnly && m.slayerReq <= lvl + 8 && !blocked.has(m.id));
  const pickFrom = pool.length ? pool : Object.values(CONTENT.monsters).filter((m) => !m.dungeonOnly && m.slayerReq <= lvl + 8);
  if (!pickFrom.length) return "No contracts in range.";
  const m = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  state.bounty = {
    monsterId: m.id,
    need: 8 + Math.floor(Math.random() * 18),
    have: 0,
    streak: state.bounty.streak || 0,
    block: [...blocked].slice(-5)
  };
  return null;
}

export function swapWeaponStyle(state, style) {
  const held = state.equipment.weapon;
  const pool = Object.keys(state.bank).concat(held ? [held] : []);
  const best = pool
    .map((id) => CONTENT.items[id])
    .filter((it) => it?.slot === "weapon" && it.style === style)
    .sort((a, b) => statScore(b) - statScore(a))[0];
  if (!best) return `No ${style} weapon in vault or hand.`;
  if (held === best.id) {
    state.combat.style = style;
    combatLog(state, `Already holding ${best.name}.`);
    return null;
  }
  const err = equipItem(state, best.id);
  if (!err) combatLog(state, `Swapped to ${best.name} (${style}) mid-fight.`);
  return err;
}

function statScore(it) {
  const s = it.stats || {};
  return (s.acc || 0) + (s.str || 0) + (s.ranged || 0) + (s.magic || 0) + (s.def || 0);
}

export function buryBones(state) {
  const n = bankCount(state, "bones");
  if (!n) return "No bones.";
  takeItem(state, "bones", n);
  const notes = addXp(state, "vow", n * 8);
  const restore = Math.min(state.combat.maxVow, 16 + n * 3);
  state.combat.vow = Math.min(state.combat.maxVow, state.combat.vow + restore);
  const capGain = Math.min(24, Math.floor(n / 4));
  state.combat.maxVow = Math.min(MAX_VOW_CAP, (state.combat.maxVow || 100) + capGain);
  state.combat.vow = Math.min(state.combat.maxVow, state.combat.vow);
  log(state, `Buried ${n} bones. Vow +${restore}, cap ${state.combat.maxVow}.`);
  notes.forEach((x) => log(state, `Level up: ${x}`));
  return null;
}

function rollCombatPet(state) {
  const style = styleOf(state);
  const pet = CONTENT.pets.find((p) => p.skill === style);
  if (!pet || state.pets[pet.id]) return;
  if (Math.random() < pet.chance) {
    state.pets[pet.id] = true;
    log(state, `Pet found: ${pet.name}`);
  }
}
