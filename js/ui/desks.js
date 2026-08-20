import { wandererRanks, gearSet, weightKg } from "../engine/wanderer.js";
import { CONTENT, XP_TABLE, MAX_LEVEL, skillLevel, bankCount, bankCap, bankUsed, bankValue } from "../engine/state.js";
import { playerStats, equipItem } from "../engine/combat.js";
import { silhouetteStyle } from "../scene/models.js";
import { iconMarkup } from "../scene/icons.js";
import { escapeHtml } from "../util/text.js";
import { QUAY_BOOTHS, inferBooth, offerModel, offerName, quayDeal, offerPrice, quayGossip, hungerStacks, pawnRate } from "../engine/market.js";

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
  document.querySelectorAll("#desk-nav [data-arg]").forEach((b) => {
    b.classList.toggle("on", b.dataset.arg === desk);
    if (!b.querySelector(".pix")) {
      const kind = b.dataset.arg === "stall" ? "coins" : b.dataset.arg === "bank" ? "pouch" : b.dataset.arg === "loadout" ? "saber" : "forge";
      b.insertAdjacentHTML("afterbegin", `<span class="dico">${iconMarkup({ eid: "tab-" + b.dataset.arg, kind }, 28)}</span>`);
    }
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
  const lens = [["items", "Items"], ["monsters", "Monsters"], ["dungeons", "Dungeons"], ["actions", "Actions"], ["pets", "Pets"]]
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
  } else if (vaultLens === "pets") {
    tiles = CONTENT.pets
      .filter((p) => !vaultFilter || p.name.toLowerCase().includes(vaultFilter))
      .map((p) => tile("pet", p.id, p.name, state.pets?.[p.id] ? 1 : 0, p.model)).join("");
  } else {
    let list = Object.values(CONTENT.actions);
    if (vaultFilter) list = list.filter((a) => a.name.toLowerCase().includes(vaultFilter));
    tiles = list.map((a) => tile("action", a.id, a.name, state.actionCounts?.[a.id] || 0, a.model)).join("");
  }

  document.getElementById("vault-chips").innerHTML = `<div class="tabs">${lens}</div><div class="tabs">${chips}</div>`;
  document.getElementById("vault-grid").innerHTML = tiles || "<p class='blurb'>Nothing in this drawer.</p>";
  document.getElementById("vault-meta").textContent = `${held.length}/${bankCap(state)} unique stacks · ${bankValue(state).toLocaleString()} ✦`;
  renderInspect(ctx);
}

function tile(kind, id, name, qty, model) {
  const st = silhouetteStyle(model || {});
  const on = vaultPick.kind === kind && vaultPick.id === id ? "on" : "";
  return `<button type="button" class="vtile ${on}" data-act="vault-pick" data-kind="${kind}" data-arg="${id}" style="background-color:#12081a;border-color:${st.borderColor}">
    <span class="vico">${iconMarkup(model || {}, 48)}</span>
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
      <p class="muted">${it.category}${it.slot ? " · " + it.slot : ""} · ${n.toLocaleString()} held · ${it.value || 0} ✦</p>
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
      <p class="muted">${(m.drops || []).map((d) => `${Math.round(d.chance * 100)}% ${CONTENT.items[d.item]?.name || d.item}`).join(" · ")}</p>
      ${m.dungeonOnly ? `<p class="blurb">Dungeon closer — hunt it inside its gate, not on the field.</p>` : `<button type="button" data-act="fight" data-arg="${id}">Hunt</button>`}`;
  } else if (kind === "dungeon") {
    const d = CONTENT.dungeons.find((x) => x.id === id);
    if (!d) return;
    el.innerHTML = `<h3>${d.name}</h3>
      <p class="temper">${d.temper} · ${d.sequence.length} floors · ${d.bossName}</p>
      <blockquote>${d.voice}</blockquote>
      <p class="blurb">${d.desc || ""}</p>
      <button type="button" data-act="dungeon" data-arg="${id}">Enter</button>`;
  } else if (kind === "pet") {
    const p = CONTENT.pets.find((x) => x.id === id);
    if (!p) return;
    const owned = !!ctx.state.pets?.[id];
    el.innerHTML = `<h3>${p.name}</h3>
      <p class="temper">${owned ? "perched" : "still wild"} · ${p.skill}</p>
      <p class="blurb">${p.desc || ""}</p>
      <p class="muted">A shoulder companion. Drops rarely from ${p.skill}.</p>`;
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
  const set = gearSet(state);
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
  if (meta) meta.textContent = `${Math.floor(state.coins).toLocaleString()} ✦ · ${deal.watch}`;
  const watch = document.getElementById("stall-watch");
  if (watch) {
    const gossip = quayGossip(state).map((l) => `<p>${escapeHtml(l)}</p>`).join("");
    const hungry = hungerStacks(state, deal.hunger);
    const pawn = hungry.length
      ? `<div class="hunger-row">${hungry.slice(0, 6).map((h) => `<button type="button" data-act="quay-pawn" data-arg="${h.id}">Pawn ${escapeHtml(h.it.name)} ×${h.n} @ ${Math.round(pawnRate() * 100)}%</button>`).join("")}</div>`
      : `<p class="muted">No ${deal.hunger} in the vault for the hunger. Chop, mine, or fish — then the quay pays.</p>`;
    watch.innerHTML = `<div class="quay-banner">
      <div><strong>${escapeHtml(deal.watch)}</strong>${deal.offer ? ` · lantern price on <em>${escapeHtml(offerName(deal.offer))}</em> (−${Math.round((1 - deal.mul) * 100)}%)` : ""}</div>
      ${gossip}
      <p class="muted">Hunger: they want <strong>${deal.hunger}</strong> this calendar dusk. Vault fence is 40%. The quay pays ${Math.round(pawnRate() * 100)}%.</p>
      ${pawn}
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
      return `<button type="button" class="vtile stall-tile ${stallPick === o.id ? "on" : ""} ${sold || !lvok ? "locked" : ""} ${onDeal ? "deal" : ""}" data-act="stall-pick" data-arg="${o.id}">
        <span class="vico">${iconMarkup(offerModel(o), 48)}</span>
        <span class="vnm">${escapeHtml(offerName(o))}</span>
        <span class="vqty">${Math.floor(cost).toLocaleString()} ✦ ${qty}${onDeal ? " · dusk" : ""}</span>
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
      <p class="muted">${Math.floor(cost).toLocaleString()} ✦${onDeal ? " dusk bargain" : ""}${o.qty ? ` · ${o.qty} per buy` : ""} · owned ${bought}${o.max ? "/" + o.max : ""}</p>
      ${why ? `<p class="lock-why">${escapeHtml(why)}</p>` : ""}
      ${packable ? `<div class="qty-row"><span>Buys</span>
        ${[1, 5, 10].map((n) => `<button type="button" class="${stallPacks === n ? "on" : ""}" data-act="stall-packs" data-arg="${n}">${n}</button>`).join("")}
      </div>` : ""}
      <div class="acts">
        <button type="button" class="primary" data-act="buy" data-arg="${o.id}" ${sold || !lvok ? "disabled" : ""}>Pay ${Math.floor(cost).toLocaleString()} ✦${packable && stallPacks > 1 ? ` ×${stallPacks}` : ""}</button>
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

export function inspectModelOf() {
  const { kind, id } = vaultPick;
  if (kind === "item") return CONTENT.items[id]?.model;
  if (kind === "monster") return CONTENT.monsters[id]?.model;
  if (kind === "dungeon") return CONTENT.dungeons.find((d) => d.id === id)?.model;
  if (kind === "action") return CONTENT.actions[id]?.model;
  if (kind === "pet") return CONTENT.pets.find((p) => p.id === id)?.model;
  return null;
}
