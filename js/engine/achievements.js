import { CONTENT, skillLevel, masteryLevel, log } from "./state.js";
import { ACHIEVEMENTS } from "../content/achievements.js";
import { ledgerStats } from "./ledger.js";

export function ensureAchv(state) {
  state.achv = state.achv || { claimed: {}, done: {} };
  state.titles = state.titles || [];
  return state.achv;
}

function reqMet(state, r) {
  if (r.type === "action") return (state.actionCounts?.[r.id] || 0) >= r.count;
  if (r.type === "kills-monster") return (state.combat?.kills?.[r.id] || 0) >= r.count;
  if (r.type === "stat") {
    const key = r.key;
    if (key === "chains") return (state.bounty?.chainsDone || 0) >= r.count;
    return (state.stats?.[key] || 0) >= r.count;
  }
  if (r.type === "dungeon") return (state.combat?.dungeonClears || {})[r.id] >= 1;
  if (r.type === "echo-depth") return (state.combat?.echoBest || 0) >= r.count;
  if (r.type === "pets") return Object.values(state.pets || {}).filter(Boolean).length >= r.count;
  if (r.type === "log-pct") return ledgerStats(state).log.totalPct >= r.count;
  if (r.type === "bounty") return (state.quests?.stats?.bounties || 0) >= r.count;
  if (r.type === "renewals") {
    return Object.values(state.renewals || {}).reduce((n, v) => n + (v || 0), 0) >= r.count;
  }
  if (r.type === "mode") return state.rules?.mode === r.id;
  if (r.type === "deaths-at-most") return (state.stats?.deaths || 0) <= r.count;
  if (r.type === "coins") return (state.coins || 0) >= r.count;
  if (r.type === "mastery") {
    const act = CONTENT.actions[r.id];
    const xp = state.skills?.[act?.skill]?.mastery?.[act?.masteryId] || 0;
    return masteryLevel(xp) >= r.count;
  }
  if (r.type === "quests-done") return (state.quests?.done || []).length >= r.count;
  if (r.type === "level") return skillLevel(state, r.skill) >= r.level;
  if (r.type === "skill-actions") return (state.skills?.[r.skill]?.actions || 0) >= r.count;
  if (r.type === "kills") {
    let n = 0;
    for (const mid of Object.keys(state.combat?.kills || {})) {
      if (CONTENT.monsters[mid]?.area === r.area) n += state.combat.kills[mid];
    }
    return n >= r.count;
  }
  return false;
}

export function achievementReady(state, a) {
  return (a.req || []).every((r) => reqMet(state, r));
}

export function checkAchievements(state) {
  const achv = ensureAchv(state);
  for (const a of ACHIEVEMENTS) {
    if (achv.done[a.id]) continue;
    if (!achievementReady(state, a)) continue;
    achv.done[a.id] = 1;
    const title = a.reward?.title;
    if (title && !state.titles.includes(title)) state.titles.push(title);
    log(state, `Diary sealed: ${a.name}.`);
  }
}

export function wearTitle(state, title) {
  if (title && !(state.titles || []).includes(title)) return "You have not earned that name.";
  state.activeTitle = title || "";
  return null;
}
