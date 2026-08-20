import { SKILLS, XP_TABLE, levelFromXp } from "../content/catalog.js";
import { createState, CONTENT as C, skillLevel, addItem, bankUsed, bankCap, bankCount, importSave, exportSave, normalizeState, stashItem } from "../engine/state.js";
import { startAction, tick, actionDuration, applyOffline, offlineCapMs, openPouch, plantPlot, buyPillar, spendChartRank } from "../engine/sim.js";
import { startFight, startDungeon, equipItem, unequip, rollBounty } from "../engine/combat.js";
import { wandererRanks, gearSet, loadLoadout } from "../engine/wanderer.js";
import { escapeHtml, utf8ToB64 } from "../util/text.js";
import { iconMarkup } from "../scene/icons.js";

let rng = 20260820;
Math.random = () => {
  rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
  return rng / 0x100000000;
};

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
unique(C.quests.map((q) => q.id), "quest id");
if (C.quests.some((q) => q.id === "whisper-dock-beggar")) throw new Error("quest id still collides with action id");

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

const mk = new Set(Object.values(C.monsters).map((m) => m.model.kind));
if (mk.size < 12) throw new Error("monster silhouettes too few: " + [...mk].join(","));
if (!iconMarkup(C.items["log-0"].model).includes("<svg")) throw new Error("icon markup broken");
if (!iconMarkup(Object.values(C.monsters)[0].model).includes("rect")) throw new Error("monster icon empty");
const gates = new Set(C.dungeons.map((d) => d.model.kind));
if (gates.size < 6) throw new Error("dungeon gates not unique: " + [...gates].join(","));

const s = createState();
if (s.loadouts[0].equipment.weapon !== "drift-saber") throw new Error("default Wanderer loadout missing saber");
const err = startAction(s, "timber-0");
if (err) throw new Error(err);
const dur = actionDuration(s, C.actions["timber-0"]);
if (dur < 2000) throw new Error("timber too snappy: " + dur);

for (let i = 0; i < 2000; i++) tick(s, 50); // 100s
if ((s.actionCounts["timber-0"] || 0) < 5) throw new Error("timber too slow: " + s.actionCounts["timber-0"]);
if (!(s._dripSeq > 0) || !(s.lastDrip?.xp > 0) || !s.lastDrip.items?.length) {
  throw new Error("chop drip missing: " + JSON.stringify(s.lastDrip));
}
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

const full = createState();
for (const id of Object.keys(C.items)) {
  if (bankUsed(full) >= bankCap(full)) break;
  if (id === "drift-saber" || id === "coins") continue;
  addItem(full, id, 1);
}
const worn = full.equipment.weapon;
const uerr = unequip(full, "weapon");
if (!uerr) throw new Error("unequip at cap should refuse");
if (full.equipment.weapon !== worn) throw new Error("unequip at cap deleted the worn piece");

const blank = createState();
blank.loadouts.push({ name: "Blank", equipment: {} });
const saber = blank.equipment.weapon;
const lerr = loadLoadout(blank, blank.loadouts.length - 1);
if (lerr) throw new Error(lerr);
if (blank.equipment.weapon !== saber) throw new Error("empty loadout stripped the saber");

if (addItem(createState(), "log-0", 0) !== true) throw new Error("qty 0 should be a no-op success");
if (addItem(createState(), "log-0", -3) !== true) throw new Error("negative qty should be a no-op success");

const off = createState();
startAction(off, "timber-0");
applyOffline(off, 3 * 3600000);
if ((off.actionCounts["timber-0"] || 0) < 900) {
  throw new Error("3h offline should resolve far more than a 50-minute cap: " + off.actionCounts["timber-0"]);
}
if (off._dripSeq) throw new Error("offline should not spam yield drips: " + off._dripSeq);
if (offlineCapMs(off) < 18 * 3600000 - 1) throw new Error("offline cap too small");

const hunt = createState();
startFight(hunt, Object.keys(C.monsters)[0]);
const hp = hunt.combat.hp;
const kills = hunt.stats.kills;
applyOffline(hunt, 2 * 3600000);
if (!hunt.combat.fighting) throw new Error("offline resolved a hunt");
if (hunt.stats.deaths) throw new Error("offline death while hidden");
if (hunt.stats.kills !== kills) throw new Error("offline combat kills");
if (hunt.combat.hp !== hp) throw new Error("offline combat hp changed");

const nokey = createState();
const d0 = C.dungeons[0];
const derr = startDungeon(nokey, d0.id);
if (!derr) throw new Error("dungeon started without a Citadel Key");
addItem(nokey, "dungeon-key", 1);
const d2 = startDungeon(nokey, d0.id);
if (d2) throw new Error("dungeon with a key failed: " + d2);
if (bankCount(nokey, "dungeon-key")) throw new Error("key was not consumed");

const xss = escapeHtml(`<img src=x onerror=alert(1)>`);
if (xss.includes("<")) throw new Error("escapeHtml failed: " + xss);
const poisoned = createState();
poisoned.name = "<b>x</b>";
const round = importSave(exportSave(poisoned));
if (round.name.includes("<")) throw new Error("imported name not clamped: " + round.name);

const protoIn = importSave(utf8ToB64('{"name":"Ok","__proto__":{"polluted":true}}'));
if (protoIn.polluted) throw new Error("prototype pollution via import");
if (Object.prototype.polluted) throw new Error("Object.prototype polluted");

const dump = createState();
for (const id of Object.keys(C.items)) {
  if (bankUsed(dump) >= bankCap(dump)) break;
  addItem(dump, id, 1);
}
const beforeLog = dump.log.length;
stashItem(dump, "celestial-saber", 1, "test rare");
if (dump.log.length <= beforeLog && bankCount(dump, "celestial-saber")) {
  /* either stashed or logged; if bank was full it must log */
}
if (bankUsed(dump) >= bankCap(dump) && !bankCount(dump, "celestial-saber")) {
  if (!dump.log.some((l) => /Could not stash/.test(l.msg))) throw new Error("full vault rare was silent");
}

if (C.actions["smith-copper-longbow"] || Object.keys(C.actions).some((id) => /smith-.*longbow/.test(id))) {
  throw new Error("longbows must be fletched, not smithed");
}
for (const d of C.dungeons) {
  const seq = d.sequence;
  if (new Set(seq).size !== seq.length) throw new Error("dungeon repeats floors: " + d.name);
  const boss = C.monsters[seq[seq.length - 1]];
  if (!boss?.dungeonOnly) throw new Error("dungeon missing authored boss: " + d.name);
}
if (!C.items.compost || !C.items.stardust || !C.items.fodder) throw new Error("missing identity items");
if (!(C.chartRanks || []).length) throw new Error("chart ranks missing");
if (C.prayers.find((p) => p.id === "vow-protect")?.stats?.takenMul !== 0.78) throw new Error("aegis oath missing");

const pouch = createState();
addItem(pouch, "seed-pouch", 1);
const perr = openPouch(pouch);
if (perr) throw new Error(perr);
if (bankCount(pouch, "seed-pouch")) throw new Error("pouch not consumed");
const seedId = Object.keys(pouch.bank).find((id) => C.items[id]?.category === "seed");
if (!seedId) throw new Error("pouch did not grant a seed");

addItem(pouch, "compost", 1);
addItem(pouch, seedId, 1);
const plant = plantPlot(pouch, 0, seedId);
if (plant) throw new Error(plant);
if (!pouch.soil.plots[0].compost) throw new Error("compost not applied");
if (bankCount(pouch, "compost")) throw new Error("compost not consumed");

const course = createState();
addItem(course, "coins", 40);
const berr = buyPillar(course, "tempo", "stride");
if (berr) throw new Error(berr);
if (course.course.built.tempo !== "stride") throw new Error("pillar not built");
const unpaid = createState();
const lockedLap = startAction(unpaid, "course-lap");
if (!lockedLap) throw new Error("unbuilt course should refuse");

const dust = createState();
addItem(dust, "stardust", 20);
const rerr = spendChartRank(dust, "dust-speed");
if (rerr) throw new Error(rerr);
if ((dust.chart.ranks["dust-speed"] || 0) < 1) throw new Error("chart rank not spent");

const bty = createState();
rollBounty(bty);
const first = bty.bounty.monsterId;
const r2 = rollBounty(bty);
if (!r2) throw new Error("free reroll should cost a token");
addItem(bty, "bounty-token", 1);
const r3 = rollBounty(bty);
if (r3) throw new Error(r3);
if (!(bty.bounty.block || []).includes(first)) throw new Error("bounty block list empty");

if (!off.lastOffline || off.lastOffline.actions < 900) throw new Error("offline report missing: " + JSON.stringify(off.lastOffline));

if (C.actions["timber-13"] && C.actions["timber-13"].level < 105) throw new Error("late groves still capped at 99");

const tool = createState();
addItem(tool, "drift-hatchet", 1);
const te = equipItem(tool, "drift-hatchet");
if (te) throw new Error(te);
if (bankCount(tool, "drift-hatchet")) throw new Error("equipped tool still in the vault");
if (tool.tools.axe !== "drift-hatchet") throw new Error("tool slot empty");

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
  sampleMonster: Object.values(C.monsters)[0].name,
  offline3h: off.actionCounts["timber-0"]
}, null, 2));
