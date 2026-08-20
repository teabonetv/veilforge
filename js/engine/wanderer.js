import { SKILLS, COMBAT_SKILLS, skillLevel, bankCap, bankUsed, CONTENT } from "./state.js";
import { equipItem, unequip } from "./combat.js";

export function wandererRanks(state) {
  const idleSkills = SKILLS.filter((s) => s.kind !== "combat");
  const idle = idleSkills.reduce((n, s) => n + skillLevel(state, s.id), 0) / Math.max(1, idleSkills.length);
  const combat = COMBAT_SKILLS.reduce((n, id) => n + skillLevel(state, id), 0) / COMBAT_SKILLS.length;
  const stars = Math.min(5, 1 + Math.floor((idle + combat) / 24));
  const titles = ["Dock Hand", "Apprentice", "Wanderer", "Veteran Adventurer", "Dusk Warden", "Ledger-Named"];
  const title = titles[Math.min(titles.length - 1, Math.floor((idle + combat) / 20))];
  return { idle: Math.floor(idle), combat: Math.floor(combat), stars, title };
}

export function gearSet(state) {
  const counts = {};
  for (const slot of Object.keys(state.equipment)) {
    const it = CONTENT.items[state.equipment[slot]];
    if (it?.tier == null) continue;
    const key = `${it.tier}:${it.style || "plate"}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  let best = { n: 0, key: null };
  for (const [k, n] of Object.entries(counts)) if (n > best.n) best = { n, key: k };
  if (!best.key) return null;
  const [tier, style] = best.key.split(":");
  const bonus = best.n >= 6 ? 0.2 : best.n >= 4 ? 0.15 : best.n >= 3 ? 0.08 : 0;
  return { n: best.n, need: 6, tier: +tier, style, bonus, next: best.n >= 6 ? null : (best.n >= 4 ? 0.2 : 0.15) };
}

export function weightKg(state) {
  let kg = 0;
  for (const [id, n] of Object.entries(state.bank)) {
    const cat = CONTENT.items[id]?.category;
    const w = ({ ore: 1.2, bar: 1.4, log: 0.8, equipment: 2.1, food: 0.3, fish: 0.4 })[cat] || 0.25;
    kg += w * Math.min(n, 40);
  }
  const cap = 12 + bankCap(state) * 2.2;
  return { kg, cap, stacks: bankUsed(state) };
}

export function emptyEquipment() {
  return {
    weapon: null, helm: null, body: null, legs: null, boots: null, gloves: null,
    shield: null, cape: null, amulet: null, ammo: null, ring: null
  };
}

export function starterLoadout() {
  return { name: "Wanderer", equipment: { ...emptyEquipment(), weapon: "drift-saber" } };
}

export function saveLoadout(state, index = state.activeLoadout) {
  const lo = state.loadouts[index] || state.loadouts[0];
  if (!lo) return "No loadout.";
  lo.equipment = { ...emptyEquipment(), ...state.equipment };
  lo.tools = { ...(state.tools || {}) };
  return null;
}

/** Apply a saved set. Unspecified slots are left alone. Empty `{}` is a no-op (does not strip gear). */
export function loadLoadout(state, i) {
  const lo = state.loadouts[i];
  if (!lo) return "No loadout.";
  const spec = lo.equipment || {};
  const keys = Object.keys(spec);
  if (!keys.length) {
    state.activeLoadout = i;
    return null;
  }
  for (const slot of Object.keys(state.equipment)) {
    if (!(slot in spec)) continue;
    const want = spec[slot] || null;
    const have = state.equipment[slot] || null;
    if (have === want) continue;
    if (want) {
      const err = equipItem(state, want);
      if (err) return err;
    } else if (have) {
      const err = unequip(state, slot);
      if (err) return err;
    }
  }
  if (lo.tools) {
    for (const slot of Object.keys(state.tools || {})) {
      if (!(slot in lo.tools)) continue;
      const want = lo.tools[slot];
      if (!want) continue;
      const err = equipItem(state, want);
      if (err) return err;
    }
  }
  state.activeLoadout = i;
  return null;
}
