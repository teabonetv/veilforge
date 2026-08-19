import { SKILLS, XP_TABLE, levelFromXp } from "../content/catalog.js";
import { createState, CONTENT as C, skillLevel, addItem, bankUsed, bankCap, bankCount } from "../engine/state.js";
import { startAction, tick, actionDuration } from "../engine/sim.js";
import { startFight, equipItem } from "../engine/combat.js";
import { wandererRanks, gearSet } from "../engine/wanderer.js";

function unique(list, label) {
  const seen = new Set();
  for (const n of list) {
    const k = n.toLowerCase();
    if (seen.has(k)) throw new Error(`duplicate ${label}: ${n}`);
    seen.add(k);
  }
}

unique(Object.values(C.items).map((i) => i.name), "item name");
unique(Object.values(C.actions).map((a) => a.name), "action name");
unique(Object.values(C.monsters).map((m) => m.name), "monster name");
unique(C.dungeons.map((d) => d.name), "dungeon name");

for (const it of Object.values(C.items)) {
  if (!it.model?.kind || !it.voice) throw new Error("item missing persona " + it.id);
}
for (const a of Object.values(C.actions)) {
  if (!a.model?.kind || !a.voice) throw new Error("action missing persona " + a.id);
}
for (const m of Object.values(C.monsters)) {
  if (!m.model?.kind || !m.voice) throw new Error("monster missing persona " + m.id);
}
for (const d of C.dungeons) {
  if (!d.model?.kind || !d.voice) throw new Error("dungeon missing persona " + d.id);
}

const seeds = new Set();
let seedClash = 0;
for (const it of Object.values(C.items)) {
  if (seeds.has(it.model.seed)) seedClash += 1;
  seeds.add(it.model.seed);
}
if (seedClash > Object.keys(C.items).length * 0.02) throw new Error("too many model seed collisions " + seedClash);

const s = createState();
const err = startAction(s, "timber-0");
if (err) throw new Error(err);
const dur = actionDuration(s, C.actions["timber-0"]);
if (dur < 2000) throw new Error("timber too snappy: " + dur);

for (let i = 0; i < 2000; i++) tick(s, 50); // 100s
if ((s.actionCounts["timber-0"] || 0) < 5) throw new Error("timber too slow: " + s.actionCounts["timber-0"]);
if (skillLevel(s, "timber") < 2) throw new Error("100s of chopping should ding at least once: " + s.skills.timber.level);
if (skillLevel(s, "timber") >= 8) throw new Error("timber still rocket-levels: " + s.skills.timber.level);
if (levelFromXp(s.skills.timber.xp) !== s.skills.timber.level) throw new Error("xp/level mismatch");

const need5 = XP_TABLE[5];
const xpPerAct = C.actions["timber-0"].xp;
const actsFor5 = Math.ceil(need5 / xpPerAct);
if (actsFor5 * dur < 60000) throw new Error("level 5 arrives too fast: " + (actsFor5 * dur));

const ferr = startFight(s, Object.keys(C.monsters)[0]);
if (ferr) throw new Error(ferr);
for (let i = 0; i < 4000; i++) tick(s, 50);

const r = wandererRanks(s);
if (!r.title || r.stars < 1) throw new Error("wanderer ranks broken");
gearSet(s);

if (!C.items["drift-saber"]?.model) throw new Error("starter saber has no model");

const cap = createState();
addItem(cap, "copper-saber", 1);
for (const id of Object.keys(C.items)) {
  if (bankUsed(cap) >= bankCap(cap)) break;
  if (id === "drift-saber" || id === "coins" || id === "copper-saber") continue;
  addItem(cap, id, 1);
}
const spareW = "copper-saber";
if (!bankCount(cap, spareW) && cap.equipment.weapon !== spareW) throw new Error("no spare weapon to swap");
const before = cap.equipment.weapon;
const swap = equipItem(cap, spareW);
if (swap) {
  if (cap.equipment.weapon !== before) throw new Error("failed swap still changed kit: " + swap);
} else if (before && !cap.bank[before] && cap.equipment.weapon !== before) {
  throw new Error("previous weapon deleted on kit swap");
}

console.log(JSON.stringify({
  items: Object.keys(C.items).length,
  actions: Object.keys(C.actions).length,
  monsters: Object.keys(C.monsters).length,
  skills: SKILLS.length,
  timber: s.actionCounts["timber-0"],
  timberLv: s.skills.timber.level,
  timberDurMs: Math.round(dur),
  actsForLv5: actsFor5,
  minutesToLv5: +(actsFor5 * dur / 60000).toFixed(2),
  kills: s.stats.kills,
  hp: s.combat.hp,
  quests: s.quests.done,
  sampleItem: C.items["log-0"].name,
  sampleMonster: Object.values(C.monsters)[0].name
}, null, 2));
