import { CONTENT, skillName } from "./state.js";

/* First-hour onboarding helpers. Kept engine-side so the selftest can reach
   them without pulling the DOM-bound shell. */

const TOOL_SLOTS = ["axe", "pick", "rod"];

export function needsWelcome(state) {
  if (!state || state.settings?.welcomed) return false;
  if ((state.quests?.done?.length || 0) > 0) return false;
  if ((state.stats?.actions || 0) > 0 || (state.stats?.kills || 0) > 0) return false;
  return true;
}

/* The single best tool upgrade sitting unclaimed in the vault, if any.
   Returns { slot, id, name, bonus } or null. */
export function toolNudge(state) {
  let best = null;
  for (const slot of TOOL_SLOTS) {
    const worn = state.tools?.[slot];
    const wornTier = worn ? (CONTENT.items[worn]?.tier ?? -1) : -1;
    for (const [id, n] of Object.entries(state.bank || {})) {
      if (!(n > 0)) continue;
      const it = CONTENT.items[id];
      if (!it || it.category !== "tool" || it.toolSlot !== slot) continue;
      if ((it.tier ?? 0) <= wornTier) continue;
      if (!best || (it.tier ?? 0) > (CONTENT.items[best.id]?.tier ?? 0)) {
        best = { slot, id, name: it.name, bonus: it.bonus || 0 };
      }
    }
  }
  return best;
}

/* Short "how far along is this beat job" counter, e.g. "1/3". Empty when done. */
export function beatWhy(state, beat) {
  if (!beat?.q) return "";
  const req = (beat.q.req || []).find((r) => r.type === "action");
  if (!req) return "";
  const have = state.actionCounts?.[req.id] || 0;
  if (have >= req.count) return "";
  return `${Math.min(have, req.count)}/${req.count}`;
}

/* Human-readable reward line for a sealed ledger page. */
export function sealCopy(seal) {
  if (!seal) return "";
  const bits = [];
  if (seal.coins) bits.push(`+${seal.coins} veilmarks`);
  if (seal.items?.length) {
    for (const it of seal.items.slice(0, 3)) {
      const nm = it.id === "coins" ? "veilmarks" : (CONTENT.items[it.id]?.name || it.id);
      bits.push(`${it.qty} ${nm}`);
    }
  }
  if (seal.xp) {
    for (const [sk, amt] of Object.entries(seal.xp).slice(0, 2)) bits.push(`+${amt} ${skillName(sk)} xp`);
  }
  return bits.join(" · ");
}
