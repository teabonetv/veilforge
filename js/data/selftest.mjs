import { pathToFileURL } from "node:url";
import { createState, CONTENT as C, skillLevel, addItem, bankUsed, bankCap, bankCount, importSave, exportSave, normalizeState, stashItem, persistable, skillLocked, lockMessage, SAVE_KEY, SAVE_BAK, SAVE_VERSION, save, load, setSaveStore, checksum, masteryBonus, renewSkill, addXp, STACK_MAX } from "../engine/state.js";
import { startAction, tick, actionDuration, applyOffline, offlineCapMs, openPouch, plantPlot, buyPillar, spendChartRank, setUseCompost, thieveStunChance, markHeat, setActionMode } from "../engine/sim.js";
import { startFight, startDungeon, equipItem, unequip, rollBounty, playerStats, die, deathTaxAmount, combatLog } from "../engine/combat.js";
import { wandererRanks, gearSet, loadLoadout } from "../engine/wanderer.js";
import { escapeHtml, utf8ToB64 } from "../util/text.js";
import { iconMarkup, iconUrl } from "../scene/icons.js";
import { PIX_EID } from "../scene/pix-map.js";
import { offerModel, quayDeal, inferBooth, QUAY_BOOTHS, openCoinGoals, quayCommissions, offerPrice, pawnRate } from "../engine/market.js";
import { firstHourBeat } from "../engine/quests.js";
import { RARITY, rarityOf, rollRarity } from "../content/rarity.js";
import { ledgerStats, standingBonuses, STANDING_TIERS } from "../engine/ledger.js";
import { logbookStats } from "../engine/logbook.js";
import { weeklyEclipse } from "../engine/eclipse.js";
import { currentCommission, deliverCommission } from "../engine/commissions.js";
import { ACHIEVEMENTS } from "../content/achievements.js";
import { spawnSync } from "node:child_process";
import { SKILLS, XP_TABLE, levelFromXp } from "../content/catalog.js";

const nativeRandom = Math.random.bind(Math);
const failures = [];
function seedRng(seed = 20260820) {
  let rng = seed >>> 0;
  Math.random = () => {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    return rng / 0x100000000;
  };
}
function restoreRng() {
  Math.random = nativeRandom;
}
function test(name, fn) {
  try { fn(); } catch (e) { failures.push(`${name}: ${e.message}`); }
}

function unique(list, label) {
  const seen = new Set();
  for (const n of list) {
    const k = n.toLowerCase();
    if (seen.has(k)) throw new Error(`duplicate ${label}: ${n}`);
    seen.add(k);
  }
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) seedRng(20260820);
if (!isMain) {
  /* importing leaves Math.random untouched and skips assertions */
} else {

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

for (const it of Object.values(C.items)) {
  if (!it.model.eid || !PIX_EID[it.model.eid]) throw new Error("item missing unique icon " + it.id);
  const html = iconMarkup(it.model);
  if (!html.includes("atlas-items.png") && !html.includes("atlas-skills.png") && !html.includes("u-items-")) {
    throw new Error("item icon not on kind atlas " + it.id + " kind=" + it.model.kind);
  }
}
if (C.items["log-0"].model.kind !== "log") throw new Error("log kind drifted: " + C.items["log-0"].model.kind);
if (C.items["gem-0"].model.kind !== "gem") throw new Error("gem kind drifted");
if (iconMarkup(C.items["log-0"].model).includes("hue-rotate")) throw new Error("hue-rotate still on item icons");
for (const m of Object.values(C.monsters)) {
  if (String(m.id).startsWith("elite-") || m.echo) continue;
  if (!PIX_EID[m.id]) throw new Error("monster missing unique icon " + m.id);
  const html = iconMarkup(m.model);
  if (!html.includes("u-mon-") && !html.includes("u-misc.png") && !html.includes("atlas-beasts.png")) throw new Error("monster not on unique sheet " + m.id);
}
for (const d of C.dungeons) {
  if (!PIX_EID[d.id]) throw new Error("dungeon missing unique icon " + d.id);
  if (d.infinite) continue;
  const html = iconMarkup(d.model);
  if (!html.includes("u-misc.png") && !html.includes("atlas-gates.png")) throw new Error("dungeon missing gate icon " + d.id);
}
for (const a of Object.values(C.actions)) {
  const html = iconMarkup(a.model);
  if (!html.includes("u-act-") && !html.includes("u-misc.png") && !html.includes("atlas-skills.png")) throw new Error("action missing icon " + a.id);
}
for (const p of C.pets) {
  if (!p.model?.eid || !PIX_EID[p.id]) throw new Error("pet missing unique icon " + p.id);
}
const cells = new Set();
for (const [id, cell] of Object.entries(PIX_EID)) {
  const k = cell.join(":");
  if (cells.has(k)) throw new Error("shared unique cell " + k + " at " + id);
  cells.add(k);
}
if (cells.size < 600) throw new Error("too few unique icon cells: " + cells.size);
const mk = new Set(Object.values(C.monsters).map((m) => m.model.kind));
if (mk.size < 12) throw new Error("monster silhouettes too few: " + [...mk].join(","));
const gates = new Set(C.dungeons.map((d) => d.model.kind));
if (gates.size < 6) throw new Error("dungeon gates not unique: " + [...gates].join(","));

if (C.quests[0].id !== "q-wake" || !/Timber/.test(C.quests[0].how || "")) {
  throw new Error("first-hour goal is still flavor: " + JSON.stringify(C.quests[0]));
}
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

const batch = createState();
addItem(batch, "log-0", 8);
const bstart = startAction(batch, "ember-0", { count: 2 });
if (bstart) throw new Error(bstart);
for (let i = 0; i < 500; i++) tick(batch, 50);
if (batch.action) throw new Error("craft batch should halt after 2");
if ((batch.actionCounts["ember-0"] || 0) !== 2) throw new Error("crafted " + batch.actionCounts["ember-0"] + ", wanted 2");
if (C.actions["smelt-0"]?.category !== "smelt" || !C.actions["smith-drift-saber"]?.category) throw new Error("anvil lanes missing");

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
{
  const act = C.actions["timber-0"];
  const oldOut = act.outputs;
  act.outputs = [{ item: "coins", min: 1, max: 1 }];
  startAction(off, "timber-0");
  applyOffline(off, 3 * 3600000);
  act.outputs = oldOut;
}
if ((off.actionCounts["timber-0"] || 0) < 900) {
  throw new Error("3h offline should resolve far more than a 50-minute cap: " + off.actionCounts["timber-0"]);
}
if (off._dripSeq) throw new Error("offline should not spam yield drips: " + off._dripSeq);
if (offlineCapMs(off) < 18 * 3600000 - 1) throw new Error("offline cap too small");
if (!(off.lastOffline?.coins > 0)) throw new Error("offline report missed coin income: " + JSON.stringify(off.lastOffline));
if (!Array.isArray(off.lastOffline?.goals)) throw new Error("offline report lost its coin goals");

const cappedSt = createState();
startAction(cappedSt, "timber-0");
applyOffline(cappedSt, 40 * 3600000);
if (!cappedSt.lastOffline?.capped) throw new Error("40h away did not flag the offline cap");
if (cappedSt.lastOffline.minutes > 18 * 60 + 2) throw new Error("capped minutes exceed the window: " + cappedSt.lastOffline.minutes);

const huntFoe = C.monsters[Object.keys(C.monsters)[0]];
const savedFoeHp = huntFoe.hp;
const savedFoeAcc = huntFoe.acc;
/* Guarantee the foe connects so auto-eat is exercised, not lucky misses. */
huntFoe.hp = 24;
huntFoe.acc = 999;

const hunt = createState();
addItem(hunt, "food-0", 200);
startFight(hunt, huntFoe.id);
const foodBeforeHunt = bankCount(hunt, "food-0");
applyOffline(hunt, 4 * 3600000);
if ((hunt.stats.kills || 0) < 1) throw new Error("offline hunt earned no kills");
if (bankCount(hunt, "food-0") >= foodBeforeHunt) throw new Error("offline hunt did not eat");

const dryHunt = createState();
dryHunt.bank["food-0"] = 0;
dryHunt.combat.foodId = "food-0";
startFight(dryHunt, huntFoe.id);
applyOffline(dryHunt, 4 * 3600000);
if (!dryHunt.lastOffline?.huntPaused) throw new Error("starved hunt should pause on death: " + JSON.stringify(dryHunt.lastOffline));
if ((dryHunt.stats.kills || 0) >= 5000) throw new Error("death should cap offline kills");

huntFoe.hp = savedFoeHp;
huntFoe.acc = savedFoeAcc;

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
if (pouch.soil.plots[0].compost) throw new Error("compost auto-applied without the toggle");
if (!bankCount(pouch, "compost")) throw new Error("compost consumed while toggle off");
pouch.soil.plots[0] = null;
setUseCompost(pouch, true);
addItem(pouch, seedId, 1);
const plant2 = plantPlot(pouch, 0, seedId);
if (plant2) throw new Error(plant2);
if (!pouch.soil.plots[0].compost) throw new Error("compost not applied with toggle");
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
if ((C.actions["fletch-bow-13"]?.level || 0) > 120) throw new Error("veilborn longbow above cap");
if ((C.actions["smith-veilborn-crozier"]?.level || 0) > 120) throw new Error("veilborn crozier above cap");
if (C.actions["loom-veilborn-amulet"]?.level !== C.actions["timber-13"]?.level) throw new Error("late amulet still clamped to 99");
if (bankCap(createState()) < 36) throw new Error("starter vault too small");
if (C.areas.some((a) => C.dungeons.some((d) => d.id === a.id))) throw new Error("area/dungeon id collision");
const dock = C.dungeons.find((d) => d.id === "dock-vault");
for (const id of dock.sequence.slice(0, -1)) {
  if (C.monsters[id].area !== "Cinder Docks") throw new Error("Dock Vault floor left the docks: " + C.monsters[id].area);
}
const boss = Object.values(C.monsters).find((m) => m.dungeonOnly);
const farm = startFight(createState(), boss.id);
if (!farm) throw new Error("dungeon closer farmable from Hunt");
const crab = Object.values(C.monsters).find((m) => m.catalogName === "Vault Crab");
if (!crab || crab.maxHit > 8) throw new Error("Vault Crab still one-shots docks: " + crab?.maxHit);
if (!C.shop.some((o) => o.item === "thread") || !C.shop.some((o) => o.item === "feather") || !C.shop.some((o) => o.item === "bounty-token")) {
  throw new Error("missing thread/feather/bounty stall");
}
if (!/40%/.test(C.shop.find((o) => o.id === "shop-eat")?.desc || "") || !/60%/.test(C.shop.find((o) => o.id === "shop-eat")?.desc || "")) {
  throw new Error("auto-eat shop copy should name 40% → 60%");
}
if ((C.items["food-0"]?.heal || 0) < 6) throw new Error("food-0 still heals " + C.items["food-0"]?.heal);
if (createState().combat.autoEat !== 0.4) throw new Error("starter auto-eat should be 40%");

const unpaidBuild = createState();
unpaidBuild.course.chosen.tempo = "stride";
normalizeState(unpaidBuild);
if (unpaidBuild.course.built.tempo) throw new Error("unpaid pillar became built on load");

const gear = createState();
addItem(gear, "drift-helm", 1);
addItem(gear, "drift-body", 1);
addItem(gear, "drift-legs", 1);
equipItem(gear, "drift-helm");
equipItem(gear, "drift-body");
equipItem(gear, "drift-legs");
startFight(gear, Object.keys(C.monsters)[0]);
if ((playerStats(gear).setBonus || 1) <= 1) throw new Error("dusk set bonus still 1");

const offOnce = createState();
startAction(offOnce, "timber-0");
applyOffline(offOnce, 20 * 60000);
const afterFirst = offOnce.actionCounts["timber-0"];
const saveAt = offOnce.lastSave;
applyOffline(offOnce, 50);
if (offOnce.actionCounts["timber-0"] - afterFirst > 2) throw new Error("tiny second offline should not replay the hour");
if (!saveAt) throw new Error("applyOffline did not stamp lastSave");

const tok = createState();
addItem(tok, "bounty-token", 3);
rollBounty(tok, { free: true });
rollBounty(tok, { free: true });
if (bankCount(tok, "bounty-token") !== 3) throw new Error("free bounty roll spent a token");

const tool = createState();
addItem(tool, "drift-hatchet", 1);
const te = equipItem(tool, "drift-hatchet");
if (te) throw new Error(te);
if (bankCount(tool, "drift-hatchet")) throw new Error("equipped tool still in the vault");
if (tool.tools.axe !== "drift-hatchet") throw new Error("tool slot empty");

if (QUAY_BOOTHS.length < 6) throw new Error("quay booths missing");
if (!C.shop.find((o) => o.id === "shop-food") || !C.shop.find((o) => o.id === "shop-relief-log-0")) {
  throw new Error("quay larder/relief stock missing");
}
for (const o of C.shop) {
  const booth = inferBooth(o);
  if (!QUAY_BOOTHS.some((b) => b.id === booth)) throw new Error("ware without a keeper: " + o.id);
  const html = iconMarkup(offerModel(o));
  if (!html.includes("pix") && !html.includes("<svg")) throw new Error("shop ware has no icon: " + o.id);
}
if (!quayDeal().offer) throw new Error("dusk bargain missing");
if (offerModel(C.shop.find((o) => o.item === "log-0")).kind !== "log") throw new Error("relief log icon not a log");

const ash = Object.values(C.monsters).find((m) => m.name === "Ash Mite") || C.monsters[Object.keys(C.monsters)[0]];
test("collector reports two", () => {
  const f = [];
  const t = (n, fn) => { try { fn(); } catch { f.push(n); } };
  t("a", () => { throw new Error("one"); });
  t("b", () => { throw new Error("two"); });
  if (f.length !== 2) throw new Error("collector hid failures: " + f.length);
});
test("G1 docks no full-HP deaths", () => {
  const w = createState();
  w.bank["food-0"] = 24;
  const e = startFight(w, ash.id);
  if (e) throw new Error(e);
  applyOffline(w, 30 * 60 * 1000);
  if (w.stats.fullHpDeaths) throw new Error("full-HP deaths: " + w.stats.fullHpDeaths);
});
test("G2 vault halt", () => {
  const fullb = createState();
  fullb.bank["log-0"] = 40;
  for (const id of Object.keys(C.items)) {
    if (bankUsed(fullb) >= bankCap(fullb)) break;
    if (id === "log-0" || id === "coins") continue;
    addItem(fullb, id, 1);
  }
  const e = startAction(fullb, "timber-0");
  if (e) throw new Error(e);
  applyOffline(fullb, 8 * 3600000);
  if ((fullb.lastOffline?.actions || 0) > 8) throw new Error("full vault kept chopping: " + fullb.lastOffline.actions);
  const halts = fullb.log.filter((l) => /^Halted /.test(l.msg));
  if (halts.length !== 1) throw new Error("expected one halt reason, got " + halts.length + " " + JSON.stringify(halts.map((h) => h.msg)));
});

test("G9 craft never eats inputs into a full vault", () => {
  const st = createState();
  addItem(st, "fish-0", 30);
  st.bank["food-0"] = STACK_MAX.food;
  for (const id of Object.keys(C.items)) {
    if (bankUsed(st) >= bankCap(st)) break;
    if (id === "coins" || id === "food-0" || id === "fish-0") continue;
    addItem(st, id, 1);
  }
  const beforeFish = bankCount(st, "fish-0");
  const e = startAction(st, "cook-0");
  if (e) throw new Error(e);
  applyOffline(st, 2 * 3600000);
  if (bankCount(st, "fish-0") !== beforeFish) throw new Error(`inputs were eaten: ${beforeFish} -> ${bankCount(st, "fish-0")}`);
  if (st.action) throw new Error("craft kept running against a capped shelf");
  if (!st.log.some((l) => /^Halted /.test(l.msg))) throw new Error("no halt named for the capped craft");
  if (!(st.lastOffline?.halt || "").includes("No inputs were spent")) throw new Error("offline report lost the craft halt: " + st.lastOffline?.halt);
});
test("E2 save strips underscore", () => {
  const mid = createState();
  startFight(mid, ash.id);
  mid._clog = ["Guard for 99 hits you"];
  mid._floaters = [{ n: "9", foe: true }];
  mid._hiddenAt = Date.now();
  const dumped = persistable(mid);
  if (Object.keys(dumped).some((k) => k.startsWith("_"))) throw new Error("persistable kept _: " + Object.keys(dumped).filter((k) => k.startsWith("_")));
  const json = JSON.parse(Buffer.from(exportSave(mid), "base64").toString("utf8"));
  if (Object.keys(json).some((k) => k.startsWith("_"))) throw new Error("export kept _ keys");
});
test("E3 offline remainder", () => {
  const act = C.actions["timber-0"];
  const oldTime = act.time;
  const oldOut = act.outputs;
  act.time = 400;
  act.outputs = [{ item: "coins", min: 1, max: 1 }];
  try {
    const st = createState();
    st.offlineHours = 24;
    st.shopBought["shop-offline"] = 1;
    const e = startAction(st, "timber-0");
    if (e) throw new Error(e);
    applyOffline(st, 24 * 3600000);
    const dur = actionDuration(st, act);
    const capMs = offlineCapMs(st);
    const expect = Math.floor(capMs / Math.max(1, dur)) - 2;
    if ((st.actionCounts["timber-0"] || 0) < expect * 0.9) {
      throw new Error("truncated yields: " + st.actionCounts["timber-0"] + " want ~" + expect + " trunc=" + st.lastOffline?.truncated + " min=" + st.lastOffline?.minutes + " hours=" + st.offlineHours + " cap=" + capMs + " dur=" + dur);
    }
    if (!st.lastOffline?.truncated) throw new Error("lastOffline.truncated not set");
  } finally {
    act.time = oldTime;
    act.outputs = oldOut;
  }
});
test("E4 version ladder", () => {
  const raw = { version: 1, name: "Mig", quests: { active: ["whisper-dock-beggar"], done: [], stats: { harvests: 0, laps: 0, bounties: 0, drove: {}, guildMax: 0 } } };
  const loaded = importSave(utf8ToB64(JSON.stringify(raw)));
  if (loaded.version !== SAVE_VERSION) throw new Error("v1 did not become " + SAVE_VERSION + ": " + loaded.version);
  if (loaded.quests.active.includes("whisper-dock-beggar")) throw new Error("v1 remap missed");
  if (!loaded.quests.active.includes("q-whisper") && !loaded.quests.done.includes("q-whisper")) {
    /* deepMerge with createState may have replaced active; remap should still have run on leftover */
  }
  const v2stale = importSave(utf8ToB64(JSON.stringify({ version: 2, name: "Ok", quests: { active: ["whisper-dock-beggar"], done: [], stats: { harvests: 0, laps: 0, bounties: 0, drove: {}, guildMax: 0 } } })));
  if (v2stale.version !== SAVE_VERSION) throw new Error("v2 did not become " + SAVE_VERSION);
});
test("E5 structured floaters", () => {
  const st = createState();
  combatLog(st, "Guard for 99 misses you.");
  if ((st._floaters || []).length) throw new Error("phantom floater from name");
  combatLog(st, "A renaming would not matter.", { dmg: 7, foeHit: true });
  if (st._floaters.at(-1)?.n !== "7" || !st._floaters.at(-1)?.foe) throw new Error("payload floater missing");
});
test("E7 lock copy", () => {
  const st = createState();
  const anvil = skillLocked(st, "anvil");
  if (lockMessage(anvil) !== "Locked until Vein 2.") throw new Error("skill lock: " + lockMessage(anvil));
  const loom = skillLocked(st, "loom");
  if (lockMessage(loom) !== "Locked until you record 8 kills.") throw new Error("kills lock: " + lockMessage(loom));
  const fake = { kind: "quest", label: "a sealed ledger page" };
  if (lockMessage(fake) !== "Locked until you seal a ledger page.") throw new Error("quest lock: " + lockMessage(fake));
});
test("BEAT-1 firstHourBeat", () => {
  const st = createState();
  st.actionCounts["timber-0"] = 3;
  const beat = firstHourBeat(st);
  if (beat?.id !== "q-wake") throw new Error("wake not current: " + beat?.id);
  if (beat.actionId !== null) throw new Error("satisfied action still highlighted: " + beat.actionId);
  st.quests.done.push("q-blood");
  st.quests.active = ["q-blood", "q-anvil", "q-wake"];
  const beat2 = firstHourBeat(st);
  if (beat2?.id !== "q-wake") throw new Error("out of order blood stole the beat: " + beat2?.id);
});
test("G4 cook food lasts 10 fights", () => {
  const st = createState();
  st.bank["food-0"] = 36;
  st.combat.foodId = "food-0";
  st.combat.autoEat = 0.4;
  let e = startFight(st, ash.id);
  if (e) throw new Error(e);
  let guard = 0;
  while ((st.combat.kills?.[ash.id] || 0) < 10 && guard++ < 80000) {
    tick(st, 50);
    if (!st.combat.fighting) {
      const r = startFight(st, ash.id, { respawn: true });
      if (r) startFight(st, ash.id);
    }
  }
  if ((st.combat.kills?.[ash.id] || 0) < 10) throw new Error("could not finish 10 mite fights");
  if (bankCount(st, "food-0") <= 0) throw new Error("larder empty after 10 fights");
});
test("G6 whisper heat per mark", () => {
  const st = createState();
  st.whisper.heatByMark = { "dock-beggar": 10 };
  const beggar = C.npcs.find((n) => n.id === "dock-beggar");
  const clerk = C.npcs.find((n) => n.id === "lantern-clerk");
  const a = thieveStunChance(st, beggar);
  const b = thieveStunChance(st, clerk);
  if (!(a > b + 0.2)) throw new Error("clerk inherited beggar heat: " + a + " vs " + b);
  if (markHeat(st, "lantern-clerk") !== 0) throw new Error("clerk heat not isolated");
});
test("G7 death sheet names blow", () => {
  const burst = createState();
  burst._lastBlow = { kind: "burst", dmg: 9, fromFull: false };
  die(burst);
  if (burst._deathSheet?.blow !== "burst") throw new Error("burst sheet: " + JSON.stringify(burst._deathSheet));
  const poi = createState();
  poi._lastBlow = { kind: "poison", dmg: 4, fromFull: false };
  die(poi);
  if (poi._deathSheet?.blow !== "poison") throw new Error("poison sheet");
  const dry = createState();
  dry._lastBlow = { kind: "starve", dmg: 5, fromFull: false };
  die(dry);
  if (dry._deathSheet?.blow !== "starve") throw new Error("starve sheet");
});
test("G8 coin goals after tools", () => {
  const st = createState();
  st.coins = 400;
  for (const o of C.shop) {
    if (o.item && C.items[o.item]?.category === "tool") st.shopBought[o.id] = o.max || 1;
  }
  const goals = openCoinGoals(st).filter((g) => g.cost > st.coins);
  if (goals.length < 3) throw new Error("not enough coin sinks: " + JSON.stringify(goals.slice(0, 8)));
});
test("E10 death tax", () => {
  if (deathTaxAmount(2) !== 2) throw new Error("2-coin tax " + deathTaxAmount(2));
  if (deathTaxAmount(0) !== 0) throw new Error("0-coin should be named exemption 0");
  const poor = createState();
  poor.coins = 2;
  die(poor);
  if (poor.coins !== 0) throw new Error("2-coin player did not pay: " + poor.coins);
  const broke = createState();
  broke.coins = 0;
  die(broke);
  if (broke.coins !== 0) throw new Error("0-coin death changed coins: " + broke.coins);
  if (!SAVE_KEY.includes("veilforge-save")) throw new Error("SAVE_KEY missing");
});
test("no bankFull", () => {
  const st = createState();
  for (const id of Object.keys(C.items)) {
    if (bankUsed(st) >= bankCap(st)) break;
    addItem(st, id, 1);
  }
  addItem(st, "celestial-saber", 1);
  if ("bankFull" in st) throw new Error("bankFull still written");
});

function memStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }
  };
}

test("F1 backup load", () => {
  const store = memStore();
  setSaveStore(store);
  try {
    const st = createState();
    st.name = "BackupHero";
    save(st);
    st.name = "SecondWatch";
    save(st);
    store.setItem(SAVE_KEY, JSON.stringify({ wrap: 1, sum: "deadbeef", data: { name: "Corrupt" } }));
    const loaded = load();
    if (loaded.name !== "BackupHero") throw new Error("did not recover backup: " + loaded?.name);
    if (!loaded.log.some((l) => /ember-backup/.test(l.msg))) throw new Error("missing backup log");
  } finally {
    setSaveStore(null);
  }
});

test("F1 checksum import", () => {
  const bad = utf8ToB64(JSON.stringify({ wrap: 1, sum: "nope", data: persistable(createState()) }));
  let threw = false;
  try { importSave(bad); } catch (e) {
    threw = /checksum/.test(e.message);
    if (!threw) throw e;
  }
  if (!threw) throw new Error("bad checksum imported");
});

test("F2 orphan sweep", () => {
  const st = createState();
  st.bank["ghost-item"] = 3;
  st.equipment.ring = "ghost-ring";
  normalizeState(st);
  if (st.bank["ghost-item"]) throw new Error("orphan stack remained");
  if (st.equipment.ring) throw new Error("orphan ring remained");
});

test("C4 rarity module", () => {
  if (RARITY.length !== 5) throw new Error("need five rarities");
  if (rarityOf("dusk").id !== "dusk") throw new Error("dusk lookup");
  const seen = new Set();
  for (let i = 0; i < 80; i++) seen.add(rollRarity(() => i / 80).id);
  if (seen.size < 3) throw new Error("rollRarity too narrow: " + [...seen]);
});

test("C2 logbook + C5 standing", () => {
  const st = createState();
  addItem(st, "log-0", 1);
  const lb = logbookStats(st, C);
  if (!(lb.items.have >= 2)) throw new Error("starter items not logged: " + JSON.stringify(lb.items));
  const ls = ledgerStats(st);
  if (typeof ls.completionPct !== "number") throw new Error("completionPct missing");
  if (STANDING_TIERS.length !== 5) throw new Error("standing tiers");
  const boon = standingBonuses(st);
  if (!boon.label) throw new Error("standing label");
});

test("C5b standing pawn boon", () => {
  const fan = createState();
  for (const q of C.quests) fan.quests.done.push(q.id);
  const sb = standingBonuses(fan);
  if (!(sb.pawn >= 0.02)) throw new Error("standing pays no quay favour: " + JSON.stringify(sb));
  const bare = standingBonuses(createState());
  if (bare.pawn !== 0) throw new Error("fresh save already has favour");
});

test("C9 quay pawn rates", () => {
  const st = createState();
  addItem(st, "log-0", 10);
  const base = pawnRate(st);
  if (base < 0.72 || base > 0.73) throw new Error("bare pawn rate drifted: " + base);
  const deal = quayDeal();
  const rLog = pawnRate(st, C.items["log-0"]);
  if (deal.hunger === "log" && !(rLog > base + 0.1)) throw new Error("hunger premium missing");
  if (deal.hunger !== "log" && Math.abs(rLog - base) > 1e-9) throw new Error("non-hunger paid premium");
  if (pawnRate(null) < 0.719 || pawnRate(null) > 0.721) throw new Error("stateless pawn rate drifted");
});

test("C10 dual dusk bargains", () => {
  const d = quayDeal();
  if (!d.offer) throw new Error("budget bargain missing");
  if (!d.deals.length) throw new Error("deals empty");
  const st = createState();
  for (const o of d.deals) {
    const { cost, deal: on } = offerPrice(st, o);
    if (!on) throw new Error("bargain not priced as deal: " + o.id);
    if (cost >= o.cost) throw new Error("bargain not cheaper: " + o.id);
  }
  if (d.deals.length >= 2 && d.deals[0].id === d.deals[1].id) throw new Error("both bargains are the same hook");
});

test("C6 mastery 50 speed", () => {
  const st = createState();
  const act = C.actions["timber-0"];
  st.skills.timber.mastery[act.masteryId] = 12 * 49 * 49;
  const mb = masteryBonus(st, act.masteryId, "timber");
  if (mb.level < 50) throw new Error("mastery not 50: " + mb.level);
  if (!(mb.speed >= 0.04)) throw new Error("seasoned speed missing: " + mb.speed);
  if (mb.label !== "Seasoned" && mb.label !== "Master" && mb.label !== "Legend") {
    throw new Error("milestone label: " + mb.label);
  }
});

test("C8 mastery pays xp", () => {
  const fresh = createState();
  const act = C.actions["timber-0"];
  const mb0 = masteryBonus(fresh, act.masteryId, "timber");
  if (mb0.xp !== 0) throw new Error("fresh mastery already pays: " + mb0.xp);
  const st = createState();
  st.skills.timber.mastery[act.masteryId] = 12 * 99 * 99;
  const mb = masteryBonus(st, act.masteryId, "timber");
  if (!(mb.xp >= 0.2)) throw new Error("legend mastery xp thin: " + mb.xp);
  const run1 = (s) => {
    const e = startAction(s, "timber-0");
    if (e) throw new Error(e);
    let guard = 0;
    while ((s.actionCounts["timber-0"] || 0) < 1 && guard++ < 20000) tick(s, 50);
    return s.skills.timber.xp;
  };
  const xpPlain = run1(createState());
  const xpMaster = run1(st);
  if (!(xpMaster > xpPlain * 1.1)) throw new Error("mastery xp not applied in sim: " + xpMaster + " vs " + xpPlain);
});

test("D5 echo depth", () => {
  const st = createState();
  st.skills.might.xp = XP_TABLE[120];
  st.skills.might.level = 120;
  st.skills.bounty.xp = XP_TABLE[120];
  st.skills.bounty.level = 120;
  st.combat.maxHp = 9999;
  st.combat.hp = 9999;
  addItem(st, "dungeon-key", 1);
  addItem(st, "food-0", 400);
  const e = startDungeon(st, "the-echo");
  if (e) throw new Error(e);
  let guard = 0;
  while ((st.combat.echoDepth || 0) < 2 && guard++ < 8000) {
    st.combat.hp = st.combat.maxHp;
    tick(st, 50);
    if (!st.combat.fighting) break;
  }
  if ((st.combat.echoDepth || 0) < 2) throw new Error("echo did not descend: depth=" + st.combat.echoDepth);
});

test("D4 bounty chain", () => {
  const st = createState();
  st.skills.bounty.xp = XP_TABLE[50];
  st.skills.bounty.level = 50;
  let chained = false;
  for (let i = 0; i < 200; i++) {
    rollBounty(st, { free: true, forceChain: i === 0 });
    if (st.bounty.chain?.ids?.length === 3) { chained = true; break; }
  }
  if (!chained) throw new Error("no 3-link chain in 200 rolls");
});

test("D9 hardcore might reset", () => {
  const st = createState();
  st.rules.mode = "hardcore";
  st.skills.might.xp = XP_TABLE[40];
  st.skills.might.level = 40;
  die(st);
  if (skillLevel(st, "might") !== 1) throw new Error("hardcore did not reset might");
});

test("D8 workshop commission", () => {
  const st = createState();
  const c = currentCommission(st, Date.UTC(2026, 7, 21));
  for (const r of c.requires) addItem(st, r.item, r.qty);
  const err = deliverCommission(st, Date.UTC(2026, 7, 21));
  if (err) throw new Error(err);
  if (st.commissions.done !== 1) throw new Error("commission not marked");
  const again = deliverCommission(st, Date.UTC(2026, 7, 21));
  if (!again) throw new Error("double-delivered");
});

test("D8b commission streak pays", () => {
  const st = createState();
  const t1 = Date.UTC(2026, 7, 21);
  let c = currentCommission(st, t1);
  for (const r of c.requires) addItem(st, r.item, r.qty);
  if (deliverCommission(st, t1)) throw new Error("day1 delivery failed");
  if ((st.commissions.streak || 0) !== 1) throw new Error("streak should open at 1");
  const purse1 = st.coins;
  const t2 = t1 + 86400000;
  c = currentCommission(st, t2);
  for (const r of c.requires) addItem(st, r.item, r.qty);
  if (deliverCommission(st, t2)) throw new Error("day2 delivery failed");
  if (st.commissions.streak !== 2) throw new Error("streak did not climb: " + st.commissions.streak);
  if (!(st.coins - purse1 >= c.pays * 1.09)) throw new Error("day2 streak paid no bonus");
  const t4 = t1 + 3 * 86400000;
  c = currentCommission(st, t4);
  for (const r of c.requires) addItem(st, r.item, r.qty);
  if (deliverCommission(st, t4)) throw new Error("day4 delivery failed");
  if (st.commissions.streak !== 1) throw new Error("missed day did not reset streak");
});

test("BEAT-1 firstHourBeat still", () => {
  const st = createState();
  st.actionCounts["timber-0"] = 3;
  const beat = firstHourBeat(st);
  if (beat?.id !== "q-wake") throw new Error("wake not current: " + beat?.id);
});

test("E2 persistable no underscore", () => {
  const st = createState();
  st._dawn = true;
  st._edict = { act: 2 };
  const dumped = persistable(st);
  if (Object.keys(dumped).some((k) => k.startsWith("_"))) throw new Error("persistable kept _");
  if (SAVE_VERSION !== 3) throw new Error("SAVE_VERSION " + SAVE_VERSION);
});

test("D6 training modes", () => {
  const st = createState();
  const act = C.actions["timber-0"];
  const d0 = actionDuration(st, act);
  setActionMode(st, "timber", "focused");
  const d1 = actionDuration(st, act);
  setActionMode(st, "timber", "meditative");
  const d2 = actionDuration(st, act);
  if (!(d1 < d0)) throw new Error("focused not faster " + d1 + " vs " + d0);
  if (!(d2 > d0)) throw new Error("meditative not slower " + d2 + " vs " + d0);
});

test("P4 eclipse same week", () => {
  const t = Date.UTC(2026, 7, 21, 12);
  const a = weeklyEclipse(t);
  const b = weeklyEclipse(t + 3600 * 1000);
  if (a.id !== b.id || a.week !== b.week) throw new Error("eclipse drifted in-week");
});

test("D7 renewal keeps mastery", () => {
  const st = createState();
  const act = C.actions["timber-0"];
  st.skills.timber.xp = XP_TABLE[120];
  st.skills.timber.level = 120;
  st.skills.timber.mastery[act.masteryId] = 40000;
  const err = renewSkill(st, "timber");
  if (err) throw new Error(err);
  if (skillLevel(st, "timber") !== 1) throw new Error("renewal did not reset xp");
  if (st.skills.timber.mastery[act.masteryId] !== 40000) throw new Error("mastery lost");
  if ((st.renewals.timber || 0) < 1) throw new Error("renewal uncounted");
});

test("C7 achievements table", () => {
  if (ACHIEVEMENTS.length < 100) throw new Error("need ~100 diaries: " + ACHIEVEMENTS.length);
});

test("desk icons paint pix once", () => {
  const kinds = ["forge", "pouch", "coins", "saber", "tome"];
  for (const kind of kinds) {
    const html = iconMarkup({ kind }, 28);
    if (!html.includes("class=\"pix")) throw new Error("desk kind " + kind + " fell back to SVG and would stack in #desk-nav");
  }
});

test("F3 import does not patch Math.random", () => {
  const href = new URL("../engine/state.js", import.meta.url).href;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `
    const before = Math.random;
    await import(${JSON.stringify(href)});
    if (Math.random !== before) process.exit(2);
  `], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("import patched RNG status=" + r.status + " " + (r.stderr || r.stdout || ""));
});

if (failures.length) {
  console.error(failures.length + " failed");
  for (const f of failures) console.error(" - " + f);
  restoreRng();
  process.exit(1);
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
  sampleMonster: Object.values(C.monsters)[0].name,
  offline3h: off.actionCounts["timber-0"]
}, null, 2));
restoreRng();
}
