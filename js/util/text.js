const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeMergeKey(key) {
  return typeof key === "string" && !DANGEROUS_KEYS.has(key);
}

export function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64ToUtf8(str) {
  const bin = atob(String(str || "").trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function clampName(name) {
  return String(name || "Aelric").replace(/[<>]/g, "").slice(0, 32) || "Aelric";
}
