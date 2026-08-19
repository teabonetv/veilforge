import { wandererRanks, gearSet, weightKg } from "../engine/wanderer.js";
import { CONTENT, XP_TABLE, MAX_LEVEL, skillLevel, bankCount, bankCap, bankUsed } from "../engine/state.js";
import { playerStats, equipItem } from "../engine/combat.js";
import { silhouetteStyle } from "../scene/models.js";

const SLOTS = [
  { id: "helm", label: "Hood", side: "left", i: 0 },
  { id: "cape", label: "Cape", side: "right", i: 0 },
  { id: "weapon", label: "Main-hand", side: "right", i: 1 },
  { id: "shield", label: "Off-hand", side: "left", i: 1 },
  { id: "body", label: "Body", side: "left", i: 2 },
  { id: "ammo", label: "Quiver", side: "right", i: 2 },
  { id: "gloves", label: "Gloves", side: "left", i: 3 },
  { id: "ring", label: "Ring", side: "right", i: 3 },
  { id: "legs", label: "Legs", side: "left", i: 4 },
  { id: "boots", label: "Boots", side: "right", i: 4 },
  { id: "amulet", label: "Relic", side: "left", i: 5 }
];

export let desk = "workshop";
export let vaultPick = { kind: "item", id: "log-0" };
export let kitMode = "custom";
let vaultFilter = "";
let vaultCat = "held";
let vaultLens = "items";

export function setDesk(id) {
  desk = id;
}

export function setVaultPick(kind, id) {
  vaultPick = { kind, id };
}

export function applyKit(state, mode) {
  kitMode = mode;
  if (mode === "prayer" || mode === "custom") return;
  const style = mode === "melee" ? "might" : mode === "ranged" ? "mark" : "weave";
  const pool = Object.keys(state.bank).concat(Object.values(state.equipment).filter(Boolean));
  const bestW = pool.map((id) => CONTENT.items[id]).filter((it) => it?.slot === "weapon" && it.style === style)
    .sort((a, b) => ((b.stats?.str || b.stats?.ranged || b.stats?.magic || 0) - (a.stats?.str || a.stats?.ranged || a.stats?.magic || 0)))[0];
  if (bestW && state.equipment.weapon !== bestW.id && bankCount(state, bestW.id)) equipItem(state, bestW.id);
  const bestB = pool.map((id) => CONTENT.items[id]).filter((it) => it?.slot === "body" && it.style === style)
    .sort((a, b) => (b.stats?.def || 0) - (a.stats?.def || 0))[0];
  if (bestB && state.equipment.body !== bestB.id && bankCount(state, bestB.id)) equipItem(state, bestB.id);
}

export function renderDesks(ctx) {
  const app = document.getElementById("app");
  if (app) app.dataset.desk = desk;
  document.getElementById("layout")?.classList.toggle("away", desk !== "workshop");
  const bankEl = document.getElementById("bank-desk");
  const wandEl = document.getElementById("wander-desk");
  if (bankEl) {
    bankEl.hidden = desk !== "bank";
    if (desk === "bank") renderVault(ctx);
  }
  if (wandEl) {
    wandEl.hidden = desk !== "loadout";
    if (desk === "loadout") renderWanderer(ctx);
  }
  document.querySelectorAll("#desk-nav [data-arg]").forEach((b) => {
    b.classList.toggle("on", b.dataset.arg === desk);
  });
  ctx.portraits?.sync?.(ctx);
}

function catOf(it) {
  if (!it) return "other";
  if (it.slot === "weapon") return "weapons";
  if (it.category === "equipment") return "armour";
  if (it.category === "food" || it.heal) return "food";
  return it.category || "other";
}

function renderVault(ctx) {
  const { state } = ctx;
  const search = document.getElementById("vault-search");
  if (search && document.activeElement !== search) search.value = vaultFilter;
  const held = Object.entries(state.bank).filter(([, n]) => n > 0);
  const chips = [["held", "In vault"], ["weapons", "Weapons"], ["armour", "Armour"], ["food", "Food"], ["log", "Timber"], ["all", "Compendium"]]
    .map(([id, lab]) => `<button type="button" class="${vaultCat === id ? "on" : ""}" data-act="vault-cat" data-arg="${id}">${lab}</button>`).join("");
  const lens = [["items", "Items"], ["monsters", "Monsters"], ["dungeons", "Dungeons"], ["actions", "Actions"]]
    .map(([id, lab]) => `<button type="button" class="${vaultLens === id ? "on" : ""}" data-act="vault-lens" data-arg="${id}">${lab}</button>`).join("");

  let tiles = "";
  if (vaultLens === "items") {
    let list = vaultCat === "all"
      ? Object.values(CONTENT.items)
      : held.map(([id]) => CONTENT.items[id]).filter(Boolean);
    if (vaultCat !== "held" && vaultCat !== "all") list = list.filter((it) => catOf(it) === vaultCat || it.category === vaultCat);
    if (vaultFilter) list = list.filter((it) => `${it.name} ${it.voice}`.toLowerCase().includes(vaultFilter));
    tiles = list.slice(0, 220).map((it) => tile("item", it.id, it.name, bankCount(state, it.id), it.model)).join("");
  } else if (vaultLens === "monsters") {
    let list = Object.values(CONTENT.monsters);
    if (vaultFilter) list = list.filter((m) => `${m.name} ${m.area}`.toLowerCase().includes(vaultFilter));
    tiles = list.slice(0, 180).map((m) => tile("monster", m.id, m.name, state.combat.kills?.[m.id] || 0, m.model)).join("");
  } else if (vaultLens === "dungeons") {
    tiles = CONTENT.dungeons
      .filter((d) => !vaultFilter || d.name.toLowerCase().includes(vaultFilter))
      .map((d) => tile("dungeon", d.id, d.name, (state.combat.dungeonClears || {})[d.id] || 0, d.model)).join("");
  } else {
    let list = Object.values(CONTENT.actions);
    if (vaultFilter) list = list.filter((a) => a.name.toLowerCase().includes(vaultFilter));
    tiles = list.slice(0, 180).map((a) => tile("action", a.id, a.name, state.actionCounts?.[a.id] || 0, a.model)).join("");
  }

  document.getElementById("vault-chips").innerHTML = `<div class="tabs">${lens}</div><div class="tabs">${chips}</div>`;
  document.getElementById("vault-grid").innerHTML = tiles || "<p class='blurb'>Nothing in this drawer.</p>";
  document.getElementById("vault-meta").textContent = `${held.length}/${bankCap(state)} unique stacks`;
  renderInspect(ctx);
}

function tile(kind, id, name, qty, model) {
  const st = silhouetteStyle(model || {});
  const on = vaultPick.kind === kind && vaultPick.id === id ? "on" : "";
  return `<button type="button" class="vtile ${on}" data-act="vault-pick" data-kind="${kind}" data-arg="${id}" style="background:${st.background};border-color:${st.borderColor};border-radius:${st.borderRadius};box-shadow:${st.boxShadow}">
    <span class="vqty">${qty ? qty.toLocaleString() : ""}</span>
    <span class="vnm">${name}</span>
  </button>`;
}

function renderInspect(ctx) {
  const el = document.getElementById("vault-copy");
  if (!el) return;
  const { kind, id } = vaultPick;
  if (kind === "item") {
    const it = CONTENT.items[id];
    if (!it) return;
    const n = bankCount(ctx.state, id);
    el.innerHTML = `<h3>${it.name}</h3>
      <p class="temper">${it.temper} · ${it.catalogName || ""}</p>
      <blockquote>${it.voice}</blockquote>
      <p class="blurb">${it.desc || ""}</p>
      <p class="muted">${it.category}${it.slot ? " · " + it.slot : ""} · ${n.toLocaleString()} held · ${it.value || 0} ✦</p>
      ${it.stats ? `<p class="muted">Acc ${it.stats.acc || 0} · Str ${it.stats.str || 0} · Def ${it.stats.def || 0} · HP ${it.stats.hp || 0}</p>` : ""}
      <div class="acts">${(it.category === "equipment" || it.category === "tool" || it.category === "ammo") ? `<button data-act="equip" data-arg="${id}">Equip</button>` : ""}
        ${n ? `<button data-act="sell" data-arg="${id}">Sell one</button>` : ""}</div>`;
  } else if (kind === "monster") {
    const m = CONTENT.monsters[id];
    if (!m) return;
    el.innerHTML = `<h3>${m.name}</h3>
      <p class="temper">${m.temper} · ${m.style} · ${m.area}</p>
      <blockquote>${m.voice}</blockquote>
      <p class="blurb">${m.desc || ""}</p>
      <p class="muted">HP ${m.hp} · max hit ${m.maxHit} · interval ${(m.interval / 1000).toFixed(1)}s · slayer ${m.slayerReq}</p>
      <button data-act="fight" data-arg="${id}">Hunt</button>`;
  } else if (kind === "dungeon") {
    const d = CONTENT.dungeons.find((x) => x.id === id);
    if (!d) return;
    el.innerHTML = `<h3>${d.name}</h3>
      <p class="temper">${d.temper} · ${d.sequence.length} floors · ${d.bossName}</p>
      <blockquote>${d.voice}</blockquote>
      <p class="blurb">${d.desc || ""}</p>
      <button data-act="dungeon" data-arg="${id}">Enter</button>`;
  } else {
    const a = CONTENT.actions[id];
    if (!a) return;
    el.innerHTML = `<h3>${a.name}</h3>
      <p class="temper">${a.temper} · ${a.skill} ${a.level}</p>
      <blockquote>${a.voice}</blockquote>
      <p class="blurb">${a.desc || ""}</p>
      <p class="muted">${((a.time || 0) / 1000).toFixed(1)}s base · ${a.xp} xp</p>
      <button data-act="start" data-arg="${id}">Commit this job</button>`;
  }
}

export function renderWanderer(ctx) {
  const { state } = ctx;
  const r = wandererRanks(state);
  const st = playerStats(state);
  const set = gearSet(state);
  const w = weightKg(state);
  const pct = Math.min(100, 100 * w.kg / w.cap);
  const stars = "★".repeat(r.stars) + "☆".repeat(5 - r.stars);
  const vit = skillLevel(state, "vitality");
  const next = XP_TABLE[Math.min(MAX_LEVEL, vit + 1)];
  const prev = XP_TABLE[vit];
  const xp = state.skills.vitality.xp;
  const xpPct = next === prev ? 100 : Math.min(100, 100 * (xp - prev) / (next - prev));
  const wpn = CONTENT.items[state.equipment.weapon];

  document.getElementById("wander-profile").innerHTML = `
    <div class="w-name">${state.name || "Aelric"}</div>
    <div class="w-title">${r.title}</div>
    <div class="w-stars">${stars}</div>
    <div class="w-lvls"><div><em>${r.combat}</em><span>Combat</span></div><div><em>${r.idle}</em><span>Idle</span></div></div>
    <div class="xpbar"><i style="width:${xpPct}%"></i><span>${Math.floor(xp).toLocaleString()} / ${next.toLocaleString()} vitality xp</span></div>
    <blockquote>The dusk calls. We answer.</blockquote>
  `;

  const left = SLOTS.filter((s) => s.side === "left").map((s) => slotBtn(state, s)).join("");
  const right = SLOTS.filter((s) => s.side === "right").map((s) => slotBtn(state, s)).join("");
  document.getElementById("wander-slots-l").innerHTML = left;
  document.getElementById("wander-slots-r").innerHTML = right;

  document.getElementById("wander-kits").innerHTML = ["melee", "ranged", "magic", "prayer", "custom"].map((k) =>
    `<button type="button" class="${kitMode === k ? "on" : ""}" data-act="kit" data-arg="${k}">${k}</button>`
  ).join("") + state.loadouts.map((l, i) =>
    `<button type="button" data-act="loadout-load" data-arg="${i}">${l.name}</button>`
  ).join("") + `<button type="button" data-act="loadout-save">Save</button>`;

  document.getElementById("wander-stats").innerHTML = `
    <div><span>Attack</span><b>${st.style === "might" ? st.acc.toFixed(0) : skillLevel(state, "might")}</b></div>
    <div><span>Strength</span><b>${st.style === "might" ? st.power.toFixed(0) : skillLevel(state, "might")}</b></div>
    <div><span>Ranged</span><b>${skillLevel(state, "mark")}</b></div>
    <div><span>Magic</span><b>${skillLevel(state, "weave")}</b></div>
    <div><span>Defence</span><b>${st.def.toFixed(0)}</b></div>
    <div><span>Constitution</span><b>${vit}</b></div>
  `;

  document.getElementById("wander-detail").innerHTML = `
    <section class="wd-card">
      <h4>${wpn?.name || "Empty hands"}</h4>
      <p class="muted">${wpn?.slot || "weapon"} · ${wpn?.special || "no special"}</p>
      <blockquote>${wpn?.voice || "A wanderer is still a person without a blade."}</blockquote>
      <p>Attack bonus +${wpn?.stats?.acc || 0} · Strength +${wpn?.stats?.str || 0}</p>
    </section>
    <section class="wd-card">
      <h4>Dusk set</h4>
      <p>${set ? `${set.n}/6 ${CONTENT.items[state.equipment.body]?.catalogName || "pieces"}` : "No matching set."}</p>
      <p class="blurb">${set?.bonus ? `Damage during committed hunts +${Math.round(set.bonus * 100)}%.` : "Wear three pieces of one tier to wake a set."}</p>
    </section>
    <section class="wd-card">
      <h4>Carried weight</h4>
      <p><b>${w.kg.toFixed(1)} / ${w.cap.toFixed(0)} kg</b></p>
      <div class="xpbar"><i style="width:${pct}%"></i><span>${Math.round(pct)}%</span></div>
      <p class="muted">${bankUsed(state)} unique stacks in the vault.</p>
    </section>
  `;
}

function slotBtn(state, s) {
  const id = state.equipment[s.id];
  const it = CONTENT.items[id];
  const st = silhouetteStyle(it?.model || { hue: 260, seed: 1 });
  return `<button type="button" class="wslot" data-act="slot-focus" data-arg="${s.id}" title="${s.label}" style="background:${st.background};border-color:${st.borderColor}">
    <em>${s.label}</em><span>${it ? it.name : "empty"}</span>
  </button>`;
}

export function onVaultSearch(v) {
  vaultFilter = v.toLowerCase();
}

export function onVaultCat(v) { vaultCat = v; }
export function onVaultLens(v) { vaultLens = v; }

export function inspectModelOf() {
  const { kind, id } = vaultPick;
  if (kind === "item") return CONTENT.items[id]?.model;
  if (kind === "monster") return CONTENT.monsters[id]?.model;
  if (kind === "dungeon") return CONTENT.dungeons.find((d) => d.id === id)?.model;
  if (kind === "action") return CONTENT.actions[id]?.model;
  return null;
}
