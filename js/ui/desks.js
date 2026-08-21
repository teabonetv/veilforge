import { wandererRanks, weightKg } from "../engine/wanderer.js";
import { CONTENT, XP_TABLE, MAX_LEVEL, skillLevel, bankCount, bankCap, bankUsed, bankValue } from "../engine/state.js";
import { playerStats, equipItem, gearSetInfo } from "../engine/combat.js";
import { silhouetteStyle } from "../scene/models.js";
import { iconMarkup } from "../scene/icons.js";
import { escapeHtml } from "../util/text.js";
import { QUAY_BOOTHS, inferBooth, offerModel, offerName, quayDeal, offerPrice, quayGossip, hungerStacks, plainStock, pawnRate, isHungerItem, quayCommissions } from "../engine/market.js";
import { glyphMarks, glyphLock } from "./glyphs.js";
import { ledgerStats, collectUniqueIds } from "../engine/ledger.js";
import { logbookStats } from "../engine/logbook.js";
import { ACHIEVEMENTS } from "../content/achievements.js";
import { currentCommission } from "../engine/commissions.js";
import { fetchScores } from "../engine/scores.js";
import { rarityOf } from "../content/rarity.js";
import { deedMedals } from "../engine/deeds.js";
import { weeklyEclipse } from "../engine/eclipse.js";

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
export let focusedSlot = "weapon";
let vaultFilter = "";
let vaultCat = "held";
let vaultLens = "items";
let stallBooth = "tools";
let stallPick = null;
let stallFilter = "";
let stallPacks = 1;
let codexTab = "beasts";
let hiscoreRows = [];
let hiscoreAsked = false;

export function setDesk(id) {
  desk = id;
}

export function setVaultPick(kind, id) {
  vaultPick = { kind, id };
}

export function setFocusedSlot(slot) {
  focusedSlot = slot || "weapon";
}

export function applyKit(state, mode) {
  kitMode = mode;
  if (mode === "custom") return;
  const pool = Object.keys(state.bank).concat(Object.values(state.equipment).filter(Boolean));
  const best = (slot, pred, statKeys) => pool.map((id) => CONTENT.items[id])
    .filter((it) => it?.slot === slot && pred(it))
    .sort((a, b) => statScore(b, statKeys) - statScore(a, statKeys))[0];
  const wear = (it) => {
    if (!it || state.equipment[it.slot] === it.id) return;
    if (bankCount(state, it.id)) equipItem(state, it.id);
  };
  if (mode === "prayer") {
    for (const slot of ["helm", "body", "legs", "boots", "shield", "gloves", "cape"]) {
      wear(best(slot, () => true, ["def", "hp"]));
    }
    return;
  }
  const style = mode === "melee" ? "might" : mode === "ranged" ? "mark" : "weave";
  const wstat = style === "mark" ? ["ranged", "acc"] : style === "weave" ? ["magic", "acc"] : ["str", "acc"];
  wear(best("weapon", (it) => it.style === style, wstat));
  for (const slot of ["helm", "body", "legs", "boots", "gloves", "cape", "amulet", "ring", "shield"]) {
    wear(best(slot, (it) => !it.style || it.style === style, ["def", "hp"]));
  }
  if (style === "mark") wear(best("ammo", () => true, ["ranged", "acc"]));
}

function statScore(it, keys) {
  return keys.reduce((n, k) => n + (it?.stats?.[k] || 0), 0);
}

export function renderDesks(ctx) {
  const app = document.getElementById("app");
  if (app) app.dataset.desk = desk;
  document.getElementById("layout")?.classList.toggle("away", desk !== "workshop");
  const bankEl = document.getElementById("bank-desk");
  const wandEl = document.getElementById("wander-desk");
  const stallEl = document.getElementById("stall-desk");
  const codexEl = document.getElementById("codex-desk");
  if (bankEl) {
    bankEl.hidden = desk !== "bank";
    if (desk === "bank") renderVault(ctx);
  }
  if (wandEl) {
    wandEl.hidden = desk !== "loadout";
    if (desk === "loadout") renderWanderer(ctx);
  }
  if (stallEl) {
    stallEl.hidden = desk !== "stall";
    if (desk === "stall") renderStall(ctx);
  }
  if (codexEl) {
    codexEl.hidden = desk !== "codex";
    if (desk === "codex") renderCodexDesk(ctx);
  }
  document.querySelectorAll("#desk-nav [data-arg]").forEach((b) => {
    b.classList.toggle("on", b.dataset.arg === desk);
    if (b.querySelector(".dico")) return;
    const kind = b.dataset.arg === "stall" ? "coins" : b.dataset.arg === "bank" ? "pouch" : b.dataset.arg === "loadout" ? "saber" : b.dataset.arg === "codex" ? "tome" : "forge";
    b.insertAdjacentHTML("afterbegin", `<span class="dico">${iconMarkup({ eid: "tab-" + b.dataset.arg, kind }, 28)}</span>`);
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
  const lens = [["items", "Items"], ["monsters", "Monsters"], ["dungeons", "Gates"], ["uniques", "Uniques"], ["quests", "Pages"], ["pets", "Pets"], ["actions", "Actions"]]
    .map(([id, lab]) => `<button type="button" class="${vaultLens === id ? "on" : ""}" data-act="vault-lens" data-arg="${id}">${lab}</button>`).join("");

  let tiles = "";
  if (vaultLens === "items") {
    let list = vaultCat === "all"
      ? Object.values(CONTENT.items)
      : held.map(([id]) => CONTENT.items[id]).filter(Boolean);
    if (vaultCat !== "held" && vaultCat !== "all") list = list.filter((it) => catOf(it) === vaultCat || it.category === vaultCat);
    if (vaultFilter) list = list.filter((it) => `${it.name} ${it.voice}`.toLowerCase().includes(vaultFilter));
    tiles = list.map((it) => tile("item", it.id, it.name, bankCount(state, it.id), it.model)).join("");
  } else if (vaultLens === "monsters") {
    let list = Object.values(CONTENT.monsters);
    if (vaultFilter) list = list.filter((m) => `${m.name} ${m.area}`.toLowerCase().includes(vaultFilter));
    tiles = list.map((m) => tile("monster", m.id, m.name, state.combat.kills?.[m.id] || 0, m.model)).join("");
  } else if (vaultLens === "dungeons") {
    tiles = CONTENT.dungeons
      .filter((d) => !vaultFilter || d.name.toLowerCase().includes(vaultFilter))
      .map((d) => tile("dungeon", d.id, d.name, (state.combat.dungeonClears || {})[d.id] || 0, d.model)).join("");
  } else if (vaultLens === "uniques") {
    const ids = collectUniqueIds();
    tiles = ids.map((id) => {
      const it = CONTENT.items[id];
      const found = !!(ctx.state.logbook?.items?.[id] || bankCount(ctx.state, id));
      return tile("item", id, found ? (it?.name || id) : "????", found ? (bankCount(ctx.state, id) || 1) : 0, it?.model, found ? "" : "locked logslot");
    }).join("");
  } else if (vaultLens === "quests") {
    tiles = CONTENT.quests.map((q) => {
      const done = (ctx.state.quests.done || []).includes(q.id);
      return tile("quest", q.id, done ? q.name : "Sealed page", done ? 1 : 0, q.model, done ? "" : "locked logslot");
    }).join("");
  } else if (vaultLens === "pets") {
    const owned = CONTENT.pets.filter((p) => state.pets?.[p.id]).length;
    tiles = `<p class="pet-head">${owned} / ${CONTENT.pets.length} companions</p>` + CONTENT.pets
      .filter((p) => !vaultFilter || p.name.toLowerCase().includes(vaultFilter) || p.skill.includes(vaultFilter.toLowerCase()))
      .map((p) => {
        const on = !!state.pets?.[p.id];
        const label = on ? p.name : "????";
        const qty = on ? 1 : 0;
        return tile("pet", p.id, label, qty, p.model, on ? "" : "locked");
      }).join("");
  } else {
    let list = Object.values(CONTENT.actions);
    if (vaultFilter) list = list.filter((a) => a.name.toLowerCase().includes(vaultFilter));
    tiles = list.map((a) => tile("action", a.id, a.name, state.actionCounts?.[a.id] || 0, a.model)).join("");
  }

  document.getElementById("vault-chips").innerHTML = `<div class="tabs">${lens}</div><div class="tabs">${chips}</div>`;
  document.getElementById("vault-grid").innerHTML = tiles || "<p class='blurb'>Nothing in this drawer.</p>";
  document.getElementById("vault-meta").innerHTML = `${held.length}/${bankCap(state)} unique stacks · ${glyphMarks(11)} ${bankValue(state).toLocaleString()}`;
  renderInspect(ctx);
}

function tile(kind, id, name, qty, model, extra = "") {
  const st = silhouetteStyle(model || {});
  const on = vaultPick.kind === kind && vaultPick.id === id ? "on" : "";
  return `<button type="button" class="vtile ${on} ${extra}" data-act="vault-pick" data-kind="${kind}" data-arg="${id}" style="background-color:#12081a;border-color:${st.borderColor}">
    <span class="vico">${iconMarkup(model || {}, 48)}</span>
    ${extra.includes("locked") ? `<span class="lock-corner">${glyphLock(10)}</span>` : ""}
    <span class="vqty">${qty ? qty.toLocaleString() : ""}</span>
    <span class="vnm">${escapeHtml(name)}</span>
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
      <p class="muted">${it.category}${it.slot ? " · " + it.slot : ""} · ${n.toLocaleString()} held · ${glyphMarks(11)} ${it.value || 0} · ${rarityOf(it).name}</p>
      ${it.stats ? `<p class="muted">Acc ${it.stats.acc || 0} · Str ${it.stats.str || 0} · Ranged ${it.stats.ranged || 0} · Magic ${it.stats.magic || 0} · Def ${it.stats.def || 0} · HP ${it.stats.hp || 0}</p>` : ""}
      ${it.heal ? `<p class="muted">Heals ${it.heal}</p>` : ""}
      ${it.special ? `<p class="muted">Special ${it.special}</p>` : ""}
      <div class="acts">${(it.category === "equipment" || it.category === "tool" || it.category === "ammo") ? `<button type="button" data-act="equip" data-arg="${id}">Equip</button>` : ""}
        ${id === "seed-pouch" && n ? `<button type="button" data-act="pouch">Open pouch</button>` : ""}
        ${n ? `<button type="button" data-act="sell" data-arg="${id}">Sell one</button>
        <button type="button" data-act="sell-all" data-arg="${id}">Sell all (${n})</button>` : ""}</div>`;
  } else if (kind === "monster") {
    const m = CONTENT.monsters[id];
    if (!m) return;
    el.innerHTML = `<h3>${m.name}</h3>
      <p class="temper">${m.temper} · ${m.style} · ${m.area}</p>
      <blockquote>${m.voice}</blockquote>
      <p class="blurb">${m.desc || ""}</p>
      <p class="muted">HP ${m.hp} · max hit ${m.maxHit} · interval ${(m.interval / 1000).toFixed(1)}s · slayer ${m.slayerReq}</p>
      <p class="muted">${(m.drops || []).map((d) => `${odds(d.chance)} ${CONTENT.items[d.item]?.name || d.item}`).join(" · ")}${m.unique ? ` · unique ${odds(m.unique.chance)} ${CONTENT.items[m.unique.item]?.name || m.unique.item}` : ""}</p>
      ${m.mechanic ? `<p class="muted">Mechanic ${m.mechanic.type} · cadence ${(m.mechanic.cadence || 0) / 1000}s</p>` : ""}
      ${m.dungeonOnly ? `<p class="blurb">Dungeon closer — hunt it inside its gate, not on the field.</p>` : `<button type="button" data-act="fight" data-arg="${id}">Hunt</button>`}`;
  } else if (kind === "dungeon") {
    const d = CONTENT.dungeons.find((x) => x.id === id);
    if (!d) return;
    el.innerHTML = `<h3>${d.name}</h3>
      <p class="temper">${d.temper} · ${d.sequence.length} floors · ${d.bossName}</p>
      <blockquote>${d.voice}</blockquote>
      <p class="blurb">${d.desc || ""}</p>
      <button type="button" data-act="dungeon" data-arg="${id}">Enter</button>`;
  } else if (kind === "quest") {
    const q = CONTENT.quests.find((x) => x.id === id);
    if (!q) return;
    const done = (ctx.state.quests.done || []).includes(id);
    el.innerHTML = `<h3>${done ? q.name : "A sealed page"}</h3>
      <p class="blurb">${done ? (q.how || q.desc) : "The ledger does not whisper this yet."}</p>`;
  } else if (kind === "pet") {
    const p = CONTENT.pets.find((x) => x.id === id);
    if (!p) return;
    const owned = !!ctx.state.pets?.[id];
    el.innerHTML = `<h3>${p.name}</h3>
      <p class="temper">${owned ? "perched" : "still wild"} · ${p.skill}</p>
      <p class="blurb">${p.desc || ""}</p>
      <p class="muted">${owned ? `Bonus: +${Math.round((p.bonus?.xp || 0) * 100)}% ${p.skill} XP, +${Math.round((p.bonus?.rare || 0) * 100)}% rares.` : `Still wild. Train ${p.skill} — about 0.035% per action. Timber's companion is Splinter.`}</p>`;
  } else {
    const a = CONTENT.actions[id];
    if (!a) return;
    el.innerHTML = `<h3>${a.name}</h3>
      <p class="temper">${a.temper} · ${a.skill} ${a.level}</p>
      <blockquote>${a.voice}</blockquote>
      <p class="blurb">${a.desc || ""}</p>
      <p class="muted">${((a.time || 0) / 1000).toFixed(1)}s base · ${a.xp} xp</p>
      <button type="button" data-act="start" data-arg="${id}">Commit this job</button>`;
  }
}

export function renderWanderer(ctx) {
  const { state } = ctx;
  try {
    renderWandererBody(ctx, state);
  } catch (err) {
    console.error("Wanderer desk", err);
    const detail = document.getElementById("wander-detail");
    if (detail) detail.innerHTML = `<p class="blurb">The wanderer failed to dress. ${err.message}</p>`;
  }
}

function renderWandererBody(ctx, state) {
  const r = wandererRanks(state);
  const st = playerStats(state);
  const setInfo = gearSetInfo(state);
  const w = weightKg(state);
  const pct = Math.min(100, 100 * w.kg / w.cap);
  const stars = "★".repeat(r.stars) + "☆".repeat(5 - r.stars);
  const vit = skillLevel(state, "vitality");
  const next = XP_TABLE[Math.min(MAX_LEVEL, vit + 1)];
  const prev = XP_TABLE[vit];
  const xp = state.skills.vitality.xp;
  const xpPct = next === prev ? 100 : Math.min(100, 100 * (xp - prev) / (next - prev));
  const slotLabel = focusedSlot || "weapon";
  const focusId = state.equipment[slotLabel];
  const wpn = CONTENT.items[focusId];

  const profile = document.getElementById("wander-profile");
  const kits = document.getElementById("wander-kits");
  const stats = document.getElementById("wander-stats");
  const detail = document.getElementById("wander-detail");
  if (!profile || !kits || !stats || !detail) return;

  const petRow = CONTENT.pets.map((p) => {
    const on = state.pets?.[p.id] ? "on" : "";
    return `<span class="pet-chip ${on}" title="${p.name}">${iconMarkup(p.model || { eid: p.id }, 28)}</span>`;
  }).join("");

  profile.innerHTML = `
    <div class="w-name">${escapeHtml(state.name || "Aelric")}</div>
    <div class="w-title">${r.title}</div>
    <div class="w-stars">${stars}</div>
    <div class="w-lvls"><div><em>${r.combat}</em><span>Combat</span></div><div><em>${r.idle}</em><span>Idle</span></div></div>
    <div class="xpbar"><i style="width:${xpPct}%"></i><span>${Math.floor(xp).toLocaleString()} / ${next.toLocaleString()} vitality xp</span></div>
    <div class="pet-row">${petRow}</div>
    <blockquote>The dusk calls. We answer.</blockquote>
  `;

  document.getElementById("wander-slots-l").innerHTML = SLOTS.filter((s) => s.side === "left").map((s) => slotBtn(state, s)).join("");
  document.getElementById("wander-slots-r").innerHTML = SLOTS.filter((s) => s.side === "right").map((s) => slotBtn(state, s)).join("");

  kits.innerHTML = ["melee", "ranged", "magic", "prayer", "custom"].map((k) =>
    `<button type="button" class="${kitMode === k ? "on" : ""}" data-act="kit" data-arg="${k}">${k}</button>`
  ).join("") + (state.loadouts || []).map((l, i) =>
    `<button type="button" data-act="loadout-load" data-arg="${i}">${l.name}</button>`
  ).join("") + `<button type="button" data-act="loadout-save">Save</button>`;

  stats.innerHTML = `
    <div><span>Attack</span><b>${st.style === "might" ? st.acc.toFixed(0) : skillLevel(state, "might")}</b></div>
    <div><span>Strength</span><b>${st.style === "might" ? st.power.toFixed(0) : skillLevel(state, "might")}</b></div>
    <div><span>Ranged</span><b>${skillLevel(state, "mark")}</b></div>
    <div><span>Magic</span><b>${skillLevel(state, "weave")}</b></div>
    <div><span>Defence</span><b>${st.def.toFixed(0)}</b></div>
    <div><span>Constitution</span><b>${vit}</b></div>
  `;

  const candidates = Object.keys(state.bank)
    .map((id) => CONTENT.items[id])
    .filter((it) => it && it.slot === slotLabel)
    .sort((a, b) => {
      const sa = (a.stats?.acc || 0) + (a.stats?.str || 0) + (a.stats?.ranged || 0) + (a.stats?.magic || 0) + (a.stats?.def || 0);
      const sb = (b.stats?.acc || 0) + (b.stats?.str || 0) + (b.stats?.ranged || 0) + (b.stats?.magic || 0) + (b.stats?.def || 0);
      return sb - sa;
    })
    .slice(0, 8);

  detail.innerHTML = `
    <section class="wd-card">
      <h4>${wpn?.name || "Empty " + slotLabel}</h4>
      <p class="muted">${slotLabel} · ${wpn?.special || wpn?.slot || "empty"} · ${wpn?.temper || ""}</p>
      <blockquote>${wpn?.voice || "A wanderer is still a person without a blade."}</blockquote>
      <p>Acc +${wpn?.stats?.acc || 0} · Str +${wpn?.stats?.str || 0} · Ranged +${wpn?.stats?.ranged || 0} · Magic +${wpn?.stats?.magic || 0} · Def +${wpn?.stats?.def || 0}</p>
      ${wpn?.heal ? `<p>Heal ${wpn.heal}</p>` : ""}
      ${wpn?.special ? `<p>Special ${wpn.special}</p>` : ""}
      ${wpn ? `<button type="button" data-act="unequip" data-arg="${slotLabel}">Unequip</button>` : ""}
    </section>
    <section class="wd-card">
      <h4>Candidates for ${slotLabel}</h4>
      ${candidates.length ? candidates.map((it) => `<button type="button" data-act="equip" data-arg="${it.id}">${it.name} · a${it.stats?.acc || 0} s${it.stats?.str || 0} (${bankCount(state, it.id)})</button>`).join("") : "<p class='muted'>Nothing in the vault for this slot.</p>"}
    </section>
    <section class="wd-card">
      <h4>Set bonus</h4>
      <p>${escapeHtml(setInfo.label)}</p>
      <p class="blurb">${setInfo.pct ? "Matching tiers stack. Mixed kits leave power on the table." : "Wear three pieces of one tier to wake a set (8% / 15% / 20%)."}</p>
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
  return `<button type="button" class="wslot ${focusedSlot === s.id ? "on" : ""}" data-act="slot-focus" data-arg="${s.id}" title="${s.label}" style="background:${st.background};border-color:${st.borderColor}">
    <em>${s.label}</em>${it ? `<span class="dico">${iconMarkup(it.model, 28)}</span>` : ""}<span>${it ? it.name : "empty"}</span>
  </button>`;
}

export function renderStall(ctx) {
  const { state } = ctx;
  const deal = quayDeal();
  const booth = QUAY_BOOTHS.find((b) => b.id === stallBooth) || QUAY_BOOTHS[0];
  stallBooth = booth.id;
  const search = document.getElementById("stall-search");
  if (search && document.activeElement !== search) search.value = stallFilter;
  const meta = document.getElementById("stall-meta");
  if (meta) meta.innerHTML = `${glyphMarks(11)} ${Math.floor(state.coins).toLocaleString()} · ${deal.watch}`;
  const watch = document.getElementById("stall-watch");
  if (watch) {
    const gossip = quayGossip(state).map((l) => `<p>${escapeHtml(l)}</p>`).join("");
    const hungry = hungerStacks(state, deal.hunger);
    const plain = plainStock(state, deal.hunger);
    const hungerRow = hungry.length
      ? `<div class="hunger-row">${hungry.slice(0, 6).map((h) => `<button type="button" data-act="quay-pawn" data-arg="${h.id}">Pawn ${escapeHtml(h.it.name)} ×${h.n} @ ${Math.round(pawnRate(state, h.it) * 100)}%</button>`).join("")}</div>`
      : `<p class="muted">No ${deal.hunger} in the vault for the hunger. Chop, mine, or fish — then the quay pays.</p>`;
    const plainRow = plain.length
      ? `<div class="hunger-row">${plain.map((h) => `<button type="button" data-act="quay-pawn" data-arg="${h.id}">Pawn ${escapeHtml(h.it.name)} ×${h.n} @ ${Math.round(pawnRate(state, h.it) * 100)}%</button>`).join("")}</div>`
      : "";
    const dearNote = deal.dear ? `<span> · also on the lantern: <em>${escapeHtml(offerName(deal.dear))}</em></span>` : "";
    watch.innerHTML = `<div class="quay-banner">
      <div><strong>${escapeHtml(deal.watch)}</strong>${deal.offer ? ` · lantern price on <em>${escapeHtml(offerName(deal.offer))}</em> (−${Math.round((1 - deal.mul * (weeklyEclipse().quayMul || 1)) * 100)}%)` : ""}${dearNote}</div>
      ${gossip}
      <p class="muted">Hunger: they want <strong>${deal.hunger}</strong> this calendar dusk and pay a premium for it. Vault fence starts at 40% and falls on high-tier junk; the quay never pays less than ${Math.round(pawnRate(state) * 100)}%.</p>
      ${hungerRow}
      ${plainRow}
      ${commissionRow(state)}
      ${workshopBoard(state)}
    </div>`;
  }
  const booths = document.getElementById("stall-booths");
  if (booths) {
    booths.innerHTML = QUAY_BOOTHS.map((b) => `<button type="button" class="${b.id === stallBooth ? "on" : ""}" data-act="stall-booth" data-arg="${b.id}">
      <span class="dico">${iconMarkup({ kind: b.kind, hue: 40, seed: 2 }, 22)}</span>${b.name}
    </button>`).join("");
  }
  let list = CONTENT.shop.filter((o) => inferBooth(o) === stallBooth);
  if (stallFilter) {
    const q = stallFilter.toLowerCase();
    list = CONTENT.shop.filter((o) => `${offerName(o)} ${o.desc || ""}`.toLowerCase().includes(q));
  }
  if (!stallPick && list[0]) stallPick = list[0].id;
  const grid = document.getElementById("stall-grid");
  if (grid) {
    grid.innerHTML = list.map((o) => {
      const { cost, bought, deal: onDeal } = offerPrice(state, o);
      const sold = o.max && bought >= o.max;
      const it = o.item ? CONTENT.items[o.item] : null;
      const lvok = !o.reqLevel || skillLevel(state, o.reqSkill) >= o.reqLevel;
      const qty = o.qty && o.qty > 1 ? `×${o.qty}` : (it ? "×1" : "upgrade");
      return `<button type="button" class="vtile stall-tile ${stallPick === o.id ? "on" : ""} ${!lvok ? "locked" : ""} ${sold ? "sold" : ""} ${onDeal ? "deal" : ""}" data-act="stall-pick" data-arg="${o.id}">
        <span class="vico">${iconMarkup(offerModel(o), 48)}</span>
        ${!lvok ? `<span class="lock-corner">${glyphLock(10)}</span>` : ""}
        <span class="vnm">${escapeHtml(offerName(o))}</span>
        <span class="vqty">${glyphMarks(11)} ${Math.floor(cost).toLocaleString()} ${qty}${onDeal ? " · dusk" : ""}</span>
      </button>`;
    }).join("") || "<p class='blurb'>This keeper has nothing hung.</p>";
  }
  const copy = document.getElementById("stall-copy");
  if (copy) {
    const o = CONTENT.shop.find((x) => x.id === stallPick) || list[0];
    if (!o) {
      copy.innerHTML = `<p class="muted">${booth.keeper}: empty hooks.</p>`;
      return;
    }
    const { cost, bought, deal: onDeal } = offerPrice(state, o);
    const sold = o.max && bought >= o.max;
    const lvok = !o.reqLevel || skillLevel(state, o.reqSkill) >= o.reqLevel;
    const why = sold ? "Sold out this ledger." : !lvok ? `Need ${o.reqSkill} ${o.reqLevel}.` : state.coins < cost ? "Short on veilmarks." : "";
    const packable = o.repeatable && o.item && !o.effect;
    copy.innerHTML = `
      <span class="dico lg">${iconMarkup(offerModel(o), 64)}</span>
      <h3>${escapeHtml(offerName(o))}</h3>
      <p class="temper">${escapeHtml(booth.keeper)} · ${escapeHtml(booth.name)}</p>
      <blockquote>${escapeHtml(booth.line)}</blockquote>
      <p class="blurb">${escapeHtml(o.desc || "")}</p>
      <p class="muted">${glyphMarks(11)} ${Math.floor(cost).toLocaleString()}${onDeal ? " dusk bargain" : ""}${o.qty ? ` · ${o.qty} per buy` : ""} · owned ${bought}${o.max ? "/" + o.max : ""}</p>
      ${why ? `<p class="lock-why">${!lvok ? glyphLock(11) : ""}${escapeHtml(why)}</p>` : ""}
      ${packable ? `<div class="qty-row"><span>Buys</span>
        ${[1, 5, 10].map((n) => `<button type="button" class="${stallPacks === n ? "on" : ""}" data-act="stall-packs" data-arg="${n}">${n}</button>`).join("")}
      </div>` : ""}
      <div class="acts">
        ${state.rules?.mode === "iron" && !o.tokens
          ? `<p class="blurb">Wanderer's Path: the quay will not sell. Fence at 40%.</p>`
          : `<button type="button" class="primary" data-act="buy" data-arg="${o.id}" ${sold || !lvok ? "disabled" : ""}>Pay ${glyphMarks(11)} ${Math.floor(cost).toLocaleString()}${packable && stallPacks > 1 ? ` ×${stallPacks}` : ""}</button>`}
      </div>`;
  }
}

export function onVaultSearch(v) {
  vaultFilter = v.toLowerCase();
}

export function onVaultCat(v) { vaultCat = v; }
export function onVaultLens(v) { vaultLens = v; }
export function currentStallBooth() { return stallBooth; }
export function currentStallFilter() { return stallFilter; }
export function onStallSearch(v) { stallFilter = v.toLowerCase(); }
export function onStallBooth(v) { stallBooth = v; stallPick = null; }
export function onStallPick(v) { stallPick = v; }
export function onStallPacks(v) { stallPacks = Math.max(1, Math.min(10, +v || 1)); }
export function stallPackCount() { return stallPacks; }
export function onCodexTab(v) { codexTab = v; }

function odds(p) {
  const n = Number(p);
  if (!(n > 0)) return "never";
  if (n >= 0.995) return "always";
  return `1/${Math.max(2, Math.round(1 / n))}`;
}

export function inspectModelOf() {
  const { kind, id } = vaultPick;
  if (kind === "item") return CONTENT.items[id]?.model;
  if (kind === "monster") return CONTENT.monsters[id]?.model;
  if (kind === "dungeon") return CONTENT.dungeons.find((d) => d.id === id)?.model;
  if (kind === "action") return CONTENT.actions[id]?.model;
  if (kind === "pet") return CONTENT.pets.find((p) => p.id === id)?.model;
  if (kind === "quest") return CONTENT.quests.find((q) => q.id === id)?.model;
  return null;
}

function commissionRow(state) {
  const jobs = quayCommissions(state);
  const rows = jobs.map((j) => {
    const done = !!state.shopBought?.[j.id];
    const have = state.bank[j.need.item] || 0;
    const it = CONTENT.items[j.need.item];
    const ready = !done && have >= j.need.qty && (state.coins || 0) >= j.cost;
    return `<button type="button" class="comm ${done ? "sold" : ""} ${ready ? "on" : ""}" data-act="commission" data-arg="${j.id}" ${done ? "disabled" : ""}>
      <strong>${escapeHtml(j.name)}</strong>
      <span>${j.need.qty} ${escapeHtml(it?.name || j.need.item)} (have ${have}) · underwrite ${glyphMarks(11)} ${j.cost.toLocaleString()} · purse ${j.pay.toLocaleString()}</span>
    </button>`;
  }).join("");
  return `<div class="commissions"><h4>Dusk commissions</h4><p class="muted">Rotating indentures — deeper acts unlock richer hulls. Pay the underwrite, deliver the goods, take the purse.</p>${rows}</div>`;
}

function workshopBoard(state) {
  const c = currentCommission(state);
  const lines = c.requires.map((r) => `${bankCount(state, r.item)}/${r.qty} ${escapeHtml(CONTENT.items[r.item]?.name || r.item)}`).join(" · ");
  const ready = c.requires.every((r) => bankCount(state, r.item) >= r.qty);
  const done = state.commissions?.lastDay === c.day;
  const streak = state.commissions?.streak || 0;
  return `<div class="commissions"><h4>Workshop indenture</h4>
    <p>${escapeHtml(c.name)} · ${c.pays.toLocaleString()} veilmarks</p>
    <p class="muted">${lines}</p>
    ${!done && streak > 0 ? `<p class="muted">Streak ${streak} — deliver again tomorrow for +${Math.min(40, streak * 10)}%.</p>` : ""}
    <button type="button" class="primary" data-act="workshop" ${ready && !done ? "" : "disabled"}>${done ? "Delivered today" : "Deliver"}</button>
  </div>`;
}

function logCell(kind, id, name, found, model) {
  return `<button type="button" class="codex-cell ${found ? "found" : ""}" data-act="vault-pick" data-kind="${kind}" data-arg="${id}">
    <span class="dico ${found ? "found" : "logslot"}">${iconMarkup(model || { eid: id }, 40)}</span>
    <strong>${escapeHtml(found ? name : "????")}</strong>
  </button>`;
}

function renderCodexDesk(ctx) {
  const { state } = ctx;
  const ls = ledgerStats(state);
  const lb = logbookStats(state, CONTENT);
  const tabs = [
    ["beasts", "Beasts"],
    ["bosses", "Bosses"],
    ["gates", "Gates"],
    ["relics", "Relics"],
    ["pets", "Pets"],
    ["pages", "Pages"],
    ["diaries", "Diaries"],
    ["hiscores", "Hiscores"]
  ];
  const tabHtml = tabs.map(([id, lab]) => `<button type="button" class="${codexTab === id ? "on" : ""}" data-act="codex-tab" data-arg="${id}">${lab}</button>`).join("");
  const meta = document.getElementById("codex-meta");
  if (meta) meta.textContent = `LOG ${lb.totalPct}% · standing ${ls.completionPct}%`;
  const tabsEl = document.getElementById("codex-tabs");
  const grid = document.getElementById("codex-grid");
  if (tabsEl) tabsEl.innerHTML = tabHtml;
  if (!grid) return;
  if (codexTab === "hiscores") {
    if (!hiscoreAsked && state.settings?.hiscores) {
      hiscoreAsked = true;
      fetchScores().then((rows) => { hiscoreRows = rows; renderDesks(ctx); });
    }
    grid.innerHTML = `<div class="panel"><p class="muted">${state.settings?.hiscores ? "Client contract only. No board is hosted here." : "Opt in from Workshop settings."}</p>
      ${(hiscoreRows || []).slice(0, 20).map((r) => `<p>${escapeHtml(r.name || "?")} · lv ${r.totalLevel || "?"} · echo ${r.echoBest || 0}</p>`).join("") || "<p class='muted'>Empty board.</p>"}</div>`;
    return;
  }
  if (codexTab === "beasts") {
    grid.innerHTML = Object.values(CONTENT.monsters)
      .filter((m) => !m.dungeonOnly && !m.echo && !String(m.id).startsWith("elite-"))
      .map((m) => logCell("monster", m.id, m.name, !!(state.logbook?.monsters?.[m.id] || state.combat.kills?.[m.id]), m.model)).join("");
    return;
  }
  if (codexTab === "bosses") {
    grid.innerHTML = Object.values(CONTENT.monsters)
      .filter((m) => m.dungeonOnly || m.fieldBoss || m.boss)
      .filter((m) => !m.echo || m.id === "echo-0")
      .map((m) => {
        const found = !!(state.logbook?.monsters?.[m.id] || state.combat.kills?.[m.id]);
        const medals = deedMedals(state, m.id).filter((d) => d.have).map((d) => d.id).join(" ");
        return `<button type="button" class="codex-cell ${found ? "found" : ""}" data-act="vault-pick" data-kind="monster" data-arg="${m.id}">
          <span class="dico ${found ? "found" : "logslot"}">${iconMarkup(m.model || {}, 40)}</span>
          <strong>${escapeHtml(found ? m.name : "????")}</strong>
          <span>${escapeHtml(medals || "")}</span>
        </button>`;
      }).join("");
    return;
  }
  if (codexTab === "gates") {
    grid.innerHTML = CONTENT.dungeons.map((d) => logCell("dungeon", d.id, d.name, !!((state.combat.dungeonClears || {})[d.id] || state.logbook?.dungeons?.[d.id]), d.model)).join("");
    return;
  }
  if (codexTab === "relics") {
    const ids = collectUniqueIds();
    grid.innerHTML = ids.map((id) => {
      const it = CONTENT.items[id];
      const found = !!(state.logbook?.items?.[id] || bankCount(state, id));
      return logCell("item", id, it?.name || id, found, it?.model);
    }).join("") + workshopBoard(state);
    return;
  }
  if (codexTab === "pets") {
    grid.innerHTML = CONTENT.pets.map((p) => logCell("pet", p.id, p.name, !!(state.pets?.[p.id] || state.logbook?.pets?.[p.id]), p.model)).join("");
    return;
  }
  if (codexTab === "pages") {
    grid.innerHTML = CONTENT.quests.map((q) => logCell("quest", q.id, q.name, (state.quests.done || []).includes(q.id), q.model)).join("");
    return;
  }
  grid.innerHTML = ACHIEVEMENTS.map((a) => {
    const done = !!(state.achv?.done?.[a.id]);
    return `<button type="button" class="codex-cell ${done ? "found" : ""}" data-act="wear-title" data-arg="${escapeHtml(a.reward?.title || "")}">
      <strong>${escapeHtml(done ? a.name : "????")}</strong>
      <span>${escapeHtml(done ? (a.reward?.title || "") : "unsealed")}</span>
    </button>`;
  }).join("");
}
