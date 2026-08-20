import { CONTENT, skillLevel, bankCount, bankUsed, bankCap } from "./state.js";

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

export function quayDeal() {
  const shop = CONTENT.shop || [];
  const day = Math.floor(Date.now() / 86400000);
  const offer = shop.length ? shop[day % shop.length] : null;
  const hunger = ["log", "ore", "fish", "hide", "ashes"][day % 5];
  const watch = ["First lantern", "Second watch", "Third watch", "Last light"][Math.floor(new Date().getUTCHours() / 6) % 4];
  return { day, offer, mul: 0.82, hunger, watch };
}

export function offerPrice(state, o) {
  const bought = state.shopBought[o.id] || 0;
  let cost = o.cost;
  if (o.repeatable) cost = Math.floor(cost * Math.pow(1.45, bought));
  const deal = quayDeal();
  if (deal.offer?.id === o.id) cost = Math.max(1, Math.floor(cost * deal.mul));
  return { cost, bought, deal: deal.offer?.id === o.id };
}

export function quayGossip(state) {
  const deal = quayDeal();
  const lines = [`${deal.watch} on the quay. Lanterns remember who paid.`];
  if (deal.offer) lines.push(`Dusk bargain: ${offerName(deal.offer)} — 18% off until the next calendar dusk.`);
  lines.push(`Quay hunger: ${deal.hunger}. They pay better than the vault fence.`);
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

export function pawnRate() {
  return 0.72;
}
