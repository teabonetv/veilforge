import { CONTENT, masteryLevel } from "./state.js";
import { logbookStats, ensureLogbook } from "./logbook.js";

export const STANDING_TIERS = [
  { pct: 25, allXp: 0.02, label: "Citadel Page" },
  { pct: 50, rare: 0.03, label: "Citadel Scribe" },
  { pct: 75, speed: 0.03, label: "Citadel Warden" },
  { pct: 100, allXp: 0.05, rare: 0.05, label: "Last Standard" }
];

export function collectUniqueIds(content = CONTENT) {
  const ids = new Set();
  for (const m of Object.values(content.monsters || {})) {
    if (m.unique?.item) ids.add(m.unique.item);
  }
  for (const d of content.dungeons || []) {
    if (d.reward?.item) ids.add(d.reward.item);
  }
  for (const it of Object.values(content.items || {})) {
    if (it.rarity === "dusk" || it.rarity === "exotic") ids.add(it.id);
  }
  return [...ids];
}

export function ledgerStats(state, content = CONTENT) {
  const key = [
    Object.keys(state.combat?.kills || {}).length,
    Object.keys(state.pets || {}).length,
    Object.keys(state.combat?.dungeonClears || {}).length,
    (state.quests?.done || []).length,
    Object.keys(state.actionCounts || {}).length,
    Object.keys(state.logbook?.items || {}).length,
    Object.keys(state.logbook?.monsters || {}).length,
    Object.keys(state.bank || {}).length
  ].join("|");
  if (state._ledgerKey === key && state._ledger) return state._ledger;
  const lb = logbookStats(state, content);
  const monsters = Object.values(content.monsters || {});
  const seenMon = monsters.filter((m) => (state.combat?.kills?.[m.id] || 0) > 0 || state.logbook?.monsters?.[m.id]);
  const pets = (content.pets || []).filter((p) => state.pets?.[p.id]);
  const dungeons = (content.dungeons || []).filter((d) => (state.combat?.dungeonClears || {})[d.id] > 0);
  const quests = (content.quests || []).filter((q) => (state.quests?.done || []).includes(q.id));
  const actionsTouched = Object.keys(state.actionCounts || {}).filter((id) => content.actions[id]).length;
  const uniqueIds = collectUniqueIds(content);
  const uniquesFound = uniqueIds.filter((id) => (state.bank?.[id] || 0) > 0 || Object.values(state.equipment || {}).includes(id) || state.logbook?.items?.[id]);
  const mastered = Object.values(content.actions || {}).filter((a) => {
    const sk = state.skills?.[a.skill];
    return masteryLevel(sk?.mastery?.[a.masteryId] || 0) >= 99;
  }).length;
  const total = monsters.length + (content.pets || []).length + (content.dungeons || []).length + (content.quests || []).length;
  const have = seenMon.length + pets.length + dungeons.length + quests.length;
  const out = {
    monsters: { seen: seenMon.length, total: monsters.length },
    pets: { owned: pets.length, total: (content.pets || []).length },
    dungeons: { cleared: dungeons.length, total: (content.dungeons || []).length },
    quests: { sealed: quests.length, total: (content.quests || []).length },
    actions: { touched: actionsTouched, total: Object.keys(content.actions || {}).length, mastered },
    uniques: { found: uniquesFound.length, total: uniqueIds.length },
    log: lb,
    completionPct: Math.round((1000 * have) / Math.max(1, total)) / 10
  };
  state._ledgerKey = key;
  state._ledger = out;
  return out;
}

export function standingRank(state) {
  const pct = ledgerStats(state).completionPct;
  let rank = 0;
  for (let i = 0; i < STANDING_TIERS.length; i++) {
    if (pct >= STANDING_TIERS[i].pct) rank = i + 1;
  }
  return rank;
}

export function standingBonuses(state) {
  const pct = ledgerStats(state).completionPct;
  const acc = { allXp: 0, rare: 0, speed: 0, label: "Unremembered" };
  for (const t of STANDING_TIERS) {
    if (pct >= t.pct) {
      acc.allXp += t.allXp || 0;
      acc.rare += t.rare || 0;
      acc.speed += t.speed || 0;
      acc.label = t.label;
    }
  }
  return acc;
}

export { ensureLogbook, logbookStats };
