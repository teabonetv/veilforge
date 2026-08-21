/** 2D glyphs for bank, skills, and combat cards. Unique Imagine cells first, kind atlas as fallback. */
import { PIX_EID, PIX_SHEETS } from "./pix-map.js";

export const SKILL_ICON_KIND = {
  timber: "grove", trawl: "tide", vein: "seam", ember: "pyre", hearth: "oven",
  anvil: "forge", fletch: "rack", loom: "frame", sigil: "circle", vial: "alembic",
  course: "circuit", whisper: "mark", soil: "plot", drove: "pen", chart: "scope",
  might: "saber", guard: "shield", vitality: "food", mark: "bow", weave: "crozier",
  vow: "amulet", bounty: "token"
};

const SHEETS = {
  skills: { src: "assets/pix/atlas-skills.png", cols: 5, rows: 5 },
  items: { src: "assets/pix/atlas-items.png", cols: 6, rows: 6 },
  beasts: { src: "assets/pix/atlas-beasts.png", cols: 6, rows: 6 },
  gates: { src: "assets/pix/atlas-gates.png", cols: 4, rows: 3 }
};

/** Painted Grok Imagine atlases. Cell is [sheet, col, row]. */
const KIND_CELL = {
  grove: ["skills", 0, 0], tide: ["skills", 1, 0], seam: ["skills", 2, 0], pyre: ["skills", 3, 0], oven: ["skills", 4, 0],
  forge: ["skills", 0, 1], rack: ["skills", 1, 1], frame: ["skills", 2, 1], circle: ["skills", 3, 1], alembic: ["skills", 4, 1],
  circuit: ["skills", 0, 2], mark: ["skills", 1, 2], plot: ["skills", 2, 2], pen: ["skills", 3, 2], scope: ["skills", 4, 2],
  saber: ["skills", 0, 3], shield: ["skills", 1, 3], food: ["skills", 2, 3], bow: ["skills", 3, 3], crozier: ["skills", 4, 3],
  amulet: ["skills", 0, 4], token: ["skills", 1, 4], compost: ["skills", 2, 4], dust: ["skills", 3, 4], pouch: ["skills", 4, 4],
  log: ["items", 0, 0], ore: ["items", 1, 0], bar: ["items", 2, 0], fish: ["items", 3, 0],
  cleaver: ["items", 0, 1], needle: ["items", 1, 1], helm: ["items", 4, 1], body: ["items", 5, 1], hidebody: ["items", 5, 0], robe: ["items", 4, 0],
  legs: ["items", 0, 2], boots: ["items", 1, 2], gloves: ["items", 2, 2], cape: ["items", 4, 2],
  ring: ["items", 0, 3], ammo: ["items", 1, 3], axe: ["items", 2, 3], pick: ["items", 3, 3], rod: ["items", 4, 3], potion: ["items", 5, 3],
  rune: ["items", 0, 4], gem: ["items", 1, 4], herb: ["items", 2, 4], seed: ["items", 3, 4],
  coins: ["items", 4, 5], currency: ["items", 2, 5], bones: ["items", 5, 5], hide: ["items", 3, 2],
  ashes: ["items", 5, 4], key: ["items", 4, 4], essence: ["items", 0, 5], material: ["items", 1, 5], fodder: ["skills", 3, 2],
  thread: ["skills", 2, 1], feather: ["items", 3, 5],
  "beast-rat": ["beasts", 0, 0], "beast-wolf": ["beasts", 2, 0], "beast-bat": ["beasts", 3, 0], "beast-spider": ["beasts", 4, 0],
  "beast-knight": ["beasts", 5, 0], "beast-moth": ["beasts", 0, 1], "beast-imp": ["beasts", 1, 1], "beast-crab": ["beasts", 2, 1],
  "beast-hydra": ["beasts", 3, 1], "beast-ghoul": ["beasts", 4, 1], "beast-troll": ["beasts", 5, 1], "beast-golem": ["beasts", 0, 2],
  "beast-drake": ["beasts", 1, 2], "beast-serpent": ["beasts", 2, 2], "beast-wraith": ["beasts", 3, 2], "beast-stag": ["beasts", 4, 2],
  "beast-brute": ["beasts", 5, 2], "beast-might": ["beasts", 0, 3], "beast-mark": ["beasts", 1, 3], "beast-weave": ["beasts", 2, 3],
  "boss-cultist": ["beasts", 3, 3], "boss-ghoul": ["beasts", 4, 3], "boss-troll": ["beasts", 5, 3], "boss-oath": ["beasts", 0, 4],
  "boss-codex": ["beasts", 1, 4], tome: ["beasts", 1, 4], "boss-ledger": ["beasts", 2, 4], "boss-crab": ["beasts", 3, 4], "boss-hydra": ["beasts", 4, 4],
  "boss-drake": ["beasts", 5, 4], "boss-colossus": ["beasts", 0, 5],
  "gate-vault": ["gates", 0, 0], "gate-sewer": ["gates", 1, 0], "gate-fen": ["gates", 2, 0], "gate-spire": ["gates", 3, 0],
  "gate-pyre": ["gates", 0, 1], "gate-keep": ["gates", 1, 1], "gate-well": ["gates", 2, 1], "gate-heart": ["gates", 3, 1],
  "gate-stacks": ["gates", 0, 2], "gate-page": ["gates", 1, 2], gate: ["gates", 2, 2]
};

function pixCell(kind) {
  if (KIND_CELL[kind]) return KIND_CELL[kind];
  if (kind?.startsWith("gate")) return KIND_CELL.gate;
  if (kind?.startsWith("beast-")) return KIND_CELL["beast-might"];
  if (kind?.startsWith("boss-")) return KIND_CELL["boss-colossus"];
  return null;
}

function sheetOf(sheetId) {
  return PIX_SHEETS[sheetId] || SHEETS[sheetId];
}

export function iconMarkup(model = {}, size = 64) {
  const kind = model.kind || "material";
  const unique = model.eid && PIX_EID[model.eid];
  const typed = pixCell(kind);
  const cell = unique || typed;
  if (cell) {
    const [sheetId, c, r] = cell;
    const sh = sheetOf(sheetId);
    if (!sh) return "";
    return `<span class="pix pix-${kind}" style="background-image:url('${sh.src}');background-size:${sh.cols * 100}% ${sh.rows * 100}%;background-position:${(c / Math.max(1, sh.cols - 1)) * 100}% ${(r / Math.max(1, sh.rows - 1)) * 100}%"></span>`;
  }
  const hue = ((model.hue ?? 270) % 360 + 360) % 360;
  const seed = model.seed || 1;
  const fill = `hsl(${hue} 52% 54%)`;
  const deep = `hsl(${hue} 40% 18%)`;
  const gold = "#e8c9a0";
  const inner = drawKind(kind, seed, fill, deep, gold);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
}

export function iconUrl(model, size = 64) {
  return `url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconMarkup(model, size))}')`;
}

export function iconDataUri(model, size = 64) {
  return `data:image/svg+xml,${encodeURIComponent(iconMarkup(model, size))}`;
}

function drawKind(kind, seed, fill, deep, gold) {
  const v = seed % 3;
  const bg = `<rect width="64" height="64" rx="10" fill="${deep}"/>`;
  const k = kind.startsWith("gate-") ? "gate" : kind;
  switch (k) {
    case "log":
    case "grove":
      return bg + `<rect x="26" y="18" width="12" height="34" rx="3" fill="${fill}"/><ellipse cx="32" cy="18" rx="${16 + v * 2}" ry="12" fill="${gold}"/>`;
    case "ore":
    case "seam":
      return bg + `<polygon points="18,44 32,14 48,44" fill="${fill}"/><polygon points="28,44 38,28 46,44" fill="${gold}"/>`;
    case "bar":
      return bg + `<rect x="10" y="26" width="44" height="12" rx="2" fill="${fill}"/><rect x="14" y="22" width="36" height="8" rx="2" fill="${gold}"/>`;
    case "fish":
    case "tide":
      return bg + `<ellipse cx="30" cy="32" rx="16" ry="9" fill="${fill}"/><polygon points="44,32 58,22 58,42" fill="${gold}"/>`;
    case "food":
    case "oven":
      return bg + `<ellipse cx="32" cy="38" rx="18" ry="10" fill="${fill}"/><ellipse cx="32" cy="28" rx="10" ry="8" fill="${gold}"/>`;
    case "saber":
      return bg + `<rect x="30" y="8" width="5" height="40" fill="${fill}"/><rect x="22" y="40" width="20" height="5" fill="${gold}"/><rect x="29" y="45" width="7" height="10" fill="${deep}" stroke="${gold}" stroke-width="1"/>`;
    case "cleaver":
      return bg + `<rect x="18" y="14" width="28" height="22" rx="2" fill="${fill}"/><rect x="14" y="32" width="8" height="22" fill="${gold}"/>`;
    case "needle":
      return bg + `<rect x="30" y="8" width="3" height="44" fill="${fill}"/><circle cx="32" cy="54" r="5" fill="${gold}"/>`;
    case "bow":
      return bg + `<path d="M18 12 Q48 32 18 52" fill="none" stroke="${fill}" stroke-width="5"/><line x1="22" y1="14" x2="22" y2="50" stroke="${gold}" stroke-width="2"/>`;
    case "crozier":
      return bg + `<rect x="30" y="16" width="5" height="38" fill="${fill}"/><circle cx="38" cy="16" r="8" fill="none" stroke="${gold}" stroke-width="4"/>`;
    case "helm":
      return bg + `<path d="M16 40 Q16 14 32 12 Q48 14 48 40 Z" fill="${fill}"/><rect x="22" y="30" width="20" height="6" fill="${gold}"/>`;
    case "body":
      return bg + `<rect x="18" y="16" width="28" height="36" rx="4" fill="${fill}"/><rect x="24" y="22" width="16" height="8" fill="${gold}"/>`;
    case "hidebody":
      return bg + `<path d="M16 18 L32 12 L48 18 L46 52 L18 52 Z" fill="${fill}"/><ellipse cx="32" cy="28" rx="8" ry="5" fill="${gold}"/>`;
    case "robe":
      return bg + `<path d="M20 14 Q32 8 44 14 L50 54 Q32 46 14 54 Z" fill="${fill}"/><rect x="28" y="20" width="8" height="18" fill="${gold}"/>`;
    case "legs":
      return bg + `<rect x="18" y="18" width="12" height="32" fill="${fill}"/><rect x="34" y="18" width="12" height="32" fill="${fill}"/>`;
    case "boots":
      return bg + `<rect x="12" y="30" width="16" height="18" rx="3" fill="${fill}"/><rect x="36" y="30" width="16" height="18" rx="3" fill="${fill}"/>`;
    case "gloves":
      return bg + `<rect x="10" y="24" width="18" height="16" rx="4" fill="${fill}"/><rect x="36" y="24" width="18" height="16" rx="4" fill="${fill}"/>`;
    case "shield":
      return bg + `<path d="M32 8 L52 18 V36 Q32 56 12 36 V18 Z" fill="${fill}"/><circle cx="32" cy="30" r="7" fill="${gold}"/>`;
    case "cape":
      return bg + `<path d="M20 12 Q32 8 44 12 L48 52 Q32 46 16 52 Z" fill="${fill}"/>`;
    case "amulet":
      return bg + `<circle cx="32" cy="20" r="10" fill="none" stroke="${gold}" stroke-width="3"/><polygon points="32,30 40,48 24,48" fill="${fill}"/>`;
    case "ring":
      return bg + `<circle cx="32" cy="34" r="14" fill="none" stroke="${gold}" stroke-width="6"/><circle cx="32" cy="34" r="7" fill="${fill}"/>`;
    case "ammo":
      return bg + `<rect x="12" y="28" width="40" height="4" fill="${fill}"/><polygon points="52,30 62,24 62,36" fill="${gold}"/>`;
    case "axe":
      return bg + `<rect x="28" y="10" width="6" height="42" fill="${gold}"/><path d="M34 12 L54 22 L34 32 Z" fill="${fill}"/>`;
    case "pick":
      return bg + `<rect x="28" y="14" width="6" height="38" fill="${gold}"/><rect x="12" y="16" width="40" height="8" fill="${fill}"/>`;
    case "rod":
      return bg + `<line x1="16" y1="52" x2="48" y2="12" stroke="${fill}" stroke-width="4"/><circle cx="50" cy="12" r="5" fill="${gold}"/>`;
    case "potion":
    case "alembic":
      return bg + `<circle cx="32" cy="38" r="14" fill="${fill}"/><rect x="26" y="12" width="12" height="14" fill="${gold}"/>`;
    case "rune":
    case "circle":
      return bg + `<circle cx="32" cy="32" r="18" fill="none" stroke="${gold}" stroke-width="4"/><polygon points="32,16 40,40 24,40" fill="${fill}"/>`;
    case "gem":
      return bg + `<polygon points="32,10 50,32 32,54 14,32" fill="${fill}"/><polygon points="32,18 42,32 32,46 22,32" fill="${gold}"/>`;
    case "herb":
    case "seed":
    case "plot":
      return bg + `<rect x="28" y="28" width="8" height="24" fill="${gold}"/><ellipse cx="32" cy="24" rx="14" ry="12" fill="${fill}"/>`;
    case "gate":
      return bg + `<rect x="12" y="12" width="8" height="40" fill="${fill}"/><rect x="44" y="12" width="8" height="40" fill="${fill}"/><rect x="12" y="12" width="40" height="8" fill="${gold}"/><circle cx="32" cy="36" r="6" fill="${gold}"/>`;
    case "forge":
    case "pyre":
      return bg + `<rect x="14" y="36" width="36" height="16" fill="${deep}" stroke="${fill}"/><polygon points="32,12 44,38 20,38" fill="${gold}"/>`;
    case "scope":
      return bg + `<rect x="10" y="28" width="36" height="8" rx="3" fill="${fill}"/><circle cx="48" cy="32" r="10" fill="none" stroke="${gold}" stroke-width="4"/>`;
    case "circuit":
      return bg + `<circle cx="32" cy="32" r="18" fill="none" stroke="${fill}" stroke-width="4"/><rect x="28" y="18" width="8" height="28" fill="${gold}"/>`;
    case "rack":
      return bg + `<rect x="10" y="40" width="44" height="6" fill="${gold}"/>` + [16, 24, 32, 40, 48].map((x) => `<rect x="${x}" y="12" width="3" height="30" fill="${fill}"/>`).join("");
    case "frame":
      return bg + `<rect x="12" y="12" width="40" height="40" fill="none" stroke="${gold}" stroke-width="5"/><rect x="18" y="18" width="28" height="28" fill="${fill}"/>`;
    case "mark":
      return bg + `<circle cx="32" cy="32" r="8" fill="${gold}"/><circle cx="32" cy="32" r="18" fill="none" stroke="${fill}" stroke-width="3"/>`;
    case "pen":
      return bg + `<rect x="10" y="20" width="44" height="28" fill="none" stroke="${gold}" stroke-width="4"/><ellipse cx="26" cy="36" rx="8" ry="6" fill="${fill}"/><ellipse cx="40" cy="38" rx="7" ry="5" fill="${fill}"/>`;
    case "coins":
    case "currency":
      return bg + `<circle cx="24" cy="34" r="12" fill="${gold}"/><circle cx="40" cy="30" r="12" fill="${fill}"/>`;
    case "bones":
      return bg + `<rect x="14" y="28" width="36" height="8" rx="4" fill="${gold}"/><circle cx="14" cy="32" r="8" fill="${fill}"/><circle cx="50" cy="32" r="8" fill="${fill}"/>`;
    case "hide":
      return bg + `<ellipse cx="32" cy="34" rx="18" ry="14" fill="${fill}"/><ellipse cx="32" cy="28" rx="10" ry="6" fill="${gold}"/>`;
    case "essence":
      return bg + `<circle cx="32" cy="32" r="16" fill="none" stroke="${gold}" stroke-width="3"/><circle cx="32" cy="32" r="7" fill="${fill}"/>`;
    case "dust":
      return bg + `<circle cx="24" cy="28" r="6" fill="${fill}"/><circle cx="38" cy="24" r="5" fill="${gold}"/><circle cx="34" cy="40" r="7" fill="${fill}"/>`;
    case "material":
      return bg + `<rect x="16" y="16" width="32" height="32" rx="2" fill="${fill}"/><rect x="22" y="22" width="20" height="8" fill="${gold}"/>`;
    case "ashes":
      return bg + `<ellipse cx="32" cy="42" rx="18" ry="8" fill="${fill}"/><circle cx="24" cy="28" r="5" fill="${gold}"/><circle cx="38" cy="24" r="4" fill="${gold}"/>`;
    case "pouch":
      return bg + `<path d="M20 28 Q32 12 44 28 L46 48 Q32 54 18 48 Z" fill="${fill}"/><rect x="26" y="16" width="12" height="8" fill="${gold}"/>`;
    case "compost":
      return bg + `<rect x="16" y="22" width="32" height="28" rx="4" fill="${fill}"/><ellipse cx="32" cy="22" rx="14" ry="6" fill="${gold}"/>`;
    case "fodder":
      return bg + `<rect x="12" y="30" width="40" height="16" rx="3" fill="${fill}"/><rect x="18" y="18" width="8" height="16" fill="${gold}"/><rect x="38" y="18" width="8" height="16" fill="${gold}"/>`;
    case "thread":
      return bg + `<circle cx="32" cy="32" r="16" fill="none" stroke="${gold}" stroke-width="5"/><circle cx="32" cy="32" r="6" fill="${fill}"/>`;
    case "feather":
      return bg + `<path d="M18 48 L32 10 L46 48" fill="${fill}"/><line x1="32" y1="16" x2="32" y2="48" stroke="${gold}" stroke-width="3"/>`;
    case "key":
      return bg + `<circle cx="22" cy="24" r="10" fill="none" stroke="${gold}" stroke-width="4"/><rect x="28" y="20" width="26" height="8" fill="${fill}"/>`;
    case "token":
      return bg + `<polygon points="32,8 40,24 58,24 44,36 50,54 32,42 14,54 20,36 6,24 24,24" fill="${gold}"/>`;
    case "beast-rat":
      return bg + `<ellipse cx="34" cy="36" rx="16" ry="10" fill="${fill}"/><circle cx="18" cy="28" r="8" fill="${fill}"/><rect x="8" y="20" width="4" height="16" fill="${gold}"/>`;
    case "beast-wolf":
      return bg + `<ellipse cx="36" cy="38" rx="16" ry="9" fill="${fill}"/><polygon points="18,20 28,32 12,32" fill="${fill}"/><polygon points="22,16 30,30 14,30" fill="${gold}"/>`;
    case "beast-bat":
      return bg + `<path d="M8 36 Q20 12 32 28 Q44 12 56 36 Q32 48 8 36" fill="${fill}"/><circle cx="32" cy="30" r="5" fill="${gold}"/>`;
    case "beast-spider":
      return bg + `<circle cx="32" cy="32" r="10" fill="${fill}"/>` + [0, 1, 2, 3].map((i) => `<line x1="32" y1="32" x2="${12 + i * 14}" y2="${i < 2 ? 12 : 52}" stroke="${gold}" stroke-width="3"/>`).join("");
    case "beast-knight":
      return bg + `<rect x="22" y="22" width="20" height="26" fill="${fill}"/><circle cx="32" cy="16" r="8" fill="${gold}"/><rect x="18" y="28" width="6" height="22" fill="${gold}"/>`;
    case "beast-moth":
      return bg + `<ellipse cx="20" cy="32" rx="12" ry="16" fill="${fill}"/><ellipse cx="44" cy="32" rx="12" ry="16" fill="${fill}"/><rect x="30" y="18" width="4" height="28" fill="${gold}"/>`;
    case "beast-crab":
    case "boss-crab":
      return bg + `<ellipse cx="32" cy="36" rx="18" ry="12" fill="${fill}"/><rect x="8" y="24" width="10" height="6" fill="${gold}"/><rect x="46" y="24" width="10" height="6" fill="${gold}"/>`;
    case "beast-hydra":
    case "boss-hydra":
      return bg + `<ellipse cx="32" cy="44" rx="16" ry="8" fill="${fill}"/><circle cx="20" cy="20" r="7" fill="${gold}"/><circle cx="32" cy="14" r="7" fill="${gold}"/><circle cx="44" cy="20" r="7" fill="${gold}"/>`;
    case "beast-ghoul":
      return bg + `<circle cx="32" cy="20" r="10" fill="${fill}"/><rect x="22" y="28" width="20" height="24" fill="${fill}"/><rect x="26" y="22" width="12" height="6" fill="${gold}"/>`;
    case "beast-troll":
    case "beast-brute":
      return bg + `<rect x="16" y="20" width="32" height="32" rx="4" fill="${fill}"/><rect x="22" y="10" width="20" height="14" fill="${gold}"/>`;
    case "beast-drake":
    case "boss-drake":
      return bg + `<polygon points="12,44 52,32 18,18" fill="${fill}"/><polygon points="48,20 60,12 52,32" fill="${gold}"/>`;
    case "beast-golem":
    case "boss-colossus":
      return bg + `<rect x="18" y="14" width="28" height="38" fill="${fill}"/><rect x="24" y="20" width="16" height="10" fill="${gold}"/>`;
    case "beast-serpent":
      return bg + `<path d="M12 44 Q24 12 36 36 Q44 52 56 20" fill="none" stroke="${fill}" stroke-width="8"/><circle cx="56" cy="18" r="6" fill="${gold}"/>`;
    case "beast-wraith":
      return bg + `<path d="M32 10 Q48 28 32 58 Q16 28 32 10" fill="${fill}"/><circle cx="32" cy="24" r="5" fill="${gold}"/>`;
    case "beast-stag":
      return bg + `<ellipse cx="34" cy="40" rx="14" ry="10" fill="${fill}"/><path d="M24 18 L20 8 M24 18 L28 8 M40 18 L36 8 M40 18 L44 8" stroke="${gold}" stroke-width="3"/><circle cx="24" cy="22" r="6" fill="${fill}"/>`;
    case "beast-imp":
      return bg + `<circle cx="32" cy="34" r="12" fill="${fill}"/><polygon points="20,20 24,32 16,32" fill="${gold}"/><polygon points="44,20 48,32 40,32" fill="${gold}"/>`;
    case "beast-might":
      return bg + `<rect x="16" y="28" width="32" height="22" fill="${fill}"/><rect x="22" y="14" width="20" height="16" fill="${fill}"/><polygon points="24,12 22,4 28,12" fill="${gold}"/><polygon points="40,12 42,4 36,12" fill="${gold}"/>`;
    case "beast-mark":
      return bg + `<circle cx="32" cy="24" r="10" fill="${fill}"/><polygon points="32,32 48,52 16,52" fill="${fill}"/><rect x="12" y="22" width="40" height="4" fill="${gold}"/>`;
    case "beast-weave":
      return bg + `<polygon points="32,10 50,32 32,54 14,32" fill="${fill}"/><circle cx="32" cy="32" r="10" fill="none" stroke="${gold}" stroke-width="3"/>`;
    case "boss-cultist":
      return bg + `<path d="M18 54 L32 10 L46 54 Z" fill="${fill}"/><circle cx="32" cy="22" r="6" fill="${gold}"/>`;
    case "boss-ghoul":
      return bg + `<circle cx="32" cy="18" r="10" fill="${gold}"/><rect x="20" y="26" width="24" height="28" fill="${fill}"/>`;
    case "boss-troll":
      return bg + `<rect x="14" y="18" width="36" height="34" fill="${fill}"/><circle cx="24" cy="30" r="4" fill="${gold}"/><circle cx="40" cy="30" r="4" fill="${gold}"/>`;
    case "boss-oath":
      return bg + `<rect x="20" y="16" width="24" height="36" fill="${fill}"/><path d="M32 8 L40 20 L24 20 Z" fill="${gold}"/>`;
    case "boss-codex":
    case "tome":
      return bg + `<rect x="16" y="14" width="32" height="40" fill="${gold}"/><rect x="20" y="18" width="24" height="32" fill="${fill}"/>`;
    case "boss-ledger":
      return bg + `<rect x="12" y="16" width="40" height="36" fill="${fill}"/><line x1="18" y1="26" x2="46" y2="26" stroke="${gold}" stroke-width="3"/><line x1="18" y1="36" x2="46" y2="36" stroke="${gold}" stroke-width="3"/>`;
    default:
      return bg + `<polygon points="32,12 48,32 32,52 16,32" fill="${fill}"/>`;
  }
}

export function monsterKindFor(m) {
  const n = `${m.id} ${m.name || ""} ${m.catalogName || ""} ${m.bossName || ""}`.toLowerCase();
  if (m.dungeonOnly) {
    if (/crab/.test(n)) return "boss-crab";
    if (/hydra/.test(n)) return "boss-hydra";
    if (/cultist/.test(n)) return "boss-cultist";
    if (/ghoul/.test(n)) return "boss-ghoul";
    if (/troll/.test(n)) return "boss-troll";
    if (/drake/.test(n)) return "boss-drake";
    if (/colossus|heart/.test(n)) return "boss-colossus";
    if (/oath/.test(n)) return "boss-oath";
    if (/codex|stacks/.test(n)) return "boss-codex";
    if (/page|ledger|primus/.test(n)) return "boss-ledger";
    return "boss-colossus";
  }
  if (/mite|rat|tick|beetle/.test(n)) return "beast-rat";
  if (/wolf|hound|hyena|jackal|mastiff|boar|lion/.test(n)) return "beast-wolf";
  if (/bat|owl|gull/.test(n)) return "beast-bat";
  if (/spider|widow|wasp|ant/.test(n)) return "beast-spider";
  if (/knight|squire|pikeman|paladin|duelist|sarge|monk|priest|captain|archer|nun/.test(n)) return "beast-knight";
  if (/moth|imp/.test(n)) return /imp/.test(n) ? "beast-imp" : "beast-moth";
  if (/crab/.test(n)) return "beast-crab";
  if (/hydra|naga|serpent|eel|leviathan/.test(n)) return /hydra/.test(n) ? "beast-hydra" : "beast-serpent";
  if (/ghoul|wight|spectre|shade|wraith|ghost|horror/.test(n)) return /wraith|spectre|shade/.test(n) ? "beast-wraith" : "beast-ghoul";
  if (/troll|golem|titan|giant|colossus|tyrant|heart|sovereign|king|god|judge|autarch/.test(n)) return /golem|colossus|titan/.test(n) ? "beast-golem" : "beast-troll";
  if (/drake|dragon/.test(n)) return "beast-drake";
  if (/stag|ewe|hen|goat/.test(n)) return "beast-stag";
  if (/hag|siren|thief|cultist|cantor/.test(n)) return "beast-ghoul";
  if (m.special === "burst") return "beast-brute";
  if (m.special === "poison") return "beast-serpent";
  if (m.special === "drain") return "beast-wraith";
  return `beast-${m.style || "might"}`;
}

export function dungeonKindFor(d) {
  const n = `${d.id} ${d.name || ""} ${d.catalogName || ""}`.toLowerCase();
  if (/dock|vault/.test(n) && /dock/.test(n)) return "gate-vault";
  if (/sewer|reliquary/.test(n)) return "gate-sewer";
  if (/fen|crown/.test(n) && /fen/.test(n)) return "gate-fen";
  if (/choir|spire/.test(n)) return "gate-spire";
  if (/pyre|cathedral/.test(n)) return "gate-pyre";
  if (/oathkeep|keep/.test(n)) return "gate-keep";
  if (/starwell|well/.test(n)) return "gate-well";
  if (/veilheart|heart/.test(n)) return "gate-heart";
  if (/silent|stacks/.test(n)) return "gate-stacks";
  if (/last page|page/.test(n)) return "gate-page";
  return "gate";
}
