import { CONTENT, skillLevel, addXp, addItem, takeItem, bankCount, log, sumGear, recalcHp, guildBonuses, courseBonuses, chartBonuses, potionStats, petBonuses, stashItem, skillLocked, lockMessage, XP_TABLE } from "./state.js";
import { checkQuests } from "./quests.js";
import { noteMonster, noteDungeon, notePet } from "./logbook.js";
import { mechanicOf, restoreMech } from "../content/mechanics.js";
import { gradeKill } from "./deeds.js";
import { echoMonster } from "../content/catalog.js";
import { rarityOf } from "../content/rarity.js";
import { weeklyEclipse } from "./eclipse.js";
import { autoEatFinest, ensureOrders, orderUnlocked } from "./orders.js";

const PRAYER_CAP = 2;
const MAX_VOW_CAP = 260;
const SHRED_MAX = 6;
const BLEED_TICK_MS = 650;
const POISON_TICK_MS = 700;
const DRY_LOG_MS = 2500;

const STYLE_BEATS = { might: "mark", mark: "weave", weave: "might" };

/* Every fight starts with a clean mechanic slate: no inherited telegraphs,
   no stale curse, no boss flags bleeding across floors or respawns. */
function resetMechanicState(state) {
  const c = state.combat;
  c.curse = 0;
  c.curseUntil = 0;
  c.takenMul = 1;
  c.phased = false;
  c.enraged = false;
  c.guardUntil = 0;
  c.guardStyle = null;
  c.addHits = 0;
  c.telegraph = null;
  c.nextMechAt = 0;
  c.burstWind = false;
  c.riposteArmed = false;
  c.braceLogged = false;
  c.braceAt = 0;
  c.curseBraced = false;
}

export function startFight(state, monsterId, opts = {}) {
  let m = CONTENT.monsters[monsterId];
  if (!m && String(monsterId).startsWith("echo-")) {
    const depth = Number(String(monsterId).slice(5)) || 0;
    m = stampEcho(state, depth);
  }
  if (!m) return "No such foe.";
  if (m.dungeonOnly && !opts.dungeon) return "That closer only exists inside its dungeon.";
  if (!state.equipment.weapon) return "Equip a weapon.";
  const heldStyle = CONTENT.items[state.equipment.weapon]?.style;
  if (heldStyle && skillLocked(state, heldStyle) && !opts.respawn && !opts.chain) {
    return lockMessage(skillLocked(state, heldStyle));
  }
  if ((m.slayerReq || 0) > skillLevel(state, "bounty") && !opts.dungeon && !opts.respawn && !opts.chain) {
    return `Slayer ${m.slayerReq} required (Bounty skill).`;
  }
  const foodN = bankCount(state, state.combat.foodId) + bankCount(state, state.combat.foodId2);
  const heal = Math.max(CONTENT.items[state.combat.foodId]?.heal || 0, CONTENT.items[state.combat.foodId2]?.heal || 0);
  if (m.maxHit >= state.combat.maxHp * 0.6) {
    combatLog(state, `Danger: ${m.name} can chunk ${m.maxHit} of your ${state.combat.maxHp} HP.`);
  }
  if (foodN * heal < m.maxHit * 3) {
    log(state, `${m.name} outpaces your larder (${foodN} food). Cook, or pick a weaker dock rat.`);
  }
  restoreMech(m); // undo any mechanic stat mutation left on this catalog foe
  resetMechanicState(state);
  state.action = null;
  state.combat.fighting = true;
  state.combat.monsterId = monsterId;
  let hp = m.hp;
  if (opts.dungeon && opts.boss) hp = Math.floor(hp * 1.45);
  state.combat.monsterHp = hp;
  state.combat.monsterMaxHp = hp;
  state.combat.area = m.area;
  state.combat.shred = opts.chain ? (state.combat.shred || 0) : 0;
  state.combat.bleed = 0;
  state.combat.nextBleedAt = 0;
  state.combat.dryUntil = 0;
  if (!opts.chain) state.combat.ward = 0;
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
    state.combat.fightStarted = now;
    state.combat.foodUsed = 0;
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
    return `Need Might, Mark, or Weave at ${d.req}.`;
  }
  if (d.infinite) {
    state.combat.echoDepth = 0;
    stampEcho(state, 0);
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

function stampEcho(state, depth) {
  const m = echoMonster(depth);
  const proto = CONTENT.monsters["echo-0"];
  if (proto?.model) m.model = { ...proto.model, eid: "echo-0" };
  CONTENT.monsters[m.id] = m;
  return m;
}

export function stopFight(state, reason = "abandon") {
  if (state.combat.dungeon && reason === "abandon") log(state, "Dungeon run abandoned. Progress lost.");
  restoreMech(CONTENT.monsters[state.combat.monsterId]);
  resetMechanicState(state);
  state.combat.fighting = false;
  state.combat.monsterId = null;
  state.combat.dungeon = null;
  state.combat.dungeonIndex = 0;
  state.combat.shred = 0;
  state.combat.bleed = 0;
  state.combat.ward = 0;
  state.combat.poison = 0;
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
  decayCurse(state, now);
  clampPrayers(state);
  autoEat(state);
  regenVow(state, ms);
  tickBleed(state, now);
  tickPoison(state, now);
  autoEat(state, { after: true });
  if (!state.combat.fighting) return;
  if (now >= (state.combat.stunUntil || 0) && now >= state.combat.nextHitAt) {
    playerHit(state);
    if (!state.combat.fighting) return;
    state.combat.nextHitAt = now + playerInterval(state);
  }
  tickMechanic(state, now);
  if (state.combat.burstWind && state.combat.fighting) braceForBurst(state, now);
  if (now >= state.combat.enemyNextAt && state.combat.fighting) {
    enemyHit(state);
    const m = CONTENT.monsters[state.combat.monsterId];
    if (m && state.combat.fighting) state.combat.enemyNextAt = now + m.interval;
    if (state.combat.addHits > 0 && state.combat.fighting) {
      state.combat.addHits -= 1;
      let add = Math.max(1, Math.floor((m?.maxHit || 4) * 0.35));
      add = Math.floor(add * curseTaken(state, now));
      const fromFull = state.combat.hp >= state.combat.maxHp;
      if (fromFull && add >= state.combat.hp) add = Math.max(1, state.combat.hp - 1); // adds obey held-the-line mercy
      state.combat.hp -= add;
      combatLog(state, `A remnant add nicks you for ${add}.`, { dmg: add, foeHit: true });
      autoEat(state, { after: true, force: state.combat.hp <= 0 });
      if (state.combat.hp <= 0) die(state);
    }
  }
}

/* A curse is a timed wound, not a permanent tax. */
function decayCurse(state, now) {
  const c = state.combat;
  if ((c.curseUntil || 0) > 0 && now >= c.curseUntil) {
    c.curse = 0;
    c.curseUntil = 0;
    c.takenMul = 1;
    if (c.curseBraced) {
      c.curseBraced = false;
      log(state, "Your draught burned the curse off early.");
    } else {
      combatLog(state, "The curse fades.");
    }
  }
}

function curseTaken(state, now) {
  return (state.combat.curseUntil || 0) > now ? (state.combat.takenMul || 1) : 1;
}

function braceForBurst(state, now) {
  if (!state.combat.braceLogged) {
    state.combat.braceLogged = true;
    combatLog(state, "It coils — auto-eat braces for the burst.");
  }
  /* Pace the brace: one ration per beat, not the whole larder in a blink. */
  if (now < (state.combat.braceAt || 0)) return;
  state.combat.braceAt = now + 700;
  autoEat(state, { brace: true });
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
  const setBonus = 1 + gearSetBonus(state);
  return {
    style,
    acc: acc * accMul * tri.acc,
    power: Math.max(1, power) * pwrMul * tri.dmg * setBonus,
    def: def * defMul,
    takenMul: ps.takenMul || 1,
    setBonus,
    ps, pot, cb, ch, tri
  };
}

function gearSetBonus(state) {
  return gearSetInfo(state).ratio;
}

export function gearSetInfo(state) {
  const counts = {};
  for (const slot of Object.keys(state.equipment || {})) {
    const it = CONTENT.items[state.equipment[slot]];
    if (it?.tier == null) continue;
    const key = `${it.tier}:${it.style || "plate"}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  let best = 0;
  let bestKey = null;
  for (const [k, n] of Object.entries(counts)) {
    if (n > best) {
      best = n;
      bestKey = k;
    }
  }
  const ratio = best >= 6 ? 0.2 : best >= 4 ? 0.15 : best >= 3 ? 0.08 : 0;
  const tier = bestKey ? Number(bestKey.split(":")[0]) : 0;
  const names = ["Drift", "Copper", "Iron", "Steel", "Moonsteel", "Adamant", "Runebound", "Wyrm", "Ancient", "Celestial", "Voidglass", "Mythic", "Astral", "Veilborn"];
  const nm = names[tier] || "Set";
  const pct = Math.round(ratio * 100);
  const label = pct
    ? `${nm} set ${best}/6 — +${pct}% power`
    : `${best}/6 matching pieces — wear 3 of one tier for a set bonus`;
  return { count: best, ratio, pct, name: nm, label };
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

function tickMechanic(state, now) {
  const m = CONTENT.monsters[state.combat.monsterId];
  const mech = mechanicOf(m);
  if (!mech || !state.combat.fighting) return;
  const cadence = mech.cadence || 9000;
  const telegraph = mech.telegraph || 1500;
  state.combat.nextMechAt = state.combat.nextMechAt || (now + cadence);
  if (!state.combat.telegraph && now >= state.combat.nextMechAt - telegraph && now < state.combat.nextMechAt) {
    state.combat.telegraph = mech.type || mech.kind;
    combatLog(state, `${m.name} ${mech.tell || "coils"}.`);
  }
  if (now >= state.combat.nextMechAt) {
    state.combat.telegraph = null;
    state.combat.nextMechAt = now + cadence;
    state._mechBraced = combatPotionLive(state);
    if (mech.type === "guard") state.combat.guardStyle = styleOf(state);
    if (typeof mech.apply === "function") mech.apply(state, m);
    state._mechBraced = false;
    if (mech.type === "phase" && (state.combat.monsterHp / (state.combat.monsterMaxHp || m.hp)) <= 0.5) {
      mech.apply(state, m);
    }
    if (mech.type === "enrage" && (now - (state.combat.fightStarted || 0)) >= (mech.atMs || 180000)) {
      mech.apply(state, m);
    }
  }
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

  if (!echoFollow) consumePotionCharge(state, "hit");

  let eva = m.eva * (1 - (state.combat.shred || 0) * 0.08);
  let ignoreDef = 0;
  if (w?.special === "pierce") {
    eva *= 0.55;
    ignoreDef = 0.45;
  }
  const sp = CONTENT.spells.find((s) => s.id === state.combat.spell);
  if (st.style === "weave" && sp?.tag === "void") ignoreDef = Math.max(ignoreDef, 0.2);

  let specFired = false;
  if (!echoFollow && state.combat.useSpec !== false && (state.combat.spec || 0) >= 50) {
    state.combat.spec -= 50;
    specFired = true;
    const specName = w?.special || "surge";
    if (specName === "pierce") ignoreDef = Math.max(ignoreDef, 0.7);
    if (specName === "riposte") state.combat.riposteArmed = true;
    if (specName === "shred") state.combat.shred = Math.min(SHRED_MAX, (state.combat.shred || 0) + 2);
    if (specName === "bleed") {
      state.combat.bleed = Math.min(8, (state.combat.bleed || 0) + 3);
      state.combat.nextBleedAt = now + BLEED_TICK_MS;
    }
  } else if (!echoFollow) {
    state.combat.spec = Math.min(100, (state.combat.spec || 0) + 14);
  }

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
  if ((state.combat.guardUntil || 0) > now && styleOf(state) === state.combat.guardStyle) {
    dmg = Math.max(1, Math.floor(dmg * 0.5));
    notes.push("veilward");
  }
  const specName = w?.special;
  if (specFired) notes.push(`special: ${specName || "surge"}`);
  if (specName === "pierce" && specFired) dmg = Math.floor(dmg * 1.25);
  if (specName === "shred" && !specFired) {
    state.combat.shred = Math.min(SHRED_MAX, (state.combat.shred || 0) + 1);
    notes.push(`shred ${state.combat.shred}`);
  }
  if (specName === "bleed" && !specFired && Math.random() < 0.42) {
    state.combat.bleed = Math.min(8, (state.combat.bleed || 0) + 2);
    state.combat.nextBleedAt = now + BLEED_TICK_MS;
    notes.push(`bleed ${state.combat.bleed}`);
  }
  if (specName === "echo" && specFired) {
    notes.push("echo");
    combatLog(state, "Special — echo (spends ammo/runes).");
    playerHit(state, false);
    if (!state.combat.fighting) return;
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
  if (st.style === "weave" && (sp?.tag === "water" || sp?.tag === "ward")) {
    state.combat.ward = Math.min(3, (state.combat.ward || 0) + 1);
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
  combatLog(state, `${echoFollow ? "Echo hits" : "Hit"} ${m.name} for ${dmg}${triTag(st.tri.edge)}${extra}.`, { dmg, foeHit: false });

  if (state.combat.monsterHp <= 0) kill(state, m);
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
  combatLog(state, `Bleed ticks ${dmg} on ${m.name}.`, { dmg, foeHit: false });
  if (state.combat.monsterHp <= 0) kill(state, m);
}

function tickPoison(state, now) {
  if ((state.combat.poison || 0) <= 0) return;
  if (!state.combat.nextPoisonAt) state.combat.nextPoisonAt = now + POISON_TICK_MS;
  if (now < state.combat.nextPoisonAt) return;
  const m = CONTENT.monsters[state.combat.monsterId];
  const fromFull = state.combat.hp >= state.combat.maxHp;
  const bite = Math.max(2, 2 + Math.floor((m?.maxHit || 4) * 0.35) + Math.min(6, state.combat.poison));
  let dmg = bite;
  if (fromFull && dmg >= state.combat.hp) dmg = Math.max(1, state.combat.hp - 1);
  state._lastBlow = { kind: "poison", dmg, fromFull };
  state.combat.hp -= dmg;
  state.combat.poison -= 1;
  state.combat.nextPoisonAt = now + POISON_TICK_MS;
  combatLog(state, `Poison bites ${dmg} — food must keep up.`, { dmg, foeHit: true });
  autoEat(state, { after: true, force: state.combat.hp <= 0 });
  if (state.combat.hp <= 0) die(state);
}

function riposte(state, m, st, why) {
  const dmg = Math.max(1, Math.floor(st.power / 5));
  state.combat.monsterHp -= dmg;
  combatLog(state, `Riposte (${why}) ${dmg}.`, { dmg, foeHit: false });
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
    if (w?.special === "riposte" && (state.combat.riposteArmed || Math.random() < 0.4)) {
      state.combat.riposteArmed = false;
      riposte(state, m, st, "whiff");
    }
    return;
  }

  let dmg = 1 + Math.floor(Math.random() * m.maxHit);
  const cursed = (state.combat.curseUntil || 0) > now;
  dmg = Math.max(1, Math.floor(dmg * st.tri.taken * (st.takenMul || 1) * (cursed ? (state.combat.takenMul || 1) : 1)));
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
  let blowKind = "hit";
  if (m.special === "burst") {
    if (state.combat.burstWind) {
      state.combat.burstWind = false;
      const scale = Math.min(1, state.combat.maxHp / Math.max(8, m.maxHit * 2.2));
      dmg = Math.floor(dmg * (m.burstMul || 2.35) * scale + m.maxHit * 0.25 * scale);
      specialNotes.push("BURST");
      blowKind = "burst";
    } else if (Math.random() < (boss ? 0.28 : 0.2)) {
      state.combat.burstWind = true;
      combatLog(state, `${m.name} coils for a burst.`);
      return;
    }
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
    blowKind = "drain";
  }
  if (m.special === "poison" && Math.random() < 0.38) {
    state.combat.poison = Math.min(12, (state.combat.poison || 0) + 4);
    state.combat.nextPoisonAt = now + 400;
    specialNotes.push(`poison ${state.combat.poison}`);
  }

  const fromFull = state.combat.hp >= state.combat.maxHp;
  if (fromFull && dmg >= state.combat.hp) {
    dmg = Math.max(1, state.combat.hp - 1);
    specialNotes.push("held the line");
  }
  state._lastBlow = { kind: blowKind, dmg, fromFull, triangle: st.tri.edge, cursed };

  state.combat.hp -= dmg;
  const spec = specialNotes.length ? ` ${specialNotes.join(", ")}` : "";
  combatLog(state, `${m.name} hits you for ${dmg}${triTag(st.tri.edge)}${spec}.`, { dmg, foeHit: true });
  autoEat(state, { after: true, force: state.combat.hp <= 0 || state.combat.hp <= (m.maxHit + 1) });
  if (state.combat.hp <= 0) {
    const foodN = bankCount(state, state.combat.foodId) + bankCount(state, state.combat.foodId2);
    if (foodN <= 0) state._lastBlow = { ...(state._lastBlow || {}), kind: "starve" };
    die(state);
  }
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
      const qty = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      stashItem(state, d.item, qty, "kill drop");
      const rar = rarityOf(CONTENT.items[d.item] || d);
      state._pendingYield = state._pendingYield || [];
      state._dripTag = rar.id === "common" ? state._dripTag : rar.id;
    }
  }
  if (m.unique && Math.random() < m.unique.chance) {
    stashItem(state, m.unique.item, 1, "unique drop");
    log(state, `Unique: ${CONTENT.items[m.unique.item]?.name}`);
    state._dripTag = rarityOf(CONTENT.items[m.unique.item] || { rarity: "exotic" }).id;
  }
  noteMonster(state, m.id);
  gradeKill(state, m, {
    elapsedMs: (state.now || 0) - (state.combat.fightStarted || 0),
    foodUsed: state.combat.foodUsed || 0
  });
  if (state.bounty.monsterId === m.id) {
    state.bounty.have += 1;
    if (state.bounty.have >= state.bounty.need) {
      const tokens = 2 + Math.floor(state.bounty.streak / 3);
      stashItem(state, "bounty-token", tokens, "bounty");
      stashItem(state, "coins", 40 + m.slayerReq * 3, "bounty");
      state.bounty.streak += 1;
      state.quests.stats.bounties += 1;
      log(state, `Bounty complete. +${tokens} tokens.`);
      if (state.bounty.chain) {
        const chain = state.bounty.chain;
        chain.step += 1;
        if (chain.step >= chain.ids.length) {
          stashItem(state, "bounty-token", 25, "chain");
          state.bounty.chainsDone = (state.bounty.chainsDone || 0) + 1;
          log(state, "Chain complete. +25 tokens.");
          state.bounty.chain = null;
          rollBounty(state, { free: true });
        } else {
          const next = chain.ids[chain.step];
          state.bounty.monsterId = next;
          state.bounty.have = 0;
          state.bounty.need = 6 + chain.step * 4;
          log(state, `Chain ${chain.step + 1}/${chain.ids.length}: hunt ${CONTENT.monsters[next]?.name}.`);
        }
      } else {
        rollBounty(state, { free: true });
      }
    }
  }
  log(state, `${m.name} falls.`);
  combatLog(state, `${m.name} falls.`);
  state._killFlash = Date.now();
  checkQuests(state);
  rollCombatPet(state);

  if (state.combat.dungeon) {
    const d = CONTENT.dungeons.find((x) => x.id === state.combat.dungeon);
    if (!d?.sequence) {
      log(state, "The dungeon ledger is missing. The hunt ends.");
      stopFight(state, "clear");
      return;
    }
    if (d.infinite) {
      state.combat.echoDepth = (state.combat.echoDepth || 0) + 1;
      state.combat.echoBest = Math.max(state.combat.echoBest || 0, state.combat.echoDepth);
      const next = stampEcho(state, state.combat.echoDepth);
      startFight(state, next.id, { dungeon: true, chain: true, boss: true });
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
      noteDungeon(state, d.id);
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

export function deathTaxAmount(coins) {
  const n = Math.max(0, Number(coins) || 0);
  return Math.min(n, Math.max(3, Math.floor(n * 0.12)));
}

export function die(state) {
  state.stats.deaths += 1;
  const blow = state._lastBlow || {};
  if (blow.fromFull) state.stats.fullHpDeaths = (state.stats.fullHpDeaths || 0) + 1;
  const foe = CONTENT.monsters[state.combat.monsterId];
  const foodN = bankCount(state, state.combat.foodId) + bankCount(state, state.combat.foodId2);
  const tax = deathTaxAmount(state.coins);
  if (tax > 0) {
    state.coins -= tax;
    log(state, `Death tax: ${tax} veilmarks. The citadel is not a charity.`);
  } else {
    log(state, "Death tax: empty purse — nothing to take.");
  }
  if (state.rules?.mode === "hardcore") {
    for (const id of ["might", "mark", "weave", "guard", "vitality"]) {
      if (state.skills[id]) {
        state.skills[id].xp = XP_TABLE[1] || 0;
        state.skills[id].level = 1;
      }
    }
    log(state, "Hardcore: combat arts reset to 1.");
  }
  state.combat.hp = Math.max(1, Math.floor(state.combat.maxHp * 0.35));
  const tip = deathTip(blow);
  const d = CONTENT.dungeons.find((x) => x.id === state.combat.dungeon);
  const sheet = {
    dungeon: d ? d.name : null,
    floor: d ? (state.combat.dungeonIndex || 0) + 1 : null,
    of: d ? d.sequence.length : null,
    cleared: d ? (d.infinite ? (state.combat.echoDepth || 0) : (state.combat.dungeonIndex || 0)) : null,
    echo: d?.infinite ? state.combat.echoDepth || 0 : null,
    foe: foe?.name || "a foe",
    blow: blow.kind || "hit",
    triangle: blow.triangle || playerStats(state).tri?.edge,
    cursed: !!blow.cursed,
    food: foodN,
    fromFull: !!blow.fromFull,
    dmg: blow.dmg,
    tax,
    tip,
    t: Date.now()
  };
  if (d) {
    const floor = (state.combat.dungeonIndex || 0) + 1;
    log(state, `You fall on ${d.name} floor ${floor}/${d.sequence.length}. The run is dust.`);
    combatLog(state, `Death — ${d.name} reset.`);
    state.combat.dungeonDeaths = (state.combat.dungeonDeaths || 0) + 1;
  } else {
    log(state, "You fall. The citadel drags you back.");
    combatLog(state, "You fall.");
  }
  state._deathSheet = sheet;
  state.combat.poison = 0;
  state.combat.bleed = 0;
  state.combat.shred = 0;
  state.combat.eatWound = 0;
  state._uiDirty = true;
  stopFight(state, "death");
}

function deathTip(blow) {
  if (blow.kind === "burst") return "Burst special — bring Aegis Oath or tankier plate.";
  if (blow.kind === "poison") return "Poison tick — carry more food or a ward.";
  if (blow.kind === "drain") return "Drain thins vows and food. Eat earlier or swap style.";
  if (blow.kind === "starve") return "Dry larder — cook before you hunt.";
  if (blow.cursed) return "A dusk curse was riding you — a live draught burns it off early.";
  if (blow.triangle === "dis") return "You fought at a triangle disadvantage — swap style before the next hunt.";
  return "The hit landed. Food, triangle, or heavier plate next time.";
}

function autoEat(state, opts = {}) {
  const m = CONTENT.monsters[state.combat.monsterId];
  const lethal = m ? m.maxHit + 1 : 0;
  const thHp = state.combat.maxHp * (state.combat.autoEat || 0.5);
  /* Bracing for a telegraphed burst: top off toward 90%, nothing more. */
  if (opts.brace && !opts.force && state.combat.hp >= state.combat.maxHp * 0.9) return;
  const need = opts.force || opts.brace || state.combat.hp <= Math.max(thHp, lethal);
  if (!need) return;
  if (ensureOrders(state).eat !== false && orderUnlocked(state, "eat")) autoEatFinest(state);
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
  state.combat.foodUsed = (state.combat.foodUsed || 0) + 1;
  let heal = it.heal;
  const eclipse = weeklyEclipse(state.now || Date.now());
  if (eclipse.foodMul) heal = Math.max(1, Math.floor(heal * eclipse.foodMul));
  if (state.shopBought["shop-eat2"]) heal = Math.floor(heal * 1.08);
  heal = Math.floor(heal * (1 + (potionStats(state).eatBoost || 0)));
  if (state.combat.eatWound > 0) {
    heal = Math.floor(heal * 0.55);
    state.combat.eatWound -= 1;
    combatLog(state, `Auto-eat ${it.name} +${heal} (drain-sick).`);
  }
  state.combat.hp = Math.min(state.combat.maxHp, state.combat.hp + heal);
  if (opts.after && state.combat.hp <= lethal) autoEat(state, { force: true });
}

export function combatLog(state, msg, meta = null) {
  state._clog = state._clog || [];
  state._clog.unshift(msg);
  if (state._clog.length > 14) state._clog.pop();
  if (meta && meta.dmg != null) {
    state._floaters = state._floaters || [];
    state._floaters.push({ n: String(meta.dmg), foe: !!meta.foeHit, id: (state._floaterSeq = (state._floaterSeq || 0) + 1) });
    if (state._floaters.length > 8) state._floaters.shift();
  }
}

function combatPotionLive(state) {
  if (!state.combat.potionId || state.combat.potionCharges <= 0) return false;
  const pot = CONTENT.items[state.combat.potionId]?.potion || {};
  return ["accMul", "strMul", "rangedMul", "magicMul", "defMul", "eatBoost"].some((k) => k in pot);
}

export function consumePotionCharge(state, why = "any") {
  if (!state.combat.potionId || state.combat.potionCharges <= 0) return;
  const it = CONTENT.items[state.combat.potionId];
  const pot = it?.potion || {};
  const combatKeys = ["accMul", "strMul", "rangedMul", "magicMul", "defMul", "eatBoost"];
  const gatherKeys = ["speedMul", "rareMul"];
  const keys = Object.keys(pot);
  const isCombat = keys.some((k) => combatKeys.includes(k));
  const isGather = keys.some((k) => gatherKeys.includes(k));
  if (why === "hit" && !isCombat) return;
  if (why === "action" && !isGather) return;
  state.combat.potionCharges -= 1;
  if (state.combat.potionCharges <= 0) {
    log(state, `${it?.name || "Draught"} empty.`);
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
  if (slot === "weapon" && state.combat.fighting) return "Cannot sheathe mid-fight. Halt first.";
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
  bumpGuild(state, "vitality");
  bumpGuild(state, "guard");
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

export function rollBounty(state, opts = {}) {
  const had = state.bounty?.monsterId;
  if (had && !opts.free) {
    if (!takeItem(state, "bounty-token", 1)) return "Rerolling a live contract costs 1 bounty token.";
    state.bounty.streak = 0;
    state.bounty.chain = null;
  }
  const blocked = new Set(state.bounty?.block || []);
  if (had) blocked.add(had);
  const lvl = skillLevel(state, "bounty");
  const pool = Object.values(CONTENT.monsters).filter((m) => !m.dungeonOnly && !m.echo && m.slayerReq <= lvl + 8 && !blocked.has(m.id));
  const pickFrom = pool.length ? pool : Object.values(CONTENT.monsters).filter((m) => !m.dungeonOnly && !m.echo && m.slayerReq <= lvl + 8);
  if (!pickFrom.length) return "No contracts in range.";
  const wantChain = Math.random() < 0.1 || opts.forceChain;
  if (wantChain) {
    const sorted = [...pickFrom].sort((a, b) => a.slayerReq - b.slayerReq);
    const a = sorted[0];
    const b = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length / 2))];
    const c = sorted[sorted.length - 1];
    const elite = ensureElite(c);
    state.bounty = {
      monsterId: a.id,
      need: 8,
      have: 0,
      streak: state.bounty.streak || 0,
      block: [...blocked].slice(-5),
      chain: { ids: [a.id, b.id, elite.id], step: 0 },
      chainsDone: state.bounty.chainsDone || 0
    };
    return null;
  }
  const m = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  state.bounty = {
    monsterId: m.id,
    need: 8 + Math.floor(Math.random() * 18),
    have: 0,
    streak: state.bounty.streak || 0,
    block: [...blocked].slice(-5),
    chain: null,
    chainsDone: state.bounty.chainsDone || 0
  };
  return null;
}

function ensureElite(base) {
  const id = "elite-" + base.id;
  if (!CONTENT.monsters[id]) {
    CONTENT.monsters[id] = {
      ...base,
      id,
      name: "Elite " + (base.catalogName || base.name),
      hp: Math.floor(base.hp * 1.35),
      maxHit: base.maxHit + 2,
      acc: Math.floor(base.acc * 1.2),
      dungeonOnly: false,
      fieldBoss: true,
      model: base.model
    };
  }
  return CONTENT.monsters[id];
}

export function swapWeaponStyle(state, style) {
  if (skillLocked(state, style)) return lockMessage(skillLocked(state, style));
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
  checkQuests(state);
  return null;
}

function rollCombatPet(state) {
  const skills = [styleOf(state), "guard", "vitality", "vow", "bounty"];
  for (const skill of skills) {
    const pet = CONTENT.pets.find((p) => p.skill === skill);
    if (!pet || state.pets[pet.id]) continue;
    if (Math.random() < pet.chance) {
      state.pets[pet.id] = true;
      notePet(state, pet.id);
      log(state, `Pet found: ${pet.name}`);
    }
  }
}
