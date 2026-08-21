export function ensureLogbook(state) {
  if (!state.logbook || typeof state.logbook !== "object") {
    state.logbook = { items: {}, monsters: {}, dungeons: {}, pets: {}, first: {} };
  }
  state.logbook.items = state.logbook.items || {};
  state.logbook.monsters = state.logbook.monsters || {};
  state.logbook.dungeons = state.logbook.dungeons || {};
  state.logbook.pets = state.logbook.pets || {};
  state.logbook.first = state.logbook.first || {};
  return state.logbook;
}

export function noteItem(state, id) {
  if (!id || id === "coins") return;
  const lb = ensureLogbook(state);
  if (!lb.items[id]) {
    lb.items[id] = 1;
    lb.first[id] = Date.now();
  } else lb.items[id] += 1;
}

export function noteMonster(state, id) {
  if (!id) return;
  const lb = ensureLogbook(state);
  lb.monsters[id] = (lb.monsters[id] || 0) + 1;
  if (!lb.first[id]) lb.first[id] = Date.now();
}

export function noteDungeon(state, id) {
  if (!id) return;
  const lb = ensureLogbook(state);
  lb.dungeons[id] = (lb.dungeons[id] || 0) + 1;
  if (!lb.first[id]) lb.first[id] = Date.now();
}

export function notePet(state, id) {
  if (!id) return;
  const lb = ensureLogbook(state);
  lb.pets[id] = 1;
  if (!lb.first[id]) lb.first[id] = Date.now();
}

function pct(have, total) {
  if (!total) return 0;
  return Math.round((1000 * have) / total) / 10;
}

export function logbookStats(state, content) {
  content = content || { items: {}, monsters: {}, dungeons: [], pets: [] };
  const lb = ensureLogbook(state);
  const items = Object.keys(content.items || {}).filter((id) => id !== "coins");
  const monsters = Object.keys(content.monsters || {});
  const dungeons = (content.dungeons || []).map((d) => d.id);
  const pets = (content.pets || []).map((p) => p.id);
  const itemHave = items.filter((id) => lb.items[id] || (state.bank?.[id] || 0) > 0).length;
  const monHave = monsters.filter((id) => lb.monsters[id] || (state.combat?.kills?.[id] || 0) > 0).length;
  const dunHave = dungeons.filter((id) => lb.dungeons[id] || (state.combat?.dungeonClears || {})[id] > 0).length;
  const petHave = pets.filter((id) => lb.pets[id] || state.pets?.[id]).length;
  const parts = [
    { have: itemHave, total: items.length },
    { have: monHave, total: monsters.length },
    { have: dunHave, total: dungeons.length },
    { have: petHave, total: pets.length }
  ];
  const have = parts.reduce((n, p) => n + p.have, 0);
  const total = parts.reduce((n, p) => n + p.total, 0);
  return {
    items: { have: itemHave, total: items.length, pct: pct(itemHave, items.length) },
    monsters: { have: monHave, total: monsters.length, pct: pct(monHave, monsters.length) },
    dungeons: { have: dunHave, total: dungeons.length, pct: pct(dunHave, dungeons.length) },
    pets: { have: petHave, total: pets.length, pct: pct(petHave, pets.length) },
    totalPct: pct(have, total)
  };
}
