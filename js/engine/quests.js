import { CONTENT, skillLevel, addXp, log, stashItem } from "./state.js";
import { checkAchievements } from "./achievements.js";

const FIRST_HOUR = ["q-wake", "q-fire", "q-fish", "q-cook", "q-blood"];

export const ACTS = [
  { id: 1, name: "First Watch", story: "The docks remember who chops.", need: 5 },
  { id: 2, name: "The Anvil Wakes", story: "Ore is a dead weight until it sings.", need: 8 },
  { id: 3, name: "Named Hunts", story: "Contracts are opportunity cost.", need: 12 },
  { id: 4, name: "Choir and Chart", story: "Aim the telescope. You cannot buff everything.", need: 15 },
  { id: 5, name: "Veilheart", story: "The citadel's last locked door.", need: 18 },
  { id: 6, name: "The Last Standard", story: "The dusk endures. Renew the vow.", need: 20 }
];

const BEATS = [
  { id: "b-chop", act: 1, skill: "timber", how: "Select Timber, pick the first grove, then press Idle this job." },
  { id: "b-burn", act: 1, skill: "ember", how: "Select Ember, then press Idle this job on Drift logs." },
  { id: "b-fish", act: 1, skill: "trawl", how: "Select Trawl, then press Idle this job." },
  { id: "b-cook", act: 1, skill: "hearth", how: "Select Hearth and cook the catch." },
  { id: "b-fight", act: 1, skill: "might", how: "Select Might. Hunt Ash Mite. Watch food." },
  { id: "b-vein", act: 2, skill: "vein", how: "Open Vein. Mine, then smelt, then hammer a saber." },
  { id: "b-loom", act: 2, skill: "loom", how: "Sew a hide cape. War-drops become a loadout." },
  { id: "b-soil", act: 2, skill: "soil", how: "Plant a plot. Soil ticks while you war." },
  { id: "b-whisper", act: 2, skill: "whisper", how: "Pickpocket the Dock Beggar. Heat is per mark." },
  { id: "b-bounty", act: 3, skill: "bounty", how: "Take a contract. Tokens buy identity." },
  { id: "b-vault", act: 3, skill: "might", how: "Clear Dock Vault. Sequential kills, no cowardice." },
  { id: "b-drove", act: 3, skill: "drove", how: "Keep a ewe. Collect is the engine." },
  { id: "b-chart", act: 4, skill: "chart", how: "Study a star, then slot it." },
  { id: "b-course", act: 4, skill: "course", how: "Pay a pillar, then run the circuit." },
  { id: "b-choir", act: 4, skill: "weave", how: "Clear Choir Spire with a style that isn't comfort." },
  { id: "b-vow", act: 5, skill: "vow", how: "Reach Vow 30. Bones refill the well." },
  { id: "b-starwell", act: 5, skill: "might", how: "Clear Starwell." },
  { id: "b-veilheart", act: 5, skill: "might", how: "Clear Veilheart." },
  { id: "b-echo", act: 6, skill: "bounty", how: "Descend The Echo. Halt is still Halt." },
  { id: "b-renew", act: 6, skill: "timber", how: "At 120, renew the vow. Mastery stays." }
];

export function actOf(state) {
  const done = (state.quests?.done || []).length;
  let act = 1;
  for (const a of ACTS) if (done >= a.need) act = a.id;
  return ACTS.find((a) => a.id === act) || ACTS[0];
}

export function currentBeat(state) {
  const first = firstHourBeat(state);
  const act = actOf(state);
  if (first) return { ...first, act: act.id, actName: act.name, how: first.q?.how, story: act.story };
  const open = BEATS.find((b) => b.act === act.id);
  return open ? { id: open.id, skill: open.skill, how: open.how, act: act.id, actName: act.name, actionId: null, story: act.story } : null;
}

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
  const beforeAct = actOf(state).id;
  for (const qid of [...state.quests.active]) {
    const q = CONTENT.quests.find((x) => x.id === qid);
    if (q && questReady(state, q)) completeQuest(state, q);
  }
  for (const q of CONTENT.quests) {
    if (state.quests.done.includes(q.id) || state.quests.active.includes(q.id)) continue;
    if (canOffer(state, q) && state.quests.active.length < 4) state.quests.active.push(q.id);
  }
  checkAchievements(state);
  const afterAct = actOf(state).id;
  if (afterAct > beforeAct) {
    state.actTier = afterAct;
    const a = ACTS.find((x) => x.id === afterAct);
    state._edict = { act: afterAct, name: a?.name, story: a?.story, t: Date.now() };
    state._uiDirty = true;
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
