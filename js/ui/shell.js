import { escapeHtml } from "../util/text.js";
import { CONTENT, SKILLS, COMBAT_SKILLS, XP_TABLE, MAX_LEVEL, skillLevel, bankCount, addItem, takeItem, log, masteryLevel, recalcHp, skillLocked, bankUsed, bankCap, stashItem, upcomingUnlocks } from "../engine/state.js";
import { startAction, stopAction, harvestPlot, plantPlot, collectPen, stockPen, actionDuration, spendCheckpoint, checkpointCost } from "../engine/sim.js";
import { startFight, stopFight, startDungeon, equipItem, unequip, drinkPotion, rollBounty, buryBones, playerStats, playerInterval } from "../engine/combat.js";
import { questProgress } from "../engine/quests.js";
import { saveLoadout, loadLoadout } from "../engine/wanderer.js";
import { desk, setDesk, setVaultPick, setFocusedSlot, renderDesks, onVaultSearch, onVaultCat, onVaultLens, applyKit, inspectModelOf } from "./desks.js";

let forkFn = null;
let shownLevelKey = "";
let lastFloater = 0;
let bankFilter = "";
let bankTab = "All";
let shopFilter = "";
let shopCat = "tools";
let shopTool = "all";
let codexOpen = localStorage.getItem("veilforge-codex") !== "0";
let selectedSkill = "timber";
let openAreas = new Set();

const CAT_ICON = {
  currency: "✦", material: "◇", log: "🌲", ore: "⛏", bar: "▬", fish: "🐟",
  food: "🍽", seed: "🌱", herb: "🌿", gem: "◆", rune: "✧", potion: "⚗",
  equipment: "⚔", ammo: "➳", tool: "⚒", token: "◎", key: "⚿", hide: "◇"
};

const TOOL_LABEL = { axe: "Hatchets", pick: "Picks", rod: "Rods" };

export function skillSelect() { return selectedSkill; }

export function bindUI(ctx) {
  const { state, root } = ctx;
  const host = document.body;
  host.addEventListener("toggle", (e) => {
    const d = e.target;
    if (d?.dataset?.area) {
      if (d.open) openAreas.add(d.dataset.area);
      else openAreas.delete(d.dataset.area);
    }
  }, true);
  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    const arg = b.dataset.arg;
    handle(ctx, act, arg, b);
  });
  host.addEventListener("input", (e) => {
    if (e.target.id === "bank-search") {
      bankFilter = e.target.value.toLowerCase();
      renderBank(ctx);
    }
    if (e.target.id === "shop-search") {
      shopFilter = e.target.value.toLowerCase();
      renderShop(ctx);
    }
    if (e.target.id === "vault-search") {
      onVaultSearch(e.target.value);
      renderDesks(ctx);
    }
  });
  host.addEventListener("change", (e) => {
    if (e.target.dataset.act === "pillar") {
      state.course.chosen[e.target.dataset.cat] = e.target.value || null;
    }
    if (e.target.dataset.act === "chart-slot") {
      const i = +e.target.dataset.i;
      state.chart.active[i] = e.target.value;
    }
    if (e.target.dataset.act === "food") state.combat.foodId = e.target.value;
    if (e.target.dataset.act === "spell") state.combat.spell = e.target.value;
    if (e.target.dataset.act === "tab-name") {
      state.bankTabs[+e.target.dataset.i] = e.target.value;
    }
  });
}

function handle(ctx, act, arg, el) {
  const { state } = ctx;
  const err = (m) => { if (m) toast(ctx, m); };
  switch (act) {
    case "skill":
      selectedSkill = arg;
      ctx.render();
      break;
    case "checkpoint": err(spendCheckpoint(state, arg)); ctx.render(); break;
    case "dismiss-level":
      state.levelUps = (state.levelUps || []).slice(1);
      shownLevelKey = "";
      renderLevelModal(ctx);
      break;
    case "dismiss-levels":
      state.levelUps = [];
      shownLevelKey = "";
      renderLevelModal(ctx);
      break;
    case "start":
      if (state.action?.id === arg) break;
      if (!confirmBusy(ctx, arg, "action", () => { err(startAction(state, arg)); ctx.render(); })) break;
      err(startAction(state, arg)); ctx.render(); break;
    case "stop": stopAction(state); stopFight(state); ctx.render(); break;
    case "fight":
      if (state.combat.fighting && state.combat.monsterId === arg) break;
      if (!confirmBusy(ctx, arg, "fight", () => { err(startFight(state, arg)); ctx.render(); })) break;
      err(startFight(state, arg)); ctx.render(); break;
    case "dungeon":
      if (!confirmBusy(ctx, arg, "dungeon", () => { err(startDungeon(state, arg)); ctx.render(); })) break;
      err(startDungeon(state, arg)); ctx.render(); break;
    case "fork-yes": {
      const fn = forkFn; forkFn = null;
      hideFork();
      if (fn) fn();
      break;
    }
    case "fork-no": forkFn = null; hideFork(); break;
    case "equip": err(equipItem(state, arg)); ctx.render(); break;
    case "unequip": err(unequip(state, arg)); ctx.render(); break;
    case "drink": err(drinkPotion(state, arg)); ctx.render(); break;
    case "plant": err(plantPlot(state, +arg, el.dataset.seed)); ctx.render(); break;
    case "harvest": harvestPlot(state, +arg); ctx.render(); break;
    case "stock": err(stockPen(state, +arg, el.dataset.animal)); ctx.render(); break;
    case "collect": collectPen(state, +arg); ctx.render(); break;
    case "bounty": rollBounty(state); ctx.render(); break;
    case "bury": err(buryBones(state)); ctx.render(); break;
    case "buy": err(buyShop(state, arg)); ctx.render(); break;
    case "sell": sellOne(state, arg); ctx.render(); break;
    case "pray": togglePrayer(state, arg); ctx.render(); break;
    case "spec": state.combat.useSpec = !(state.combat.useSpec !== false); ctx.render(); break;
    case "spell-pick": state.combat.spell = arg; ctx.render(); break;
    case "tab": bankTab = arg; renderBank(ctx); break;
    case "set-tab": {
      const dest = bankTab === "All" ? (state.bankTabs[0] || "General") : bankTab;
      state.itemTabs[arg] = dest;
      renderBank(ctx);
      break;
    }
    case "shop-cat": shopCat = arg; renderShop(ctx); break;
    case "shop-tool": shopTool = arg; renderShop(ctx); break;
    case "codex-toggle":
      codexOpen = !codexOpen;
      localStorage.setItem("veilforge-codex", codexOpen ? "1" : "0");
      renderCodex(ctx);
      break;
    case "loadout-save": saveLoadout(state); toast(ctx, "Loadout saved."); break;
    case "loadout-load": err(loadLoadout(state, +arg)); ctx.render(); break;
    case "desk": setDesk(arg); ctx.render(); ctx.portraits?.resize?.(); break;
    case "vault-pick": setVaultPick(el.dataset.kind || "item", arg); renderDesks(ctx); break;
    case "vault-cat": onVaultCat(arg); renderDesks(ctx); break;
    case "vault-lens": onVaultLens(arg); renderDesks(ctx); break;
    case "kit": applyKit(state, arg); ctx.render(); break;
    case "slot-focus": {
      const id = state.equipment[arg];
      if (id) setVaultPick("item", id);
      setFocusedSlot(arg);
      renderDesks(ctx);
      break;
    }
    case "export": {
      try {
        const text = ctx.exportSave();
        navigator.clipboard.writeText(text).then(
          () => toast(ctx, "Save copied."),
          () => toast(ctx, "Copy failed — allow clipboard permission, or copy from the prompt.")
        );
      } catch (e) {
        toast(ctx, e.message || "Export failed.");
      }
      break;
    }
    case "import": {
      const s = prompt("Paste save");
      if (s) {
        try {
          ctx.importSave(s);
          toast(ctx, "Save imported.");
        } catch (e) {
          toast(ctx, e.message || "Import failed.");
        }
      }
      break;
    }
    case "wipe": if (confirm("Reset Veilforge?")) ctx.wipe(); break;
    case "panel": document.getElementById(arg)?.scrollIntoView({ behavior: "smooth", block: "start" }); break;
    default: break;
  }
}

function togglePrayer(state, id) {
  const p = CONTENT.prayers.find((x) => x.id === id);
  if (!p) return;
  if (skillLevel(state, "vow") < p.level) return;
  const i = state.combat.prayers.indexOf(id);
  if (i >= 0) state.combat.prayers.splice(i, 1);
  else {
    if (state.combat.prayers.length >= 2) state.combat.prayers.shift();
    state.combat.prayers.push(id);
  }
}

function buyShop(state, id) {
  const offer = CONTENT.shop.find((s) => s.id === id);
  if (!offer) return "Unknown wares.";
  const bought = state.shopBought[id] || 0;
  if (offer.max && bought >= offer.max) return "Sold out.";
  let cost = offer.cost;
  if (offer.repeatable) cost = Math.floor(cost * Math.pow(1.45, bought));
  if (offer.reqLevel && skillLevel(state, offer.reqSkill) < offer.reqLevel) return `Need ${offer.reqSkill} ${offer.reqLevel}.`;
  if (state.coins < cost) return "Not enough veilmarks.";
  state.coins -= cost;
  state.shopBought[id] = bought + 1;
  if (offer.item) stashItem(state, offer.item, offer.qty || 1, "stall");
  if (offer.effect === "bankTab") state.bankTabs.push("Tab " + state.bankTabs.length);
  if (offer.effect === "plot") state.soil.plots.push(null);
  if (offer.effect === "pen") state.drove.pens.push(null);
  if (offer.effect === "autoEat") state.combat.autoEat = 0.6;
  if (offer.effect === "autoEat2") { state.combat.autoEat = 0.75; }
  if (offer.effect === "loadout") state.loadouts.push({ name: "Set " + state.loadouts.length, equipment: { ...state.equipment } });
  if (offer.effect === "chartSlot") state.chart.slots = Math.max(state.chart.slots, 3);
  if (offer.effect === "offlineHours") state.offlineHours = 24;
  return null;
}

function sellOne(state, id) {
  const it = CONTENT.items[id];
  if (!it || !bankCount(state, id)) return;
  takeItem(state, id, 1);
  addItem(state, "coins", Math.max(1, Math.floor((it.value || 1) * 0.4)));
}

function fillHtml(el, html) {
  if (!el) return;
  const ae = document.activeElement;
  const keep = ae && el.contains(ae) && ae.id;
  const id = ae?.id;
  const ss = ae?.selectionStart;
  const se = ae?.selectionEnd;
  el.innerHTML = html;
  if (keep && id) {
    const n = document.getElementById(id);
    if (n) {
      n.focus();
      try { n.setSelectionRange(ss, se); } catch { /* not a text field */ }
    }
  }
}

function skillName(id) {
  return SKILLS.find((s) => s.id === id)?.name || id;
}

function itemName(id) {
  return CONTENT.items[id]?.name || id;
}

function shopGroup(o) {
  const it = o.item ? CONTENT.items[o.item] : null;
  if (it?.category === "tool") return "tools";
  if (it && ["cape", "amulet", "ring"].includes(it.slot)) return "cosmetics";
  return "upgrades";
}

export function renderShell(ctx) {
  const { state, root } = ctx;
  const left = SKILLS.map((s) => {
    const lv = skillLevel(state, s.id);
    const on = selectedSkill === s.id ? "on" : "";
    const lock = skillLocked(state, s.id);
    return `<button type="button" class="skill ${on} ${lock ? "locked" : ""}" data-act="skill" data-arg="${s.id}" ${lock ? `title="Locked until ${lock}"` : ""}><span>${s.icon}</span><span class="sn">${s.name}</span><span class="lv">${lock ? "🔒" : lv}</span></button>`;
  }).join("");
  root.querySelector("#skill-nav").innerHTML = left;
  renderTop(ctx);
  renderCodex(ctx);
  renderCenter(ctx);
  renderRight(ctx);
  renderDesks(ctx);
  renderLevelModal(ctx);
}

function duelSwing(now, nextAt, interval) {
  if (!interval || nextAt == null) return 0;
  const left = nextAt - now;
  return Math.max(0, Math.min(100, 100 * (1 - left / interval)));
}

function renderTop(ctx) {
  const { state } = ctx;
  const hp = state.combat.hp;
  const max = state.combat.maxHp;
  document.getElementById("coins").textContent = Math.floor(state.coins).toLocaleString();
  document.getElementById("hp-label").textContent = `${Math.ceil(hp)} / ${max}`;
  document.getElementById("hp-fill").style.width = `${Math.max(0, 100 * hp / max)}%`;
  document.getElementById("vow-fill").style.width = `${Math.max(0, 100 * state.combat.vow / state.combat.maxVow)}%`;
  const vowLab = document.getElementById("vow-label");
  if (vowLab) vowLab.textContent = `${Math.floor(state.combat.vow)}/${state.combat.maxVow}`;

  const foodId = state.combat.foodId;
  const foodN = foodId ? bankCount(state, foodId) : 0;
  const foodEl = document.getElementById("food-chip");
  if (foodEl) {
    const nm = CONTENT.items[foodId]?.name || "No food";
    const heal = CONTENT.items[foodId]?.heal;
    foodEl.textContent = foodId ? `🍽 ${foodN} ${nm}${heal ? ` +${heal}` : ""}` : "🍽 No food set";
    foodEl.style.color = foodN <= 3 ? "var(--rose)" : "";
  }

  const specEl = document.getElementById("spec-chip");
  if (specEl) {
    const sp = Math.floor(state.combat.spec || 0);
    const on = state.combat.useSpec !== false;
    specEl.textContent = `Special ${sp}% ${on ? "ON" : "OFF"}`;
  }

  const duel = document.getElementById("duel");
  const now = state.now || 0;
  const act = state.action;
  const bar = document.getElementById("action-fill");
  const lab = document.getElementById("action-label");
  const m = state.combat.fighting && CONTENT.monsters[state.combat.monsterId];

  if (m) {
    duel?.classList.remove("idle");
    document.getElementById("foe-tag").textContent = m.name;
    document.getElementById("foe-hp-label").textContent = `${Math.max(0, Math.ceil(state.combat.monsterHp))}/${state.combat.monsterMaxHp || m.hp}`;
    document.getElementById("foe-fill").style.width = `${Math.max(0, 100 * state.combat.monsterHp / (state.combat.monsterMaxHp || m.hp))}%`;
    document.getElementById("you-swing").style.width = `${duelSwing(now, state.combat.nextHitAt, playerInterval(state))}%`;
    document.getElementById("foe-swing").style.width = `${duelSwing(now, state.combat.enemyNextAt, m.interval)}%`;
    lab.textContent = `Fighting ${m.name} [${CONTENT.items[state.equipment.weapon]?.style || "might"}]`;
    bar.style.width = `${Math.max(0, 100 * state.combat.monsterHp / m.hp)}%`;
    bar.classList.add("combat");
  } else {
    duel?.classList.add("idle");
    document.getElementById("foe-tag").textContent = "No foe";
    document.getElementById("foe-hp-label").textContent = "—";
    document.getElementById("foe-fill").style.width = "0%";
    document.getElementById("you-swing").style.width = "0%";
    document.getElementById("foe-swing").style.width = "0%";
    if (act) {
      const a = CONTENT.actions[act.id];
      const pct = Math.min(100, 100 * act.progress / (act.duration || 1));
      lab.textContent = `${skillName(act.skill)} · ${a?.name || act.id}`;
      bar.style.width = pct + "%";
      bar.classList.remove("combat");
    } else {
      lab.textContent = "Idle — one craft or one war. Halt to change.";
      bar.style.width = "0%";
      bar.classList.remove("combat");
    }
  }
  const commit = document.getElementById("commit");
  if (commit) {
    if (m) {
      const foodN = bankCount(state, state.combat.foodId);
      commit.innerHTML = `<b>Committed:</b> fighting ${escapeHtml(m.name)} · ${foodN} food · Halt to leave. Soil/Drove still tick.`;
      commit.className = "danger";
    } else if (act) {
      const a = CONTENT.actions[act.id];
      const outId = a?.outputs?.[0]?.item;
      const outN = outId ? bankCount(state, outId) : 0;
      const outNm = outId ? (CONTENT.items[outId]?.name || outId) : "yield";
      const capNote = state._yieldWarn ? ` · ${state._yieldWarn}` : ` · ${outN} ${outNm}`;
      commit.innerHTML = `<b>Committed:</b> ${escapeHtml(a?.name || act.id)} (${skillName(act.skill)})${capNote}. Switching jobs asks Halt.`;
      commit.className = state._yieldWarn ? "danger" : "";
    } else {
      commit.innerHTML = `<b>Uncommitted.</b> Pick one action. You cannot train 22 skills at once — that was never the game.`;
      commit.className = "idle";
    }
  }
  const hits = document.getElementById("arena-hits");
  const seq = state._floaterSeq || 0;
  if (hits && seq !== lastFloater) {
    lastFloater = seq;
    const f = (state._floaters || []).at(-1);
    if (f) {
      const el = document.createElement("span");
      el.className = `floater ${f.foe ? "foe" : "you"}`;
      el.textContent = `${f.foe ? "-" : "+"}${f.n}`;
      hits.appendChild(el);
      setTimeout(() => el.remove(), 750);
    }
  }
  renderLevelModal(ctx);
}

function confirmBusy(ctx, nextId, kind, fn) {
  const { state } = ctx;
  if (kind === "action" && state.action?.id === nextId) return true;
  if (kind === "fight" && state.combat.fighting && state.combat.monsterId === nextId) return true;
  const cur = state.combat.fighting
    ? `fighting ${CONTENT.monsters[state.combat.monsterId]?.name || "a foe"}`
    : (state.action ? (CONTENT.actions[state.action.id]?.name || "a craft") : null);
  if (!cur) return true;
  const nextName = kind === "fight"
    ? (CONTENT.monsters[nextId]?.name || nextId)
    : (CONTENT.actions[nextId]?.name || CONTENT.dungeons.find((d) => d.id === nextId)?.name || nextId);
  forkFn = fn;
  const el = document.getElementById("fork-modal");
  if (!el) { fn(); return false; }
  el.hidden = false;
  el.classList.add("open");
  el.innerHTML = `<div class="sheet"><h3>Halt?</h3>
    <p>You are committed to <strong>${escapeHtml(cur)}</strong>. Switch to <strong>${escapeHtml(nextName)}</strong>?</p>
    <p class="blurb">Soil and Drove still tick. Everything else waits.</p>
    <button type="button" data-act="fork-yes">Halt and switch</button>
    <button type="button" data-act="fork-no">Keep this job</button></div>`;
  trapModal(el);
  return false;
}

function hideFork() {
  const el = document.getElementById("fork-modal");
  releaseModal();
  if (el) { el.hidden = true; el.classList.remove("open"); el.innerHTML = ""; }
}

let modalKeyHandler = null;
function trapModal(el) {
  releaseModal();
  const app = document.getElementById("app");
  app?.setAttribute("inert", "");
  const focusables = () => [...el.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
    .filter((n) => !n.disabled && n.offsetParent !== null);
  modalKeyHandler = (e) => {
    if (e.key === "Escape") {
      const no = el.querySelector("[data-act='fork-no'], [data-act='dismiss-level']");
      no?.click();
      return;
    }
    if (e.key !== "Tab") return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", modalKeyHandler);
  queueMicrotask(() => focusables()[0]?.focus());
}

function releaseModal() {
  if (modalKeyHandler) document.removeEventListener("keydown", modalKeyHandler);
  modalKeyHandler = null;
  document.getElementById("app")?.removeAttribute("inert");
}

function foldLevelUps(list) {
  const m = new Map();
  for (const ev of list || []) {
    const p = m.get(ev.skill);
    if (!p) m.set(ev.skill, { ...ev, unlocks: [...(ev.unlocks || [])] });
    else {
      p.from = Math.min(p.from, ev.from);
      p.to = Math.max(p.to, ev.to);
      p.unlocks = [...new Set([...(p.unlocks || []), ...(ev.unlocks || [])])];
    }
  }
  return [...m.values()];
}

function renderLevelModal(ctx) {
  const modal = document.getElementById("level-modal");
  if (!modal) return;
  const folded = foldLevelUps(ctx.state.levelUps);
  ctx.state.levelUps = folded;
  const ev = folded[0];
  if (!ev) {
    shownLevelKey = "";
    releaseModal();
    modal.hidden = true;
    return;
  }
  const key = folded.map((e) => `${e.skill}-${e.from}-${e.to}`).join("|");
  if (shownLevelKey === key && !modal.hidden) return;
  shownLevelKey = key;
  modal.hidden = false;
  const more = folded.length - 1;
  const lines = folded.slice(0, 8).map((e) =>
    `<p><strong>${skillName(e.skill)}</strong> ${e.from} → ${e.to}${e.unlocks?.length ? ` · ${e.unlocks.slice(0, 4).join(", ")}` : ""}</p>`
  ).join("");
  modal.innerHTML = `<div class="sheet">
    <h3>${skillName(ev.skill)} ${ev.to}</h3>
    <p>That stretch cost real dusk. The citadel does not mark a ledger this often.</p>
    ${lines}
    ${more > 0 ? `<p class="muted">${more} more arts waiting.</p>` : ""}
    <button type="button" data-act="dismiss-level">Continue</button>
    ${folded.length > 1 ? `<button type="button" data-act="dismiss-levels">Dismiss all ${folded.length}</button>` : ""}
  </div>`;
  trapModal(modal);
}

function renderCodex(ctx) {
  const el = document.getElementById("codex");
  if (!el) return;
  const { state } = ctx;
  if (!codexOpen) {
    el.className = "closed";
    el.innerHTML = `<span class="codex-k">Codex</span><span class="muted">Hidden — idling continues.</span>
      <div class="codex-acts"><button type="button" data-act="codex-toggle">Show</button></div>`;
    return;
  }
  el.className = "";
  const qid = state.quests.active[0];
  const q = CONTENT.quests.find((x) => x.id === qid);
  let next = "The Ledger is quiet.";
  let jump = "";
  if (q) {
    const steps = questProgress(state, q).map((p) => reqView(state, p.r));
    const open = steps.find((s) => !s.ok) || steps[0];
    next = `<strong>${q.name}</strong> — ${open?.label || q.desc}`;
    const hintSkill = inferQuestSkill(q);
    if (hintSkill) jump = `<button type="button" data-act="skill" data-arg="${hintSkill}">Open ${skillName(hintSkill)}</button>`;
  }
  let idle = pipelineFor(selectedSkill) || "Tap a Grove on Timber and leave it running.";
  if (state.combat.fighting) idle = "In combat. Halt to leave. Watch food.";
  else if (state.action) {
    const act = CONTENT.actions[state.action.id];
    const sink = (act?.outputs || []).flatMap((o) => sinksOf(o.item))[0];
    idle = `Idling: ${act?.name || state.action.id}${sink ? ` → ${sink}` : ""}.`;
  }
  el.innerHTML = `<span class="codex-k">Codex</span>
    <span>${next}</span>
    <span class="muted">${idle}</span>
    <div class="codex-acts">
      ${jump}
      <button type="button" data-act="desk" data-arg="bank">Open vault</button>
      <button type="button" data-act="desk" data-arg="loadout">Wanderer</button>
      <button type="button" data-act="panel" data-arg="shop">Stall</button>
      <button type="button" data-act="codex-toggle">Hide</button>
    </div>`;
}

function inferQuestSkill(q) {
  const r = q.req?.[0];
  if (!r) return "timber";
  if (r.type === "action") return CONTENT.actions[r.id]?.skill || "timber";
  if (r.type === "kills" || r.type === "dungeon") return "might";
  if (r.type === "harvest") return "soil";
  if (r.type === "laps") return "course";
  if (r.type === "bounty") return "bounty";
  if (r.type === "drove") return "drove";
  if (r.type === "level") return r.skill;
  return "timber";
}

function renderCenter(ctx) {
  const { state } = ctx;
  const sk = SKILLS.find((s) => s.id === selectedSkill);
  const lv = skillLevel(state, sk.id);
  const xp = state.skills[sk.id].xp;
  const next = XP_TABLE[Math.min(MAX_LEVEL, lv + 1)];
  const prev = XP_TABLE[lv];
  const pct = next === prev ? 100 : Math.min(100, 100 * (xp - prev) / (next - prev));
  const guild = state.skills[sk.id].guildRank;
  const gtask = CONTENT.guildTasks[sk.id][guild];
  const lock = skillLocked(state, sk.id);
  const coming = upcomingUnlocks(state, sk.id);
  let body = "";
  if (sk.kind === "gather" || sk.kind === "artisan") body = renderActions(ctx, sk.id);
  else if (sk.id === "course") body = renderCourse(ctx);
  else if (sk.id === "whisper") body = renderActions(ctx, "whisper");
  else if (sk.id === "soil") body = renderSoil(ctx);
  else if (sk.id === "drove") body = renderDrove(ctx);
  else if (sk.id === "chart") body = renderChart(ctx);
  else if (COMBAT_SKILLS.includes(sk.id)) body = renderCombatSkill(ctx, sk.id);
  const lockBanner = lock
    ? `<p class="blurb warn">Preview only — locked until <strong>${escapeHtml(lock)}</strong>. Read the board. Train the requirement. That is the fork.</p>`
    : "";
  const pipeline = pipelineFor(sk.id);
  const nextLine = coming.length
    ? `<p class="muted">Next by ${sk.name} ${Math.min(MAX_LEVEL, lv + 12)}: ${coming.join(" · ")}</p>`
    : `<p class="muted">No new groves in the next dozen levels — push mastery or a sink.</p>`;
  document.getElementById("center").innerHTML = `
    <div class="skill-head">
      <div>
        <h2>${sk.icon} ${sk.name} <em>${lv}</em></h2>
        <p class="blurb">${sk.blurb}</p>
        ${pipeline ? `<p class="sink">${pipeline}</p>` : ""}
        ${nextLine}
      </div>
      <div class="xpbar"><i style="width:${pct}%"></i><span>${Math.floor(xp).toLocaleString()} / ${next.toLocaleString()} xp</span></div>
    </div>
    ${lockBanner}
    <div class="guild">Pool ${state.skills[sk.id].pool || 0} · spend it on one node, not all of them · Guild ${guild}/10 ${gtask ? `· ${gtask.name}: ${state.skills[sk.id].guildProgress.toLocaleString()} / ${gtask.need.toLocaleString()} · ${gtask.bonus.label}` : "· Maxed"}</div>
    ${body}
  `;
}

function pipelineFor(skill) {
  const map = {
    timber: "Sink: logs → Ember (ash for Sigil) and Fletch (shafts/bows). Do not hoard Drift wood with nowhere to burn or nock.",
    trawl: "Sink: raw fish → Hearth. Uncooked catch will not keep you alive in Cinder Docks.",
    vein: "Sink: ore → Anvil bars → sabers you actually swing. Mining without smithing is a full vault.",
    ember: "Sink: ash → Sigil runes → Weave. Burning with no rune plan is a vanity fire.",
    hearth: "Sink: food → auto-eat. Combat without a larder is a dare.",
    anvil: "Sink: bars → weapons/armour. Each special (riposte, shred, bleed, pierce, echo) is a different hunt.",
    fletch: "Sink: ammo → Mark. A bow with an empty quiver is furniture.",
    loom: "Sink: hide → Mark armour. Plate is a tax against weavers.",
    sigil: "Sink: runes → the spell you actually cast. Out of runes, Weave goes silent.",
    vial: "Sink: draughts → a fight you chose, with a charge count.",
    course: "Pillars are a loadout. You cannot take every bonus. Time multiplies — greed is slower.",
    whisper: "Stun is the tax. Heat climbs if you get caught. Pick pockets, not a second job.",
    soil: "Plots tick while you Halt-lock something else. Plant, then go to war.",
    drove: "Pens stack produce while you adventure. Collect is the click that pays.",
    chart: "Two slots. Study arms the bonus — slotted with 0 insight does nothing.",
    might: "Triangle: Might beats Mark, loses to Weave. Food and style, not a DPS sheet.",
    mark: "Needs ammo. Beats Weave, loses to Might.",
    weave: "Needs runes. Beats Might, loses to Mark.",
    vow: "Two prayers. Drain is real — bury bones or go dark.",
    bounty: "A contract is opportunity cost: this monster, not that grove."
  };
  return map[skill] || "";
}

function sinksOf(itemId) {
  if (!itemId) return [];
  const seen = new Set();
  const out = [];
  for (const a of Object.values(CONTENT.actions)) {
    if (!a.inputs?.some((i) => i.item === itemId)) continue;
    if (seen.has(a.skill)) continue;
    seen.add(a.skill);
    out.push(`${skillName(a.skill)} (${a.name})`);
    if (out.length >= 3) break;
  }
  return out;
}

function fmtIo(state, list, kind) {
  if (!list?.length) return "";
  return list.map((i) => {
    const id = i.item;
    const have = bankCount(state, id);
    if (kind === "in") {
      const need = i.qty;
      return `${have}/${need} ${itemName(id)}`;
    }
    const min = i.min ?? i.qty ?? 1;
    const max = i.max ?? min;
    const range = min === max ? `×${min}` : `×${min}–${max}`;
    return `${itemName(id)} ${range} <span class="inv">(have ${have})</span>`;
  }).join(" · ");
}

function lockReason(state, a) {
  const lv = skillLevel(state, a.skill);
  if (lv < a.level) return `Locked — need ${skillName(a.skill)} ${a.level} (you are ${lv}).`;
  if (a.inputs) {
    for (const inp of a.inputs) {
      const have = bankCount(state, inp.item);
      if (have < inp.qty) return `Need ${inp.qty} ${itemName(inp.item)} (have ${have}).`;
    }
  }
  return "";
}

function renderActions(ctx, skill) {
  const { state } = ctx;
  const list = Object.values(CONTENT.actions).filter((a) => a.skill === skill);
  const groups = {};
  list.forEach((a) => {
    const g = a.category || "train";
    (groups[g] = groups[g] || []).push(a);
  });
  return Object.entries(groups).map(([g, arr]) => `
    <h3 class="grp">${g}</h3>
    <div class="grid">
      ${arr.map((a) => {
        const lvok = skillLevel(state, skill) >= a.level;
        const ml = masteryLevel(state.skills[skill].mastery[a.masteryId] || 0);
        const why = lockReason(state, a);
        const on = state.action?.id === a.id;
        const outs = fmtIo(state, a.outputs, "out");
        const ins = fmtIo(state, a.inputs, "in");
        const invBits = [];
        (a.inputs || []).forEach((i) => invBits.push(`${bankCount(state, i.item)} ${itemName(i.item)}`));
        (a.outputs || []).forEach((i) => invBits.push(`${bankCount(state, i.item)} ${itemName(i.item)}`));
        const inv = [...new Set(invBits)].slice(0, 4).join(" · ");
        const cp = state.skills[skill].checkpoints?.[a.masteryId] || 0;
        const cost = checkpointCost(state, a.id);
        const pool = state.skills[skill].pool || 0;
        const n = state.actionCounts?.[a.id] || 0;
        const sinkBits = (a.outputs || []).flatMap((o) => sinksOf(o.item));
        const sinks = [...new Set(sinkBits)].slice(0, 3).join(" · ");
        return `<div class="cardwrap">
        <button type="button" class="card ${on ? "on" : ""} ${lvok ? "" : "locked"}" data-act="start" data-arg="${a.id}" ${lvok ? "" : "disabled"}>
          <strong>${a.name}</strong>
          <span>Lv ${a.level} · ${(a.time / 1000).toFixed(1)}s · ${a.xp} xp · M${ml} · CP${cp} · ×${n} done</span>
          <div class="io">
            ${ins ? `<span class="in">In ${ins}</span>` : `<span class="in">No inputs</span>`}
            ${outs ? `<span class="out">Out ${outs}</span>` : `<span class="out">${a.desc || "No listed outputs"}</span>`}
          </div>
          ${sinks ? `<span class="sink">Then ${sinks}</span>` : ""}
          ${inv ? `<span class="inv">Bank ${inv}</span>` : ""}
          ${why ? `<em class="lock-why">${why}</em>` : ""}
        </button>
        <button type="button" class="tiny" data-act="checkpoint" data-arg="${a.id}">Spend ${cost} pool on THIS node (have ${pool}) — skip the rest</button>
        </div>`;
      }).join("")}
    </div>
  `).join("");
}

function renderCourse(ctx) {
  const { state } = ctx;
  const picks = CONTENT.coursePillars.map((cat) => {
    const cur = state.course.chosen[cat.id] || "";
    return `<label class="pillar">${cat.name}
      <select data-act="pillar" data-cat="${cat.id}">
        <option value="">— empty —</option>
        ${cat.options.map((o) => `<option value="${o.id}" ${cur === o.id ? "selected" : ""}>${o.name}</option>`).join("")}
      </select>
      <div class="hint">${cat.options.map((o) => `${o.name}: ${Object.entries(o).filter(([k]) => !["id","name"].includes(k)).map(([k,v]) => k + " " + v).join(", ")}`).join("<br>")}</div>
    </label>`;
  }).join("");
  return `<p class="blurb">Each pillar is a loadout slot. You cannot take every bonus. Time multiplies — greedy circuits run slower.</p>
    <div class="pillars">${picks}</div>
    <button type="button" class="primary" data-act="start" data-arg="course-lap">Run the circuit</button>`;
}

function renderSoil(ctx) {
  const { state } = ctx;
  const seeds = Object.keys(state.bank).filter((id) => CONTENT.items[id]?.category === "seed");
  const plots = state.soil.plots.map((p, i) => {
    if (!p) {
      return `<div class="plot empty"><h4>Plot ${i + 1}</h4>
        ${seeds.map((s) => `<button type="button" data-act="plant" data-arg="${i}" data-seed="${s}">Plant ${CONTENT.items[s].name} (${state.bank[s]})</button>`).join("") || "<em>No seeds. Chop groves.</em>"}
      </div>`;
    }
    return `<div class="plot ${p.ready ? "ready" : ""}">
      <h4>${CONTENT.items[p.seed].name}</h4>
      <p>${p.ready ? "Ready" : `${Math.ceil(p.left / 1000)}s`}</p>
      ${p.ready ? `<button type="button" data-act="harvest" data-arg="${i}">Harvest</button>` : ""}
    </div>`;
  }).join("");
  return `<div class="plots">${plots}</div>`;
}

function renderDrove(ctx) {
  const { state } = ctx;
  const pens = state.drove.pens.map((p, i) => {
    if (!p) {
      return `<div class="plot empty"><h4>Pen ${i + 1}</h4>
        ${CONTENT.animals.map((a) => `<button type="button" data-act="stock" data-arg="${i}" data-animal="${a.id}" ${skillLevel(state, "drove") < a.level ? "disabled" : ""}>${a.name} · ${20 + a.level * 4}m · Lv ${a.level}</button>`).join("")}
      </div>`;
    }
    const a = CONTENT.animals.find((x) => x.id === p.animal);
    return `<div class="plot ${p.ready ? "ready" : ""}">
      <h4>${a.name}</h4>
      <p>${p.ready ? `Ready: ${CONTENT.items[a.produce].name}` : `${Math.ceil(p.left / 1000)}s`}</p>
      ${p.ready ? `<button type="button" data-act="collect" data-arg="${i}">Collect</button>` : ""}
    </div>`;
  }).join("");
  return `<div class="plots">${pens}</div>`;
}

function renderChart(ctx) {
  const { state } = ctx;
  const slots = [];
  for (let i = 0; i < state.chart.slots; i++) {
    const cur = state.chart.active[i] || "";
    slots.push(`<select data-act="chart-slot" data-i="${i}">
      ${CONTENT.constellations.map((c) => `<option value="${c.id}" ${cur === c.id ? "selected" : ""}>${c.name} — ${c.desc || c.skill}</option>`).join("")}
    </select>`);
  }
  const study = CONTENT.constellations.map((c) => {
    return `<button type="button" class="card" data-act="start" data-arg="chart-${c.id}" disabled style="display:none"></button>`;
  }).join("");
  return `<p class="blurb">Only ${state.chart.slots} constellations bind at once. A slotted star with 0 study grants nothing — study it to arm the bonus.</p>
    <div class="pillars">${slots.join("")}</div>
    <div class="grid">${CONTENT.constellations.map((c) => {
      const on = state.chart.active.includes(c.id);
      const n = state.chart.studied?.[c.id] || 0;
      return `<button type="button" class="card ${on ? "on" : ""}" data-act="start" data-arg="chart-study-${c.id}">
        <strong>Study ${c.name}</strong><span>Chart xp · ${c.studyTime / 1000}s · insight ${n}${on && n <= 0 ? " · slotted, unarmed" : ""}</span><em>${JSON.stringify(c.bonus)}</em>
      </button>`;
    }).join("")}</div>${study}`;
}

function renderCombatTheater(ctx) {
  const { state } = ctx;
  const m = CONTENT.monsters[state.combat.monsterId];
  const st = playerStats(state);
  const foodId = state.combat.foodId;
  const foodN = foodId ? bankCount(state, foodId) : 0;
  const now = state.now || 0;
  if (!state.combat.fighting || !m) {
    return `<div class="fight-board">
      <div><h4>Not in a fight</h4><p class="hint">Equip a weapon, set food, then pick a monster. Auto-eat at ${(state.combat.autoEat * 100).toFixed(0)}% HP.</p></div>
      <div>
        <p class="hint">You ${Math.ceil(state.combat.hp)}/${state.combat.maxHp} · style ${st.style}</p>
        <p class="hint">Food: ${foodId ? `${foodN} ${itemName(foodId)}` : "none"}</p>
      </div>
    </div>`;
  }
  const youSwing = duelSwing(now, state.combat.nextHitAt, playerInterval(state));
  const foeSwing = duelSwing(now, state.combat.enemyNextAt, m.interval);
  const dun = state.combat.dungeon ? CONTENT.dungeons.find((d) => d.id === state.combat.dungeon) : null;
  return `<div class="fight-board">
    <div>
      <h4>You</h4>
      <div class="bar hp"><i style="width:${Math.max(0, 100 * state.combat.hp / state.combat.maxHp)}%;display:block;height:100%;background:linear-gradient(90deg,#8e3a58,var(--rose))"></i></div>
      <p class="hint">${Math.ceil(state.combat.hp)} / ${state.combat.maxHp} · next strike ${youSwing.toFixed(0)}%</p>
      <p class="hint">Style ${st.style} · Acc ${st.acc.toFixed(0)} · Power ${st.power.toFixed(0)} · Def ${st.def.toFixed(0)} · max hit ~${Math.max(1, Math.floor(st.power / 4))}${st.tri?.edge && st.tri.edge !== "even" ? ` · triangle ${st.tri.edge}` : ""}</p>
      <p class="hint">Food ${foodN} ${foodId ? itemName(foodId) : "—"} ${foodN <= 3 ? "· running low" : ""}</p>
      <p class="hint">Special ${Math.floor(state.combat.spec || 0)}% ${(state.combat.useSpec !== false) ? "ON" : "OFF"} · prayers on Vow · spells on Weave</p>
    </div>
    <div>
      <h4>${m.name}</h4>
      <div class="bar hp foe"><i style="display:block;height:100%;width:${Math.max(0, 100 * state.combat.monsterHp / m.hp)}%;background:linear-gradient(90deg,#3a2a78,#8b7cff)"></i></div>
      <p class="hint">${Math.max(0, Math.ceil(state.combat.monsterHp))} / ${m.hp} · incoming ${foeSwing.toFixed(0)}%</p>
      <p class="hint">Hit ${m.maxHit} · ${m.style}${m.special ? " · " + m.special : ""}</p>
      <p class="hint">${dun ? `${dun.name} floor ${(state.combat.dungeonIndex || 0) + 1}/${dun.sequence.length}` : m.area}</p>
    </div>
  </div>`;
}

function renderCombatSkill(ctx, id) {
  const { state } = ctx;
  const theater = renderCombatTheater(ctx);
  if (id === "vow") {
    return theater + `<div class="grid">${CONTENT.prayers.map((p) => {
      const on = state.combat.prayers.includes(p.id);
      const ok = skillLevel(state, "vow") >= p.level;
      return `<button type="button" class="card ${on ? "on" : ""}" data-act="pray" data-arg="${p.id}" ${ok ? "" : "disabled"}>
        <strong>${p.name}</strong><span>Lv ${p.level} · drain ${p.drain}/s</span>
        <em>${p.desc}</em>
        ${ok ? "" : `<em class="lock-why">Locked — Vow ${p.level}</em>`}
      </button>`;
    }).join("")}
    <p><button type="button" class="primary" data-act="bury">Bury all pale bones (${bankCount(state, "bones")})</button></p></div>`;
  }
  if (id === "weave") {
    return theater + `<div class="grid">${CONTENT.spells.map((s) => {
      const on = state.combat.spell === s.id;
      const ok = skillLevel(state, "weave") >= s.level;
      const cost = Object.entries(s.runes).map(([r, n]) => `${n} ${CONTENT.items[r].name} (have ${bankCount(state, r)})`).join(", ");
      return `<button type="button" class="card ${on ? "on" : ""}" data-act="spell-pick" data-arg="${s.id}" ${ok ? "" : "disabled"}>
        <strong>${s.name}</strong><span>Lv ${s.level} · hit ${s.maxHit}</span><em>${s.desc} · ${cost}</em>
        ${ok ? "" : `<em class="lock-why">Locked — Weave ${s.level}</em>`}
      </button>`;
    }).join("")}
    <label>Spell <select data-act="spell">${CONTENT.spells.map((s) => `<option value="${s.id}" ${state.combat.spell === s.id ? "selected" : ""}>${s.name}</option>`).join("")}</select></label>
    </div>${renderAreas(ctx)}`;
  }
  if (id === "bounty") {
    const b = state.bounty;
    const m = CONTENT.monsters[b.monsterId];
    return theater + `<div class="panel">
      <p>${m ? `Hunt <strong>${m.name}</strong> in ${m.area}: ${b.have}/${b.need} · streak ${b.streak}` : "No contract."}</p>
      <button type="button" class="primary" data-act="bounty">Roll a contract</button>
      <p>Tokens: ${bankCount(state, "bounty-token")}</p>
    </div>${renderAreas(ctx)}`;
  }
  return theater + renderAreas(ctx);
}

function renderAreas(ctx) {
  const { state } = ctx;
  const areas = CONTENT.areas.map((a) => `
    <details class="area" data-area="${a.id}" ${openAreas.has(a.id) || a.name === state.combat.area ? "open" : ""}>
      <summary>${a.name} <em>Bounty ${a.slayer}</em></summary>
      <div class="grid">${a.monsters.map((id) => {
        const m = CONTENT.monsters[id];
        const on = state.combat.fighting && state.combat.monsterId === id;
        return `<button type="button" class="card ${on ? "on" : ""}" data-act="fight" data-arg="${id}">
          <strong>${m.name}</strong>
          <span>HP ${m.hp} · hit ${m.maxHit} · ${m.style}${m.special ? " · " + m.special : ""}</span>
          <em>${m.desc}</em>
        </button>`;
      }).join("")}</div>
    </details>`).join("");
  const duns = `<h3 class="grp">Dungeons</h3><div class="grid">${CONTENT.dungeons.map((d) => {
    const n = (state.combat.dungeonClears || {})[d.id] || 0;
    const on = state.combat.dungeon === d.id;
    return `<button type="button" class="card ${on ? "on" : ""}" data-act="dungeon" data-arg="${d.id}">
      <strong>${d.name}</strong><span>Req ${d.req} · ${d.sequence.length} floors · clears ${n}</span><em>${d.desc}</em>
    </button>`;
  }).join("")}</div>`;
  const st = playerStats(state);
  const foodOpts = Object.keys(state.bank).filter((id) => CONTENT.items[id]?.heal).concat(state.combat.foodId ? [state.combat.foodId] : []);
  const uniqueFood = [...new Set(foodOpts)];
  return `<div class="stats-strip">Style <b>${st.style}</b> · Acc ${st.acc.toFixed(0)} · Power ${st.power.toFixed(0)} · Def ${st.def.toFixed(0)} · Auto-eat ${(state.combat.autoEat * 100).toFixed(0)}%</div>
    <label>Food <select data-act="food">${uniqueFood.map((id) => `<option value="${id}" ${state.combat.foodId === id ? "selected" : ""}>${CONTENT.items[id]?.name} +${CONTENT.items[id]?.heal} (${bankCount(state, id)})</option>`).join("")}</select></label>
    <div class="potions">${Object.keys(state.bank).filter((id) => CONTENT.items[id]?.potion).slice(0, 12).map((id) => `<button type="button" data-act="drink" data-arg="${id}">Drink ${CONTENT.items[id].name} (${state.bank[id]})</button>`).join("")}</div>
    ${state.combat.potionId ? `<p class="blurb">Active: ${CONTENT.items[state.combat.potionId].name} · ${state.combat.potionCharges} charges</p>` : ""}
    ${areas}${duns}
    <div class="clog">${(state._clog || []).map((l) => `<div>${escapeHtml(l)}</div>`).join("")}</div>
  `;
}

export function renderRight(ctx) {
  renderGear(ctx);
  renderBank(ctx);
  renderQuests(ctx);
  renderShop(ctx);
  renderLog(ctx);
}

function renderGear(ctx) {
  const { state } = ctx;
  const slots = ["weapon", "shield", "helm", "body", "legs", "boots", "gloves", "cape", "amulet", "ammo", "ring"];
  document.getElementById("gear").innerHTML = slots.map((s) => {
    const id = state.equipment[s];
    const it = CONTENT.items[id];
    return `<div class="slot"><b>${s}</b> ${it ? `<span>${it.name}</span> <button type="button" data-act="unequip" data-arg="${s}">x</button>` : "<em>empty</em>"}</div>`;
  }).join("") + `<div class="slot"><b>tools</b> <span>axe ${CONTENT.items[state.tools.axe]?.name || "–"} ${state.tools.axe ? `<button type="button" data-act="unequip" data-arg="axe">x</button>` : ""} · pick ${CONTENT.items[state.tools.pick]?.name || "–"} ${state.tools.pick ? `<button type="button" data-act="unequip" data-arg="pick">x</button>` : ""} · rod ${CONTENT.items[state.tools.rod]?.name || "–"} ${state.tools.rod ? `<button type="button" data-act="unequip" data-arg="rod">x</button>` : ""}</span></div>
    <button type="button" data-act="desk" data-arg="loadout">Open wanderer</button>
    <button type="button" data-act="loadout-save">Save loadout</button>
    ${state.loadouts.map((l, i) => `<button type="button" data-act="loadout-load" data-arg="${i}">${l.name}</button>`).join("")}`;
}

function renderBank(ctx) {
  const { state } = ctx;
  const tabBtns = [`<button type="button" class="${bankTab === "All" ? "on" : ""}" data-act="tab" data-arg="All">All</button>`]
    .concat(state.bankTabs.map((t) => `<button type="button" class="${t === bankTab ? "on" : ""}" data-act="tab" data-arg="${t}">${t}</button>`))
    .join("");
  const held = Object.entries(state.bank).filter(([, n]) => n > 0);
  const rows = held
    .filter(([id]) => CONTENT.items[id]?.name.toLowerCase().includes(bankFilter))
    .filter(([id]) => bankTab === "All" || (state.itemTabs[id] || "General") === bankTab)
    .sort((a, b) => CONTENT.items[a[0]].name.localeCompare(CONTENT.items[b[0]].name))
    .map(([id, n]) => {
      const it = CONTENT.items[id];
      const eq = it.category === "equipment" || it.category === "ammo" || it.category === "tool";
      const stackVal = (it.value || 0) * n;
      const icon = CAT_ICON[it.category] || "·";
      return `<div class="brow" title="${it.desc || ""}">
        <span>${icon}</span>
        <span class="nm">${it.name}</span>
        <span class="qty">${n.toLocaleString()}</span>
        <span class="val">${stackVal.toLocaleString()} ✦ · ${it.category}</span>
        <div class="acts">
          ${eq ? `<button type="button" data-act="equip" data-arg="${id}">equip</button>` : ""}
          ${it.potion ? `<button type="button" data-act="drink" data-arg="${id}">drink</button>` : ""}
          <button type="button" data-act="set-tab" data-arg="${id}">tab</button>
          <button type="button" data-act="sell" data-arg="${id}">sell</button>
        </div>
      </div>`;
    }).join("");
  const worth = held.reduce((s, [id, n]) => s + (CONTENT.items[id]?.value || 0) * n, 0);
  const html = `<div class="tabs">${tabBtns}</div>
    <input id="bank-search" placeholder="Search bank" value="${escapeHtml(bankFilter)}" />
    <div class="bank-meta"><span>${held.length}/${bankCap(state)} stacks${held.length >= bankCap(state) ? " · FULL" : ""}</span><span>${worth.toLocaleString()} ✦</span></div>
    <button type="button" data-act="desk" data-arg="bank">Open dedicated vault</button>
    <div class="bank-grid">${rows || "<p class='blurb'>Empty tab.</p>"}</div>`;
  fillHtml(document.getElementById("bank"), html);
}

function areaKills(state, area) {
  let n = 0;
  for (const mid of Object.keys(state.combat.kills || {})) {
    if (CONTENT.monsters[mid]?.area === area) n += state.combat.kills[mid];
  }
  return n;
}

function reqView(state, r) {
  let have = 0, need = 1, label = r.type;
  if (r.type === "action") {
    const a = CONTENT.actions[r.id];
    have = state.actionCounts?.[r.id] || 0;
    need = r.count;
    label = `${a?.name || r.id}`;
  } else if (r.type === "kills") {
    have = areaKills(state, r.area);
    need = r.count;
    label = `Defeat foes in ${r.area}`;
  } else if (r.type === "dungeon") {
    have = (state.combat.dungeonClears || {})[r.id] >= 1 ? 1 : 0;
    need = 1;
    const d = CONTENT.dungeons.find((x) => x.id === r.id);
    label = `Clear ${d?.name || r.id}`;
  } else if (r.type === "harvest") {
    have = state.quests.stats.harvests || 0;
    need = r.count;
    label = "Harvest soil plots";
  } else if (r.type === "laps") {
    have = state.quests.stats.laps || 0;
    need = r.count;
    label = "Finish course laps";
  } else if (r.type === "bounty") {
    have = state.quests.stats.bounties || 0;
    need = r.count;
    label = "Complete bounty contracts";
  } else if (r.type === "drove") {
    have = state.quests.stats?.drove?.[r.animal] || 0;
    need = r.count;
    const an = CONTENT.animals.find((x) => x.id === r.animal);
    label = `Collect ${an?.name || r.animal} produce`;
  } else if (r.type === "level") {
    have = skillLevel(state, r.skill);
    need = r.level;
    label = `Reach ${skillName(r.skill)} ${r.level}`;
  } else if (r.type === "anyLevel") {
    have = Math.max(0, ...Object.values(state.skills).map((s) => s.level || 0));
    need = r.level;
    label = `Any skill to ${r.level}`;
  } else if (r.type === "guildRank") {
    have = Math.max(0, ...Object.values(state.skills).map((s) => s.guildRank || 0));
    need = r.rank;
    label = `Any guild rank ${r.rank}`;
  }
  const ok = have >= need;
  const pct = need <= 0 ? 100 : Math.min(100, 100 * have / need);
  return { have, need, label, ok, pct };
}

function renderQuests(ctx) {
  const { state } = ctx;
  const cards = state.quests.active.map((id) => {
    const q = CONTENT.quests.find((x) => x.id === id);
    if (!q) return "";
    const steps = questProgress(state, q).map((p) => reqView(state, p.r));
    const prog = steps.map((s) => `
      <div class="qstep ${s.ok ? "ok" : ""}">
        <div class="ql"><span>${s.label}</span><span>${Math.min(s.have, s.need).toLocaleString()} / ${s.need.toLocaleString()}${s.ok ? " ✓" : ""}</span></div>
        <div class="qbar"><i style="width:${s.pct}%"></i></div>
      </div>`).join("");
    const reward = [];
    if (q.reward?.coins) reward.push(`${q.reward.coins} ✦`);
    if (q.reward?.items) q.reward.items.forEach((it) => reward.push(`${it.qty} ${itemName(it.id)}`));
    return `<div class="q"><strong>${q.name}</strong><p>${q.desc}</p>${prog}${reward.length ? `<p class="muted">Reward: ${reward.join(" · ")}</p>` : ""}</div>`;
  }).join("");
  const coming = CONTENT.quests
    .filter((q) => !state.quests.done.includes(q.id) && !state.quests.active.includes(q.id))
    .slice(0, 4)
    .map((q) => `<p class="muted">Coming: ${q.name} — ${q.desc}</p>`)
    .join("");
  document.getElementById("quests").innerHTML = cards + coming + `<p class="blurb">Sealed ${state.quests.done.length}/${CONTENT.quests.length}</p>`;
}

function offerName(o) {
  return o.name || CONTENT.items[o.item]?.name || o.id;
}

function offerCost(state, o) {
  const bought = state.shopBought[o.id] || 0;
  let cost = o.cost;
  if (o.repeatable) cost = Math.floor(cost * Math.pow(1.45, bought));
  return { cost, bought };
}

function renderShop(ctx) {
  const { state } = ctx;
  const cats = [
    ["tools", "Tools"],
    ["upgrades", "Upgrades"],
    ["cosmetics", "Cosmetics"]
  ];
  const chips = cats.map(([id, lab]) => `<button type="button" class="${shopCat === id ? "on" : ""}" data-act="shop-cat" data-arg="${id}">${lab}</button>`).join("");
  let list = CONTENT.shop.filter((o) => shopGroup(o) === shopCat);
  if (shopFilter) {
    list = CONTENT.shop.filter((o) => offerName(o).toLowerCase().includes(shopFilter) || (o.desc || "").toLowerCase().includes(shopFilter));
  }
  if (shopCat === "tools" && !shopFilter && shopTool !== "all") {
    list = list.filter((o) => CONTENT.items[o.item]?.toolSlot === shopTool);
  }
  const toolChips = shopCat === "tools" && !shopFilter ? `<div class="tabs">
    <button type="button" class="${shopTool === "all" ? "on" : ""}" data-act="shop-tool" data-arg="all">All tools</button>
    <button type="button" class="${shopTool === "axe" ? "on" : ""}" data-act="shop-tool" data-arg="axe">Hatchets</button>
    <button type="button" class="${shopTool === "pick" ? "on" : ""}" data-act="shop-tool" data-arg="pick">Picks</button>
    <button type="button" class="${shopTool === "rod" ? "on" : ""}" data-act="shop-tool" data-arg="rod">Rods</button>
  </div>` : "";

  const families = {};
  list.forEach((o) => {
    const it = o.item ? CONTENT.items[o.item] : null;
    const fam = it?.toolSlot ? TOOL_LABEL[it.toolSlot] || it.toolSlot : (shopFilter ? shopGroup(o) : "wares");
    (families[fam] = families[fam] || []).push(o);
  });

  const body = Object.keys(families).length === 0
    ? `<p class="blurb">${shopCat === "cosmetics" ? "No lanterns or veils hung yet — this stall is still a workshop." : "Nothing matches."}</p>`
    : Object.entries(families).map(([fam, arr]) => `
        ${shopCat === "tools" || shopFilter ? `<div class="shop-fam">${fam}</div>` : ""}
        <div class="wares">${arr.map((o) => {
          const { cost, bought } = offerCost(state, o);
          const sold = o.max && bought >= o.max;
          const lvok = !o.reqLevel || skillLevel(state, o.reqSkill) >= o.reqLevel;
          const why = sold ? "Sold out" : !lvok ? `Need ${skillName(o.reqSkill)} ${o.reqLevel}` : state.coins < cost ? "Short on marks" : "";
          return `<button type="button" class="ware ${sold || !lvok ? "locked" : ""}" data-act="buy" data-arg="${o.id}" ${sold ? "disabled" : ""}>
            <strong>${offerName(o)}</strong>
            <span class="cost">${Math.floor(cost).toLocaleString()} ✦</span>
            <span class="sub">${o.desc || ""} · owned ${bought}${o.max ? "/" + o.max : ""}${why ? " · " + why : ""}</span>
          </button>`;
        }).join("")}</div>`).join("");

  const html = `<div class="shop-head">
      <div class="tabs">${chips}</div>
      <input id="shop-search" placeholder="Filter stall" value="${escapeHtml(shopFilter)}" />
      ${toolChips}
    </div>${body}`;
  fillHtml(document.getElementById("shop"), html);
}

function renderLog(ctx) {
  document.getElementById("journal").innerHTML = ctx.state.log.slice(0, 14).map((l) => `<div>${escapeHtml(l.msg)}</div>`).join("");
}

function toast(ctx, msg) {
  log(ctx.state, msg);
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove("show"), 3200);
}

export { renderTop, recalcHp, desk, inspectModelOf };
