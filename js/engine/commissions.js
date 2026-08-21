import { CONTENT, addItem, takeItem, bankCount, log } from "./state.js";
import { dailySeed } from "./eclipse.js";

export const WORKSHOP_JOBS = [
  {
    id: "reliquary",
    name: "Ledger Reliquary",
    requires: [
      { item: "bar-11", qty: 20 }, { item: "rune-star", qty: 40 }, { item: "gem-7", qty: 8 },
      { item: "herb-9", qty: 30 }, { item: "hide", qty: 80 }, { item: "essence", qty: 60 }
    ],
    pays: 250000,
    unique: "echo-sigil-0"
  },
  {
    id: "spire-bell",
    name: "Spire Bell",
    requires: [
      { item: "bar-8", qty: 20 }, { item: "log-10", qty: 36 }, { item: "thread", qty: 80 },
      { item: "feather", qty: 40 }, { item: "food-6", qty: 24 }, { item: "rune-void", qty: 24 }
    ],
    pays: 180000,
    unique: "echo-sigil-3"
  },
  {
    id: "oath-casket",
    name: "Oath Casket",
    requires: [
      { item: "bar-6", qty: 20 }, { item: "bones", qty: 80 }, { item: "hide", qty: 40 },
      { item: "ashes", qty: 80 }, { item: "gem-4", qty: 12 }, { item: "rune-blood", qty: 24 }
    ],
    pays: 120000,
    unique: "workshop-seal"
  },
  {
    id: "dawn-loom",
    name: "Dawn Loom",
    requires: [
      { item: "thread", qty: 80 }, { item: "hide", qty: 60 }, { item: "log-7", qty: 36 },
      { item: "gem-5", qty: 8 }, { item: "essence", qty: 40 }, { item: "feather", qty: 40 }
    ],
    pays: 90000,
    unique: "workshop-banner"
  }
];

function dayIndex(now) {
  const seed = dailySeed(now);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return h % WORKSHOP_JOBS.length;
}

export function currentCommission(state, now = Date.now()) {
  const job = WORKSHOP_JOBS[dayIndex(now)];
  return { ...job, day: dailySeed(now), requires: job.requires };
}

export function deliverCommission(state, now = Date.now()) {
  const c = currentCommission(state, now);
  state.commissions = state.commissions || { lastDay: null, done: 0 };
  if (state.commissions.lastDay === c.day) return "Already delivered today's indenture.";
  for (const r of c.requires) {
    if (bankCount(state, r.item) < r.qty) {
      return `Need ${r.qty} ${CONTENT.items[r.item]?.name || r.item}.`;
    }
  }
  for (const r of c.requires) takeItem(state, r.item, r.qty);
  addItem(state, "coins", c.pays);
  if (c.unique) addItem(state, c.unique, 1);
  state.commissions.lastDay = c.day;
  state.commissions.done = (state.commissions.done || 0) + 1;
  log(state, `Workshop commission: ${c.name}. +${c.pays} veilmarks.`);
  return null;
}
