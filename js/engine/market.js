import { CONTENT, skillLevel, bankCount, bankUsed, bankCap } from "./state.js";
import { weeklyEclipse } from "./eclipse.js";
import { standingBonuses } from "./ledger.js";

export const QUAY_BOOTHS = [
  { id: "tools", name: "Hatchet Yard", keeper: "Noll the Notch", kind: "axe", line: "Faster tools are a fork, not a free lunch." },
  { id: "larder", name: "Third-Watch Larder", keeper: "Brae of the Pans", kind: "food", line: "Combat without a larder is a dare." },
  { id: "packs", name: "Binder's Knot", keeper: "Sil the Knot", kind: "thread", line: "Thread, feathers, compost, fodder. The quiet engines." },
  { id: "relief", name: "Dock Relief", keeper: "Orphan Purse", kind: "log", line: "She sells what you could have chopped — at a dusk tax." },
  { id: "ledger", name: "The Deep Ledger", keeper: "Quill", kind: "coins", line: "Slots, plots, rest. The citadel prices identity." },
  { id: "night", name: "Night Market", keeper: "Vela", kind: "amulet", line: "Vanity with a sliver of plate. Wear it like a decision." },
  { id: "contract", name: "Contract Desk", keeper: "Tick", kind: "token", line: "Keys and tokens. The quay does not hunt for you." }
];

const EFFECT_KIND = {
  bankTab: "pouch", plot: "plot", pen: "pen", autoEat: "food", autoEat2: "food",
  loadout: "body", chartSlot: "scope", offlineHours: "dust", slots: "pouch"
};

export const PAWN_BASE = 0.72;
export const HUNGER_PREMIUM = 0.13;
export const DEAL_CUT = 1500;

export function inferBooth(o) {
  if (o.booth) return o.booth;
  const it = o.item ? CONTENT.items[o.item] : null;
  if (it?.category === "tool") return "tools";
  if (it && ["cape", "amulet", "ring"].includes(it.slot)) return "night";
  if (it?.category === "food" || it?.heal) return "larder";
  if (["log", "ore", "fish", "herb", "seed"].includes(it?.category)) return "relief";
  if (it?.id === "bounty-token" || it?.id === "dungeon-key" || it?.id === "bones") return "contract";
  if (["compost", "fodder", "thread", "feather", "ashes", "essence", "hide"].includes(it?.id)) return "packs";
  return "ledger";
}

export function offerModel(o) {
  const it = o.item ? CONTENT.items[o.item] : null;
  if (it?.model) return it.model;
  return { kind: EFFECT_KIND[o.effect] || "coins", hue: 48, seed: (o.id || "shop").length, eid: o.id };
}

export function offerName(o) {
  return o.name || CONTENT.items[o.item]?.name || o.id;
}

/** Two lantern bargains per calendar dusk: one cheap hook, one dear one. */
export function quayDeal(now = Date.now()) {
  const shop = CONTENT.shop || [];
  const day = Math.floor(now / 86400000);
  const budget = shop.filter((o) => (o.cost || 0) <= DEAL_CUT);
  const dear = shop.filter((o) => (o.cost || 0) > DEAL_CUT);
  const offer = budget.length ? budget[day % budget.length] : (shop[day % Math.max(1, shop.length)] || null);
  const dearOffer = dear.length ? dear[(day + 3) % dear.length] : null;
  const deals = [offer, dearOffer].filter(Boolean);
  const hunger = ["log", "ore", "fish", "hide", "ashes"][day % 5];
  const watch = ["First lantern", "Second watch", "Third watch", "Last light"][Math.floor(new Date(now).getUTCHours() / 6) % 4];
  return { day, offer, dear: dearOffer, deals, mul: 0.82, hunger, watch };
}

export function onDeal(deal, o) {
  return deal.deals.some((d) => d && d.id === o.id);
}

export function offerPrice(state, o) {
  const bought = state.shopBought[o.id] || 0;
  let cost = o.cost;
  if (o.effect === "endow") cost = Math.floor(5000 * Math.pow(1.6, bought));
  else if (o.repeatable) cost = Math.floor(cost * Math.pow(o.effect === "slots" ? 1.35 : 1.45, bought));
  if (o.tokens) return { cost, bought, deal: false, token: true };
  const deal = quayDeal();
  if (onDeal(deal, o)) {
    const eclipse = weeklyEclipse();
    const extra = eclipse.quayMul || 1;
    cost = Math.max(1, Math.floor(cost * deal.mul * extra));
  }
  return { cost, bought, deal: onDeal(deal, o) };
}

/** Quay pawn value: base rate, +hunger premium on the category the quay craves,
 *  +standing favour from ledger completion. The vault fence never sees this. */
export function pawnRate(state, item) {
  let rate = PAWN_BASE;
  const it = item ? (typeof item === "string" ? CONTENT.items[item] : item) : null;
  if (state) rate += standingBonuses(state).pawn || 0;
  if (it && state) {
    const hunger = quayDeal().hunger;
    if (it.category === hunger || it.id === hunger) rate += HUNGER_PREMIUM;
  }
  return Math.min(0.95, rate);
}

export function isHungerItem(state, item) {
  const it = item ? (typeof item === "string" ? CONTENT.items[item] : item) : null;
  if (!it) return false;
  const hunger = quayDeal().hunger;
  return it.category === hunger || it.id === hunger;
}

export function quayGossip(state) {
  const deal = quayDeal();
  const eclipse = weeklyEclipse();
  const cut = Math.round((1 - deal.mul * (eclipse.quayMul || 1)) * 100);
  const lines = [`${deal.watch} on the quay. Lanterns remember who paid.`];
  if (deal.deals.length) {
    const names = deal.deals.map((d) => offerName(d)).join(" and ");
    lines.push(`Dusk bargains: ${names} — ${cut}% off until the next calendar dusk.`);
  }
  lines.push(`Quay hunger: ${deal.hunger}. Pawn ${deal.hunger} today for ${Math.round((PAWN_BASE + HUNGER_PREMIUM + (standingBonuses(state).pawn || 0)) * 100)}%, other stock at ${Math.round(pawnRate(state) * 100)}%.`);
  if (bankUsed(state) >= bankCap(state) - 1) lines.push("Quill: buy vault slots before a rare walks off the dock.");
  const food = Object.keys(state.bank).some((id) => CONTENT.items[id]?.heal && state.bank[id] > 0);
  if (!food) lines.push("Brae: the larder is not optional. Eat or the docks eat you.");
  if (!state.tools?.axe) lines.push("Noll: a Drift hatchet now is a sermon. Chopping barehanded is pride.");
  if (skillLevel(state, "vein") >= 2 && !(state.actionCounts?.["smelt-0"])) lines.push("Quill: Vein 2 opened the anvil. Ore in the vault is a dead weight.");
  if ((state.coins || 0) < 40) lines.push("Orphan Purse: marks first. Chop, sell, then browse.");
  return lines.slice(0, 4);
}

export function hungerStacks(state, hunger) {
  return Object.entries(state.bank || {})
    .filter(([id, n]) => n > 0 && (CONTENT.items[id]?.category === hunger || CONTENT.items[id]?.id === hunger))
    .map(([id, n]) => ({ id, n, it: CONTENT.items[id] }));
}

/** Non-hunger stacks the quay will still pawn, at the plain rate. */
export function plainStock(state, hunger) {
  return Object.entries(state.bank || {})
    .filter(([id, n]) => {
      if (n <= 0 || id === "coins") return false;
      const it = CONTENT.items[id];
      if (!it || it.slot) return false;
      return !(it.category === hunger || it.id === hunger);
    })
    .sort((a, b) => (CONTENT.items[b[0]]?.value || 0) * b[1] - (CONTENT.items[a[0]]?.value || 0) * a[1])
    .slice(0, 4)
    .map(([id, n]) => ({ id, n, it: CONTENT.items[id] }));
}

export function vaultFenceRate(item) {
  const raw = ["log", "ore", "fish", "herb", "seed", "hide", "bar"].includes(item?.category);
  if (!raw) return 0.4;
  return Math.max(0.08, 0.4 - (item.tier || 0) * 0.022);
}

export const QUAY_JOBS = [
  { key: "moon", name: "Moonsteel Indenture", cost: 5000, need: { item: "bar-4", qty: 20 }, pay: 9000, desc: "Underwrite 5k, deliver 20 Moonsteel bars, purse 9k." },
  { key: "iron", name: "Iron Shipment", cost: 2500, need: { item: "bar-2", qty: 30 }, pay: 4800, desc: "Dock foundry wants Iron bars by last light." },
  { key: "rune", name: "Runebound Tithe", cost: 12000, need: { item: "bar-6", qty: 12 }, pay: 20000, desc: "Choir pays a premium if the bars arrive sealed." },
  { key: "larder", name: "Third-watch Larder", cost: 1800, need: { item: "food-2", qty: 40 }, pay: 3400, desc: "Brae will not cook this watch. You will." },
  { key: "hide", name: "Hide Bales", cost: 3000, need: { item: "hide", qty: 80 }, pay: 5200, desc: "Loom houses pay for volume, not heroics." },
  { key: "ash", name: "Ash for Sigil", cost: 2200, need: { item: "ashes", qty: 60 }, pay: 4000, desc: "Star ash without a fire. The quay still wants a plan." },
  { key: "keel", name: "Adamant Keels", cost: 20000, need: { item: "bar-8", qty: 24 }, pay: 36000, minAct: 3, desc: "Shipwrights pay through the dusk for Adamant keel stock." },
  { key: "feast", name: "Regent's Feast", cost: 30000, need: { item: "food-8", qty: 60 }, pay: 52000, minAct: 3, desc: "The citadel table wants sixty braised Ancients. Brae supervises." },
  { key: "ballast", name: "Voidglass Ballast", cost: 60000, need: { item: "bar-10", qty: 15 }, pay: 105000, minAct: 4, desc: "The Spire's new floor hangs on Voidglass ballast." },
  { key: "anchor", name: "Astral Anchors", cost: 150000, need: { item: "bar-12", qty: 10 }, pay: 260000, minAct: 5, desc: "The Last Page's chains are forged from Astral anchors." }
];

export function quayCommissions(state = null, now = Date.now()) {
  const day = Math.floor(now / 86400000);
  const act = Math.max(1, Number(state?.actTier) || 1);
  const list = QUAY_JOBS.filter((j) => (j.minAct || 1) <= act);
  return [0, 1, 2].map((i) => {
    const base = list[(day + i * 2) % list.length];
    return { ...base, id: `qj-${base.key}-${day}`, day };
  });
}

export function openCoinGoals(state) {
  const coins = state.coins || 0;
  const goals = [];
  for (const o of CONTENT.shop || []) {
    if (o.tokens) continue;
    if (o.max && (state.shopBought?.[o.id] || 0) >= o.max) continue;
    const { cost } = offerPrice(state, o);
    if (cost > coins) goals.push({ id: o.id, name: offerName(o), cost });
  }
  for (const j of quayCommissions(state)) {
    if (state.shopBought?.[j.id]) continue;
    if (j.cost > coins) goals.push({ id: j.id, name: j.name, cost: j.cost });
  }
  return goals.sort((a, b) => a.cost - b.cost);
}
