import { SKILLS, COMBAT_SKILLS, XP_TABLE, MAX_LEVEL, levelFromXp, buildContent } from "../content/catalog.js";

export const CONTENT = buildContent();
export const TICK_MS = 50;
const SAVE_KEY = "veilforge-save-v1";

export function emptySkills() {
  const o = {};
  for (const s of SKILLS) o[s.id] = { xp: 0, level: 1, mastery: {}, guildProgress: 0, guildRank: 0, actions: 0, pool: 0, checkpoints: {} };
  return o;
}

export function createState() {
  return {
    version: 1,
    name: "Veilwright",
    bornAt: Date.now(),
    lastSave: Date.now(),
    coins: 25,
    bank: {
      "food-0": 4,
      "log-0": 2
    },
    bankTabs: ["General", "War", "Craft"],
    itemTabs: {},
    equipment: {
      weapon: "drift-saber",
      helm: null, body: null, legs: null, boots: null, gloves: null,
      shield: null, cape: null, amulet: null, ammo: null, ring: null
    },
    loadouts: [{ name: "Wanderer", equipment: {} }],
    activeLoadout: 0,
    tools: { axe: null, pick: null, rod: null },
    skills: emptySkills(),
    combat: {
      hp: 10, maxHp: 10, area: null, monsterId: null, monsterHp: 0,
      nextHitAt: 0, enemyNextAt: 0, fighting: false, dungeon: null, dungeonIndex: 0,
      kills: {}, style: "might", spell: "gust-bolt", prayers: [], vow: 100, maxVow: 100,
      foodId: "food-0", autoEat: 0.5, potionId: null, potionCharges: 0,
      stunUntil: 0, poison: 0, ward: 0, dungeonDeaths: 0,
      spec: 0, useSpec: true
    },
    bounty: { monsterId: null, need: 0, have: 0, streak: 0 },
    course: { chosen: {} },
    soil: { plots: [null, null, null, null] },
    drove: { pens: [null, null] },
    chart: { active: ["the-hatchet"], slots: 2, studied: {} },
    whisper: { heat: 0, streak: 0 },
    quests: { active: ["q-wake"], done: [], stats: { harvests: 0, laps: 0, bounties: 0, drove: {}, guildMax: 0 } },
    pets: {},
    shopBought: {},
    stats: { actions: 0, kills: 0, deaths: 0, gp: 0, offlineMs: 0 },
    log: [],
    settings: { toasts: true, reducedMotion: false, showCombatLog: true, tickScale: 1 },
    action: null,
    actionCounts: {},
    now: 0,
    levelUps: [],
    _fx: 0
  };
}

export function skillLevel(state, id) {
  return levelFromXp(state.skills[id].xp);
}

export function addXp(state, skill, amount, content = CONTENT) {
  if (amount <= 0) return [];
  const toasts = [];
  const sk = state.skills[skill];
  const before = levelFromXp(sk.xp);
  sk.xp += amount;
  sk.level = levelFromXp(sk.xp);
  if (sk.level > before) {
    toasts.push(`${skillName(skill)} ${sk.level}`);
    if (skill === "vitality") recalcHp(state);
    const unlocks = collectUnlocks(state, skill, before, sk.level);
    state.levelUps = state.levelUps || [];
    state.levelUps.push({ skill, from: before, to: sk.level, unlocks, t: Date.now() });
  }
  return toasts;
}

export function skillName(id) {
  return SKILLS.find((s) => s.id === id)?.name || id;
}

export function recalcHp(state) {
  const lvl = skillLevel(state, "vitality");
  const gearHp = sumGear(state, "hp");
  state.combat.maxHp = 9 + lvl + gearHp;
  if (state.combat.hp > state.combat.maxHp) state.combat.hp = state.combat.maxHp;
}

export function sumGear(state, stat) {
  let n = 0;
  for (const slot of Object.keys(state.equipment)) {
    const id = state.equipment[slot];
    if (!id) continue;
    const it = CONTENT.items[id];
    n += it?.stats?.[stat] || 0;
  }
  return n;
}

export function bankCount(state, id) {
  return state.bank[id] || 0;
}

export function bankUsed(state) {
  return Object.keys(state.bank).filter((id) => (state.bank[id] || 0) > 0).length;
}

export function bankCap(state) {
  return 12 + (state.shopBought["shop-slots"] || 0) * 6;
}

export function skillLocked(state, skillId) {
  const s = SKILLS.find((x) => x.id === skillId);
  if (!s?.unlock) return null;
  const u = s.unlock;
  if (u.skill && skillLevel(state, u.skill) < u.level) {
    return `${skillName(u.skill)} ${u.level}`;
  }
  if (u.kills && (state.stats.kills || 0) < u.kills) {
    return `${u.kills} kills`;
  }
  if (u.quest && !(state.quests.done || []).includes(u.quest)) {
    return "a sealed ledger page";
  }
  return null;
}

function collectUnlocks(state, skill, from, to) {
  const out = [];
  for (const act of Object.values(CONTENT.actions)) {
    if (act.skill === skill && act.level > from && act.level <= to) out.push(act.name);
  }
  for (const s of SKILLS) {
    if (!s.unlock) continue;
    if (s.unlock.skill === skill && s.unlock.level > from && s.unlock.level <= to) out.push(`${s.name} skill`);
  }
  return out.slice(0, 6);
}

export function addItem(state, id, qty) {
  if (!id || qty <= 0) return false;
  if (id === "coins") {
    const gp = 1 + (courseBonuses(state).gpMul || 0);
    qty = Math.max(1, Math.round(qty * gp));
    state.coins += qty;
    state.stats.gp += qty;
    return true;
  }
  const exists = (state.bank[id] || 0) > 0;
  if (!exists && bankUsed(state) >= bankCap(state)) {
    state.bankFull = true;
    return false;
  }
  const cat = CONTENT.items[id]?.category;
  const stackMax = ({ log: 40, fish: 40, ore: 40, food: 48, bar: 24, herb: 40, seed: 24 })[cat];
  if (stackMax) {
    const have = state.bank[id] || 0;
    if (have >= stackMax) {
      state.stackFull = CONTENT.items[id]?.name || id;
      return false;
    }
    qty = Math.min(qty, stackMax - have);
  }
  state.bank[id] = (state.bank[id] || 0) + qty;
  if (!state.itemTabs[id]) {
    const cat = CONTENT.items[id]?.category;
    const slot = CONTENT.items[id]?.slot;
    if (cat === "equipment" || cat === "ammo" || slot) state.itemTabs[id] = "War";
    else if (["log", "ore", "bar", "fish", "food", "herb", "seed", "gem", "rune", "potion", "material", "tool"].includes(cat)) {
      state.itemTabs[id] = "Craft";
    } else state.itemTabs[id] = "General";
  }
  return true;
}

export function takeItem(state, id, qty) {
  if (id === "coins") {
    if (state.coins < qty) return false;
    state.coins -= qty;
    return true;
  }
  if ((state.bank[id] || 0) < qty) return false;
  state.bank[id] -= qty;
  if (state.bank[id] <= 0) delete state.bank[id];
  return true;
}

export function log(state, msg) {
  state.log.unshift({ t: Date.now(), msg });
  if (state.log.length > 80) state.log.pop();
}

export function masteryLevel(xp) {
  return Math.min(99, 1 + Math.floor(Math.sqrt(xp / 12)));
}

export function masteryBonus(state, masteryId, skillHint) {
  const skill = skillHint || state.action?.skill;
  if (!skill || !state.skills[skill]) return { speed: 0, preserve: 0, output: 0, rare: 0 };
  const xp = state.skills[skill].mastery[masteryId] || 0;
  const ml = masteryLevel(xp);
  const cp = state.skills[skill].checkpoints?.[masteryId] || 0;
  return {
    speed: ml * 0.0025 + cp * 0.04,
    preserve: ml * 0.0015 + cp * 0.03,
    output: ml * 0.001 + cp * 0.02,
    rare: ml * 0.002 + cp * 0.015
  };
}

export function guildBonuses(state, skill) {
  const rank = state.skills[skill].guildRank;
  const tasks = CONTENT.guildTasks[skill] || [];
  const acc = { speed: 0, rare: 0, preserve: 0, xp: 0, output: 0, acc: 0, def: 0 };
  for (let i = 0; i < rank; i++) {
    const b = tasks[i]?.bonus || {};
    for (const k of Object.keys(acc)) acc[k] += b[k] || 0;
  }
  return acc;
}

export function courseBonuses(state) {
  const acc = { skillSpeed: 0, hp: 0, xpMul: 0, gpMul: 0, rareMul: 0, preserve: 0, accMul: 0, defMul: 0, leech: 0, outputMul: 0, masteryMul: 0, burnReduce: 0, chartXp: 0, allXp: 0, offlineMul: 0, time: 1 };
  for (const cat of CONTENT.coursePillars || []) {
    const pick = state.course?.chosen?.[cat.id];
    const opt = cat.options.find((o) => o.id === pick);
    if (!opt) continue;
    for (const k of Object.keys(opt)) {
      if (k === "id" || k === "name") continue;
      if (k === "time") acc.time *= opt.time;
      else acc[k] = (acc[k] || 0) + opt[k];
    }
  }
  return acc;
}

export function chartBonuses(state) {
  const acc = { speed: 0, rare: 0, output: 0, gem: 0, burnReduce: 0, xp: 0, preserve: 0, acc: 0, str: 0, ranged: 0, magic: 0, preserveAmmo: 0, preserveRune: 0, allXp: 0 };
  const slots = state.chart?.slots || 2;
  const active = (state.chart?.active || []).slice(0, slots);
  const studied = state.chart?.studied || {};
  for (const id of active) {
    if (!id) continue;
    const c = CONTENT.constellations.find((x) => x.id === id);
    if (!c) continue;
    const n = studied[id] || 0;
    if (n <= 0) continue;
    const power = Math.min(1, 0.5 + Math.log2(1 + n) * 0.14);
    for (const [k, v] of Object.entries(c.bonus)) acc[k] += v * power;
  }
  return acc;
}

export function potionStats(state) {
  if (!state.combat.potionId || state.combat.potionCharges <= 0) return {};
  return CONTENT.items[state.combat.potionId]?.potion || {};
}

export function petBonuses(state, skill) {
  const acc = { xp: 0, rare: 0 };
  for (const [id, owned] of Object.entries(state.pets)) {
    if (!owned) continue;
    const p = CONTENT.pets.find((x) => x.id === id);
    if (!p) continue;
    if (p.skill === skill || p.skill === "all") {
      acc.xp += p.bonus.xp || 0;
      acc.rare += p.bonus.rare || 0;
    }
  }
  return acc;
}

export function save(state) {
  state.lastSave = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("save failed", e);
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const base = createState();
    return deepMerge(base, s);
  } catch {
    return null;
  }
}

function deepMerge(a, b) {
  if (Array.isArray(a)) return Array.isArray(b) ? b : a;
  if (a && typeof a === "object") {
    const out = { ...a };
    for (const k of Object.keys(b || {})) {
      if (k in a && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) out[k] = deepMerge(a[k], b[k]);
      else out[k] = b[k];
    }
    return out;
  }
  return b === undefined ? a : b;
}

export function exportSave(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(str) {
  const s = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
  return deepMerge(createState(), s);
}

export { SKILLS, COMBAT_SKILLS, XP_TABLE, MAX_LEVEL, levelFromXp };
