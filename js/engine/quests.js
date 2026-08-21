import { CONTENT, skillLevel, addXp, log, stashItem } from "./state.js";

const FIRST_HOUR = ["q-wake", "q-fire", "q-fish", "q-cook", "q-blood"];

export function firstHourBeat(state) {
  for (const id of FIRST_HOUR) {
    if ((state.quests.done || []).includes(id)) continue;
    const q = CONTENT.quests.find((x) => x.id === id);
    if (!q) continue;
    const actionReq = (q.req || []).find((r) => r.type === "action" && !reqMet(state, r));
    return {
      id: q.id,
      actionId: actionReq?.id || null,
      skill: q.skill || skillOfQuest(q),
      q
    };
  }
  return null;
}

function skillOfQuest(q) {
  if (q.skill) return q.skill;
  const r = (q.req || []).find((x) => x.type === "action") || q.req?.[0];
  if (r?.type === "action") return CONTENT.actions[r.id]?.skill || "timber";
  if (r?.type === "kills" || r?.type === "dungeon") return "might";
  if (r?.type === "harvest") return "soil";
  if (r?.type === "laps") return "course";
  if (r?.type === "bounty") return "bounty";
  if (r?.type === "drove") return "drove";
  if (r?.type === "level") return r.skill;
  return "timber";
}

export function checkQuests(state) {
  for (const qid of [...state.quests.active]) {
    const q = CONTENT.quests.find((x) => x.id === qid);
    if (q && questReady(state, q)) completeQuest(state, q);
  }
  for (const q of CONTENT.quests) {
    if (state.quests.done.includes(q.id) || state.quests.active.includes(q.id)) continue;
    if (canOffer(state, q) && state.quests.active.length < 4) state.quests.active.push(q.id);
  }
}

function canOffer(state, q) {
  const list = CONTENT.quests;
  const idx = list.indexOf(q);
  if (q.after) return q.after.every((id) => state.quests.done.includes(id));
  if (idx <= 0) return true;
  if (state.quests.done.includes(list[idx - 1].id)) return true;
  // First five pages overlap so chop → burn → fish → cook → fight lands in one sitting.
  return idx < 5 && state.quests.done.length >= idx - 1;
}

function questReady(state, q) {
  return q.req.every((r) => reqMet(state, r));
}

function reqMet(state, r) {
  if (r.type === "action") {
    return (state.actionCounts?.[r.id] || 0) >= r.count;
  }
  if (r.type === "kills") {
    let n = 0;
    for (const mid of Object.keys(state.combat.kills || {})) {
      if (CONTENT.monsters[mid]?.area === r.area) n += state.combat.kills[mid];
    }
    return n >= r.count;
  }
  if (r.type === "dungeon") return (state.combat.dungeonClears || {})[r.id] >= 1;
  if (r.type === "harvest") return (state.quests.stats.harvests || 0) >= r.count;
  if (r.type === "laps") return (state.quests.stats.laps || 0) >= r.count;
  if (r.type === "bounty") return (state.quests.stats.bounties || 0) >= r.count;
  if (r.type === "drove") return (state.quests.stats.drove[r.animal] || 0) >= r.count;
  if (r.type === "level") return skillLevel(state, r.skill) >= r.level;
  if (r.type === "anyLevel") return Object.values(state.skills).some((s) => s.level >= r.level);
  if (r.type === "guildRank") return Object.values(state.skills).some((s) => s.guildRank >= r.rank);
  return false;
}

function completeQuest(state, q) {
  state.quests.active = state.quests.active.filter((id) => id !== q.id);
  state.quests.done.push(q.id);
  if (q.reward.coins) stashItem(state, "coins", q.reward.coins, "ledger");
  if (q.reward.items) q.reward.items.forEach((it) => stashItem(state, it.id, it.qty, "ledger"));
  if (q.reward.xp) {
    for (const [sk, amt] of Object.entries(q.reward.xp)) addXp(state, sk, amt);
  }
  log(state, `Ledger sealed: ${q.name}`);
}

export function questProgress(state, q) {
  return q.req.map((r) => ({ r, ok: reqMet(state, r) }));
}
