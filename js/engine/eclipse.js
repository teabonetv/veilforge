const MODS = [
  { id: "famine", name: "Famine", desc: "Food heals half. The larder is a prayer.", foodMul: 0.5 },
  { id: "harvest", name: "Harvest Moon", desc: "Gather yields run fat.", outputMul: 0.2 },
  { id: "blood", name: "Blood Dusk", desc: "Combat XP thickens.", combatXp: 0.2 },
  { id: "quiet", name: "Quiet Marks", desc: "Whisper stun tax thins.", stunMul: 0.7 },
  { id: "forge", name: "Forge Night", desc: "Anvil and Ember run hot.", artisanSpeed: 0.12 },
  { id: "veil", name: "Thin Veil", desc: "Rares show themselves.", rareMul: 0.15 },
  { id: "stone", name: "Stonewatch", desc: "Hits taken cut a sliver.", takenMul: 0.92 },
  { id: "wild", name: "Wild Circuit", desc: "Course laps pay extra.", courseXp: 0.25 },
  { id: "salt", name: "Salt Wind", desc: "Trawl and Hearth hurry.", gatherSpeed: 0.1 },
  { id: "oath", name: "Oath Ember", desc: "Vow drains slower.", vowDrain: 0.8 },
  { id: "ledger", name: "Open Ledger", desc: "Quest XP on every seal doubles this week.", questXp: 1 },
  { id: "echo", name: "Long Echo", desc: "The Echo's depth record glows. Sidegrades drop easier.", echoRare: 0.25 },
  { id: "calm", name: "Still Citadel", desc: "A quiet week. No hook, no tax.", },
  { id: "market", name: "Lantern Tide", desc: "Quay bargain deepens.", quayMul: 0.9 }
];

export function weekNumber(now = Date.now()) {
  return Math.floor(now / 86400000 / 7);
}

function lcg(seed) {
  let rng = seed >>> 0;
  return () => {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    return rng / 0x100000000;
  };
}

export function weeklyEclipse(now = Date.now()) {
  const week = weekNumber(now);
  const rand = lcg(week * 9973 + 20260821);
  const mod = MODS[Math.floor(rand() * MODS.length)];
  return { week, ...mod };
}

export function dailySeed(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function dailyModifier(now = Date.now()) {
  const seed = dailySeed(now);
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = lcg(h >>> 0);
  const mod = MODS[Math.floor(rand() * MODS.length)];
  return { seed, ...mod };
}
