/* Veilforge content — data-driven tiers, skills, items, monsters, quests, guilds. */
import { imprintContent } from "./imprint.js";
export const TIER_NAMES = [
  "Drift", "Copper", "Iron", "Steel", "Moonsteel", "Adamant", "Runebound",
  "Wyrm", "Ancient", "Celestial", "Voidglass", "Mythic", "Astral", "Veilborn"
];

export const TIER_COLORS = [
  "#8d6e4c", "#c47a4a", "#9aa3b5", "#7d93a8", "#7ec8e3", "#4ade80", "#60a5fa",
  "#f87171", "#c4b5fd", "#fde68a", "#a78bfa", "#fb7185", "#67e8f9", "#e0b15a"
];

export const SKILLS = [
  { id: "timber", name: "Timber", kind: "gather", icon: "🌲", blurb: "Fell remnant groves for living wood. Logs also want Ember and Fletch — pick a sink." },
  { id: "trawl", name: "Trawl", kind: "gather", icon: "🎣", blurb: "Draw pale fish. Raw catch is worthless in a fight until Hearth sees it." },
  { id: "vein", name: "Vein", kind: "gather", icon: "⛏️", blurb: "Open citadel stone. Ore is a dead weight until Anvil is unlocked." },
  { id: "ember", name: "Ember", kind: "gather", icon: "🔥", blurb: "Burn wood you could have fletched. Essence vs arrows is a real fork." },
  { id: "hearth", name: "Hearth", kind: "artisan", icon: "🍳", blurb: "Cook or starve. Combat without food is a dare, not a strategy." },
  { id: "anvil", name: "Anvil", kind: "artisan", icon: "⚒️", blurb: "Smelt and hammer. Weapon jobs are different fights, not a ladder.", unlock: { skill: "vein", level: 5 } },
  { id: "fletch", name: "Fletch", kind: "artisan", icon: "🏹", blurb: "Bows eat the same logs Ember wants.", unlock: { skill: "timber", level: 8 } },
  { id: "loom", name: "Loom", kind: "artisan", icon: "🧵", blurb: "Hide armor for Mark. You will feel naked in plate against weavers.", unlock: { kills: 8 } },
  { id: "sigil", name: "Sigil", kind: "artisan", icon: "✦", blurb: "Runes from essence. No essence, no Weave.", unlock: { skill: "ember", level: 10 } },
  { id: "vial", name: "Vial", kind: "artisan", icon: "⚗️", blurb: "Draughts are loadout choices with charge counts.", unlock: { skill: "hearth", level: 12 } },
  { id: "course", name: "Course", kind: "unique", icon: "🏃", blurb: "Mutually exclusive pillars. Greedy circuits are slower on purpose.", unlock: { skill: "timber", level: 15 } },
  { id: "whisper", name: "Whisper", kind: "unique", icon: "👜", blurb: "Stun is the tax. Heat makes later marks meaner.", unlock: { kills: 4 } },
  { id: "soil", name: "Soil", kind: "unique", icon: "🌱", blurb: "The one skill that grows while you war — if you planted.", unlock: { skill: "timber", level: 5 } },
  { id: "drove", name: "Drove", kind: "unique", icon: "🐏", blurb: "Pens stack produce while you adventure. Collect is the engine.", unlock: { skill: "soil", level: 10 } },
  { id: "chart", name: "Chart", kind: "unique", icon: "🔭", blurb: "Two slots. Aim the telescope; you cannot buff everything.", unlock: { skill: "ember", level: 8 } },
  { id: "might", name: "Might", kind: "combat", icon: "⚔️", blurb: "Melee. Might beats Mark, loses to Weave." },
  { id: "guard", name: "Guard", kind: "combat", icon: "🛡️", blurb: "Armour. The difference between a vault and a gravestone." },
  { id: "vitality", name: "Vitality", kind: "combat", icon: "♥", blurb: "Hitpoints. Food is a decision, not wallpaper." },
  { id: "mark", name: "Mark", kind: "combat", icon: "◎", blurb: "Ranged. Needs ammo. Beats Weave, loses to Might.", unlock: { skill: "might", level: 10 } },
  { id: "weave", name: "Weave", kind: "combat", icon: "☄", blurb: "Spells eat runes. Beats Might, loses to Mark.", unlock: { skill: "sigil", level: 5 } },
  { id: "vow", name: "Vow", kind: "combat", icon: "🕯️", blurb: "Two prayers. Vow drains — bury bones or go dark.", unlock: { skill: "vitality", level: 8 } },
  { id: "bounty", name: "Bounty", kind: "combat", icon: "☠", blurb: "Contracts are opportunity cost: hunt THIS, not that.", unlock: { kills: 12 } }
];

export const COMBAT_SKILLS = ["might", "guard", "vitality", "mark", "weave", "vow", "bounty"];

export function xpForLevel(level) {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.floor(i + 300 * Math.pow(2, i / 7));
  }
  return Math.floor(total / 4);
}

export const XP_TABLE = Array.from({ length: 121 }, (_, i) => xpForLevel(i));
export const MAX_LEVEL = 120;

export function levelFromXp(xp) {
  let lvl = 1;
  for (let i = 2; i <= MAX_LEVEL; i++) {
    if (xp >= XP_TABLE[i]) lvl = i;
    else break;
  }
  return lvl;
}

export function toolBonus(level) {
  return 1 + level * 0.035;
}

function idify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function buildContent() {
  const items = {};
  const actions = {};
  const monsters = {};
  const areas = [];
  const dungeons = [];
  const shop = [];
  const quests = [];
  const guildTasks = {};
  const npcs = [];
  const spells = [];
  const prayers = [];
  const potions = [];
  const pets = [];
  const constellations = [];
  const coursePillars = [];
  const animals = [];
  const crops = [];

  const addItem = (it) => {
    items[it.id] = it;
    return it.id;
  };

  addItem({ id: "coins", name: "Veilmarks", category: "currency", stack: true, value: 1, desc: "The citadel's dusk coin. Everything prices against it." });
  addItem({ id: "ashes", name: "Star Ash", category: "material", stack: true, value: 2, desc: "Residue of ember-work. Used in sigils and vials." });
  addItem({ id: "bones", name: "Pale Bones", category: "material", stack: true, value: 4, desc: "Buried for vow experience, or ground for reagents." });
  addItem({ id: "essence", name: "Veil Essence", category: "material", stack: true, value: 12, desc: "Condensed dusk. Runecrafting's true fuel." });
  addItem({ id: "hide", name: "Dusk Hide", category: "material", stack: true, value: 8, desc: "Base leather from hunted and ranched beasts." });
  addItem({ id: "feather", name: "Gloam Feather", category: "material", stack: true, value: 3, desc: "Fletching stabilizer." });
  addItem({ id: "thread", name: "Silver Thread", category: "material", stack: true, value: 6, desc: "Loom binder." });
  addItem({ id: "seed-pouch", name: "Seed Pouch", category: "material", stack: true, value: 5, desc: "Opens into a random soil seed." });
  addItem({ id: "bounty-token", name: "Bounty Token", category: "token", stack: true, value: 40, desc: "Contract proof. Spend in the bounty stall." });
  addItem({ id: "dungeon-key", name: "Citadel Key", category: "key", stack: true, value: 80, desc: "Opens a dungeon floor's lock." });

  const logs = [];
  const ores = [];
  const bars = [];
  const fish = [];
  const cooked = [];
  const herbs = [];
  const gems = [];
  const runes = ["gust", "ember", "tide", "stone", "mind", "blood", "void", "star"].map((r) => {
    const id = `rune-${r}`;
    addItem({ id, name: `${r[0].toUpperCase() + r.slice(1)} Rune`, category: "rune", stack: true, value: 8 + r.length, desc: `Spell component: ${r}.` });
    return id;
  });

  TIER_NAMES.forEach((tier, t) => {
    const req = Math.min(1 + t * 8, 99);
    const val = Math.round(4 * Math.pow(1.55, t));
    const time = 4800 + t * 720;

    const log = addItem({ id: `log-${t}`, name: `${tier} Log`, category: "log", tier: t, stack: true, value: val, desc: `Living timber, tier ${t + 1}.` });
    logs.push(log);
    actions[`timber-${t}`] = {
      id: `timber-${t}`, skill: "timber", name: `${tier} Grove`, level: req, time,
      xp: 12 + t * 11, masteryId: `timber-${t}`,
      outputs: [{ item: log, min: 1, max: 1 }],
      rare: [{ item: "seed-pouch", chance: 0.012 + t * 0.001 }],
      desc: `Chop ${tier} groves. Higher tiers pay in time and rare seeds.`
    };

    const ore = addItem({ id: `ore-${t}`, name: `${tier} Ore`, category: "ore", tier: t, stack: true, value: val + 2, desc: `Raw metal, tier ${t + 1}.` });
    ores.push(ore);
    actions[`vein-${t}`] = {
      id: `vein-${t}`, skill: "vein", name: `${tier} Seam`, level: req, time: time + 100,
      xp: 14 + t * 12, masteryId: `vein-${t}`,
      outputs: [{ item: ore, min: 1, max: 1 }],
      rare: [{ item: `gem-${Math.min(t, 7)}`, chance: 0.02 }],
      desc: `Mine ${tier} seams. Gems hide in the harder faces.`
    };

    const bar = addItem({ id: `bar-${t}`, name: `${tier} Bar`, category: "bar", tier: t, stack: true, value: val * 3, desc: `Smelted ${tier} metal.` });
    bars.push(bar);
    actions[`smelt-${t}`] = {
      id: `smelt-${t}`, skill: "anvil", name: `Smelt ${tier}`, level: req, time: 4000 + t * 240,
      xp: 10 + t * 8, masteryId: `smelt-${t}`, category: "smelt",
      inputs: [{ item: ore, qty: t >= 10 ? 4 : t >= 6 ? 3 : 2 }],
      outputs: [{ item: bar, min: 1, max: 1 }],
      desc: `Smelt ${tier} bars. Higher tiers eat more ore — a real sink.`
    };

    const fishId = addItem({ id: `fish-${t}`, name: `${tier} Catch`, category: "fish", tier: t, stack: true, value: val, desc: `Raw catch.` });
    fish.push(fishId);
    actions[`trawl-${t}`] = {
      id: `trawl-${t}`, skill: "trawl", name: `${tier} Shoal`, level: req, time: 5000 + t * 640,
      xp: 13 + t * 10, masteryId: `trawl-${t}`,
      outputs: [{ item: fishId, min: 1, max: 1 }],
      rare: [{ item: "feather", chance: 0.08 }],
      desc: `Fish ${tier} shoals. Feathers snag in the nets.`
    };

    const foodHeal = 4 + t * 5 + (t >= 8 ? 8 : 0);
    const cookId = addItem({
      id: `food-${t}`, name: `Braised ${tier}`, category: "food", tier: t, stack: true, value: val * 2,
      heal: foodHeal, desc: `Restores ${foodHeal} vitality. Auto-eat respects this number.`
    });
    cooked.push(cookId);
    actions[`cook-${t}`] = {
      id: `cook-${t}`, skill: "hearth", name: `Braise ${tier}`, level: req, time: 3200 + t * 220,
      xp: 11 + t * 9, masteryId: `cook-${t}`,
      inputs: [{ item: fishId, qty: 1 }],
      outputs: [{ item: cookId, min: 1, max: 1 }],
      burn: { chance: Math.max(0.02, 0.28 - t * 0.015), item: "ashes" },
      desc: `Cook ${tier} fish. Burns until hearth mastery and level catch up.`
    };

    actions[`ember-${t}`] = {
      id: `ember-${t}`, skill: "ember", name: `Burn ${tier} Logs`, level: req, time: 3800 + t * 280,
      xp: 16 + t * 13, masteryId: `ember-${t}`,
      inputs: [{ item: log, qty: 1 }],
      outputs: [{ item: "ashes", min: 1, max: 2 }],
      rare: [{ item: "essence", chance: 0.04 + t * 0.006 }],
      desc: `Firemaking. Ash and essence — the quiet engine of magic.`
    };

    if (t < 8) {
      const gem = addItem({ id: `gem-${t}`, name: `${tier} Gem`, category: "gem", tier: t, stack: true, value: val * 6, desc: "Cut later at the loom, or sold." });
      gems.push(gem);
    }

    const herb = addItem({ id: `herb-${t}`, name: `${tier} Wort`, category: "herb", tier: t, stack: true, value: val + 6, desc: "Vial reagent and soil crop." });
    herbs.push(herb);
    const seed = addItem({ id: `seed-${t}`, name: `${tier} Seed`, category: "seed", tier: t, stack: true, value: Math.round(val * 0.6), desc: "Plant on a soil plot." });
    crops.push({ seed, herb, log, t, req, growMs: 90000 + t * 48000 });

    const styles = [
      { slot: "weapon", style: "might", name: "Saber", special: "riposte", interval: 2400, acc: 12 + t * 8, str: 10 + t * 9 },
      { slot: "weapon", style: "might", name: "Cleaver", special: "shred", interval: 3100, acc: 6 + t * 6, str: 16 + t * 12 },
      { slot: "weapon", style: "might", name: "Needle", special: "bleed", interval: 2000, acc: 14 + t * 7, str: 7 + t * 7 },
      { slot: "weapon", style: "mark", name: "Longbow", special: "pierce", interval: 2600, acc: 11 + t * 8, ranged: 12 + t * 10, ammo: true },
      { slot: "weapon", style: "weave", name: "Crozier", special: "echo", interval: 2500, acc: 10 + t * 7, magic: 12 + t * 10 }
    ];
    styles.forEach((w) => {
      const id = idify(`${tier}-${w.name}`);
      addItem({
        id, name: `${tier} ${w.name}`, category: "equipment", slot: "weapon", style: w.style,
        tier: t, value: val * 18, special: w.special, interval: w.interval,
        stats: { acc: w.acc, str: w.str || 0, ranged: w.ranged || 0, magic: w.magic || 0, def: 2 + t },
        ammo: w.ammo || false,
        desc: `${w.name} identity: ${w.special}. Weapons are jobs, not a ladder with one winner.`
      });
      actions[`smith-${id}`] = {
        id: `smith-${id}`, skill: "anvil", name: `Forge ${tier} ${w.name}`, level: req + (w.style === "might" ? 0 : 2),
        time: 6200 + t * 280, xp: 22 + t * 14, masteryId: `smith-${id}`, category: "smith",
        inputs: [{ item: bar, qty: 2 + Math.floor(t / 4) }],
        outputs: [{ item: id, min: 1, max: 1 }],
        desc: `Smith a ${tier} ${w.name}.`
      };
    });

    ["helm", "body", "legs", "boots", "gloves", "shield"].forEach((slot, si) => {
      const id = idify(`${tier}-${slot}`);
      addItem({
        id, name: `${tier} ${slot[0].toUpperCase() + slot.slice(1)}`, category: "equipment", slot, style: "might",
        tier: t, value: val * (8 + si),
        stats: { def: 4 + t * 4 + si, acc: t, str: Math.floor(t / 2), hp: 2 + t },
        desc: `${tier} plate for the ${slot} slot.`
      });
      actions[`smith-${id}`] = {
        id: `smith-${id}`, skill: "anvil", name: `Forge ${tier} ${slot}`, level: req,
        time: 5400 + t * 220, xp: 18 + t * 12, masteryId: `smith-${id}`, category: "smith",
        inputs: [{ item: bar, qty: slot === "body" ? 5 : slot === "legs" ? 4 : 2 }],
        outputs: [{ item: id, min: 1, max: 1 }]
      };
    });

    const leatherSlots = ["cape", "body", "legs", "boots", "gloves"];
    leatherSlots.forEach((slot) => {
      const id = idify(`${tier}-hide-${slot}`);
      addItem({
        id, name: `${tier} Hide ${slot[0].toUpperCase() + slot.slice(1)}`, category: "equipment", slot, style: "mark",
        tier: t, value: val * 9,
        stats: { def: 3 + t * 3, ranged: 3 + t * 2, acc: 2 + t, hp: 1 + t },
        desc: `Ranged hide ${slot}. Lighter defence, better mark.`
      });
      actions[`loom-${id}`] = {
        id: `loom-${id}`, skill: "loom", name: `Sew ${tier} Hide ${slot}`, level: req,
        time: 5000 + t * 200, xp: 16 + t * 11, masteryId: `loom-${id}`,
        inputs: [{ item: "hide", qty: slot === "body" ? 4 : 2 }, { item: "thread", qty: 1 }],
        outputs: [{ item: id, min: 1, max: 1 }]
      };
    });

    const robe = addItem({
      id: idify(`${tier}-robe`), name: `${tier} Veilrobe`, category: "equipment", slot: "body", style: "weave",
      tier: t, value: val * 11,
      stats: { def: 2 + t * 2, magic: 6 + t * 3, acc: t, hp: t },
      desc: "Cloth that remembers starlight. Magic body slot."
    });
    actions[`loom-${robe}`] = {
      id: `loom-${robe}`, skill: "loom", name: `Weave ${tier} Veilrobe`, level: req,
      time: 5600, xp: 20 + t * 12, masteryId: `loom-${robe}`,
      inputs: [{ item: "thread", qty: 3 + t }, { item: t < 8 ? `gem-${Math.min(t, 7)}` : "essence", qty: 1 }],
      outputs: [{ item: robe, min: 1, max: 1 }]
    };

    const amulet = addItem({
      id: idify(`${tier}-amulet`), name: `${tier} Amulet`, category: "equipment", slot: "amulet",
      tier: t, value: val * 14,
      stats: { acc: 3 + t, str: 2 + t, ranged: 2 + t, magic: 2 + t, def: 2 + t },
      desc: "All-style jewelry. Small, always relevant."
    });
    actions[`loom-${amulet}`] = {
      id: `loom-${amulet}`, skill: "loom", name: `Set ${tier} Amulet`, level: Math.min(99, req + 4),
      time: 6400, xp: 24 + t * 12, masteryId: `loom-${amulet}`,
      inputs: [{ item: t < 8 ? `gem-${Math.min(t, 7)}` : "essence", qty: 1 }, { item: "thread", qty: 2 }],
      outputs: [{ item: amulet, min: 1, max: 1 }]
    };

    const arrow = addItem({ id: `arrow-${t}`, name: `${tier} Shafts`, category: "ammo", slot: "ammo", tier: t, stack: true, value: 1 + t, stats: { ranged: 1 + t }, desc: "Consumed on most mark shots." });
    actions[`fletch-arrow-${t}`] = {
      id: `fletch-arrow-${t}`, skill: "fletch", name: `Fletch ${tier} Shafts`, level: req,
      time: 2800, xp: 5 + t * 3, masteryId: `fletch-arrow-${t}`,
      inputs: [{ item: log, qty: 1 }, { item: "feather", qty: 1 }],
      outputs: [{ item: arrow, min: 12 + t * 2, max: 18 + t * 2 }]
    };
    actions[`fletch-bow-${t}`] = {
      id: `fletch-bow-${t}`, skill: "fletch", name: `Till ${tier} Longbow`, level: req + 1,
      time: 6200, xp: 20 + t * 13, masteryId: `fletch-bow-${t}`,
      inputs: [{ item: log, qty: 2 }, { item: "thread", qty: 1 }],
      outputs: [{ item: idify(`${tier}-longbow`), min: 1, max: 1 }]
    };

    const potEffects = [
      { key: "mightAcc", label: "Sure Strike", stats: { accMul: 1.08 + t * 0.01 } },
      { key: "mightStr", label: "Heavy Hand", stats: { strMul: 1.08 + t * 0.01 } },
      { key: "mark", label: "Keen Eye", stats: { rangedMul: 1.08 + t * 0.01 } },
      { key: "weave", label: "Bright Mind", stats: { magicMul: 1.08 + t * 0.01 } },
      { key: "guard", label: "Stone Skin", stats: { defMul: 1.1 + t * 0.01 } },
      { key: "stamina", label: "Second Wind", stats: { eatBoost: 0.08 + t * 0.01 } },
      { key: "lucky", label: "Gloam Luck", stats: { rareMul: 1.12 + t * 0.02 } },
      { key: "haste", label: "Quick Hands", stats: { speedMul: 1.04 + t * 0.005 } }
    ];
    const pe = potEffects[t % potEffects.length];
    const pot = addItem({
      id: `potion-${t}`, name: `${tier} ${pe.label}`, category: "potion", tier: t, stack: true, value: val * 4,
      charges: 8 + t, potion: pe.stats, desc: `${pe.label}. ${8 + t} charges. Potions are loadout choices.`
    });
    potions.push(pot);
    actions[`vial-${t}`] = {
      id: `vial-${t}`, skill: "vial", name: `Brew ${tier} ${pe.label}`, level: req,
      time: 5200 + t * 180, xp: 18 + t * 12, masteryId: `vial-${t}`,
      inputs: [{ item: herb, qty: 1 }, { item: "ashes", qty: 1 + Math.floor(t / 5) }],
      outputs: [{ item: pot, min: 1, max: 1 }]
    };

    actions[`sigil-${t}`] = {
      id: `sigil-${t}`, skill: "sigil", name: `Carve ${tier} Runes`, level: req,
      time: 4400 + t * 200, xp: 14 + t * 10, masteryId: `sigil-${t}`,
      inputs: [{ item: "essence", qty: 1 }, ...(t >= 4 ? [{ item: "ashes", qty: 1 }] : [])],
      outputs: [{ item: runes[t % runes.length], min: 4 + t, max: 8 + t }],
      desc: `Turn essence into ${runes[t % runes.length]}.`
    };
  });

  const toolTypes = [
    { skill: "timber", slot: "axe", name: "Hatchet" },
    { skill: "vein", slot: "pick", name: "Pick" },
    { skill: "trawl", slot: "rod", name: "Rod" }
  ];
  toolTypes.forEach((tt) => {
    TIER_NAMES.forEach((tier, t) => {
      const id = idify(`${tier}-${tt.name}`);
      addItem({
        id, name: `${tier} ${tt.name}`, category: "tool", toolSlot: tt.slot, skill: tt.skill, tier: t,
        value: 40 * (t + 1) * (t + 1), bonus: 0.04 + t * 0.035,
        desc: `Speeds ${tt.skill} by ${Math.round((0.04 + t * 0.035) * 100)}%.`
      });
      shop.push({
        id: `shop-${id}`, item: id, qty: 1, cost: 80 * Math.pow(t + 1, 2.15),
        reqSkill: tt.skill, reqLevel: Math.min(1 + t * 8, 99),
        desc: `${tt.name} upgrade. The gathering identity of Melvor lives or dies on this ladder.`
      });
    });
  });

  shop.push(
    { id: "shop-bank-tab", item: null, effect: "bankTab", cost: 2500, repeatable: true, max: 8, name: "Bank Tab", desc: "Another named bank tab." },
    { id: "shop-plot", item: null, effect: "plot", cost: 1200, repeatable: true, max: 12, name: "Soil Plot", desc: "Another farming plot." },
    { id: "shop-pen", item: null, effect: "pen", cost: 1800, repeatable: true, max: 8, name: "Ranch Pen", desc: "Another drove pen." },
    { id: "shop-eat", item: null, effect: "autoEat", cost: 5000, name: "Auto-Eat Threshold", desc: "Raise auto-eat from 40% to 60% vitality." },
    { id: "shop-eat2", item: null, effect: "autoEat2", cost: 40000, name: "Auto-Eat Mastery", desc: "Auto-eat at 75% and 8% extra healing." },
    { id: "shop-loadout", item: null, effect: "loadout", cost: 8000, repeatable: true, max: 5, name: "Gear Loadout", desc: "Save another equipment set." },
    { id: "shop-offline", item: null, effect: "offlineHours", cost: 15000, name: "Deep Rest", desc: "Offline cap 18 → 24 hours." },
    { id: "shop-slots", item: null, effect: "slots", cost: 400, repeatable: true, max: 20, name: "Bank Slots", desc: "+6 unique stacks. Full banks halt crafts — this is the Melvor tax." }
  );

  addItem({
    id: "dock-warden", name: "Dock Warden", category: "equipment", slot: "weapon", style: "might",
    special: "riposte", interval: 2300, value: 180, stats: { acc: 16, str: 14, def: 4, hp: 2 },
    desc: "A named dock saber. Ledger-forged identity, not another ladder rung."
  });
  addItem({ id: "lantern-cape", name: "Dock Lantern Cape", category: "equipment", slot: "cape", value: 60, stats: { def: 2, hp: 1 }, desc: "Workshop vanity. A little pride, a little defence." });
  addItem({ id: "veil-circlet", name: "Veil Circlet", category: "equipment", slot: "amulet", value: 90, stats: { magic: 2, acc: 1 }, desc: "A dusk ribbon worn as an amulet. Looks expensive because it is." });
  addItem({ id: "star-signet", name: "Star Signet", category: "equipment", slot: "ring", value: 120, stats: { acc: 2, str: 1, ranged: 1, magic: 1 }, desc: "A ring that remembers constellations." });
  shop.push(
    { id: "shop-lantern-cape", item: "lantern-cape", qty: 1, cost: 450, name: "Dock Lantern Cape", desc: "Cosmetic cape with a sliver of plate." },
    { id: "shop-veil-circlet", item: "veil-circlet", qty: 1, cost: 800, name: "Veil Circlet", desc: "Jewelry for the workshop, not a BiS check." },
    { id: "shop-star-signet", item: "star-signet", qty: 1, cost: 1400, name: "Star Signet", desc: "A ring stall classic." },
    { id: "shop-chart-slot", item: null, effect: "chartSlot", cost: 20000, name: "Third Chart Slot", desc: "Aim one more constellation. Scarcity is the point of Chart." }
  );

  const monsterPacks = [
    ["Ash Mite", "Gutter Rat", "Dusk Imp", "Cinder Bat", "Moss Wolf", "Vault Crab"],
    ["Sewer Lamp", "Coin Leech", "Grate Spider", "Lantern Cultist", "Filth Knight", "Bell Wight"],
    ["Fen Tick", "Bog Knight", "Reed Hag", "Hollow Stag", "Silt Naga", "Ashfen Widow"],
    ["Yard Pikeman", "Bastion Boar", "Drill Sarge", "Forge Wasp", "Banner Ghoul", "Keep Mastiff"],
    ["Psalm Moth", "Choir Ghoul", "Relic Thief", "Mirror Owl", "Censer Imp", "Vault Cantor"],
    ["Glass Gull", "Salt Hydra", "Tide Monk", "Coral Wolf", "Drift Siren", "Coast Leviathan"],
    ["Cinder Ant", "Pyre Troll", "Coal Wight", "Smoke Drake", "Kiln Knight", "Furnace Heart"],
    ["Broken Squire", "Oathbreaker", "March Hound", "Rust Paladin", "Standard Wraith", "Vow Eater"],
    ["Meteor Rat", "Star Hyena", "Cut Jackal", "Comet Archer", "Falling Nun", "Glass Drake"],
    ["Orchard Mite", "Void Moth", "Ripe Spectre", "Black Bloom", "Root Seraph", "Orchard Titan"],
    ["Step Wisp", "Stair Gargoyle", "Veil Seraph", "Choir Giant", "Halo Wight", "Spire Judge"],
    ["Thorn Tick", "Heart Bramble", "Thorn Colossus", "Rose Wraith", "Crown Hydra", "Veil Tyrant"],
    ["Dredge Crab", "Moon Eel", "Harbor Priest", "Chain Diver", "Fog Captain", "Abyss Bell"],
    ["Quarry Tick", "Slag Golem", "Pick Wraith", "Ore Hydra", "Deep Autarch", "Vein Sovereign"],
    ["Archive Moth", "Ink Wight", "Index Demon", "Vellum Drake", "Silent Curator", "Codex Beast"],
    ["Ranch Tick", "Drove Shade", "Sire Ghost", "Wool Wraith", "Pen Horror", "Herd King"],
    ["Plot Beetle", "Compost Wight", "Seed Hag", "Vine Serpent", "Harvest Golem", "Grove Reaper"],
    ["Chart Imp", "Astrolabe Eye", "Orbit Wraith", "Nova Hound", "Eclipse Monk", "Star Regent"],
    ["Guild Duelist", "Taskmaster", "Rank Serpent", "Seal Knight", "Master Shade", "Guild Tyrant"],
    ["Last Candle", "Dusk Judge", "Veilborn Lion", "Citadel Echo", "Workshop God", "The Ledger"]
  ];
  const areaNames = [
    { name: "Cinder Docks", slayer: 1 },
    { name: "Lantern Sewers", slayer: 12 },
    { name: "Ashfen", slayer: 24 },
    { name: "Bastion Yard", slayer: 36 },
    { name: "Choir Vaults", slayer: 48 },
    { name: "Saltglass Coast", slayer: 60 },
    { name: "Pyre Warrens", slayer: 72 },
    { name: "Oathbreak March", slayer: 80 },
    { name: "Starfall Cut", slayer: 90 },
    { name: "Void Orchard", slayer: 99 },
    { name: "Seraph Stair", slayer: 108 },
    { name: "Thornheart", slayer: 115 },
    { name: "Drowned Harbor", slayer: 18 },
    { name: "Slag Hollow", slayer: 42 },
    { name: "Silent Archive", slayer: 58 },
    { name: "Drove Graves", slayer: 66 },
    { name: "Rotfield", slayer: 74 },
    { name: "Orbit Cloister", slayer: 88 },
    { name: "Guild Crucible", slayer: 102 },
    { name: "The Last Page", slayer: 120 }
  ];

  areaNames.forEach((area, ai) => {
    const pack = monsterPacks[ai] || monsterPacks[monsterPacks.length - 1];
    const mids = [];
    pack.forEach((nm, mi) => {
      const t = Math.min(13, Math.floor(ai * 1.1 + mi * 0.3));
      const id = idify(`${area.name}-${nm}`);
      const hp = 12 + ai * 18 + mi * 8;
      const maxHit = (ai === 0 ? 5 : 2) + ai * 3 + mi * 2 + (mi === 5 ? 6 : 0);
      const acc = 4 + ai * 7;
      const eva = 4 + ai * 6;
      const style = mi % 3 === 0 ? "might" : mi % 3 === 1 ? "mark" : "weave";
      monsters[id] = {
        id, name: nm, area: area.name, hp, maxHit, acc, eva, style, interval: 2800 + (mi % 3) * 400,
        def: 2 + ai * 4, slayerReq: area.slayer, tier: t,
        special: mi === 5 ? "burst" : mi === 3 ? "poison" : mi === 1 ? "drain" : null,
        burstMul: 2.4,
        xp: { might: 7 + ai * 4, guard: 7 + ai * 4, vitality: 5 + ai * 3, mark: 7 + ai * 4, weave: 7 + ai * 4 },
        drops: [
          { item: "coins", min: 4 + ai * 6, max: 14 + ai * 16, chance: 1 },
          { item: "bones", min: 1, max: 1, chance: 0.7 },
          { item: "hide", min: 1, max: 2, chance: 0.35 },
          { item: cooked[Math.min(cooked.length - 1, t)], min: 1, max: 1, chance: 0.12 },
          { item: `bar-${Math.min(13, t)}`, min: 1, max: 1, chance: 0.08 },
          { item: "bounty-token", min: 1, max: 1, chance: 0.05 + ai * 0.004 },
          { item: idify(`${TIER_NAMES[Math.min(13, t)]}-saber`), min: 1, max: 1, chance: 0.008 },
        ],
        unique: mi === 5 ? { item: idify(`${TIER_NAMES[Math.min(13, t)]}-amulet`), chance: 0.02 } : null,
        desc: `${nm} of ${area.name}. Style ${style}${mi === 5 ? ", area unique hunter." : "."}`
      };
      mids.push(id);
    });
    areas.push({ id: idify(area.name), name: area.name, slayer: area.slayer, monsters: mids, desc: `Combat fields. Slayer ${area.slayer}+ recommended.` });
  });

  const dungeonDefs = [
    { name: "Dock Vault", floors: 4, req: 1, boss: "Vault Crab" },
    { name: "Sewer Reliquary", floors: 5, req: 20, boss: "Lantern Cultist" },
    { name: "Fen Crown", floors: 6, req: 40, boss: "Salt Hydra" },
    { name: "Choir Spire", floors: 7, req: 55, boss: "Choir Ghoul" },
    { name: "Pyre Cathedral", floors: 8, req: 70, boss: "Pyre Troll" },
    { name: "Oathkeep", floors: 8, req: 85, boss: "Oathbreaker" },
    { name: "Starwell", floors: 9, req: 96, boss: "Glass Drake" },
    { name: "Veilheart", floors: 10, req: 110, boss: "Thorn Colossus" },
    { name: "Silent Stacks", floors: 7, req: 62, boss: "Codex Beast" },
    { name: "The Last Page", floors: 12, req: 118, boss: "The Ledger" }
  ];
  dungeonDefs.forEach((d, di) => {
    const seq = [];
    for (let f = 0; f < d.floors; f++) {
      const area = areas[Math.min(areas.length - 1, di + Math.floor(f / 3))];
      seq.push(area.monsters[f % area.monsters.length]);
    }
    const rewardTier = Math.min(13, 2 + di * 2);
    dungeons.push({
      id: idify(d.name), name: d.name, req: d.req, sequence: seq, bossName: d.boss,
      reward: { item: idify(`${TIER_NAMES[rewardTier]}-amulet`), qty: 1 },
      tokens: 3 + di,
      desc: `${d.floors} sequential kills. Death resets the run. This is Melvor's dungeon tension.`
    });
  });

  spells.push(
    { id: "gust-bolt", name: "Gust Bolt", level: 1, runes: { "rune-gust": 1, "rune-mind": 1 }, maxHit: 6, xp: 8, tag: "air", desc: "Cheap opener. Check runes or Weave goes dry." },
    { id: "ember-lash", name: "Ember Lash", level: 12, runes: { "rune-ember": 2, "rune-mind": 1 }, maxHit: 10, xp: 14, tag: "fire", desc: "Applies ember burn (bleed tick) on hit." },
    { id: "tide-ward", name: "Tide Ward", level: 24, runes: { "rune-tide": 2, "rune-stone": 1 }, maxHit: 8, xp: 16, tag: "water", desc: "Stacks a ward: next hit against you is cut ~28%." },
    { id: "stone-spike", name: "Stone Spike", level: 36, runes: { "rune-stone": 3 }, maxHit: 14, xp: 20, tag: "earth", desc: "High hit, slower interval. A real tempo choice." },
    { id: "blood-pact", name: "Blood Pact", level: 52, runes: { "rune-blood": 2, "rune-mind": 2 }, maxHit: 12, xp: 28, tag: "blood", desc: "Heal 15% of damage dealt." },
    { id: "void-needle", name: "Void Needle", level: 70, runes: { "rune-void": 2, "rune-gust": 2 }, maxHit: 18, xp: 36, tag: "void", desc: "Ignores 20% of enemy defence (pairs with pierce)." },
    { id: "star-fall", name: "Starfall", level: 88, runes: { "rune-star": 3, "rune-ember": 2, "rune-mind": 2 }, maxHit: 24, xp: 48, tag: "star", desc: "Splash +40% as a second hit on the same target." },
    { id: "veil-edict", name: "Veil Edict", level: 108, runes: { "rune-star": 4, "rune-void": 3, "rune-blood": 2 }, maxHit: 32, xp: 64, tag: "veil", desc: "Late-game identity spell. Expensive on purpose." },
    { id: "gust-fan", name: "Gust Fan", level: 8, runes: { "rune-gust": 2 }, maxHit: 7, xp: 10, tag: "air", desc: "Cheap and a little faster soul." },
    { id: "ember-core", name: "Ember Core", level: 20, runes: { "rune-ember": 3, "rune-stone": 1 }, maxHit: 13, xp: 18, tag: "fire", desc: "Heavier burn. Eats ember runes." },
    { id: "tide-lash", name: "Tide Lash", level: 32, runes: { "rune-tide": 3, "rune-mind": 1 }, maxHit: 11, xp: 18, tag: "water", desc: "Ward plus a respectable slap." },
    { id: "stone-wall", name: "Stone Wall", level: 44, runes: { "rune-stone": 2, "rune-mind": 2 }, maxHit: 6, xp: 16, tag: "earth", desc: "Low hit, extra defence feeling via ward stacks." },
    { id: "mind-spike", name: "Mind Spike", level: 48, runes: { "rune-mind": 4 }, maxHit: 15, xp: 22, tag: "void", desc: "Pure mind. Ignores a sliver of defence." },
    { id: "blood-rain", name: "Blood Rain", level: 64, runes: { "rune-blood": 3, "rune-ember": 1 }, maxHit: 16, xp: 32, tag: "blood", desc: "Leech that costs you if you go dry." },
    { id: "void-veil", name: "Void Veil", level: 78, runes: { "rune-void": 3, "rune-mind": 2 }, maxHit: 20, xp: 40, tag: "void", desc: "Defence ignore. The expensive cousin of Needle." },
    { id: "star-needle", name: "Star Needle", level: 96, runes: { "rune-star": 2, "rune-gust": 2, "rune-mind": 1 }, maxHit: 22, xp: 44, tag: "star", desc: "Splash-lite. Mid-late book filler that still has a job." }
  );

  prayers.push(
    { id: "vow-sharp", name: "Sharp Oath", level: 1, drain: 2, stats: { accMul: 1.1 }, desc: "Accuracy. Two-prayer cap — pick a partner." },
    { id: "vow-heavy", name: "Heavy Oath", level: 10, drain: 3, stats: { strMul: 1.12 }, desc: "Melee strength. Drains vow; bury bones to last a dungeon." },
    { id: "vow-iron", name: "Iron Oath", level: 20, drain: 3, stats: { defMul: 1.14 }, desc: "Defence. Surviving burst/poison is a vow job." },
    { id: "vow-sight", name: "Sight Oath", level: 30, drain: 3, stats: { rangedMul: 1.12 }, desc: "Ranged. Mark still spends ammo." },
    { id: "vow-mind", name: "Mind Oath", level: 40, drain: 3, stats: { magicMul: 1.12 }, desc: "Magic." },
    { id: "vow-triangle", name: "Triune Oath", level: 55, drain: 6, stats: { triangle: 0.16 }, desc: "Widen the style triangle. Swap arts on purpose." },
    { id: "vow-leech", name: "Leech Oath", level: 70, drain: 7, stats: { leech: 0.08 }, desc: "Life leech. Hungry on vow." },
    { id: "vow-smite", name: "Smite Oath", level: 85, drain: 8, stats: { smite: 0.16 }, desc: "Bonus on every dungeon floor, not a stat stick." },
    { id: "vow-still", name: "Still Oath", level: 99, drain: 4, stats: { preserveRune: 0.18 }, desc: "Rune preserve. Still need stock when luck fails." },
    { id: "vow-last", name: "Last Light", level: 110, drain: 10, stats: { accMul: 1.06, strMul: 1.06, defMul: 1.06, rangedMul: 1.06, magicMul: 1.06 }, desc: "All-style hymn. Drain is the tax — bones refill the well." },
    { id: "vow-haste", name: "Haste Oath", level: 15, drain: 3, stats: { accMul: 1.04 }, desc: "A little accuracy. Pair with Heavy, not with Last Light." },
    { id: "vow-ward", name: "Ward Oath", level: 25, drain: 3, stats: { defMul: 1.08 }, desc: "Softer iron. For docks, not Thornheart." },
    { id: "vow-flint", name: "Flint Oath", level: 35, drain: 4, stats: { strMul: 1.06, accMul: 1.03 }, desc: "Melee hybrid. The two-slot tax is the game." },
    { id: "vow-nock", name: "Nock Oath", level: 38, drain: 4, stats: { rangedMul: 1.08, accMul: 1.03 }, desc: "Mark hybrid." },
    { id: "vow-glyph", name: "Glyph Oath", level: 42, drain: 4, stats: { magicMul: 1.08, preserveRune: 0.06 }, desc: "Weave hybrid." },
    { id: "vow-thick", name: "Thick Oath", level: 50, drain: 5, stats: { defMul: 1.1, leech: 0.02 }, desc: "Survive plus a sip." },
    { id: "vow-hunt", name: "Hunt Oath", level: 60, drain: 5, stats: { accMul: 1.08, smite: 0.06 }, desc: "Accuracy that wakes up in dungeons." },
    { id: "vow-quiet", name: "Quiet Oath", level: 65, drain: 2, stats: { preserveRune: 0.1 }, desc: "Cheap preserve. Long fights." },
    { id: "vow-red", name: "Red Oath", level: 75, drain: 6, stats: { leech: 0.05, strMul: 1.05 }, desc: "Blood-minded melee." },
    { id: "vow-blue", name: "Blue Oath", level: 75, drain: 6, stats: { leech: 0.05, magicMul: 1.05 }, desc: "Blood-minded weave." },
    { id: "vow-green", name: "Green Oath", level: 75, drain: 6, stats: { leech: 0.05, rangedMul: 1.05 }, desc: "Blood-minded mark." },
    { id: "vow-boss", name: "Boss Oath", level: 92, drain: 9, stats: { smite: 0.2, defMul: 1.06 }, desc: "Dungeon closer. Vow melts." },
    { id: "vow-thin", name: "Thin Oath", level: 5, drain: 1, stats: { accMul: 1.03 }, desc: "The first sip. Almost free." },
    { id: "vow-mirror", name: "Mirror Oath", level: 80, drain: 6, stats: { defMul: 1.08, triangle: 0.08 }, desc: "Defence plus triangle. For style swapping." },
    { id: "vow-star", name: "Star Oath", level: 105, drain: 8, stats: { magicMul: 1.1, preserveRune: 0.08 }, desc: "Late weave identity." },
    { id: "vow-ash", name: "Ash Oath", level: 22, drain: 2, stats: { strMul: 1.04 }, desc: "Tiny strength. Tutorial vaults." },
    { id: "vow-salt", name: "Salt Oath", level: 28, drain: 2, stats: { rangedMul: 1.04 }, desc: "Tiny mark." },
    { id: "vow-ink", name: "Ink Oath", level: 33, drain: 2, stats: { magicMul: 1.04 }, desc: "Tiny weave." },
    { id: "vow-final", name: "Final Oath", level: 120, drain: 12, stats: { accMul: 1.08, strMul: 1.08, defMul: 1.08, rangedMul: 1.08, magicMul: 1.08, smite: 0.1 }, desc: "Capstone. You will bury bones or you will go dark." }
  );

  npcs.push(
    { id: "dock-beggar", name: "Dock Beggar", level: 1, time: 5200, xp: 8, loot: [{ item: "coins", min: 1, max: 8, chance: 0.8 }], stun: 0.18, stunMs: 4000, desc: "Easy mark. Low coin." },
    { id: "lantern-clerk", name: "Lantern Clerk", level: 15, time: 6400, xp: 22, loot: [{ item: "coins", min: 8, max: 28, chance: 0.75 }, { item: "thread", min: 1, max: 1, chance: 0.2 }], stun: 0.22, stunMs: 5000 },
    { id: "ashfen-herbalist", name: "Ashfen Herbalist", level: 30, time: 7600, xp: 40, loot: [{ item: "herb-3", min: 1, max: 2, chance: 0.45 }, { item: "coins", min: 12, max: 40, chance: 0.7 }], stun: 0.26, stunMs: 6000 },
    { id: "bastion-guard", name: "Bastion Guard", level: 45, time: 8800, xp: 62, loot: [{ item: "bar-4", min: 1, max: 1, chance: 0.12 }, { item: "coins", min: 20, max: 70, chance: 0.7 }], stun: 0.32, stunMs: 8000 },
    { id: "choir-monk", name: "Choir Monk", level: 60, time: 9600, xp: 90, loot: [{ item: "essence", min: 1, max: 3, chance: 0.3 }, { item: "rune-mind", min: 2, max: 8, chance: 0.25 }], stun: 0.28, stunMs: 7000 },
    { id: "star-merchant", name: "Star Merchant", level: 78, time: 10400, xp: 125, loot: [{ item: "gem-6", min: 1, max: 1, chance: 0.08 }, { item: "coins", min: 40, max: 160, chance: 0.75 }], stun: 0.35, stunMs: 9000 },
    { id: "void-diplomat", name: "Void Diplomat", level: 95, time: 11600, xp: 180, loot: [{ item: "potion-10", min: 1, max: 1, chance: 0.06 }, { item: "coins", min: 80, max: 260, chance: 0.7 }], stun: 0.4, stunMs: 11000 },
    { id: "veil-regent", name: "Veil Regent", level: 112, time: 12800, xp: 260, loot: [{ item: "dungeon-key", min: 1, max: 1, chance: 0.04 }, { item: "coins", min: 120, max: 400, chance: 0.65 }], stun: 0.45, stunMs: 13000, desc: "Endgame pickpocket. Stun hurts." }
  );

  const pillarCats = [
    { id: "tempo", name: "Tempo", options: [
      { id: "stride", name: "Long Stride", skillSpeed: 0.03, time: 1 },
      { id: "sprint", name: "Sprint Latch", skillSpeed: 0.06, hp: -4, time: 1.15 },
      { id: "measure", name: "Measured Step", skillSpeed: 0.02, xpMul: 0.03, time: 0.95 }
    ]},
    { id: "fortune", name: "Fortune", options: [
      { id: "coin", name: "Coin Bell", gpMul: 0.06, time: 1 },
      { id: "rare", name: "Rare Chime", rareMul: 0.08, gpMul: -0.02, time: 1.05 },
      { id: "preserve", name: "Thrifty Hands", preserve: 0.05, time: 1 }
    ]},
    { id: "war", name: "War", options: [
      { id: "edge", name: "Edge Wind", accMul: 0.04, time: 1 },
      { id: "hide", name: "Hide Wind", defMul: 0.05, time: 1 },
      { id: "blood", name: "Blood Wind", leech: 0.03, hp: -6, time: 1.1 }
    ]},
    { id: "craft", name: "Craft", options: [
      { id: "yield", name: "Yield Knot", outputMul: 0.04, time: 1 },
      { id: "mastery", name: "Mastery Knot", masteryMul: 0.08, time: 1.05 },
      { id: "burn", name: "Clean Burn", burnReduce: 0.2, time: 0.98 }
    ]},
    { id: "star", name: "Star", options: [
      { id: "chart", name: "Open Chart", chartXp: 0.1, time: 1 },
      { id: "veil", name: "Veil Lean", allXp: 0.02, time: 1.12 },
      { id: "rest", name: "Rest Gate", offlineMul: 0.08, time: 1.08 }
    ]}
  ];
  coursePillars.push(...pillarCats);

  animals.push(
    { id: "gloom-ewe", name: "Gloom Ewe", level: 1, produce: "hide", qty: 1, time: 72000, xp: 12, rare: { item: "thread", chance: 0.1 } },
    { id: "ash-hen", name: "Ash Hen", level: 12, produce: "feather", qty: 3, time: 56000, xp: 18, rare: { item: "food-1", chance: 0.08 } },
    { id: "salt-goat", name: "Salt Goat", level: 28, produce: "herb-3", qty: 1, time: 84000, xp: 32, rare: { item: "seed-3", chance: 0.12 } },
    { id: "choir-ox", name: "Choir Ox", level: 44, produce: "hide", qty: 3, time: 108000, xp: 50, rare: { item: "bones", chance: 0.2 } },
    { id: "star-moth", name: "Star Moth", level: 62, produce: "essence", qty: 1, time: 98000, xp: 74, rare: { item: "rune-star", chance: 0.07 } },
    { id: "void-ram", name: "Void Ram", level: 80, produce: "bar-8", qty: 1, time: 140000, xp: 110, rare: { item: "potion-8", chance: 0.04 } },
    { id: "veil-stag", name: "Veil Stag", level: 100, produce: "gem-7", qty: 1, time: 168000, xp: 160, rare: { item: "dungeon-key", chance: 0.03 } }
  );

  constellations.push(
    { id: "the-hatchet", name: "The Hatchet", skill: "timber", bonus: { speed: 0.05, rare: 0.04 }, studyTime: 24000, xp: 20, desc: "Grove luck and tempo." },
    { id: "the-net", name: "The Net", skill: "trawl", bonus: { speed: 0.05, output: 0.03 }, studyTime: 24000, xp: 20 },
    { id: "the-pick", name: "The Pick", skill: "vein", bonus: { speed: 0.05, gem: 0.05 }, studyTime: 24000, xp: 20 },
    { id: "the-hearth", name: "The Hearth", skill: "hearth", bonus: { burnReduce: 0.15, xp: 0.04 }, studyTime: 27000, xp: 24 },
    { id: "the-anvil", name: "The Anvil", skill: "anvil", bonus: { preserve: 0.04, xp: 0.04 }, studyTime: 27000, xp: 24 },
    { id: "the-blade", name: "The Blade", skill: "might", bonus: { acc: 0.04, str: 0.04 }, studyTime: 30000, xp: 28 },
    { id: "the-bow", name: "The Bow", skill: "mark", bonus: { ranged: 0.05, preserveAmmo: 0.06 }, studyTime: 30000, xp: 28 },
    { id: "the-crozier", name: "The Crozier", skill: "weave", bonus: { magic: 0.05, preserveRune: 0.06 }, studyTime: 30000, xp: 28 },
    { id: "the-veil", name: "The Veil", skill: "all", bonus: { allXp: 0.02, rare: 0.02 }, studyTime: 42000, xp: 40, desc: "Soft global. You cannot run every constellation at full power — slots are scarce." }
  );

  SKILLS.forEach((sk) => {
    const tasks = [];
    for (let i = 1; i <= 10; i++) {
      const need = Math.round(40 * Math.pow(1.85, i - 1));
      tasks.push({
        id: `${sk.id}-g${i}`,
        name: `${sk.name} Guild ${i}`,
        skill: sk.id,
        need,
        bonus: guildBonus(sk.kind, i),
        desc: `Complete ${need.toLocaleString()} ${sk.name} actions (or hits, for war-arts).`
      });
    }
    guildTasks[sk.id] = tasks;
  });

  quests.push(
    { id: "q-wake", name: "Wake in the Hollow", desc: "Chop Drift groves. The citadel notices hands that work.", req: [{ type: "action", id: "timber-0", count: 3 }], reward: { coins: 40, xp: { timber: 30 }, items: [{ id: "drift-hatchet", qty: 1 }] } },
    { id: "q-fire", name: "First Ember", desc: "Burn those logs. Ash is civilization.", req: [{ type: "action", id: "ember-0", count: 3 }], reward: { coins: 40, xp: { ember: 40 }, items: [{ id: "food-0", qty: 12 }] } },
    { id: "q-fish", name: "Docks at Dusk", desc: "Pull Drift catches. The river feeds the line.", req: [{ type: "action", id: "trawl-0", count: 4 }], reward: { coins: 50, items: [{ id: "drift-rod", qty: 1 }] } },
    { id: "q-cook", name: "Salt and Pan", desc: "Cook the catch. Combat without food is a dare.", req: [{ type: "action", id: "cook-0", count: 4 }], reward: { coins: 50, items: [{ id: "food-0", qty: 24 }] } },
    { id: "q-blood", name: "First Blood", desc: "Fight in Cinder Docks. Equip food. Watch the triangle.", req: [{ type: "kills", area: "Cinder Docks", count: 4 }], reward: { coins: 80, xp: { might: 80, vitality: 80 }, items: [{ id: "dock-warden", qty: 1 }, { id: "potion-0", qty: 3 }, { id: "hide", qty: 4 }] } },
    { id: "q-anvil", name: "Open the Vein", desc: "Mine Drift ore, smelt it, and hammer a saber. The anvil is the spine.", req: [{ type: "action", id: "vein-0", count: 6 }, { type: "action", id: "smelt-0", count: 3 }, { type: "action", id: "smith-drift-saber", count: 1 }], reward: { coins: 120, items: [{ id: "copper-pick", qty: 1 }, { id: "thread", qty: 6 }] } },
    { id: "q-loom", name: "Cut and Stitch", desc: "Sew Drift hide into a cape. War-drops become a loadout.", req: [{ type: "action", id: "loom-drift-hide-cape", count: 1 }], reward: { coins: 120, items: [{ id: "lantern-cape", qty: 1 }, { id: "hide", qty: 8 }] } },
    { id: "q-bounty", name: "Take a Contract", desc: "Finish a bounty. Tokens buy identity, not just more damage.", req: [{ type: "bounty", count: 1 }], reward: { coins: 150, items: [{ id: "bounty-token", qty: 8 }, { id: "food-1", qty: 20 }] } },
    { id: "q-vault", name: "Dock Vault", desc: "Clear Dock Vault. Sequential kills, no cowardice.", req: [{ type: "dungeon", id: "dock-vault" }], reward: { coins: 200, items: [{ id: "dungeon-key", qty: 2 }, { id: "food-1", qty: 16 }] } },
    { id: "whisper-dock-beggar", name: "Quiet Hands", desc: "Pickpocket the Dock Beggar. Stun is the tax.", req: [{ type: "action", id: "whisper-dock-beggar", count: 12 }], reward: { coins: 100, xp: { whisper: 160 }, items: [{ id: "veil-circlet", qty: 1 }] } },
    { id: "q-soil", name: "A Plot of Dusk", desc: "Harvest Drift crops. Soil ticks while you war.", req: [{ type: "harvest", count: 6 }], reward: { coins: 140, items: [{ id: "seed-1", qty: 8 }, { id: "copper-rod", qty: 1 }] } },
    { id: "q-drove", name: "Keep a Ewe", desc: "Collect Gloom Ewe hide. Ranching is a second clock.", req: [{ type: "drove", animal: "gloom-ewe", count: 8 }], reward: { coins: 140, items: [{ id: "thread", qty: 24 }] } },
    { id: "q-chart", name: "Name a Star", desc: "Study The Hatchet until Chart 10.", req: [{ type: "level", skill: "chart", level: 10 }], reward: { coins: 160, items: [{ id: "star-signet", qty: 1 }] } },
    { id: "q-course", name: "Raise a Circuit", desc: "Run 24 laps with pillars chosen. Course is a build, not a grind bar.", req: [{ type: "laps", count: 24 }], reward: { coins: 180, xp: { course: 300 }, items: [{ id: "food-2", qty: 16 }] } },
    { id: "q-choir", name: "Choir Spire", desc: "Clear Choir Spire. Bring a style that isn't your comfort pick.", req: [{ type: "dungeon", id: "choir-spire" }], reward: { coins: 1200, items: [{ id: "runebound-crozier", qty: 1 }] } },
    { id: "q-vow", name: "Keep an Oath", desc: "Reach Vow 30. Prayers drain; bones refill the well.", req: [{ type: "level", skill: "vow", level: 30 }], reward: { coins: 400, items: [{ id: "iron-amulet", qty: 1 }] } },
    { id: "q-guild", name: "Join a Guild", desc: "Complete any skill's Guild 3. Mastery Guilds are the long game.", req: [{ type: "guildRank", rank: 3 }], reward: { coins: 600, items: [{ id: "iron-hatchet", qty: 1 }, { id: "iron-rod", qty: 1 }] } },
    { id: "q-starwell", name: "Starwell", desc: "Clear Starwell. Late mid-game wall.", req: [{ type: "dungeon", id: "starwell" }], reward: { coins: 4000, items: [{ id: "celestial-saber", qty: 1 }] } },
    { id: "q-veilheart", name: "Veilheart", desc: "Clear Veilheart. The citadel's last locked door.", req: [{ type: "dungeon", id: "veilheart" }], reward: { coins: 24000, items: [{ id: "veilborn-amulet", qty: 1 }] } },
    { id: "q-cap", name: "One Hundred and Twenty", desc: "Reach level 120 in any skill. The MI2 cap is the horizon.", req: [{ type: "anyLevel", level: 120 }], reward: { coins: 60000, items: [{ id: "veilborn-cleaver", qty: 1 }] } }
  );

  SKILLS.forEach((sk) => {
    pets.push({
      id: `pet-${sk.id}`,
      name: petName(sk.id),
      skill: sk.id,
      chance: 0.00035,
      bonus: { xp: 0.03, rare: 0.02 },
      desc: `A quiet companion from ${sk.name}. Tiny, permanent, collectible.`
    });
  });

  // Whisper actions from NPCs
  npcs.forEach((n) => {
    actions[`whisper-${n.id}`] = {
      id: `whisper-${n.id}`, skill: "whisper", name: n.name, level: n.level, time: n.time,
      xp: n.xp, masteryId: `whisper-${n.id}`, npc: n, desc: n.desc || "Pickpocket."
    };
  });

  // Course lap action
  actions["course-lap"] = {
    id: "course-lap", skill: "course", name: "Run the Circuit", level: 1, time: 14000,
    xp: 20, masteryId: "course-lap", desc: "Time and bonuses depend on chosen pillars."
  };

  constellations.forEach((c) => {
    actions[`chart-study-${c.id}`] = {
      id: `chart-study-${c.id}`, skill: "chart", name: `Study ${c.name}`, level: 1,
      time: c.studyTime, xp: c.xp, masteryId: `chart-${c.id}`,
      desc: c.desc || `Bind insight toward ${c.skill}.`
    };
  });

  return imprintContent({
    items, actions, monsters, areas, dungeons, shop, quests, guildTasks,
    npcs, spells, prayers, potions, pets, constellations, coursePillars, animals, crops,
    logs, ores, bars, fish, cooked, herbs, gems, runes
  });
}

function guildBonus(kind, i) {
  const n = i / 10;
  if (kind === "gather") return { speed: 0.015 * i, rare: 0.01 * i, label: `+${(1.5 * i).toFixed(1)}% speed, +${i}% rares` };
  if (kind === "artisan") return { preserve: 0.012 * i, xp: 0.01 * i, label: `+${(1.2 * i).toFixed(1)}% preserve, +${i}% XP` };
  if (kind === "unique") return { xp: 0.015 * i, output: 0.01 * i, label: `+${(1.5 * i).toFixed(1)}% XP, +${i}% yield` };
  return { acc: 0.008 * i, def: 0.008 * i, label: `+${(0.8 * i).toFixed(1)}% accuracy & defence` };
}

function petName(skill) {
  const map = {
    timber: "Splinter", trawl: "Puddle", vein: "Pebble", ember: "Cinderkit",
    hearth: "Skillet", anvil: "Clink", fletch: "Nock", loom: "Mothkin",
    sigil: "Glyphling", vial: "Drip", course: "Dash", whisper: "Pick",
    soil: "Sprout", drove: "Lambent", chart: "Wink", might: "Fang",
    guard: "Shell", vitality: "Pulse", mark: "Bead", weave: "Spark",
    vow: "Wick", bounty: "Tick"
  };
  return map[skill] || "Companion";
}
