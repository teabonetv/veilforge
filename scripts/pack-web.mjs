#!/usr/bin/env node
/**
 * Copy the playable web game into www/ for Capacitor and Electron.
 * Does not copy .git, progress pages, or node_modules.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "www");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const dir of ["css", "js", "branding"]) {
  cpSync(join(root, dir), join(dest, dir), { recursive: true });
}

cpSync(join(root, "manifest.webmanifest"), join(dest, "manifest.webmanifest"));
cpSync(join(root, "sw.js"), join(dest, "sw.js"));

writeFileSync(join(dest, "index.html"), readFileSync(join(root, "index.html"), "utf8"));

writeFileSync(
  join(dest, "privacy.html"),
  readFileSync(join(root, "stores", "privacy.html"), "utf8")
);

if (!existsSync(join(dest, "branding", "icon.png"))) {
  console.warn("Missing branding/icon.png — run node scripts/icons.mjs");
}

console.log("Packed www/ for native shells.");
