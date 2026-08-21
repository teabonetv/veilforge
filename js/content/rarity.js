export const RARITY = [
  { id: "common", name: "Common", token: "--rarity-common", weight: 1000 },
  { id: "uncommon", name: "Uncommon", token: "--rarity-uncommon", weight: 220 },
  { id: "rare", name: "Rare", token: "--rarity-rare", weight: 45 },
  { id: "exotic", name: "Exotic", token: "--rarity-exotic", weight: 8 },
  { id: "dusk", name: "Duskbound", token: "--rarity-dusk", weight: 1 }
];

const BY_ID = Object.fromEntries(RARITY.map((r) => [r.id, r]));

export function rarityOf(item) {
  const id = typeof item === "string" ? item : item?.rarity;
  return BY_ID[id] || BY_ID.common;
}

export function rarityClass(item) {
  return `rarity-${rarityOf(item).id}`;
}

export function rollRarity(rng = Math.random) {
  const total = RARITY.reduce((n, r) => n + r.weight, 0);
  let roll = rng() * total;
  for (const r of RARITY) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return BY_ID.common;
}
