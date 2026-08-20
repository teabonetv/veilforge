import { monsterKindFor, dungeonKindFor } from "../scene/icons.js";

export function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(h, arr, salt = 0) {
  return arr[(h + salt * 9973) % arr.length];
}

const ADJ = [
  "Widow", "Lantern", "Ashen", "Quiet", "Salt", "Knotted", "Veiled", "Last",
  "Hollow", "Gilded", "Crooked", "Pale", "Soot", "Moonlit", "Thorned", "Drowned",
  "Oathbound", "Splintered", "Cinder", "Silent", "Rueful", "Frosted", "Brine",
  "Warding", "Orphan", "Ledger", "Dusk", "Grave", "Coppered", "Starved"
];
const NOUN = [
  "Notch", "Hearth", "Quay", "Bell", "Rook", "Suture", "Cowl", "Anvil",
  "Wick", "Spire", "Fen", "Keel", "Reliquary", "Latch", "Orchard", "Choir",
  "Kiln", "March", "Archive", "Pen", "Plot", "Orbit", "Crucible", "Page",
  "Dock", "Grate", "Seam", "Grove", "Tally", "Vow"
];
const VOICE_ITEM = [
  "It remembers the first hand that refused to drop it.",
  "Warm as a workshop at third watch.",
  "Heavier than it looks. That's the point.",
  "Smells of salt and old varnish.",
  "A quiet thing that wants a job, not a shrine.",
  "The ledger has a line for this. It is not generous.",
  "Worn smooth where a better wanderer gripped it.",
  "It will outlast your current plan.",
  "Don't name it. It already has one.",
  "Useful, stubborn, slightly cursed in a polite way."
];
const VOICE_MONSTER = [
  "It learned your interval. Change style or pay.",
  "The dusk made this one mean on purpose.",
  "Not a loot piñata. A decision.",
  "It eats the unprepared and the greedy equally.",
  "You can hear the area in its breathing.",
  "Specials are not flavor text.",
  "It has a favorite prayer to break.",
  "The last wanderer left a dent. Not a victory."
];
const VOICE_ACTION = [
  "Leave it running. That's the whole sermon.",
  "Faster tools are a fork, not a free lunch.",
  "The grove does not care that you are bored.",
  "Mastery is paid in hours you were elsewhere.",
  "A small node. A long night.",
  "You will know this place by the sound it makes."
];
const VOICE_DUNGEON = [
  "Death resets the floors. Pack food like you mean it.",
  "The boss at the end is the tax, not the prize.",
  "Keys are scarce. So is courage.",
  "A sequential argument against greed."
];
const TEMPER = ["stoic", "hungry", "wry", "grim", "devout", "salt-tongued", "patient", "sharp"];

function uniqueLabel(used, h, fallback) {
  let n = 0;
  let name = fallback;
  while (used.has(name.toLowerCase())) {
    n += 1;
    name = `${fallback} ${roman(n + (h % 7))}`;
  }
  used.add(name.toLowerCase());
  return name;
}

function roman(n) {
  const r = ["", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return r[n] || String(n);
}

export function modelKindForItem(it) {
  if (it.id === "coins") return "coins";
  if (it.id === "bones") return "bones";
  if (it.id === "hide") return "hide";
  if (it.id === "essence") return "essence";
  if (it.id === "stardust") return "dust";
  if (it.id === "seed-pouch") return "pouch";
  if (it.id === "compost") return "compost";
  if (it.id === "fodder") return "fodder";
  if (it.id === "ashes") return "ashes";
  if (it.id === "dungeon-key") return "key";
  if (it.id === "bounty-token") return "token";
  if (it.slot === "weapon") {
    const n = (it.name || it.catalogName || "").toLowerCase();
    if (n.includes("cleaver")) return "cleaver";
    if (n.includes("needle")) return "needle";
    if (n.includes("bow") || n.includes("longbow")) return "bow";
    if (n.includes("crozier")) return "crozier";
    return "saber";
  }
  if (it.slot === "body") {
    if (it.style === "mark") return "hidebody";
    if (it.style === "weave") return "robe";
    return "body";
  }
  if (it.toolSlot === "axe") return "axe";
  if (it.toolSlot === "pick") return "pick";
  if (it.toolSlot === "rod") return "rod";
  if (it.slot) return it.slot;
  if (it.category === "food" || it.heal) return "food";
  return it.category || "material";
}

export function imprintContent(content) {
  const usedItem = new Set();
  const usedAct = new Set();
  const usedMon = new Set();
  const usedDun = new Set();

  for (const it of Object.values(content.items)) {
    const h = hash32(it.id);
    it.catalogName = it.name;
    const adj = pick(h, ADJ, 1);
    const noun = pick(h, NOUN, 2);
    const base = it.name;
    let fancy = base;
    if (it.category === "log") fancy = `${adj} ${base.replace(/ Log$/, " Heartwood")}`;
    else if (it.category === "ore") fancy = `${adj} ${noun} ${base}`;
    else if (it.category === "bar") fancy = `${noun}-forged ${base}`;
    else if (it.category === "fish") fancy = `${adj} ${base}`;
    else if (it.category === "food") fancy = `${pick(h, ADJ, 3)}-hearth ${base}`;
    else if (it.category === "equipment" && it.slot === "weapon") fancy = `${adj} ${noun} ${base}`;
    else if (it.category === "equipment") fancy = `${adj} ${base}`;
    else if (it.category === "tool") fancy = `${noun} ${base}`;
    else if (it.category === "potion") fancy = `${adj} ${base}`;
    else if (["gem", "herb", "seed", "rune", "ammo"].includes(it.category)) fancy = `${adj} ${base}`;
    else fancy = `${adj} ${base}`;
    it.name = uniqueLabel(usedItem, h, fancy);
    it.voice = pick(h, VOICE_ITEM, 4);
    it.temper = pick(h, TEMPER, 5);
    it.hue = (h % 360);
    it.model = { kind: modelKindForItem(it), seed: h, hue: it.hue };
  }

  for (const act of Object.values(content.actions)) {
    const h = hash32(act.id);
    act.catalogName = act.name;
    const adj = pick(h, ADJ, 2);
    const noun = pick(h, NOUN, 6);
    let fancy = `${adj} ${noun} — ${act.name}`;
    act.name = uniqueLabel(usedAct, h, fancy);
    act.voice = pick(h, VOICE_ACTION, 3);
    act.temper = pick(h, TEMPER, 1);
    act.hue = (h % 360);
    const skillKind = {
      timber: "grove", vein: "seam", trawl: "tide", ember: "pyre", hearth: "oven",
      anvil: "forge", fletch: "rack", loom: "frame", sigil: "circle", vial: "alembic",
      whisper: "mark", course: "circuit", chart: "scope", soil: "plot", drove: "pen"
    }[act.skill] || "shrine";
    act.model = { kind: skillKind, seed: h, hue: act.hue };
  }

  for (const m of Object.values(content.monsters)) {
    const h = hash32(m.id);
    m.catalogName = m.name;
    const epithet = pick(h, ADJ, 8);
    m.name = uniqueLabel(usedMon, h, `${m.name}, ${epithet} of ${m.area}`);
    m.voice = pick(h, VOICE_MONSTER, 2);
    m.temper = pick(h, TEMPER, 9);
    m.hue = (h % 360);
    m.model = { kind: monsterKindFor({ ...m, catalogName: m.catalogName }), seed: h, hue: m.hue };
  }

  for (const d of content.dungeons) {
    const h = hash32(d.id);
    d.catalogName = d.name;
    d.name = uniqueLabel(usedDun, h, `${pick(h, ADJ)} ${d.name}`);
    d.voice = pick(h, VOICE_DUNGEON, 1);
    d.temper = pick(h, TEMPER, 4);
    d.hue = (h % 360);
    d.model = { kind: dungeonKindFor({ ...d, catalogName: d.catalogName }), seed: h, hue: d.hue };
  }

  return content;
}
