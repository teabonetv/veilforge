import { PIX_EID, PIX_SHEETS } from "./pix-map.js";

function freeCells(prefer) {
  const used = new Set(Object.values(PIX_EID).map((c) => c.join(":")));
  const out = [];
  const ids = Object.keys(PIX_SHEETS);
  const ordered = prefer
    ? [...ids.filter((id) => prefer(id)), ...ids.filter((id) => !prefer(id))]
    : ids;
  for (const sid of ordered) {
    const sh = PIX_SHEETS[sid];
    for (let r = 0; r < sh.rows; r++) {
      for (let c = 0; c < sh.cols; c++) {
        const cell = [sid, c, r];
        if (!used.has(cell.join(":"))) out.push(cell);
      }
    }
  }
  return out;
}

function takeCell(prefer) {
  const free = freeCells(prefer);
  return free[0] || null;
}

export function assignPix(id, prefer) {
  if (!id || PIX_EID[id]) return PIX_EID[id];
  const cell = takeCell(prefer);
  if (!cell) return null;
  PIX_EID[id] = cell;
  return cell;
}

/** Assign leftover Imagine cells to newly authored ids so uniqueness tests stay honest. */
export function registerMissingPix(content) {
  const groups = [
    [Object.keys(content.items || {}), (sid) => sid.startsWith("i")],
    [Object.keys(content.monsters || {}), (sid) => sid.startsWith("m") || sid === "misc"],
    [(content.dungeons || []).map((d) => d.id), (sid) => sid === "misc" || sid.startsWith("m")],
    [(content.pets || []).map((p) => p.id), (sid) => sid.startsWith("m") || sid === "misc"],
    [Object.keys(content.actions || {}), (sid) => sid.startsWith("a") || sid === "misc"]
  ];
  for (const [ids, prefer] of groups) {
    for (const id of ids) {
      if (!id || PIX_EID[id]) continue;
      const cell = takeCell(prefer);
      if (!cell) break;
      PIX_EID[id] = cell;
    }
  }
}
