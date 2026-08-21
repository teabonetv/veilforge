import { CONTENT } from "./state.js";

const GRADES = ["clear", "speed", "enduring", "scarred"];

export function ensureDeeds(state) {
  state.deeds = state.deeds || {};
  return state.deeds;
}

export function gradeKill(state, m, meta = {}) {
  if (!m?.dungeonOnly && !m?.fieldBoss && !m?.boss) return null;
  const deeds = ensureDeeds(state);
  const row = deeds[m.id] || { clear: 0, speed: 0, enduring: 0, scarred: 0 };
  row.clear = (row.clear || 0) + 1;
  const elapsed = meta.elapsedMs ?? ((state.now || 0) - (state.combat.fightStarted || 0));
  const par = (m.hp || 40) * 80;
  if (elapsed > 0 && elapsed <= par) row.speed = (row.speed || 0) + 1;
  if ((meta.foodUsed || 0) <= 0) row.enduring = (row.enduring || 0) + 1;
  if ((state.combat.hp || 0) <= Math.max(1, state.combat.maxHp * 0.1)) row.scarred = (row.scarred || 0) + 1;
  deeds[m.id] = row;
  return row;
}

export function deedMedals(state, monsterId) {
  const row = ensureDeeds(state)[monsterId] || {};
  return GRADES.map((g) => ({ id: g, have: (row[g] || 0) > 0 }));
}

export function deedCount(state) {
  let n = 0;
  for (const row of Object.values(ensureDeeds(state))) {
    for (const g of GRADES) if (row[g] > 0) n += 1;
  }
  return n;
}

export function bossIds(content = CONTENT) {
  return Object.values(content.monsters || {}).filter((m) => m.dungeonOnly || m.fieldBoss || m.boss).map((m) => m.id);
}
