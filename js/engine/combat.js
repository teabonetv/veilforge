import { CONTENT, skillLevel, addXp, addItem, takeItem, bankCount, log, sumGear, recalcHp, guildBonuses, courseBonuses, chartBonuses, potionStats, petBonuses } from "./state.js";
import { checkQuests } from "./quests.js";

export function startFight(state, monsterId, opts = {}) {
  const m = CONTENT.monsters[monsterId];
  if (!m) return "No such foe.";
  if (!state.equipment.weapon) return "Equip a weapon.";
  state.action = null;
  state.combat.fighting = true;
  state.combat.monsterId = monsterId;
  state.combat.monsterHp = m.hp;
  state.combat.area = m.area;
  const now = state.now || 0;
  state.combat.nextHitAt = now + playerInterval(state);
  state.combat.enemyNextAt = now + m.interval;
  if (!opts.dungeon) state.combat.dungeon = null;
  return null;
}

export function startDungeon(state, dungeonId) {
  const d = CONTENT.dungeons.find((x) => x.id === dungeonId);
  if (!d) return "Unknown dungeon.";
  if (Math.max(skillLevel(state, "might"), skillLevel(state, "mark"), skillLevel(state, "weave")) < d.req) {
    return `Need a combat art at ${d.req}.`;
  }
  state.combat.dungeon = dungeonId;
  state.combat.dungeonIndex = 0;
  return startFight(state, d.sequence[0], { dungeon: true });
}

export function stopFight(state) {
  if (state.combat.dungeon) log(state, "Dungeon run abandoned.");
  state.combat.fighting = false;
  state.combat.monsterId = null;
  state.combat.dungeon = null;
  state.combat.dungeonIndex = 0;
}

export function playerInterval(state) {
  const w = CONTENT.items[state.equipment.weapon];
  let iv = w?.interval || 2400;
  const pot = potionStats(state);
  iv /= (pot.speedMul || 1);
  return iv;
}

export function combatTick(state, ms) {
  const now = state.now || 0;
  if (state.combat.stunUntil > now) return;
  autoEat(state);
  regenVow(state, ms);
  if (now >= state.combat.nextHitAt) {
    playerHit(state);
    state.combat.nextHitAt = now + playerInterval(state);
  }
  if (now >= state.combat.enemyNextAt && state.combat.fighting) {
    enemyHit(state);
    const m = CONTENT.monsters[state.combat.monsterId];
    if (m) state.combat.enemyNextAt = now + m.interval;
  }
  if (state.combat.poison > 0 && Math.random() < 0.02) {
    state.combat.hp -= 1;
    state.combat.poison -= 1;
    if (state.combat.hp <= 0) die(state);
  }
}

function regenVow(state, ms) {
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
    log(state, "Vows guttered. Prayers dropped.");
  }
}

function prayerStats(state) {
  const acc = {};
  for (const id of state.combat.prayers) {
    const p = CONTENT.prayers.find((x) => x.id === id);
    if (!p) continue;
    for (const [k, v] of Object.entries(p.stats)) {
      if (typeof v === "number") acc[k] = (acc[k] || (k.endsWith("Mul") ? 1 : 0)) * (k.endsWith("Mul") ? v : 1) + (k.endsWith("Mul") ? 0 : v);
      else acc[k] = v;
    }
  }
  // fix multiplicative stacking
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

function triangleMod(pStyle, eStyle, extra) {
  const beats = { might: "mark", mark: "weave", weave: "might" };
  let m = 1;
  if (beats[pStyle] === eStyle) m += 0.1 + (extra || 0);
  if (beats[eStyle] === pStyle) m -= 0.1 + (extra || 0) * 0.5;
  return m;
}

export function playerStats(state) {
  const style = styleOf(state);
  const ps = prayerStats(state);
  const pot = potionStats(state);
  const cb = courseBonuses(state);
  const ch = chartBonuses(state);
  const gb = guildBonuses(state, style);
  const acc = 8 + skillLevel(state, style === "might" ? "might" : style) + sumGear(state, "acc") + (gb.acc || 0) * 100;
  let power = 0;
  if (style === "might") power += skillLevel(state, "might") + sumGear(state, "str");
  if (style === "mark") power += skillLevel(state, "mark") + sumGear(state, "ranged") + (CONTENT.items[state.equipment.ammo]?.stats?.ranged || 0);
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
  return { style, acc: acc * accMul, power: Math.max(1, power) * pwrMul, def: def * defMul, ps, pot, cb, ch };
}

function hitChance(att, eva) {
  const p = att / (att + eva + 8);
  return Math.min(0.95, Math.max(0.15, p));
}

function playerHit(state) {
  const m = CONTENT.monsters[state.combat.monsterId];
  if (!m) return;
  const st = playerStats(state);
  const w = CONTENT.items[state.equipment.weapon];
  if (st.style === "mark") {
    const ammo = state.equipment.ammo;
    if (!ammo || bankCount(state, ammo) < 1) {
      log(state, "No ammo. Mark falls silent.");
      return;
    }
    const preserve = (st.ch.preserveAmmo || 0) + (w?.special === "pierce" ? 0.08 : 0);
    if (Math.random() > preserve) takeItem(state, ammo, 1);
  }
  if (st.style === "weave") {
    const sp = CONTENT.spells.find((s) => s.id === state.combat.spell);
    if (!sp) return;
    if (skillLevel(state, "weave") < sp.level) return;
    const preserve = (st.ps.preserveRune || 0) + (st.ch.preserveRune || 0) + (w?.special === "echo" ? 0.08 : 0);
    for (const [rune, qty] of Object.entries(sp.runes)) {
      if (Math.random() > preserve) {
        if (!takeItem(state, rune, qty)) {
          log(state, "Out of runes.");
          return;
        }
      }
    }
  }
  consumePotionCharge(state);
  const tri = triangleMod(st.style, m.style, st.ps.triangle || 0);
  const chance = hitChance(st.acc * tri, m.eva);
  if (Math.random() > chance) {
    combatLog(state, "You miss.");
    return;
  }
  let maxHit = Math.max(1, Math.floor((st.power / 4) * tri));
  if (st.style === "weave") {
    const sp = CONTENT.spells.find((s) => s.id === state.combat.spell);
    if (sp?.tag === "void") maxHit = Math.floor(maxHit * 1.12);
    if (sp?.tag === "veil") maxHit = Math.floor(maxHit * 1.18);
  }
  if (w?.special === "shred") maxHit = Math.floor(maxHit * 1.15);
  if (state.combat.dungeon && st.ps.smite) maxHit = Math.floor(maxHit * (1 + st.ps.smite));
  let dmg = 1 + Math.floor(Math.random() * maxHit);
  if (w?.special === "bleed" && Math.random() < 0.25) dmg += 2 + Math.floor(m.hp * 0.03);
  if (w?.special === "echo" && Math.random() < 0.2) dmg = Math.floor(dmg * 1.35);
  if (w?.special === "pierce" && Math.random() < 0.18) dmg = Math.floor(dmg * 1.25);
  if (w?.special === "riposte") { /* applied on enemy hit */ }
  const sp = CONTENT.spells.find((s) => s.id === state.combat.spell);
  if (st.style === "weave" && sp?.tag === "star") dmg += Math.floor(dmg * 0.4 * Math.random());
  dmg = Math.max(1, dmg);
  state.combat.monsterHp -= dmg;
  if (st.style === "weave" && sp?.tag === "blood") {
    state.combat.hp = Math.min(state.combat.maxHp, state.combat.hp + Math.ceil(dmg * 0.15));
  }
  if (st.ps.leech || st.cb.leech) {
    state.combat.hp = Math.min(state.combat.maxHp, state.combat.hp + Math.ceil(dmg * ((st.ps.leech || 0) + (st.cb.leech || 0))));
  }
  combatLog(state, `Hit ${m.name} for ${dmg}.`);
  const skill = st.style;
  const notes = addXp(state, skill, (m.xp[skill] || 8) * (1 + petBonuses(state, skill).xp));
  addXp(state, "vitality", m.xp.vitality || 4);
  addXp(state, "guard", Math.floor((m.xp.guard || 4) * 0.35));
  state.skills[skill].actions += 1;
  state.skills[skill].guildProgress += 1;
  notes.forEach((n) => log(state, `Level up: ${n}`));
  if (sp && st.style === "weave") addXp(state, "weave", sp.xp * 0.25);
  if (state.combat.monsterHp <= 0) kill(state, m);
}

function enemyHit(state) {
  const m = CONTENT.monsters[state.combat.monsterId];
  if (!m) return;
  const st = playerStats(state);
  const tri = triangleMod(m.style, st.style, 0);
  const chance = hitChance(m.acc * tri, st.def);
  if (Math.random() > chance) {
    const w = CONTENT.items[state.equipment.weapon];
    if (w?.special === "riposte" && Math.random() < 0.18) {
      state.combat.monsterHp -= Math.max(1, Math.floor(st.power / 8));
      combatLog(state, "Riposte!");
      if (state.combat.monsterHp <= 0) kill(state, m);
    } else combatLog(state, `${m.name} misses.`);
    return;
  }
  let dmg = 1 + Math.floor(Math.random() * m.maxHit * tri);
  if (state.combat.ward > 0) {
    dmg = Math.floor(dmg * 0.75);
    state.combat.ward -= 1;
  }
  const sp = CONTENT.spells.find((s) => s.id === state.combat.spell);
  if (st.style === "weave" && sp?.tag === "water") dmg = Math.floor(dmg * 0.85);
  if (m.special === "burst" && Math.random() < 0.12) dmg = Math.floor(dmg * 1.6);
  if (m.special === "drain" && Math.random() < 0.15) {
    dmg += 2;
    state.combat.vow = Math.max(0, state.combat.vow - 8);
  }
  if (m.special === "poison" && Math.random() < 0.2) state.combat.poison = Math.max(state.combat.poison, 5);
  state.combat.hp -= dmg;
  combatLog(state, `${m.name} hits you for ${dmg}.`);
  if (state.combat.hp <= 0) die(state);
}

function kill(state, m) {
  state.stats.kills += 1;
  state.combat.kills[m.id] = (state.combat.kills[m.id] || 0) + 1;
  addXp(state, "bounty", 6 + m.slayerReq * 0.2);
  state.skills.bounty.actions += 1;
  state.skills.bounty.guildProgress += 1;
  for (const d of m.drops) {
    if (Math.random() < d.chance * (1 + (chartBonuses(state).rare || 0))) {
      addItem(state, d.item, d.min + Math.floor(Math.random() * (d.max - d.min + 1)));
    }
  }
  if (m.unique && Math.random() < m.unique.chance) {
    addItem(state, m.unique.item, 1);
    log(state, `Unique: ${CONTENT.items[m.unique.item]?.name}`);
  }
  if (state.bounty.monsterId === m.id) {
    state.bounty.have += 1;
    if (state.bounty.have >= state.bounty.need) {
      const tokens = 2 + Math.floor(state.bounty.streak / 3);
      addItem(state, "bounty-token", tokens);
      addItem(state, "coins", 40 + m.slayerReq * 3);
      state.bounty.streak += 1;
      state.quests.stats.bounties += 1;
      log(state, `Bounty complete. +${tokens} tokens.`);
      rollBounty(state);
    }
  }
  log(state, `${m.name} falls.`);
  checkQuests(state);
  rollCombatPet(state);

  if (state.combat.dungeon) {
    const d = CONTENT.dungeons.find((x) => x.id === state.combat.dungeon);
    state.combat.dungeonIndex += 1;
    if (state.combat.dungeonIndex >= d.sequence.length) {
      addItem(state, d.reward.item, d.reward.qty);
      addItem(state, "bounty-token", d.tokens);
      addItem(state, "dungeon-key", 1);
      log(state, `${d.name} cleared.`);
      state.combat.dungeonClears = state.combat.dungeonClears || {};
      state.combat.dungeonClears[d.id] = (state.combat.dungeonClears[d.id] || 0) + 1;
      stopFight(state);
      checkQuests(state);
      return;
    }
    startFight(state, d.sequence[state.combat.dungeonIndex], { dungeon: true });
    return;
  }
  startFight(state, m.id);
}

function die(state) {
  state.stats.deaths += 1;
  state.combat.hp = Math.max(1, Math.floor(state.combat.maxHp * 0.4));
  log(state, "You fall. The citadel drags you back — dungeon progress lost, pride bruised.");
  if (state.combat.dungeon) state.combat.dungeonDeaths += 1;
  stopFight(state);
}

function autoEat(state) {
  const th = state.combat.autoEat;
  if (state.combat.hp > state.combat.maxHp * th) return;
  const food = state.combat.foodId;
  const it = CONTENT.items[food];
  if (!it?.heal) return;
  if (!takeItem(state, food, 1)) return;
  let heal = it.heal;
  if (state.shopBought["shop-eat2"]) heal = Math.floor(heal * 1.08);
  heal = Math.floor(heal * (1 + (potionStats(state).eatBoost || 0)));
  state.combat.hp = Math.min(state.combat.maxHp, state.combat.hp + heal);
}

function combatLog(state, msg) {
  if (!state.settings.showCombatLog) return;
  state._clog = state._clog || [];
  state._clog.unshift(msg);
  if (state._clog.length > 12) state._clog.pop();
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
    state.tools[it.toolSlot] = id;
    return null;
  }
  const slot = it.slot;
  const prev = state.equipment[slot];
  if (prev) addItem(state, prev, 1);
  if (!takeItem(state, id, 1)) {
    if (prev) takeItem(state, prev, 1);
    return "Not in bank.";
  }
  state.equipment[slot] = id;
  recalcHp(state);
  return null;
}

export function unequip(state, slot) {
  const id = state.equipment[slot];
  if (!id) return;
  addItem(state, id, 1);
  state.equipment[slot] = null;
  recalcHp(state);
}

export function rollBounty(state) {
  const lvl = skillLevel(state, "bounty");
  const pool = Object.values(CONTENT.monsters).filter((m) => m.slayerReq <= lvl + 8);
  const m = pool[Math.floor(Math.random() * pool.length)];
  state.bounty = { monsterId: m.id, need: 8 + Math.floor(Math.random() * 18), have: 0, streak: state.bounty.streak || 0 };
}

export function buryBones(state) {
  const n = bankCount(state, "bones");
  if (!n) return "No bones.";
  takeItem(state, "bones", n);
  addXp(state, "vow", n * 6);
  log(state, `Buried ${n} bones.`);
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
