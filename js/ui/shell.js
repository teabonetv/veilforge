import { escapeHtml } from "../util/text.js";
import { CONTENT, SKILLS, COMBAT_SKILLS, XP_TABLE, MAX_LEVEL, skillLevel, bankCount, log, masteryLevel, recalcHp, skillLocked, lockMessage, bankUsed, bankCap, stashItem, upcomingUnlocks, bankValue, masteryBonus, lastSaveFail, takeItem, renewSkill, MASTERY_MILESTONES } from "../engine/state.js";
import { startAction, stopAction, harvestPlot, plantPlot, collectPen, stockPen, actionDuration, spendCheckpoint, checkpointCost, buyPillar, spendChartRank, openPouch, feedPen, sellItems, setUseCompost, maxAffordable, fulfillCommission, markHeat, setActionMode } from "../engine/sim.js";
import { startFight, stopFight, startDungeon, equipItem, unequip, drinkPotion, rollBounty, buryBones, playerStats, playerInterval, swapWeaponStyle, gearSetInfo } from "../engine/combat.js";
import { questProgress, firstHourBeat, currentBeat, actOf } from "../engine/quests.js";
import { needsWelcome, toolNudge, beatWhy, sealCopy } from "../engine/onboard.js";
import { saveLoadout, loadLoadout } from "../engine/wanderer.js";
import { desk, setDesk, setVaultPick, setFocusedSlot, renderDesks, onVaultSearch, onVaultCat, onVaultLens, applyKit, inspectModelOf, onStallSearch, onStallBooth, onStallPick, onStallPacks, stallPackCount, currentStallBooth, currentStallFilter, onCodexTab } from "./desks.js";
import { iconMarkup, SKILL_ICON_KIND } from "../scene/icons.js";
import { QUAY_BOOTHS, inferBooth, offerModel, quayDeal, offerName as stallOfferName, offerPrice, pawnRate, quayCommissions, vaultFenceRate } from "../engine/market.js";
import { ledgerStats, standingBonuses } from "../engine/ledger.js";
import { weeklyEclipse } from "../engine/eclipse.js";
import { standingCopy, ensureOrders } from "../engine/orders.js";
import { currentCommission, deliverCommission } from "../engine/commissions.js";
import { ACHIEVEMENTS } from "../content/achievements.js";
import { wearTitle } from "../engine/achievements.js";
import { rarityOf } from "../content/rarity.js";
import { deedMedals } from "../engine/deeds.js";
import { glyphLock, glyphMarks } from "./glyphs.js";

let forkFn = null;
let shownLevelKey = "";
let lastFloater = 0;
let lastDrip = 0;
let audioCtx = null;
let bankFilter = "";
let bankTab = "All";
let codexOpen = localStorage.getItem("veilforge-codex") !== "0";
let selectedSkill = "timber";
let selectedAction = null;
let craftQty = "inf";
let jobTabs = { anvil: "smelt" };
let openAreas = new Set();

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
    if (e.target.id === "stall-search") {
      onStallSearch(e.target.value);
      renderDesks(ctx);
    }
    if (e.target.id === "shop-search") {
      onStallSearch(e.target.value);
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
      state.chart.active[i] = e.target.value || null;
    }
    if (e.target.dataset.act === "food") state.combat.foodId = e.target.value;
    if (e.target.dataset.act === "food2") state.combat.foodId2 = e.target.value || null;
    if (e.target.dataset.act === "spell") state.combat.spell = e.target.value;
    if (e.target.dataset.act === "char-name") {
      state.name = e.target.value.slice(0, 24);
    }
    if (e.target.dataset.act === "set-toasts") state.settings.toasts = e.target.checked;
    if (e.target.dataset.act === "set-motion") state.settings.reducedMotion = e.target.checked;
    if (e.target.dataset.act === "set-clog") state.settings.showCombatLog = e.target.checked;
    if (e.target.dataset.act === "compost") setUseCompost(state, e.target.checked);
    if (e.target.dataset.act === "set-hiscores") state.settings.hiscores = e.target.checked;
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
      if (selectedAction && CONTENT.actions[selectedAction]?.skill !== arg) selectedAction = null;
      setDesk("workshop");
      ctx.render();
      break;
    case "job-pick":
      selectedAction = arg;
      setDesk("workshop");
      ctx.render();
      break;
    case "job-tab":
      jobTabs[selectedSkill] = arg;
      selectedAction = null;
      ctx.render();
      break;
    case "job-qty":
      craftQty = arg || "inf";
      ctx.render();
      break;
    case "checkpoint": err(spendCheckpoint(state, arg)); ctx.render(); break;
    case "dismiss-level":
      state.levelUps = (state.levelUps || []).slice(1);
      shownLevelKey = "";
      clearTimeout(levelFade);
      renderLevelModal(ctx);
      break;
    case "dismiss-levels":
      state.levelUps = [];
      shownLevelKey = "";
      clearTimeout(levelFade);
      renderLevelModal(ctx);
      break;
    case "start":
      setDesk("workshop");
      selectedAction = arg;
      if (state.action?.id === arg) break;
      {
        const count = resolveCraftCount(state, CONTENT.actions[arg]);
        const go = () => { err(startAction(state, arg, { count })); ctx.render(); };
        if (!confirmBusy(ctx, arg, "action", go)) break;
        go();
      }
      break;
    case "stop":
      if (state.combat.fighting || state.action) {
        confirmHalt(ctx);
        break;
      }
      stopAction(state); stopFight(state); ctx.render(); break;
    case "spec":
      state.combat.useSpec = state.combat.useSpec === false;
      ctx.render();
      break;
    case "food-chip":
      setDesk("workshop");
      selectedSkill = "might";
      ctx.render();
      document.getElementById("food-pick")?.focus();
      break;
    case "settings":
      showSettings(ctx);
      break;
    case "death-ack":
      state._deathSheet = null;
      ctx.render();
      break;
    case "commission":
      err(fulfillCommission(state, arg));
      ctx.render();
      break;
    case "compost":
      setUseCompost(state, !!el.checked);
      ctx.render();
      break;
    case "fight":
      setDesk("workshop");
      if (state.combat.fighting && state.combat.monsterId === arg) break;
      if (!confirmBusy(ctx, arg, "fight", () => { err(startFight(state, arg)); ctx.render(); })) break;
      err(startFight(state, arg)); ctx.render(); break;
    case "dungeon":
      setDesk("workshop");
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
    case "feed": err(feedPen(state, +arg)); ctx.render(); break;
    case "bounty": err(rollBounty(state)); ctx.render(); break;
    case "bury": err(buryBones(state)); ctx.render(); break;
    case "buy": err(buyShop(state, arg, stallPackCount())); ctx.render(); break;
    case "sell": sellItems(state, arg, 1); ctx.render(); break;
    case "sell-all": sellItems(state, arg, "all"); ctx.render(); break;
    case "quay-pawn": {
      const deal = quayDeal();
      const it = CONTENT.items[arg];
      if (!it || (it.category !== deal.hunger && it.id !== deal.hunger)) {
        toast(ctx, "The quay is not hungry for that this watch.");
        break;
      }
      err(sellItems(state, arg, "all", { rate: pawnRate(), quay: true }));
      ctx.render();
      break;
    }
    case "pouch": err(openPouch(state)); ctx.render(); break;
    case "build-pillar": err(buyPillar(state, el.dataset.cat, arg)); ctx.render(); break;
    case "chart-rank": err(spendChartRank(state, arg)); ctx.render(); break;
    case "swap-style": err(swapWeaponStyle(state, arg)); ctx.render(); break;
    case "pray": togglePrayer(state, arg); ctx.render(); break;
    case "offline-ack": state.lastOffline = null; ctx.render(); break;
    case "spell-pick": state.combat.spell = arg; ctx.render(); break;
    case "tab": bankTab = arg; renderBank(ctx); break;
    case "set-tab": {
      const dest = bankTab === "All" ? (state.bankTabs[0] || "General") : bankTab;
      state.itemTabs[arg] = dest;
      renderBank(ctx);
      break;
    }
    case "shop-cat":
      onStallBooth(arg);
      if (desk === "stall") ctx.render();
      else renderShop(ctx);
      break;
    case "stall-booth": onStallBooth(arg); renderDesks(ctx); break;
    case "stall-pick": onStallPick(arg); renderDesks(ctx); break;
    case "stall-packs": onStallPacks(arg); renderDesks(ctx); break;
    case "codex-toggle":
      codexOpen = !codexOpen;
      localStorage.setItem("veilforge-codex", codexOpen ? "1" : "0");
      renderCodex(ctx);
      break;
    case "loadout-save": saveLoadout(state); toast(ctx, "Loadout saved."); break;
    case "loadout-load": err(loadLoadout(state, +arg)); ctx.render(); break;
    case "desk":
      setDesk(arg);
      ctx.render();
      ctx.portraits?.resize?.();
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      ["layout", "bank-desk", "wander-desk", "stall-desk", "codex-desk", "center"].forEach((id) => {
        document.getElementById(id)?.scrollTo?.(0, 0);
      });
      break;
    case "vault-pick": setVaultPick(el.dataset.kind || "item", arg); renderDesks(ctx); break;
    case "codex-tab": onCodexTab(arg); renderDesks(ctx); break;
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
        const blob = new Blob([text], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "veilforge.veilforge.txt";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        navigator.clipboard?.writeText(text).then(
          () => toast(ctx, "Save downloaded and copied."),
          () => toast(ctx, "Save downloaded. Clipboard copy needs permission.")
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
    case "wipe": showNewGame(ctx); break;
    case "new-game":
      hideFork();
      ctx.wipe(arg || "standard");
      break;
    case "renew":
      err(renewSkill(state, arg || selectedSkill));
      ctx.render();
      break;
    case "action-mode":
      err(setActionMode(state, selectedSkill, arg));
      ctx.render();
      break;
    case "workshop":
      err(deliverCommission(state));
      ctx.render();
      break;
    case "wear-title":
      err(wearTitle(state, arg));
      ctx.render();
      break;
    case "edict-ack":
      state._edict = null;
      releaseModal();
      ctx.render();
      break;
    case "wake-ack":
      state.settings = state.settings || {};
      state.settings.welcomed = true;
      releaseModal();
      ctx.render();
      break;
    case "dawn-ack":
      state._dawn = false;
      releaseModal();
      ctx.render();
      break;
    case "order-bank":
      ensureOrders(state).bank = !state.orders.bank;
      ctx.render();
      break;
    case "order-eat":
      ensureOrders(state).eat = !state.orders.eat;
      ctx.render();
      break;
    case "order-sell":
      ensureOrders(state).sell = !state.orders.sell;
      ctx.render();
      break;
    case "order-floor":
      ensureOrders(state).sellFloor = arg;
      ctx.render();
      break;
    case "rite":
      showRite(ctx, arg || selectedSkill);
      break;
    case "panel":
      if (arg === "shop") { setDesk("stall"); ctx.render(); ctx.portraits?.resize?.(); break; }
      document.getElementById(arg)?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
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

function buyShop(state, id, packs = 1) {
  const offer = CONTENT.shop.find((s) => s.id === id);
  if (!offer) return "Unknown wares.";
  if (state.rules?.mode === "iron" && !offer.tokens) return "Wanderer's Path: the quay will not sell. Fence at 40%.";
  const times = offer.repeatable && offer.item && !offer.effect ? Math.max(1, Math.min(10, packs || 1)) : 1;
  for (let i = 0; i < times; i++) {
    const { cost, bought, token } = offerPrice(state, offer);
    if (offer.max && bought >= offer.max) return i ? null : "Sold out.";
    if (offer.reqLevel && skillLevel(state, offer.reqSkill) < offer.reqLevel) return `Need ${offer.reqSkill} ${offer.reqLevel}.`;
    if (token) {
      if (bankCount(state, "bounty-token") < cost) return i ? null : "Not enough bounty tokens.";
      takeItem(state, "bounty-token", cost);
    } else {
      if (state.coins < cost) return i ? null : "Not enough veilmarks.";
      state.coins -= cost;
    }
    state.shopBought[id] = bought + 1;
    if (offer.item) stashItem(state, offer.item, offer.qty || 1, "quay");
    if (offer.effect === "bankTab") state.bankTabs.push("Tab " + state.bankTabs.length);
    if (offer.effect === "plot") state.soil.plots.push(null);
    if (offer.effect === "pen") state.drove.pens.push(null);
    if (offer.effect === "autoEat") state.combat.autoEat = 0.6;
    if (offer.effect === "autoEat2") { state.combat.autoEat = 0.75; }
    if (offer.effect === "loadout") state.loadouts.push({ name: "Set " + state.loadouts.length, equipment: { ...state.equipment } });
    if (offer.effect === "chartSlot") state.chart.slots = Math.max(state.chart.slots, 3);
    if (offer.effect === "offlineHours") state.offlineHours = 24;
    if (offer.effect === "endow") state.endow = (state.endow || 0) + 1;
  }
  return null;
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

function xpPct(state, skillId) {
  const lv = skillLevel(state, skillId);
  const xp = state.skills[skillId]?.xp || 0;
  const next = XP_TABLE[Math.min(MAX_LEVEL, lv + 1)];
  const prev = XP_TABLE[lv] || 0;
  if (next === prev) return 100;
  return Math.max(0, Math.min(100, 100 * (xp - prev) / (next - prev)));
}

function itemName(id) {
  return CONTENT.items[id]?.name || id;
}

function glyph(model, cls = "mico") {
  return `<span class="${cls}">${iconMarkup(model || {}, 48)}</span>`;
}

export function renderShell(ctx) {
  const { state, root } = ctx;
  const left = SKILLS.map((s) => {
    const lv = skillLevel(state, s.id);
    const on = selectedSkill === s.id ? "on" : "";
    const lock = skillLocked(state, s.id);
    const pct = lock ? 0 : Math.floor(xpPct(state, s.id));
    const ico = { kind: SKILL_ICON_KIND[s.id] || "material", hue: 40 + SKILLS.indexOf(s) * 17, seed: SKILLS.indexOf(s) + 3, eid: s.id };
    return `<button type="button" class="skill ${on} ${lock ? "locked" : ""} ${(state.renewals?.[s.id] || 0) ? "renewed" : ""}" data-act="skill" data-arg="${s.id}" ${lock ? `title="${escapeHtml(lockMessage(lock))}"` : ""}>${glyph(ico, "skico")}<span class="sn">${s.name}</span><span class="lv">${lock ? glyphLock(12) : `${lv} · ${pct}%`}</span>${lock ? "" : `<i class="xpmini"><b style="width:${pct}%"></b></i>`}</button>`;
  }).join("");
  root.querySelector("#skill-nav").innerHTML = left;
  renderTop(ctx);
  renderCodex(ctx);
  renderCenter(ctx);
  renderRight(ctx);
  renderLevelModal(ctx);
  renderDeathModal(ctx);
  renderDesks(ctx);
  renderEdict(ctx);
  renderDawn(ctx);
  renderWake(ctx);
}

/* One-time welcome for a brand-new wanderer. A single dismissible sheet —
   orientation, not a gated tutorial. Every line points at something real. */
function renderWake(ctx) {
  const el = document.getElementById("wake-modal");
  if (!el) return;
  if (!needsWelcome(ctx.state)) {
    if (!el.hidden) { el.hidden = true; el.innerHTML = ""; }
    return;
  }
  if (ctx.state._deathSheet || ctx.state._edict || ctx.state._dawn) return;
  el.hidden = false;
  el.innerHTML = `<div class="sheet wake-sheet">
    <h3>The Last Workshop</h3>
    <p>You keep the last forge at the edge of the dusk. One job runs at a time — <strong>Halt</strong> to switch.</p>
    <p>The <strong>Goal</strong> line always knows your next click. Follow it and the first watch handles itself: chop, burn, fish, cook, then blood in Cinder Docks.</p>
    <p>Food keeps you breathing in a fight. Veilmarks buy tools. The ledger remembers everything else.</p>
    <button type="button" class="primary" data-act="wake-ack">Begin the first watch</button>
  </div>`;
  trapModal(el);
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
  const logEl = document.getElementById("log-badge");
  if (logEl) {
    const pct = ledgerStats(state).log.totalPct;
    logEl.textContent = `LOG ${pct}%`;
  }
  const eclEl = document.getElementById("eclipse-banner");
  if (eclEl) {
    const e = weeklyEclipse();
    eclEl.textContent = `Eclipse: ${e.name}`;
    eclEl.title = e.desc;
    eclEl.hidden = false;
  }
  const modeEl = document.getElementById("mode-chip");
  if (modeEl) {
    const mode = state.rules?.mode || "standard";
    modeEl.hidden = mode === "standard";
    modeEl.textContent = mode === "hardcore" ? "Hardcore" : mode === "iron" ? "Wanderer's Path" : "";
  }
  const titleEl = document.getElementById("active-title");
  if (titleEl) titleEl.textContent = state.activeTitle || "";
  const fail = lastSaveFail();
  const failEl = document.getElementById("save-fail");
  if (failEl) {
    failEl.hidden = !fail;
    failEl.textContent = fail ? `Save failed: ${fail}` : "";
  }
  document.getElementById("hp-label").textContent = `${Math.ceil(hp)} / ${max}`;
  document.getElementById("hp-fill").style.width = `${Math.max(0, 100 * hp / max)}%`;
  const coinsEl = document.getElementById("coins");
  if (coinsEl) coinsEl.textContent = Math.floor(state.coins || 0).toLocaleString();
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
    specEl.textContent = `Special ${sp}% ${on ? "ON" : "OFF"} · ${CONTENT.items[state.equipment.weapon]?.special || "none"}`;
  }

  const duel = document.getElementById("duel");
  const now = state.now || 0;
  const act = state.action;
  const bar = document.getElementById("action-fill");
  const lab = document.getElementById("action-label");
  const m = state.combat.fighting && CONTENT.monsters[state.combat.monsterId];

  if (m) {
    duel?.classList.remove("idle");
    if (state._killFlash && Date.now() - state._killFlash < 900) duel?.classList.add("kill");
    else duel?.classList.remove("kill");
    const foeTag = document.getElementById("foe-tag");
    if (foeTag) {
      foeTag.textContent = m.name;
      foeTag.dataset.style = m.style || "";
    }
    document.getElementById("foe-hp-label").textContent = `${Math.max(0, Math.ceil(state.combat.monsterHp))}/${state.combat.monsterMaxHp || m.hp}`;
    document.getElementById("foe-fill").style.width = `${Math.max(0, 100 * state.combat.monsterHp / (state.combat.monsterMaxHp || m.hp))}%`;
    document.getElementById("you-swing").style.width = `${duelSwing(now, state.combat.nextHitAt, playerInterval(state))}%`;
    document.getElementById("foe-swing").style.width = `${duelSwing(now, state.combat.enemyNextAt, m.interval)}%`;
    lab.textContent = `Fighting ${m.name} [${CONTENT.items[state.equipment.weapon]?.style || "might"}]`;
    bar.style.width = `${duelSwing(now, state.combat.nextHitAt, playerInterval(state))}%`;
    bar.classList.add("combat");
  } else {
    duel?.classList.add("idle");
    duel?.classList.toggle("kill", !!(state._killFlash && Date.now() - state._killFlash < 900));
    document.getElementById("foe-tag").textContent = "No foe";
    document.getElementById("foe-hp-label").textContent = "—";
    document.getElementById("foe-fill").style.width = "0%";
    document.getElementById("you-swing").style.width = "0%";
    document.getElementById("foe-swing").style.width = "0%";
    if (act) {
      const a = CONTENT.actions[act.id];
      const pct = Math.min(100, 100 * act.progress / (act.duration || 1));
      const sp = skillLevel(state, act.skill);
      const into = Math.floor(xpPct(state, act.skill));
      const beatTick = firstHourBeat(state);
      const tally = beatTick?.actionId === act.id ? beatWhy(state, beatTick) : "";
      lab.textContent = `${skillName(act.skill)} ${sp} · ${into}% to next · ${a?.name || act.id}${tally ? ` · ledger ${tally}` : ""}`;
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
      const last = state.lastDrip;
      const lastBits = last?.items?.length
        ? last.items.map((x) => `+${x.n} ${x.item === "coins" ? "veilmarks" : (CONTENT.items[x.item]?.name || x.item)}`).join(" · ")
        : "";
      const xpBits = last?.xp ? `+${last.xp} ${skillName(last.skill)} xp` : "";
      const dripNote = lastBits || xpBits ? ` · Last ${[lastBits, xpBits].filter(Boolean).join(" · ")}` : "";
      const capNote = state._yieldWarn ? ` · ${state._yieldWarn}` : ` · ${outN} ${outNm}${dripNote}`;
      const off = state.lastOffline;
      const report = off
        ? ` <button type="button" data-act="offline-ack">Offline: ${off.minutes}m · ${off.job} · ${off.actions} actions — dismiss</button>`
        : "";
      commit.innerHTML = `<b>Committed:</b> ${escapeHtml(a?.name || act.id)} (${skillName(act.skill)})${act.remaining != null ? ` · ${act.remaining} left in batch` : ""}${capNote}. Switching jobs asks Halt.${report}`;
      commit.className = state._yieldWarn ? "danger" : "";
    } else {
      const off = state.lastOffline;
      const report = off
        ? ` <button type="button" data-act="offline-ack">Offline: ${off.minutes}m · ${off.job} · ${off.actions} actions${off.huntPaused ? " · hunt paused" : ""} · ${off.plotsReady} plots ready · ${off.pensReady} pens ready — dismiss</button>`
        : "";
      const gq = firstHourBeat(state)?.q || CONTENT.quests.find((x) => x.id === state.quests.active[0]);
      const hint = gq ? `${gq.how || gq.desc}` : "Select Timber, pick the first grove, then press Idle this job.";
      commit.innerHTML = `<b>Do this:</b> ${escapeHtml(hint)}${report}`;
      commit.className = off ? "warn" : "idle";
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
  spawnYieldDrip(state);
  renderSeal(ctx);
  const ly = document.getElementById("last-yield");
  if (ly) {
    const d = state.lastDrip;
    if (!d) ly.textContent = "Last yield: —";
    else {
      const items = (d.items || []).map((x) => `+${x.n} ${x.item === "coins" ? "veilmarks" : (CONTENT.items[x.item]?.name || x.item)}`).join(" · ");
      ly.textContent = `Last yield: ${items || "—"}${d.xp ? ` · +${d.xp} ${skillName(d.skill)} xp` : ""}`;
    }
  }
  renderLevelModal(ctx);
}

function pingYield(rare) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "triangle";
    o.frequency.value = rare ? 784 : 523.25;
    g.gain.setValueAtTime(0.05, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.14);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.14);
  } catch { /* autoplay policy */ }
}

function spawnYieldDrip(state) {
  const d = state.lastDrip;
  if (!d || d.seq === lastDrip) return;
  lastDrip = d.seq;
  const host = document.getElementById("yield-hits");
  const arena = document.getElementById("arena-hits");
  const wrap = document.getElementById("action-wrap");
  const itemLine = (d.items || []).map((x) => {
    const nm = x.item === "coins" ? "veilmarks" : (CONTENT.items[x.item]?.name || x.item);
    return `+${x.n} ${nm}`;
  }).join(" · ");
  const xpLine = d.xp ? `+${d.xp} ${skillName(d.skill)} xp` : "";
  if (host) {
    host.replaceChildren();
    if (xpLine) {
      const xp = document.createElement("span");
      xp.className = "drip xp";
      xp.textContent = xpLine;
      host.appendChild(xp);
      setTimeout(() => xp.remove(), 1200);
    }
    if (itemLine) {
      const it = document.createElement("span");
      it.className = `drip item${d.tag && d.tag !== "burn" ? " " + d.tag : ""}${d.tag === "burn" ? " burn" : ""}`;
      it.textContent = d.tag === "burn" ? `Burned · ${itemLine}` : itemLine;
      host.appendChild(it);
      setTimeout(() => it.remove(), 1200);
    }
  }
  if (arena && itemLine) {
    const el = document.createElement("span");
    el.className = "floater you";
    el.textContent = itemLine.split(" · ")[0];
    arena.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  if (wrap) {
    wrap.classList.add("pop");
    setTimeout(() => wrap.classList.remove("pop"), 280);
  }
  const skBtn = document.querySelector(`#skill-nav [data-arg="${d.skill}"]`);
  if (skBtn) {
    skBtn.classList.add("ding");
    setTimeout(() => skBtn.classList.remove("ding"), 400);
  }
  if (state.settings?.toasts !== false && !state.settings?.reducedMotion) pingYield(d.tag === "rare");
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
    <p class="blurb">${state.combat.dungeon ? "Leaving a dungeon abandons the run. The key is already spent." : "Soil and Drove still tick. Everything else waits. One job at a time."}</p>
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

function confirmHalt(ctx) {
  const { state } = ctx;
  const cur = state.combat.fighting
    ? `fighting ${CONTENT.monsters[state.combat.monsterId]?.name || "a foe"}`
    : (CONTENT.actions[state.action?.id]?.name || "a craft");
  forkFn = () => { stopAction(state); stopFight(state); ctx.render(); };
  const el = document.getElementById("fork-modal");
  if (!el) { forkFn(); forkFn = null; return; }
  el.hidden = false;
  el.classList.add("open");
  el.innerHTML = `<div class="sheet"><h3>Halt?</h3>
    <p>Stop <strong>${escapeHtml(cur)}</strong>?</p>
    <p class="blurb">${state.combat.dungeon ? "Abandoning a dungeon resets every floor. The Citadel Key is gone." : "Soil and Drove still tick. One craft or one war."}</p>
    <button type="button" data-act="fork-yes">${state.combat.dungeon ? "Abandon the dungeon" : "Halt"}</button>
    <button type="button" data-act="fork-no">Keep going</button></div>`;
  trapModal(el);
}

function showRite(ctx, skill) {
  const { state } = ctx;
  const el = document.getElementById("fork-modal");
  if (!el) return;
  forkFn = () => {
    const err = renewSkill(state, skill);
    if (err) toast(ctx, err);
    ctx.render();
  };
  const n = (state.renewals?.[skill] || 0) + 1;
  el.hidden = false;
  el.classList.add("open");
  el.innerHTML = `<div class="sheet"><h3>Vow Renewal</h3>
    <p>Reset ${escapeHtml(skillName(skill))} to 1. Mastery, checkpoints, and guild stay. This is rite ${n}.</p>
    <p class="blurb">XP from this craft gains a dusk multiplier. Halt is still Halt.</p>
    <button type="button" class="primary" data-act="fork-yes">Renew the vow</button>
    <button type="button" data-act="fork-no">Keep this climb</button></div>`;
  trapModal(el);
}

function showNewGame(ctx) {
  const el = document.getElementById("fork-modal");
  if (!el) return;
  forkFn = null;
  el.hidden = false;
  el.classList.add("open");
  el.innerHTML = `<div class="sheet"><h3>A new wanderer</h3>
    <p class="blurb">This wipes the local forge. Export first if you care.</p>
    <button type="button" class="primary" data-act="new-game" data-arg="standard">Standard dusk</button>
    <button type="button" data-act="new-game" data-arg="hardcore">Hardcore — combat arts reset on death</button>
    <button type="button" data-act="new-game" data-arg="iron">Wanderer's Path — no quay buys, 40% fence</button>
    <button type="button" data-act="fork-no">Keep this save</button></div>`;
  trapModal(el);
}

function showSettings(ctx) {
  const { state } = ctx;
  const el = document.getElementById("fork-modal");
  if (!el) return;
  forkFn = null;
  el.hidden = false;
  el.classList.add("open");
  el.innerHTML = `<div class="sheet"><h3>Workshop settings</h3>
    <label>Name <input data-act="char-name" maxlength="24" value="${escapeHtml(state.name || "Aelric")}" /></label>
    <label><input type="checkbox" data-act="set-toasts" ${state.settings?.toasts !== false ? "checked" : ""} /> Yield toasts</label>
    <label><input type="checkbox" data-act="set-motion" ${state.settings?.reducedMotion ? "checked" : ""} /> Reduce motion</label>
    <label><input type="checkbox" data-act="set-clog" ${state.settings?.showCombatLog !== false ? "checked" : ""} /> Combat log</label>
    <label><input type="checkbox" data-act="set-hiscores" ${state.settings?.hiscores ? "checked" : ""} /> Opt into hiscores (client contract only)</label>
    <p class="blurb">Mode: ${escapeHtml(state.rules?.mode || "standard")}. One job at a time. Halt to switch.</p>
    ${state.titles?.length ? `<p>Wear a name ${state.titles.map((t) => `<button type="button" data-act="wear-title" data-arg="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("")}<button type="button" data-act="wear-title" data-arg="">none</button></p>` : ""}
    <div class="acts">
      <button type="button" data-act="export">Export save</button>
      <button type="button" data-act="import">Import save</button>
    </div>
    <button type="button" data-act="fork-no">Close</button></div>`;
  trapModal(el);
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
      const no = el.querySelector("[data-act='fork-no'], [data-act='dismiss-level'], [data-act='wake-ack']");
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
    clearTimeout(levelFade);
    releaseModal();
    modal.hidden = true;
    return;
  }
  const key = folded.map((e) => `${e.skill}-${e.from}-${e.to}`).join("|");
  if (shownLevelKey === key && !modal.hidden) return;
  shownLevelKey = key;
  clearTimeout(levelFade);
  // Plain single level-ups fade on their own — the first hour levels fast and
  // a blocking sheet per ding turns idle into a clicking chore. Sheets with
  // unlocks (or several at once) stay until read.
  if (folded.length === 1 && !(ev.unlocks?.length)) {
    levelFade = setTimeout(() => {
      if (shownLevelKey !== key) return;
      const cur = document.getElementById("level-modal");
      if (!cur || cur.hidden) return;
      ctx.state.levelUps = (ctx.state.levelUps || []).slice(1);
      shownLevelKey = "";
      renderLevelModal(ctx);
    }, 5200);
  }
  modal.hidden = false;
  const more = folded.length - 1;
  const lines = folded.slice(0, 8).map((e) =>
    `<p><strong>${skillName(e.skill)}</strong> ${e.from} → ${e.to}${e.unlocks?.length ? ` · ${e.unlocks.slice(0, 4).join(", ")}` : ""}</p>`
  ).join("");
  modal.innerHTML = `<div class="sheet toast-sheet">
    <h3>${skillName(ev.skill)} ${ev.to}</h3>
    <p>That stretch cost real dusk.</p>
    ${lines}
    ${more > 0 ? `<p class="muted">${more} more arts waiting.</p>` : ""}
    <button type="button" data-act="dismiss-level">Continue</button>
    ${folded.length > 1 ? `<button type="button" data-act="dismiss-levels">Dismiss all ${folded.length}</button>` : ""}
  </div>`;
}

function renderDeathModal(ctx) {
  const modal = document.getElementById("death-modal");
  if (!modal) return;
  const sheet = ctx.state._deathSheet;
  if (!sheet) {
    modal.hidden = true;
    modal.innerHTML = "";
    return;
  }
  modal.hidden = false;
  const where = sheet.dungeon
    ? `${escapeHtml(sheet.dungeon)} floor ${sheet.floor}/${sheet.of}`
    : "the field";
  modal.innerHTML = `<div class="sheet toast-sheet death-sheet">
    <h3>You fell</h3>
    <p>${escapeHtml(sheet.foe)} on ${where}.</p>
    <p><strong>${escapeHtml(sheet.blow || "hit")}</strong>${sheet.dmg != null ? ` · ${sheet.dmg} damage` : ""}${sheet.triangle && sheet.triangle !== "even" ? ` · triangle ${escapeHtml(sheet.triangle)}` : ""} · food ${sheet.food ?? 0}</p>
    <p class="blurb">${escapeHtml(sheet.tip || "")}</p>
    ${sheet.echo != null ? `<p class="muted">Echo depth ${sheet.echo}. The climb resets.</p>` : ""}
    <button type="button" data-act="death-ack">Rise</button>
  </div>`;
}

let levelFade = null;
let shownEdict = "";
function renderEdict(ctx) {
  const el = document.getElementById("edict-modal");
  if (!el) return;
  const e = ctx.state._edict;
  if (!e || ctx.state._deathSheet) {
    if (!e) {
      shownEdict = "";
      el.hidden = true;
      el.innerHTML = "";
    }
    return;
  }
  const key = `${e.act}:${e.t || ""}`;
  if (shownEdict === key && !el.hidden) return;
  shownEdict = key;
  el.hidden = false;
  el.innerHTML = `<div class="sheet edict-sheet">
    <h3>Act ${e.act}: ${escapeHtml(e.name || "")}</h3>
    <p>${escapeHtml(e.story || "The dusk endures.")}</p>
    <button type="button" data-act="edict-ack">The dusk endures</button>
  </div>`;
  trapModal(el);
}

let shownDawn = "";
function renderDawn(ctx) {
  const el = document.getElementById("dawn-modal");
  if (!el) return;
  if (!ctx.state._dawn || ctx.state._deathSheet || ctx.state._edict) {
    if (!ctx.state._dawn) {
      shownDawn = "";
      el.hidden = true;
      el.innerHTML = "";
    }
    return;
  }
  const off = ctx.state.lastOffline || {};
  const key = String(off.t || off.minutes || "dawn");
  if (shownDawn === key && !el.hidden) return;
  shownDawn = key;
  el.hidden = false;
  el.innerHTML = `<div class="sheet dawn-sheet">
    <h3>Dawn over the workshop</h3>
    <p>The citadel kept the fire. You were gone ${off.minutes || 0} minutes.</p>
    <p><strong>${escapeHtml(off.job || "no committed job")}</strong></p>
    <p class="muted">${off.actions || 0} actions · ${off.kills || 0} kills · food used ${off.foodUsed || 0}${off.huntPaused ? " · hunt paused" : ""}${off.truncated ? " · remainder bulk-settled" : ""}</p>
    <p class="muted">Plots ready ${off.plotsReady || 0} · pens ready ${off.pensReady || 0}</p>
    <button type="button" data-act="dawn-ack">Take the ledger</button>
  </div>`;
  trapModal(el);
}

function renderCodex(ctx) {
  const el = document.getElementById("codex");
  if (!el) return;
  const { state } = ctx;
  if (!codexOpen) {
    el.className = "closed";
    el.innerHTML = `<span class="codex-k">Goal</span><span class="muted">Hidden — idling continues.</span>
      <div class="codex-acts"><button type="button" data-act="codex-toggle">Show</button></div>`;
    return;
  }
  el.className = "";
  const beat = currentBeat(state) || firstHourBeat(state);
  const q = beat?.q;
  const upcoming = CONTENT.quests.filter((x) => !state.quests.done.includes(x.id) && x.id !== q?.id).slice(0, 2);
  let next = "No current goal — pick Timber and press Idle this job.";
  let jump = "";
  if (q) {
    const steps = questProgress(state, q).map((p) => reqView(state, p.r));
    const open = steps.find((s) => !s.ok) || steps[0];
    const frac = open ? `${Math.min(open.have, open.need)}/${open.need}` : "";
    next = `<strong>Do this: ${q.name}</strong> ${frac} — ${q.how || open?.label || q.desc}`;
    const hintSkill = beat?.skill || inferQuestSkill(q);
    if (hintSkill) jump = `<button type="button" data-act="skill" data-arg="${hintSkill}">Go to ${skillName(hintSkill)}</button>`;
  } else if (beat?.how) {
    next = `<strong>${escapeHtml(beat.actName || "Next")}</strong> — ${escapeHtml(beat.how)}`;
    if (beat.skill) jump = `<button type="button" data-act="skill" data-arg="${beat.skill}">Go to ${skillName(beat.skill)}</button>`;
  }
  const then = upcoming.map((x) => x.name).join(" → ");
  let idle = pipelineFor(selectedSkill) || "Select Timber, pick the first grove, then press Idle this job.";
  if (state.combat.fighting) idle = "In combat. Halt to leave. Watch food.";
  else if (state.action) {
    const act = CONTENT.actions[state.action.id];
    const sink = (act?.outputs || []).flatMap((o) => sinksOf(o.item))[0];
    idle = `Idling: ${act?.name || state.action.id}${sink ? ` → ${sink}` : ""}.`;
  }
  const nudge = toolNudge(state);
  const nudgeBtn = nudge
    ? `<button type="button" class="nudge" data-act="equip" data-arg="${nudge.id}" title="Waiting in your vault">Equip ${escapeHtml(nudge.name)} · +${Math.round((nudge.bonus || 0) * 100)}% speed</button>`
    : "";
  el.innerHTML = `<span class="codex-k">Goal</span>
    <span>${next}</span>
    <span class="muted">${then ? `Then: ${then}` : idle}</span>
    <div class="codex-acts">
      ${nudgeBtn}
      ${jump}
      <button type="button" data-act="desk" data-arg="bank">Open vault</button>
      <button type="button" data-act="desk" data-arg="loadout">Wanderer</button>
      <button type="button" data-act="desk" data-arg="stall">Shop</button>
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
  else if (sk.id === "whisper") body = renderWhisper(ctx);
  else if (sk.id === "soil") body = renderSoil(ctx);
  else if (sk.id === "drove") body = renderDrove(ctx);
  else if (sk.id === "chart") body = renderChart(ctx);
  else if (COMBAT_SKILLS.includes(sk.id)) body = renderCombatSkill(ctx, sk.id);
  const lockBanner = lock
    ? `<p class="blurb warn">${escapeHtml(lockMessage(lock))} (you are ${skillName(sk.id)} ${lv}). Train the listed skill — this board is a preview.</p>`
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

function renderWhisper(ctx) {
  const { state } = ctx;
  const running = state.action && CONTENT.actions[state.action.id]?.npc;
  const mark = running || CONTENT.npcs[0];
  const heat = mark ? markHeat(state, mark.id) : 0;
  const streak = state.whisper?.streak || 0;
  return `<div class="heat">
      <span>Heat ${heat}/14 on ${escapeHtml(mark?.name || "this mark")} — stun is per pocket, not the whole quay</span>
      <div class="xpbar"><i style="width:${Math.min(100, heat / 14 * 100)}%"></i></div>
      <span class="muted">Clean streak ${streak}. Switching marks leaves the last one's heat behind.</span>
    </div>${renderActions(ctx, "whisper")}`;
}

function pipelineFor(skill) {
  const map = {
    timber: "Chop here. Then Ember (burn) and Fletch (bows) spend the same logs.",
    trawl: "Sink: raw fish → Hearth. Uncooked catch will not keep you alive in Cinder Docks.",
    vein: "Sink: ore → Anvil bars → sabers you actually swing. Mining without smithing is a full vault.",
    ember: "Sink: ash → Sigil runes → Weave. Burning with no rune plan is a vanity fire.",
    hearth: "Sink: food → auto-eat. Combat without a larder is a dare.",
    anvil: "Sink: bars → weapons/armour. Each special (riposte, shred, bleed, pierce, echo) is a different hunt.",
    fletch: "Sink: ammo → Mark. A bow with an empty quiver is furniture.",
    loom: "Sink: hide → Mark armour. Plate is a tax against weavers.",
    sigil: "Sink: runes → the spell you actually cast. Out of runes, Weave goes silent.",
    vial: "Sink: draughts → a fight you chose, with a charge count.",
    chart: "Study for stardust, then spend ranks. Slots still cap live stars.",
    soil: "Compost is the click. Plant with a bag, harvest fatter. Pouches open.",
    drove: "Feed pens. Collect without fodder is a thin faucet.",
    course: "Pay to build a pillar. Unpaid selects do nothing.",
    whisper: "Stun is the tax. Heat is per mark — switching pockets actually helps.",
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

function fmtIoShort(state, a) {
  const ins = (a.inputs || []).map((i) => `${i.qty} ${itemName(i.item)}`).join(" + ") || "no inputs";
  const outs = (a.outputs || []).map((i) => {
    const min = i.min ?? i.qty ?? 1;
    const max = i.max ?? min;
    return min === max ? `${itemName(i.item)} ×${min}` : `${itemName(i.item)} ×${min}–${max}`;
  }).join(" + ") || "xp";
  return `${ins} → ${outs}`;
}

const JOB_TAB_LABEL = {
  smelt: "Smelting",
  smith: "Smithing",
  train: "Jobs",
  shafts: "Shafts",
  bows: "Bows"
};

function resolveCraftCount(state, act) {
  if (!act) return null;
  if (craftQty === "inf") return null;
  if (craftQty === "all") {
    const n = maxAffordable(state, act);
    return Number.isFinite(n) ? n : null;
  }
  const n = Math.max(1, parseInt(craftQty, 10) || 1);
  const cap = maxAffordable(state, act);
  if (Number.isFinite(cap)) return Math.max(1, Math.min(n, cap || n));
  return n;
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
  const keys = Object.keys(groups).sort((a, b) => {
    const order = { smelt: 0, smith: 1, shafts: 0, bows: 1, train: 9 };
    return (order[a] ?? 5) - (order[b] ?? 5) || a.localeCompare(b);
  });
  const tab = jobTabs[skill] && groups[jobTabs[skill]] ? jobTabs[skill] : keys[0];
  jobTabs[skill] = tab;
  const shown = groups[tab] || list;
  const tabs = keys.length > 1
    ? `<div class="tabs job-tabs">${keys.map((k) => `<button type="button" class="${k === tab ? "on" : ""}" data-act="job-tab" data-arg="${k}">${JOB_TAB_LABEL[k] || k}</button>`).join("")}</div>`
    : (JOB_TAB_LABEL[tab] && tab !== "train" ? `<h3 class="grp">${JOB_TAB_LABEL[tab]}</h3>` : "");
  const running = state.action && CONTENT.actions[state.action.id];
  const beat = firstHourBeat(state);
  const picked = selectedAction && CONTENT.actions[selectedAction]?.skill === skill
    ? CONTENT.actions[selectedAction]
    : (running?.skill === skill && (running.category || "train") === tab ? running : null);
  const cards = shown.map((a) => {
    const lvok = skillLevel(state, skill) >= a.level;
    const on = state.action?.id === a.id;
    const sel = picked?.id === a.id;
    const goal = beat?.actionId === a.id;
    const why = !lvok ? lockReason(state, a) : "";
    return `<button type="button" class="card compact ${on ? "on" : ""} ${sel ? "sel" : ""} ${goal ? "goal" : ""} ${lvok ? "" : "locked"}" data-act="job-pick" data-arg="${a.id}" ${lvok ? "" : "disabled"}>
      ${lvok ? "" : `<span class="lock-corner">${glyphLock(10)}</span>`}
      ${glyph(a.model)}
      <strong>${a.name}</strong>
      <span>Lv ${a.level} · ${(actionDuration(state, a) / 1000).toFixed(1)}s${on && state.action?.remaining != null ? ` · ${state.action.remaining} left` : ""}</span>
      <span class="io-short">${fmtIoShort(state, a)}</span>
      ${why ? `<em class="lock-why">${why}</em>` : ""}
    </button>`;
  }).join("");
  return `${tabs}
    ${renderJobDock(ctx, picked)}
    <div class="grid compact-grid">${cards}</div>`;
}

function renderJobDock(ctx, a) {
  const { state } = ctx;
  if (!a) {
    return `<div class="job-dock idle"><p class="muted">Pick a job. Cards stay quiet — details and batch size live here.</p></div>`;
  }
  const lvok = skillLevel(state, a.skill) >= a.level;
  const ml = masteryLevel(state.skills[a.skill].mastery[a.masteryId] || 0);
  const why = lockReason(state, a);
  const on = state.action?.id === a.id;
  const outs = fmtIo(state, a.outputs, "out");
  const ins = fmtIo(state, a.inputs, "in");
  const cp = state.skills[a.skill].checkpoints?.[a.masteryId] || 0;
  const cost = checkpointCost(state, a.id);
  const pool = state.skills[a.skill].pool || 0;
  const n = state.actionCounts?.[a.id] || 0;
  const sinks = [...new Set((a.outputs || []).flatMap((o) => sinksOf(o.item)))].slice(0, 3).join(" · ");
  const mb = masteryBonus(state, a.masteryId, a.skill);
  const mileKeys = Object.keys(MASTERY_MILESTONES).map(Number).sort((x, y) => x - y);
  const nextMile = mileKeys.find((k) => ml < k);
  const mileLine = mb.label
    ? `${mb.label}${nextMile ? ` · next ${MASTERY_MILESTONES[nextMile].label} at ${nextMile}` : ""}`
    : (nextMile ? `Next ${MASTERY_MILESTONES[nextMile].label} at mastery ${nextMile}` : "");
  const mode = state.actionMode?.[a.skill] || "steady";
  const modeRow = ["focused", "steady", "meditative"].map((id) => {
    const lab = id === "focused" ? "Focused (−time, −yield)" : id === "meditative" ? "Meditative (+time, +yield, −rare)" : "Steady";
    return `<button type="button" class="${mode === id ? "on" : ""}" data-act="action-mode" data-arg="${id}">${lab}</button>`;
  }).join("");
  const orders = standingCopy(state);
  const o = ensureOrders(state);
  const orderRow = orders.map((t) => {
    if (t.id === "eat") return `<button type="button" class="${o.eat !== false ? "on" : ""}" data-act="order-eat" ${t.open ? "" : "disabled"}>Auto-eat ${t.open ? "" : "(locked)"}</button>`;
    if (t.id === "bank") return `<button type="button" class="${o.bank ? "on" : ""}" data-act="order-bank" ${t.open ? "" : "disabled"}>Sell commons on dump ${t.open ? "" : "(1 renewal)"}</button>`;
    if (t.id === "sell") return `<button type="button" class="${o.sell ? "on" : ""}" data-act="order-sell" ${t.open ? "" : "disabled"}>Sell floor ${t.open ? "" : "(2 renewals)"}</button>`;
    return "";
  }).join("");
  const floors = ["common", "uncommon", "rare"].map((id) => `<button type="button" class="${o.sellFloor === id ? "on" : ""}" data-act="order-floor" data-arg="${id}">${id}</button>`).join("");
  const canRenew = skillLevel(state, a.skill) >= MAX_LEVEL;
  const rares = (a.rare || []).map((r) => `${Math.round(r.chance * 1000) / 10}% ${itemName(r.item)}`).join(", ");
  const burn = a.burn ? `Burn ${Math.round(a.burn.chance * 100)}% → ashes` : "";
  const can = maxAffordable(state, a);
  const planned = resolveCraftCount(state, a);
  const qtyBtns = ["1", "5", "10", "25", "all", "inf"].map((q) => {
    const lab = q === "inf" ? "Until halt" : q === "all" ? "All" : q;
    return `<button type="button" class="${craftQty === q ? "on" : ""}" data-act="job-qty" data-arg="${q}">${lab}</button>`;
  }).join("");
  const planNote = planned == null
    ? (Number.isFinite(can) ? `Idle until the vault runs dry (${can} in stock).` : "Idle until you Halt.")
    : `Batch ${planned}${Number.isFinite(can) ? ` · vault can pay ${can}` : ""}.`;
  const blocked = !lvok || (a.inputs && maxAffordable(state, a) <= 0);
  return `<div class="job-dock">
    <div class="job-dock-head">
      ${glyph(a.model, "mico lg")}
      <div>
        <h3>${a.name}</h3>
        <p class="muted">${a.catalogName || ""} · Lv ${a.level} · ${(actionDuration(state, a) / 1000).toFixed(1)}s · ${a.xp} xp</p>
      </div>
    </div>
    <p class="blurb">${a.desc || a.voice || ""}</p>
    <div class="io">
      ${ins ? `<span class="in">In ${ins}</span>` : `<span class="in">No inputs — this is an idle node.</span>`}
      ${outs ? `<span class="out">Out ${outs}</span>` : ""}
    </div>
    <span>Mastery ${ml} · +${(mb.speed * 100).toFixed(1)}% speed · +${(mb.preserve * 100).toFixed(1)}% preserve · checkpoint ${cp} · ×${n} done${mileLine ? ` · ${mileLine}` : ""}</span>
    <div class="mode-row">${modeRow}</div>
    ${canRenew ? `<button type="button" class="primary" data-act="rite" data-arg="${a.skill}">Vow Renewal — reset levels, keep mastery</button>` : ""}
    <div class="orders-row">${orderRow}</div>
    ${o.sell || o.bank ? `<div class="orders-row"><span class="muted">Sell at or below</span>${floors}</div>` : ""}
    ${rares ? `<span class="sink">Rare ${rares}</span>` : ""}
    ${burn ? `<span class="in">${burn}</span>` : ""}
    ${sinks ? `<span class="sink">Then ${sinks}</span>` : ""}
    ${why ? `<em class="lock-why">${why}</em>` : ""}
    <div class="qty-row"><span>Make</span>${qtyBtns}</div>
    <p class="muted">${planNote}</p>
    <div class="job-acts">
      <button type="button" class="primary" data-act="start" data-arg="${a.id}" ${blocked ? "disabled" : ""}>${on ? "Already idling this" : (planned == null ? "Idle this job" : `Craft ${planned}`)}</button>
      <button type="button" class="tiny" data-act="checkpoint" data-arg="${a.id}">Checkpoint ${cost} pool (have ${pool})</button>
    </div>
  </div>`;
}

function renderCourse(ctx) {
  const { state } = ctx;
  const picks = CONTENT.coursePillars.map((cat) => {
    const cur = state.course.chosen[cat.id] || "";
    const built = state.course.built?.[cat.id];
    const opt = cat.options.find((o) => o.id === cur);
    return `<label class="pillar">${cat.name}
      <select data-act="pillar" data-cat="${cat.id}">
        <option value="">— empty —</option>
        ${cat.options.map((o) => `<option value="${o.id}" ${cur === o.id ? "selected" : ""}>${o.name} · ${o.cost}m ${built === o.id ? "· BUILT" : ""}</option>`).join("")}
      </select>
      <div class="hint">${cat.options.map((o) => `${o.name}: ${o.cost} veilmarks to build. ${Object.entries(o).filter(([k]) => !["id","name","cost"].includes(k)).map(([k,v]) => k + " " + v).join(", ")}`).join("<br>")}</div>
      ${opt ? `<button type="button" data-act="build-pillar" data-cat="${cat.id}" data-arg="${cur}">${built === cur ? "Armed" : `Build ${opt.name} (${opt.cost}m)`}</button>` : ""}
    </label>`;
  }).join("");
  return `<p class="blurb">Selecting is not building. Pay veilmarks to raise a pillar, then run. Unpaid picks do nothing.</p>
    <div class="pillars">${picks}</div>
    <button type="button" class="primary" data-act="start" data-arg="course-lap">Run the circuit</button>`;
}

function renderSoil(ctx) {
  const { state } = ctx;
  const seeds = Object.keys(state.bank).filter((id) => CONTENT.items[id]?.category === "seed");
  const pouches = bankCount(state, "seed-pouch");
  const plots = state.soil.plots.map((p, i) => {
    if (!p) {
      return `<div class="plot empty"><h4>Plot ${i + 1}</h4>
        ${seeds.map((s) => `<button type="button" data-act="plant" data-arg="${i}" data-seed="${s}">Plant ${CONTENT.items[s].name} (${state.bank[s]})${bankCount(state, "compost") ? " +compost" : ""}</button>`).join("") || "<em>No seeds. Chop groves or open pouches.</em>"}
      </div>`;
    }
    return `<div class="plot ${p.ready ? "ready" : ""}">
      <h4>${CONTENT.items[p.seed].name}${p.compost ? " · composted" : ""}</h4>
      <p>${p.ready ? "Ready" : `${Math.ceil(p.left / 1000)}s`}</p>
      ${p.ready ? `<button type="button" data-act="harvest" data-arg="${i}">Harvest</button>` : ""}
    </div>`;
  }).join("");
  return `<p class="blurb">Compost is optional. Tick the box to spend a bag when you plant — faster grow, fatter harvest. Pouches from groves open into seeds.</p>
    ${pouches ? `<button type="button" class="primary" data-act="pouch">Open seed pouch (${pouches})</button>` : ""}
    <p class="muted"><label><input type="checkbox" data-act="compost" ${state.soil.useCompost ? "checked" : ""} /> Use compost on plant</label> · bags ${bankCount(state, "compost")}</p>
    <div class="plots">${plots}</div>`;
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
      <h4>${a.name}${p.fed ? " · fed" : ""}</h4>
      <p>${p.ready ? `Ready: ${CONTENT.items[a.produce].name}` : `${Math.ceil(p.left / 1000)}s`}</p>
      ${p.ready ? `<button type="button" data-act="collect" data-arg="${i}">Collect</button>` : ""}
      ${!p.fed ? `<button type="button" data-act="feed" data-arg="${i}">Feed (${bankCount(state, "fodder")} fodder)</button>` : "<em>Fed this cycle</em>"}
    </div>`;
  }).join("");
  return `<p class="blurb">Feed is the identity. Unfed collects are thin. Stall sells fodder.</p>
    <p class="muted">Fodder ${bankCount(state, "fodder")}</p>
    <div class="plots">${pens}</div>`;
}

function renderChart(ctx) {
  const { state } = ctx;
  const slots = [];
  for (let i = 0; i < state.chart.slots; i++) {
    const cur = state.chart.active[i] || "";
    slots.push(`<select data-act="chart-slot" data-i="${i}">
      <option value="">— empty —</option>
      ${CONTENT.constellations.map((c) => `<option value="${c.id}" ${cur === c.id ? "selected" : ""}>${c.name} — ${fmtBonus(c.bonus)}</option>`).join("")}
    </select>`);
  }
  return `<p class="blurb">Only ${state.chart.slots} constellations bind at once. Study grants stardust. Spend dust on ranked modifiers — that is Chart, not another timer. A slotted star with 0 study grants nothing.</p>
    <div class="pillars">${slots.join("")}</div>
    <p class="muted">Stardust ${bankCount(state, "stardust")}</p>
    <div class="grid">${(CONTENT.chartRanks || []).map((r) => {
      const n = state.chart.ranks?.[r.id] || 0;
      return `<button type="button" class="card" data-act="chart-rank" data-arg="${r.id}">
        <strong>${r.name}</strong><span>Rank ${n}/8 · ${r.cost} stardust</span><em>${r.desc}</em>
      </button>`;
    }).join("")}</div>
    <div class="grid">${CONTENT.constellations.map((c) => {
      const on = state.chart.active.includes(c.id);
      const n = state.chart.studied?.[c.id] || 0;
      return `<button type="button" class="card ${on ? "on" : ""}" data-act="start" data-arg="chart-study-${c.id}">
        <strong>Study ${c.name}</strong><span>Chart xp · ${c.studyTime / 1000}s · insight ${n}${on && n <= 0 ? " · slotted, unarmed" : ""}</span><em>${fmtBonus(c.bonus)}</em>
      </button>`;
    }).join("")}</div>`;
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
  const heal = Math.max(CONTENT.items[foodId]?.heal || 0, CONTENT.items[state.combat.foodId2]?.heal || 0);
  const foodEst = heal > 0 ? Math.max(1, Math.ceil((m.maxHit * 1.6) / heal)) : "∞";
  const set = gearSetInfo(state);
  const youSwing = duelSwing(now, state.combat.nextHitAt, playerInterval(state));
  const foeSwing = duelSwing(now, state.combat.enemyNextAt, m.interval);
  const dun = state.combat.dungeon ? CONTENT.dungeons.find((d) => d.id === state.combat.dungeon) : null;
  const medals = deedMedals(state, m.id).filter((d) => d.have).map((d) => d.id).join(" · ");
  const tell = state.combat.telegraph
    ? `<p class="hint">Telegraph: ${escapeHtml(String(state.combat.telegraph))}${m.mechanic?.counter ? ` · counter ${escapeHtml(m.mechanic.counter)}` : ""}</p>`
    : "";
  return `<div class="fight-board${state.combat.telegraph ? " telegraph" : ""}">
    <div>
      <h4>You</h4>
      <div class="bar hp"><i style="width:${Math.max(0, 100 * state.combat.hp / state.combat.maxHp)}%;display:block;height:100%;background:linear-gradient(90deg,#8e3a58,var(--rose))"></i></div>
      <p class="hint">${Math.ceil(state.combat.hp)} / ${state.combat.maxHp} · next strike ${youSwing.toFixed(0)}%</p>
      <p class="hint">Style ${st.style} · Acc ${st.acc.toFixed(0)} · Power ${st.power.toFixed(0)} · Def ${st.def.toFixed(0)} · max hit ~${Math.max(1, Math.floor(st.power / 4))}${st.tri?.edge && st.tri.edge !== "even" ? ` · triangle ${st.tri.edge}` : ""}${st.takenMul && st.takenMul < 1 ? ` · Aegis ${Math.round((1 - st.takenMul) * 100)}% less taken` : ""}</p>
      <p class="hint">Food ${foodN} ${foodId ? itemName(foodId) : "—"} / backup ${state.combat.foodId2 ? `${bankCount(state, state.combat.foodId2)} ${itemName(state.combat.foodId2)}` : "none"} ${foodN <= 3 ? "· running low" : ""} · ~${foodEst} rations/kill if auto-eat holds</p>
      <p class="hint">${escapeHtml(set.label)}</p>
      <p class="hint">Special ${Math.floor(state.combat.spec || 0)}% ${(state.combat.useSpec !== false) ? "ON" : "OFF"} — spends into your weapon job (riposte/shred/bleed/pierce/echo), not a generic 1.5×</p>
      <div class="tabs">
        <button type="button" data-act="swap-style" data-arg="might">Swap Might</button>
        <button type="button" data-act="swap-style" data-arg="mark">Swap Mark</button>
        <button type="button" data-act="swap-style" data-arg="weave">Swap Weave</button>
      </div>
    </div>
    <div>
      <h4>${m.name}</h4>
      ${glyph(m.model, "mico lg")}
      <div class="bar hp foe"><i style="display:block;height:100%;width:${Math.max(0, 100 * state.combat.monsterHp / (state.combat.monsterMaxHp || m.hp))}%;background:linear-gradient(90deg,#3a2a78,#8b7cff)"></i></div>
      <p class="hint">${Math.max(0, Math.ceil(state.combat.monsterHp))} / ${state.combat.monsterMaxHp || m.hp} · incoming ${foeSwing.toFixed(0)}%</p>
      <p class="hint">Hit ${m.maxHit} · ${m.style}${m.special ? " · " + m.special : ""}${m.mechanic?.type ? ` · ${m.mechanic.type}` : ""}</p>
      ${tell}
      ${medals ? `<p class="deed-row">${escapeHtml(medals)}</p>` : ""}
      <p class="hint">${dun ? (dun.infinite ? `${dun.name} depth ${state.combat.echoDepth || 0} (best ${state.combat.echoBest || 0})` : `${dun.name} floor ${(state.combat.dungeonIndex || 0) + 1}/${dun.sequence.length}`) : m.area}</p>
      <p class="hint sink">${dropLine(m)}</p>
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
    const chain = b.chain;
    const roman = ["I", "II", "III", "IV"][chain?.step || 0] || String((chain?.step || 0) + 1);
    return theater + `<div class="panel">
      <p>${m ? `Hunt <strong>${m.name}</strong> in ${m.area}: ${b.have}/${b.need} · streak ${b.streak}` : "No contract."}${chain ? ` · Chain ${roman}/${chain.ids.length}` : ""}</p>
      <button type="button" class="primary" data-act="bounty">${m ? "Reroll (1 token)" : "Take a contract (free)"}</button>
      <p>Tokens: ${bankCount(state, "bounty-token")}. Live rerolls cost a token, break the chain, and block the last targets.</p>
    </div>${renderAreas(ctx)}`;
  }
  return theater + renderAreas(ctx);
}

function fmtBonus(bonus) {
  if (!bonus) return "";
  return Object.entries(bonus).map(([k, v]) => {
    if (typeof v !== "number") return `${k} ${v}`;
    const pct = Math.abs(v) <= 2 ? `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%` : String(v);
    return `${k} ${pct}`;
  }).join(" · ");
}

function dropOdds(p) {
  const n = Number(p);
  if (!(n > 0)) return "never";
  if (n >= 0.995) return "always";
  const denom = Math.max(2, Math.round(1 / n));
  return `1/${denom}`;
}

function dropLine(m) {
  const bits = (m.drops || []).slice(0, 8).map((d) => `${dropOdds(d.chance)} ${itemName(d.item)}`);
  if (m.unique) bits.push(`unique ${dropOdds(m.unique.chance)} ${itemName(m.unique.item)}`);
  return bits.join(" · ");
}

function renderAreas(ctx) {
  const { state } = ctx;
  const areas = CONTENT.areas.map((a) => `
    <details class="area" data-area="${a.id}" ${openAreas.has(a.id) || a.name === state.combat.area ? "open" : ""}>
      <summary>${a.name} <em>Bounty ${a.slayer}</em></summary>
      <div class="grid">${a.monsters.map((id) => {
        const m = CONTENT.monsters[id];
        const on = state.combat.fighting && state.combat.monsterId === id;
        const locked = (m.slayerReq || 0) > skillLevel(state, "bounty");
        return `<button type="button" class="card ${on ? "on" : ""} ${locked ? "locked" : ""}" data-act="fight" data-arg="${id}" ${locked ? "disabled" : ""}>
          ${glyph(m.model)}
          <strong>${m.name}</strong>
          <span>HP ${m.hp} · hit ${m.maxHit} · ${m.style}${m.special ? " · " + m.special : ""}${locked ? ` · Bounty ${m.slayerReq}` : ""}</span>
          <em>${m.desc}</em>
          <em class="sink">${dropLine(m)}</em>
          ${locked ? `<em class="lock-why">Need Bounty ${m.slayerReq}</em>` : ""}
        </button>`;
      }).join("")}</div>
    </details>`).join("");
  const echo = CONTENT.dungeons.find((d) => d.infinite);
  const echoCard = echo ? `<button type="button" class="card echo-card ${state.combat.dungeon === echo.id ? "on" : ""}" data-act="dungeon" data-arg="${echo.id}">
      ${glyph(echo.model)}
      <strong>${echo.name}</strong>
      <span>Best depth ${state.combat.echoBest || 0} · req ${echo.req}</span>
      <em>Descend. Death resets the climb. Halt is still Halt.</em>
    </button>` : "";
  const duns = `<h3 class="grp">Dungeons</h3><div class="grid">${echoCard}${CONTENT.dungeons.filter((d) => !d.infinite).map((d) => {
    const n = (state.combat.dungeonClears || {})[d.id] || 0;
    const on = state.combat.dungeon === d.id;
    return `<button type="button" class="card ${on ? "on" : ""}" data-act="dungeon" data-arg="${d.id}">
      ${glyph(d.model)}
      <strong>${d.name}</strong><span>Req ${d.req} · ${d.sequence.length} floors · clears ${n}</span><em>${d.desc}</em>
    </button>`;
  }).join("")}</div>`;
  const st = playerStats(state);
  const foodOpts = Object.keys(state.bank).filter((id) => CONTENT.items[id]?.heal).concat(state.combat.foodId ? [state.combat.foodId] : []);
  const uniqueFood = [...new Set(foodOpts)];
  return `<div class="stats-strip">Style <b>${st.style}</b> · Acc ${st.acc.toFixed(0)} · Power ${st.power.toFixed(0)} · Def ${st.def.toFixed(0)} · Auto-eat ${(state.combat.autoEat * 100).toFixed(0)}%</div>
    <label>Food <select id="food-pick" data-act="food">${uniqueFood.map((id) => `<option value="${id}" ${state.combat.foodId === id ? "selected" : ""}>${CONTENT.items[id]?.name} +${CONTENT.items[id]?.heal} (${bankCount(state, id)})</option>`).join("")}</select></label>
    <label>Backup food <select data-act="food2"><option value="">— none —</option>${uniqueFood.map((id) => `<option value="${id}" ${state.combat.foodId2 === id ? "selected" : ""}>${CONTENT.items[id]?.name} +${CONTENT.items[id]?.heal}</option>`).join("")}</select></label>
    <div class="potions">${Object.keys(state.bank).filter((id) => CONTENT.items[id]?.potion).slice(0, 12).map((id) => `<button type="button" data-act="drink" data-arg="${id}">Drink ${CONTENT.items[id].name} (${state.bank[id]})</button>`).join("")}</div>
    ${state.combat.potionId ? `<p class="blurb">Active: ${CONTENT.items[state.combat.potionId].name} · ${state.combat.potionCharges} charges</p>` : ""}
    ${areas}${duns}
    ${state.settings?.showCombatLog === false ? "" : `<div class="clog">${(state._clog || []).map((l) => `<div>${escapeHtml(l)}</div>`).join("")}</div>`}
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
  const set = gearSetInfo(state);
  const slots = ["weapon", "shield", "helm", "body", "legs", "boots", "gloves", "cape", "amulet", "ammo", "ring"];
  document.getElementById("gear").innerHTML = slots.map((s) => {
    const id = state.equipment[s];
    const it = CONTENT.items[id];
    return `<div class="slot"><b>${s}</b> ${it ? `<span>${it.name}</span> <button type="button" data-act="unequip" data-arg="${s}">x</button>` : "<em>empty</em>"}</div>`;
  }).join("") + `<p class="set-line">${escapeHtml(set.label)}</p>
    <div class="slot"><b>tools</b> <span>axe ${CONTENT.items[state.tools.axe]?.name || "–"} ${state.tools.axe ? `<button type="button" data-act="unequip" data-arg="axe">x</button>` : ""} · pick ${CONTENT.items[state.tools.pick]?.name || "–"} ${state.tools.pick ? `<button type="button" data-act="unequip" data-arg="pick">x</button>` : ""} · rod ${CONTENT.items[state.tools.rod]?.name || "–"} ${state.tools.rod ? `<button type="button" data-act="unequip" data-arg="rod">x</button>` : ""}</span></div>
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
      return `<div class="brow" title="${it.desc || ""}">
        ${glyph(it.model, "bico")}
        <span class="nm">${it.name}</span>
        <span class="qty">${n.toLocaleString()}</span>
        <span class="val">${glyphMarks(11)} ${stackVal.toLocaleString()} · ${it.category}</span>
        <div class="acts">
          ${eq ? `<button type="button" data-act="equip" data-arg="${id}">equip</button>` : ""}
          ${it.potion ? `<button type="button" data-act="drink" data-arg="${id}">drink</button>` : ""}
          ${id === "seed-pouch" ? `<button type="button" data-act="pouch">open</button>` : ""}
          <button type="button" data-act="set-tab" data-arg="${id}">tab</button>
          <button type="button" data-act="sell" data-arg="${id}">sell 1</button>
          <button type="button" data-act="sell-all" data-arg="${id}">sell all</button>
        </div>
      </div>`;
    }).join("");
  const html = `<div class="tabs">${tabBtns}</div>
    <input id="bank-search" placeholder="Search bank" value="${escapeHtml(bankFilter)}" />
    <div class="bank-meta"><span>${held.length}/${bankCap(state)} stacks${held.length >= bankCap(state) ? " · FULL" : ""}</span><span>${glyphMarks(11)} ${bankValue(state).toLocaleString()} vault</span></div>
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
  const ls = ledgerStats(state);
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
    if (q.reward?.coins) reward.push(`${glyphMarks(11)} ${q.reward.coins}`);
    if (q.reward?.items) q.reward.items.forEach((it) => reward.push(`${it.qty} ${itemName(it.id)}`));
    return `<div class="q"><strong>${q.name}</strong><p>${q.how || q.desc}</p>${prog}${reward.length ? `<p class="muted">Reward: ${reward.join(" · ")}</p>` : ""}</div>`;
  }).join("");
  const coming = CONTENT.quests
    .filter((q) => !state.quests.done.includes(q.id) && !state.quests.active.includes(q.id))
    .slice(0, 4)
    .map((q) => `<p class="muted">Coming: ${q.name} — ${q.how || q.desc}</p>`)
    .join("");
  const ownedPets = CONTENT.pets.filter((p) => state.pets?.[p.id]).length;
  const petGrid = `<div class="pet-ledger">
    <h4>${ownedPets} / ${CONTENT.pets.length} companions</h4>
    <div class="pet-grid">${CONTENT.pets.map((p) => {
      const on = !!state.pets?.[p.id];
      const hint = on ? `${p.name} · +${Math.round((p.bonus?.xp || 0) * 100)}% ${p.skill} xp` : `Still wild · ${skillName(p.skill)} actions (~0.035%)`;
      return `<button type="button" class="pet-cell ${on ? "on" : "locked"}" data-act="desk" data-arg="bank" title="${escapeHtml(hint)}">
        <span class="dico">${iconMarkup(p.model || { eid: p.id }, 28)}</span>
        <strong>${escapeHtml(on ? p.name : "????")}</strong>
        <span>${escapeHtml(on ? `${skillName(p.skill)} +xp` : `Hunt: ${skillName(p.skill)}`)}</span>
      </button>`;
    }).join("")}</div>
  </div>`;
  document.getElementById("quests").innerHTML = cards + coming + `<p class="blurb">Sealed ${state.quests.done.length}/${CONTENT.quests.length} · ${escapeHtml(standingBonuses(state).label)} · LOG ${ls.log.totalPct}%</p>${petGrid}`;
  const badge = document.getElementById("ledger-count");
  if (badge) badge.textContent = `${ls.completionPct}%`;
}

function renderShop(ctx) {
  const { state } = ctx;
  const booth = currentStallBooth();
  const deal = quayDeal();
  const chips = QUAY_BOOTHS.map((b) => `<button type="button" class="${b.id === booth ? "on" : ""}" data-act="shop-cat" data-arg="${b.id}">${escapeHtml(b.name)}</button>`).join("");
  let list = CONTENT.shop.filter((o) => inferBooth(o) === booth);
  const q = currentStallFilter();
  if (q) list = CONTENT.shop.filter((o) => `${stallOfferName(o)} ${o.desc || ""}`.toLowerCase().includes(q));
  const search = document.getElementById("shop-search");
  const keepVal = search && document.activeElement === search ? search.value : (q || "");
  const body = list.length
    ? `<div class="wares">${list.map((o) => {
      const { cost, bought, deal: onDeal } = offerPrice(state, o);
      const sold = o.max && bought >= o.max;
      const lvok = !o.reqLevel || skillLevel(state, o.reqSkill) >= o.reqLevel;
      const why = sold ? "Sold out" : !lvok ? `Need ${skillName(o.reqSkill)} ${o.reqLevel}` : state.coins < cost ? "Short on marks" : "";
      return `<button type="button" class="ware ${!lvok ? "locked" : ""} ${sold ? "sold" : ""} ${onDeal ? "deal" : ""}" data-act="buy" data-arg="${o.id}" ${sold || !lvok ? "disabled" : ""}>
        <span class="bico">${iconMarkup(offerModel(o), 28)}</span>
        <strong>${escapeHtml(stallOfferName(o))}</strong>
        <span class="cost">${glyphMarks(11)} ${Math.floor(cost).toLocaleString()}${onDeal ? " dusk" : ""}</span>
        <span class="sub">${escapeHtml(o.desc || "")} · owned ${bought}${o.max ? "/" + o.max : ""}${why ? " · " + why : ""}</span>
      </button>`;
    }).join("")}</div>`
    : `<p class="blurb">This keeper has nothing hung.</p>`;
  const html = `<div class="shop-head">
      <p class="muted">${escapeHtml(deal.watch)}${deal.offer ? ` · lantern: ${escapeHtml(stallOfferName(deal.offer))}` : ""}</p>
      <div class="tabs">${chips}</div>
      <input id="shop-search" placeholder="Filter shop" value="${escapeHtml(keepVal)}" />
      <button type="button" class="primary" data-act="desk" data-arg="stall">Open full shop</button>
    </div>${body}`;
  fillHtml(document.getElementById("shop"), html);
}

function renderLog(ctx) {
  const e = weeklyEclipse();
  const ls = ledgerStats(ctx.state);
  const ambient = `Eclipse: ${e.name}. The ledger whispers ${ls.completionPct}% remembered.`;
  document.getElementById("journal").innerHTML = [`<div class="muted">${escapeHtml(ambient)}</div>`]
    .concat(ctx.state.log.slice(0, 14).map((l) => `<div>${escapeHtml(l.msg)}</div>`)).join("");
}

function toast(ctx, msg) {
  log(ctx.state, msg);
  showToast(ctx, msg);
}

function showToast(ctx, msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => t.classList.remove("show"), 3400);
}

/* Ledger-seal celebration: one chime + one toast per sealed page. */
let lastSeal = 0;
function renderSeal(ctx) {
  const seal = ctx.state._seal;
  if (!seal || seal.seq === lastSeal) return;
  lastSeal = seal.seq;
  const copy = sealCopy(seal);
  showToast(ctx, `Ledger sealed: ${seal.name}${copy ? ` · ${copy}` : ""}`);
  if (ctx.state.settings?.toasts !== false && !ctx.state.settings?.reducedMotion) pingYield(true);
}

export { renderTop, recalcHp, desk, inspectModelOf };
