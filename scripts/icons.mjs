#!/usr/bin/env node
/** Resize branding/icon.png into PWA and store densities using pngjs. */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const branding = join(root, "branding");
mkdirSync(branding, { recursive: true });

const srcPath = existsSync(join(branding, "icon.png"))
  ? join(branding, "icon.png")
  : "/opt/cursor/artifacts/assets/icon.png";

if (!existsSync(srcPath)) {
  console.error("No source icon at", srcPath);
  process.exit(1);
}

if (srcPath !== join(branding, "icon.png")) {
  copyFileSync(srcPath, join(branding, "icon.png"));
}

const src = PNG.sync.read(readFileSync(join(branding, "icon.png")));

function nearest(size) {
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x / size) * src.width));
      const sy = Math.min(src.height - 1, Math.floor((y / size) * src.height));
      const si = (sy * src.width + sx) << 2;
      const di = (y * size + x) << 2;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return PNG.sync.write(out);
}

for (const size of [48, 72, 96, 128, 144, 180, 192, 256, 384, 512]) {
  writeFileSync(join(branding, `icon-${size}.png`), nearest(size));
}

function letterbox(w, h) {
  const out = new PNG({ width: w, height: h });
  const bg = [12, 7, 20, 255];
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = bg[0];
    out.data[i + 1] = bg[1];
    out.data[i + 2] = bg[2];
    out.data[i + 3] = bg[3];
  }
  const side = Math.min(w, h);
  const ox = Math.floor((w - side) / 2);
  const oy = Math.floor((h - side) / 2);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x / side) * src.width));
      const sy = Math.min(src.height - 1, Math.floor((y / side) * src.height));
      const si = (sy * src.width + sx) << 2;
      const di = ((oy + y) * w + (ox + x)) << 2;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return PNG.sync.write(out);
}

writeFileSync(join(branding, "splash-2732.png"), letterbox(2732, 2732));
writeFileSync(join(branding, "splash-portrait.png"), letterbox(1242, 2688));

function writeIco(path, sizes) {
  const pngs = sizes.map((s) => nearest(s));
  const count = pngs.length;
  let offset = 6 + 16 * count;
  const dir = [];
  for (let i = 0; i < count; i++) {
    dir.push({ size: sizes[i], bytes: pngs[i].length, offset });
    offset += pngs[i].length;
  }
  const buf = Buffer.alloc(offset);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(count, 4);
  let o = 6;
  for (const e of dir) {
    buf.writeUInt8(e.size >= 256 ? 0 : e.size, o);
    buf.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1);
    buf.writeUInt8(0, o + 2);
    buf.writeUInt8(0, o + 3);
    buf.writeUInt16LE(1, o + 4);
    buf.writeUInt16LE(32, o + 6);
    buf.writeUInt32LE(e.bytes, o + 8);
    buf.writeUInt32LE(e.offset, o + 12);
    o += 16;
  }
  for (const png of pngs) {
    png.copy(buf, o);
    o += png.length;
  }
  writeFileSync(path, buf);
}
writeIco(join(branding, "icon.ico"), [16, 32, 48, 256]);
console.log("Wrote branding icons from", src.width, "x", src.height);
