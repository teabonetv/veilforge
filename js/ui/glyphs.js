/** SVG stand-ins for lock, veilmarks, and the duel divider — not emoji. */
export function glyphLock(size = 12) {
  return `<svg class="gly lock" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="1.5" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
}

export function glyphMarks(size = 12) {
  return `<svg class="gly marks" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 4.2v7.6M6.1 6.4h3.8M6.1 9.6h3.8" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>`;
}

export function glyphVs(size = 18) {
  return `<svg class="gly vs" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function marksLabel(n) {
  return `${glyphMarks(11)} ${Math.floor(n).toLocaleString()}`;
}
