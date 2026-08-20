#!/usr/bin/env node
/** Scale Imagine atlases into assets/pix and emit unique eid → cell map. */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { CONTENT, SKILLS } from "../js/engine/state.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const art = "/opt/cursor/artifacts/assets";
const destDir = join(root, "assets/pix");
mkdirSync(destDir, { recursive: true });

const FILES = [
  "u-items-0.png", "u-items-1.png", "u-items-2.png", "u-items-3.png",
  "u-items-4.png", "u-items-5.png", "u-items-6.png", "u-items-7.png",
  "u-mon-0.png", "u-mon-1.png", "u-misc.png",
  "u-act-0.png", "u-act-1.png", "u-act-2.png", "u-act-3.png",
  "u-act-4.png", "u-act-5.png", "u-act-6.png"
];

function scalePng(src, dest, size) {
  const img = PNG.sync.read(readFileSync(src));
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x / size) * img.width));
      const sy = Math.min(img.height - 1, Math.floor((y / size) * img.height));
      const si = (sy * img.width + sx) << 2;
      const di = (y * size + x) << 2;
      out.data[di] = img.data[si];
      out.data[di + 1] = img.data[si + 1];
      out.data[di + 2] = img.data[si + 2];
      out.data[di + 3] = img.data[si + 3];
    }
  }
  writeFileSync(dest, PNG.sync.write(out));
}

for (const name of FILES) {
  const src = join(art, name);
  const dest = join(destDir, name);
  if (!existsSync(src)) {
    if (!existsSync(dest)) throw new Error("missing atlas " + name);
    continue;
  }
  scalePng(src, dest, 512);
}

const sheets = {
  i0: { src: "assets/pix/u-items-0.png", cols: 8, rows: 8 },
  i1: { src: "assets/pix/u-items-1.png", cols: 8, rows: 8 },
  i2: { src: "assets/pix/u-items-2.png", cols: 8, rows: 8 },
  i3: { src: "assets/pix/u-items-3.png", cols: 8, rows: 8 },
  i4: { src: "assets/pix/u-items-4.png", cols: 8, rows: 8 },
  i5: { src: "assets/pix/u-items-5.png", cols: 8, rows: 8 },
  i6: { src: "assets/pix/u-items-6.png", cols: 8, rows: 8 },
  i7: { src: "assets/pix/u-items-7.png", cols: 8, rows: 8 },
  m0: { src: "assets/pix/u-mon-0.png", cols: 8, rows: 8 },
  m1: { src: "assets/pix/u-mon-1.png", cols: 8, rows: 8 },
  misc: { src: "assets/pix/u-misc.png", cols: 8, rows: 8 },
  a0: { src: "assets/pix/u-act-0.png", cols: 8, rows: 8 },
  a1: { src: "assets/pix/u-act-1.png", cols: 8, rows: 8 },
  a2: { src: "assets/pix/u-act-2.png", cols: 8, rows: 8 },
  a3: { src: "assets/pix/u-act-3.png", cols: 8, rows: 8 },
  a4: { src: "assets/pix/u-act-4.png", cols: 8, rows: 8 },
  a5: { src: "assets/pix/u-act-5.png", cols: 8, rows: 8 },
  a6: { src: "assets/pix/u-act-6.png", cols: 8, rows: 8 },
  skills: { src: "assets/pix/atlas-skills.png", cols: 5, rows: 5 }
};

const eid = {};
function place(id, sheetId, index) {
  const sh = sheets[sheetId];
  const cap = sh.cols * sh.rows;
  if (index >= cap) throw new Error(`${sheetId} overflow at ${id}`);
  eid[id] = [sheetId, index % sh.cols, Math.floor(index / sh.cols)];
}
function fillSheets(ids, sheetIds) {
  let n = 0;
  for (const id of ids) {
    const si = Math.floor(n / 64);
    if (si >= sheetIds.length) throw new Error("no sheet left for " + id);
    place(id, sheetIds[si], n % 64);
    n += 1;
  }
}

const itemIds = Object.keys(CONTENT.items);
fillSheets(itemIds, ["i0", "i1", "i2", "i3", "i4", "i5", "i6", "i7"]);

const monIds = Object.keys(CONTENT.monsters);
fillSheets(monIds.slice(0, 128), ["m0", "m1"]);

const actIds = Object.keys(CONTENT.actions);
fillSheets(actIds, ["a0", "a1", "a2", "a3", "a4", "a5", "a6"]);

SKILLS.forEach((s, i) => {
  eid[s.id] = ["skills", i % 5, Math.floor(i / 5)];
});

const extras = [
  ...monIds.slice(128),
  ...CONTENT.dungeons.map((d) => d.id),
  ...CONTENT.pets.map((p) => p.id),
  "tab-workshop", "tab-bank", "tab-loadout",
  ...(CONTENT.quests || []).map((q) => q.id),
  ...(CONTENT.spells || []).map((x) => x.id),
  ...(CONTENT.prayers || []).map((x) => x.id),
  ...(CONTENT.constellations || []).map((x) => x.id),
  ...(CONTENT.chartRanks || []).map((x) => x.id),
  ...(CONTENT.animals || []).map((x) => x.id)
].filter((id) => id && !eid[id]);

const occupied = new Set(Object.values(eid).map((c) => c.join(":")));
const free = [];
for (const sheetId of ["misc", "a6", "i7", "m1"]) {
  const sh = sheets[sheetId];
  const cap = sh.cols * sh.rows;
  for (let i = 0; i < cap; i++) {
    const cell = [sheetId, i % sh.cols, Math.floor(i / sh.cols)];
    if (!occupied.has(cell.join(":"))) free.push(cell);
  }
}
if (extras.length > free.length) {
  throw new Error("no free cells for extras " + extras.length + "/" + free.length + " " + extras.slice(free.length).join(","));
}
extras.forEach((id, i) => { eid[id] = free[i]; });

const cellToIds = {};
for (const [id, cell] of Object.entries(eid)) {
  const k = cell.join(":");
  (cellToIds[k] ||= []).push(id);
}
const clashes = Object.entries(cellToIds).filter(([, ids]) => ids.length > 1);
if (clashes.length) {
  throw new Error("shared cells: " + clashes.map(([k, ids]) => k + "=" + ids.join("/")).join("; "));
}

const out = `/** Generated by scripts/pack-pix.mjs — unique Grok Imagine cells per entity id. */
export const PIX_SHEETS = ${JSON.stringify(sheets, null, 2)};
export const PIX_EID = ${JSON.stringify(eid, null, 2)};
`;
writeFileSync(join(root, "js/scene/pix-map.js"), out);
console.log(JSON.stringify({
  items: itemIds.length,
  monsters: monIds.length,
  actions: actIds.length,
  extras: extras.length,
  freeLeft: free.length - extras.length,
  eids: Object.keys(eid).length
}, null, 2));
