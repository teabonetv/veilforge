#!/usr/bin/env node
/**
 * Copy the playable web game into www/ for Capacitor and Electron.
 * Does not copy .git, progress pages, or node_modules.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "www");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const dir of ["css", "js", "branding", "assets"]) {
  const src = join(root, dir);
  if (existsSync(src)) cpSync(src, join(dest, dir), { recursive: true });
}
if (!existsSync(join(dest, "assets", "pix", "u-items-0.png")) && !existsSync(join(dest, "assets", "pix", "atlas-items.png"))) {
  throw new Error("pack-web: missing assets/pix atlases");
}

cpSync(join(root, "manifest.webmanifest"), join(dest, "manifest.webmanifest"));
cpSync(join(root, "sw.js"), join(dest, "sw.js"));

writeFileSync(join(dest, "index.html"), readFileSync(join(root, "index.html"), "utf8"));

const hash = createHash("sha1");
for (const rel of ["index.html", "css/app.css", "js/main.js", "sw.js"]) {
  hash.update(readFileSync(join(dest, rel)));
}
const cacheName = "veilforge-" + hash.digest("hex").slice(0, 8);
const swPath = join(dest, "sw.js");
writeFileSync(swPath, readFileSync(swPath, "utf8").replace(/const CACHE = "[^"]+"/, `const CACHE = "${cacheName}"`));

writeFileSync(
  join(dest, "privacy.html"),
  readFileSync(join(root, "stores", "privacy.html"), "utf8")
);

if (!existsSync(join(dest, "branding", "icon.png"))) {
  console.warn("Missing branding/icon.png — run node scripts/icons.mjs");
}

console.log("Packed www/ for native shells.", cacheName);
