import { CONTENT, bankCount } from "./state.js";
import { rarityOf } from "../content/rarity.js";

const TIERS = [
  { id: "eat", needRenew: 0, playHours: 0, label: "When hunger bites below the mark, eat." },
  { id: "bank", needRenew: 1, playHours: 8, label: "When the vault fills, sell commons." },
  { id: "sell", needRenew: 2, playHours: 24, label: "Sell below a rarity floor on halt." },
  { id: "script", needRenew: 3, playHours: 48, label: "One conditional script per renewal." }
];

export function renewalCount(state) {
  return Object.values(state.renewals || {}).reduce((n, v) => n + (Number(v) || 0), 0);
}

export function playHours(state) {
  return ((state.stats?.offlineMs || 0) + Math.max(0, Date.now() - (state.bornAt || Date.now()))) / 3600000;
}

export function orderUnlocked(state, id) {
  const t = TIERS.find((x) => x.id === id);
  if (!t) return false;
  return renewalCount(state) >= t.needRenew && playHours(state) >= t.playHours;
}

export function ensureOrders(state) {
  state.orders = state.orders || { eat: true, bank: false, sell: false, sellFloor: "common", scripts: [] };
  return state.orders;
}

export function standingCopy(state) {
  return TIERS.map((t) => ({ ...t, open: orderUnlocked(state, t.id) }));
}

export function stacksToAutoSell(state) {
  const o = ensureOrders(state);
  if (!(o.bank || o.sell)) return [];
  if (!orderUnlocked(state, "bank") && !orderUnlocked(state, "sell")) return [];
  const floor = o.sellFloor || "common";
  const rank = { common: 0, uncommon: 1, rare: 2, exotic: 3, dusk: 4 };
  const cap = rank[floor] ?? 0;
  const out = [];
  for (const [id, qty] of Object.entries(state.bank || {})) {
    if (qty <= 0) continue;
    const it = CONTENT.items[id];
    if (!it || it.slot || it.heal) continue;
    if ((rank[rarityOf(it).id] ?? 0) > cap) continue;
    out.push({ id, qty: Math.min(qty, 8) });
    if (out.length >= 6) break;
  }
  return out;
}

export function autoEatFinest(state) {
  if (state.combat?.foodId && bankCount(state, state.combat.foodId) > 0) return;
  const foods = Object.keys(state.bank || {})
    .map((id) => CONTENT.items[id])
    .filter((it) => it?.heal && bankCount(state, it.id) > 0)
    .sort((a, b) => (b.heal || 0) - (a.heal || 0));
  if (foods[0] && state.combat) state.combat.foodId = foods[0].id;
}
