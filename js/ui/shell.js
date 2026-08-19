import { CONTENT, SKILLS, COMBAT_SKILLS, XP_TABLE, MAX_LEVEL, skillLevel, bankCount, addItem, takeItem, log, masteryLevel, recalcHp } from "../engine/state.js";
import { startAction, stopAction, harvestPlot, plantPlot, collectPen, stockPen, actionDuration } from "../engine/sim.js";
import { startFight, stopFight, startDungeon, equipItem, unequip, drinkPotion, rollBounty, buryBones, playerStats } from "../engine/combat.js";
import { questProgress } from "../engine/quests.js";

let selectedSkill = "timber";
let bankFilter = "";
let bankTab = "General";

export function skillSelect() { return selectedSkill; }

export function bindUI(ctx) {
  const { state, root } = ctx;
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    const arg = b.dataset.arg;
    handle(ctx, act, arg, b);
  });
  root.addEventListener("input", (e) => {
    if (e.target.id === "bank-search") {
      bankFilter = e.target.value.toLowerCase();
      renderBank(ctx);
    }
  });
  root.addEventListener("change", (e) => {
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
    case "skill": selectedSkill = arg; ctx.render(); break;
    case "start": err(startAction(state, arg)); ctx.render(); break;
    case "stop": stopAction(state); stopFight(state); ctx.render(); break;
    case "fight": err(startFight(state, arg)); ctx.render(); break;
    case "dungeon": err(startDungeon(state, arg)); ctx.render(); break;
    case "equip": err(equipItem(state, arg)); ctx.render(); break;
    case "unequip": unequip(state, arg); ctx.render(); break;
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
    case "spell-pick": state.combat.spell = arg; ctx.render(); break;
    case "tab": bankTab = arg; renderBank(ctx); break;
    case "set-tab": state.itemTabs[arg] = bankTab; renderBank(ctx); break;
    case "loadout-save": saveLoadout(state); toast(ctx, "Loadout saved."); break;
    case "loadout-load": loadLoadout(state, +arg); ctx.render(); break;
    case "export": navigator.clipboard.writeText(ctx.exportSave()); toast(ctx, "Save copied."); break;
    case "import": {
      const s = prompt("Paste save");
      if (s) ctx.importSave(s);
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
  if (offer.item) addItem(state, offer.item, offer.qty || 1);
  if (offer.effect === "bankTab") state.bankTabs.push("Tab " + state.bankTabs.length);
  if (offer.effect === "plot") state.soil.plots.push(null);
  if (offer.effect === "pen") state.drove.pens.push(null);
  if (offer.effect === "autoEat") state.combat.autoEat = 0.6;
  if (offer.effect === "autoEat2") { state.combat.autoEat = 0.75; }
  if (offer.effect === "loadout") state.loadouts.push({ name: "Set " + state.loadouts.length, equipment: { ...state.equipment } });
  return null;
}

function sellOne(state, id) {
  const it = CONTENT.items[id];
  if (!it || !bankCount(state, id)) return;
  takeItem(state, id, 1);
  addItem(state, "coins", Math.max(1, Math.floor((it.value || 1) * 0.4)));
}

function saveLoadout(state) {
  const lo = state.loadouts[state.activeLoadout] || state.loadouts[0];
  lo.equipment = { ...state.equipment };
}

function loadLoadout(state, i) {
  const lo = state.loadouts[i];
  if (!lo?.equipment) return;
  for (const slot of Object.keys(state.equipment)) {
    if (state.equipment[slot]) unequip(state, slot);
  }
  for (const [slot, id] of Object.entries(lo.equipment)) {
    if (id) equipItem(state, id);
  }
  state.activeLoadout = i;
}

export function renderShell(ctx) {
  const { state, root } = ctx;
  const left = SKILLS.map((s) => {
    const lv = skillLevel(state, s.id);
    const on = selectedSkill === s.id ? "on" : "";
    return `<button class="skill ${on}" data-act="skill" data-arg="${s.id}"><span>${s.icon}</span><span class="sn">${s.name}</span><span class="lv">${lv}</span></button>`;
  }).join("");
  root.querySelector("#skill-nav").innerHTML = left;
  renderTop(ctx);
  renderCenter(ctx);
  renderRight(ctx);
}

function renderTop(ctx) {
  const { state } = ctx;
  const hp = state.combat.hp;
  const max = state.combat.maxHp;
  document.getElementById("coins").textContent = Math.floor(state.coins).toLocaleString();
  document.getElementById("hp-label").textContent = `${Math.ceil(hp)} / ${max}`;
  document.getElementById("hp-fill").style.width = `${Math.max(0, 100 * hp / max)}%`;
  document.getElementById("vow-fill").style.width = `${Math.max(0, 100 * state.combat.vow / state.combat.maxVow)}%`;
  const act = state.action;
  const bar = document.getElementById("action-fill");
  const lab = document.getElementById("action-label");
  if (state.combat.fighting && CONTENT.monsters[state.combat.monsterId]) {
    const m = CONTENT.monsters[state.combat.monsterId];
    lab.textContent = `Fighting ${m.name} · ${Math.max(0, Math.ceil(state.combat.monsterHp))}/${m.hp}`;
    bar.style.width = `${Math.max(0, 100 * state.combat.monsterHp / m.hp)}%`;
    bar.classList.add("combat");
  } else if (act) {
    const a = CONTENT.actions[act.id];
    const pct = Math.min(100, 100 * act.progress / (act.duration || 1));
    lab.textContent = `${a?.name || act.id}`;
    bar.style.width = pct + "%";
    bar.classList.remove("combat");
  } else {
    lab.textContent = "Idle — choose a craft or a war.";
    bar.style.width = "0%";
    bar.classList.remove("combat");
  }
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
  let body = "";
  if (sk.kind === "gather" || sk.kind === "artisan") body = renderActions(ctx, sk.id);
  else if (sk.id === "course") body = renderCourse(ctx);
  else if (sk.id === "whisper") body = renderActions(ctx, "whisper");
  else if (sk.id === "soil") body = renderSoil(ctx);
  else if (sk.id === "drove") body = renderDrove(ctx);
  else if (sk.id === "chart") body = renderChart(ctx);
  else if (COMBAT_SKILLS.includes(sk.id)) body = renderCombatSkill(ctx, sk.id);
  document.getElementById("center").innerHTML = `
    <div class="skill-head">
      <div>
        <h2>${sk.icon} ${sk.name} <em>${lv}</em></h2>
        <p class="blurb">${sk.blurb}</p>
      </div>
      <div class="xpbar"><i style="width:${pct}%"></i><span>${Math.floor(xp).toLocaleString()} / ${next.toLocaleString()} xp</span></div>
    </div>
    <div class="guild">Guild ${guild}/10 ${gtask ? `· ${gtask.name}: ${state.skills[sk.id].guildProgress.toLocaleString()} / ${gtask.need.toLocaleString()} · ${gtask.bonus.label}` : "· Maxed"}</div>
    ${body}
  `;
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
        const need = (a.inputs || []).map((i) => `${bankCount(state, i.item)}/${i.qty} ${CONTENT.items[i.item]?.name}`).join(" · ");
        const on = state.action?.id === a.id;
        return `<button class="card ${on ? "on" : ""} ${lvok ? "" : "locked"}" data-act="start" data-arg="${a.id}" ${lvok ? "" : "disabled"}>
          <strong>${a.name}</strong>
          <span>Lv ${a.level} · ${(a.time / 1000).toFixed(1)}s · ${a.xp} xp · M${ml}</span>
          <em>${need || a.desc || ""}</em>
        </button>`;
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
  return `<p class="blurb">Each pillar is a loadout slot. You cannot take every bonus. Time multiplies — greedy circuits run slower. This is the Agility rework energy from Melvor Idle 2, written as dusk architecture.</p>
    <div class="pillars">${picks}</div>
    <button class="primary" data-act="start" data-arg="course-lap">Run the circuit</button>`;
}

function renderSoil(ctx) {
  const { state } = ctx;
  const seeds = Object.keys(state.bank).filter((id) => CONTENT.items[id]?.category === "seed");
  const plots = state.soil.plots.map((p, i) => {
    if (!p) {
      return `<div class="plot empty"><h4>Plot ${i + 1}</h4>
        ${seeds.map((s) => `<button data-act="plant" data-arg="${i}" data-seed="${s}">Plant ${CONTENT.items[s].name} (${state.bank[s]})</button>`).join("") || "<em>No seeds. Chop groves.</em>"}
      </div>`;
    }
    const crop = CONTENT.crops.find((c) => c.seed === p.seed);
    return `<div class="plot ${p.ready ? "ready" : ""}">
      <h4>${CONTENT.items[p.seed].name}</h4>
      <p>${p.ready ? "Ready" : `${Math.ceil(p.left / 1000)}s`}</p>
      ${p.ready ? `<button data-act="harvest" data-arg="${i}">Harvest</button>` : ""}
    </div>`;
  }).join("");
  return `<div class="plots">${plots}</div>`;
}

function renderDrove(ctx) {
  const { state } = ctx;
  const pens = state.drove.pens.map((p, i) => {
    if (!p) {
      return `<div class="plot empty"><h4>Pen ${i + 1}</h4>
        ${CONTENT.animals.map((a) => `<button data-act="stock" data-arg="${i}" data-animal="${a.id}" ${skillLevel(state, "drove") < a.level ? "disabled" : ""}>${a.name} · ${20 + a.level * 4}m · Lv ${a.level}</button>`).join("")}
      </div>`;
    }
    const a = CONTENT.animals.find((x) => x.id === p.animal);
    return `<div class="plot ${p.ready ? "ready" : ""}">
      <h4>${a.name}</h4>
      <p>${p.ready ? `Ready: ${CONTENT.items[a.produce].name}` : `${Math.ceil(p.left / 1000)}s`}</p>
      ${p.ready ? `<button data-act="collect" data-arg="${i}">Collect</button>` : ""}
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
    return `<button class="card" data-act="start" data-arg="chart-${c.id}" disabled style="display:none"></button>`;
  }).join("");
  // chart trains by studying currently slotted stars via a generated action if present; else virtual
  return `<p class="blurb">Only ${state.chart.slots} constellations bind at once. The Veil is a scarce buff budget — Chart is not a second mastery bar, it is a telescope you must aim.</p>
    <div class="pillars">${slots.join("")}</div>
    <div class="grid">${CONTENT.constellations.map((c) => {
      const on = state.chart.active.includes(c.id);
      return `<button class="card ${on ? "on" : ""}" data-act="start" data-arg="chart-study-${c.id}">
        <strong>Study ${c.name}</strong><span>Chart xp · ${c.studyTime / 1000}s</span><em>${JSON.stringify(c.bonus)}</em>
      </button>`;
    }).join("")}</div>${study}`;
}

function renderCombatSkill(ctx, id) {
  const { state } = ctx;
  if (id === "vow") {
    return `<div class="grid">${CONTENT.prayers.map((p) => {
      const on = state.combat.prayers.includes(p.id);
      const ok = skillLevel(state, "vow") >= p.level;
      return `<button class="card ${on ? "on" : ""}" data-act="pray" data-arg="${p.id}" ${ok ? "" : "disabled"}>
        <strong>${p.name}</strong><span>Lv ${p.level} · drain ${p.drain}/s</span><em>${p.desc}</em>
      </button>`;
    }).join("")}
    <p><button class="primary" data-act="bury">Bury all pale bones (${bankCount(state, "bones")})</button></p></div>`;
  }
  if (id === "weave") {
    return `<div class="grid">${CONTENT.spells.map((s) => {
      const on = state.combat.spell === s.id;
      const ok = skillLevel(state, "weave") >= s.level;
      const cost = Object.entries(s.runes).map(([r, n]) => `${n} ${CONTENT.items[r].name}`).join(", ");
      return `<button class="card ${on ? "on" : ""}" data-act="spell-pick" data-arg="${s.id}" ${ok ? "" : "disabled"} onclick="document.querySelector('[data-act=spell]').value='${s.id}'">
        <strong>${s.name}</strong><span>Lv ${s.level} · hit ${s.maxHit}</span><em>${s.desc} · ${cost}</em>
      </button>`;
    }).join("")}
    <label>Spell <select data-act="spell">${CONTENT.spells.map((s) => `<option value="${s.id}" ${state.combat.spell === s.id ? "selected" : ""}>${s.name}</option>`).join("")}</select></label>
    </div>${renderAreas(ctx)}`;
  }
  if (id === "bounty") {
    const b = state.bounty;
    const m = CONTENT.monsters[b.monsterId];
    return `<div class="panel">
      <p>${m ? `Hunt <strong>${m.name}</strong> in ${m.area}: ${b.have}/${b.need} · streak ${b.streak}` : "No contract."}</p>
      <button class="primary" data-act="bounty">Roll a contract</button>
      <p>Tokens: ${bankCount(state, "bounty-token")}</p>
    </div>${renderAreas(ctx)}`;
  }
  return renderAreas(ctx);
}

function renderAreas(ctx) {
  const { state } = ctx;
  const areas = CONTENT.areas.map((a) => `
    <details class="area" ${a.name === state.combat.area ? "open" : ""}>
      <summary>${a.name} <em>Bounty ${a.slayer}</em></summary>
      <div class="grid">${a.monsters.map((id) => {
        const m = CONTENT.monsters[id];
        const on = state.combat.fighting && state.combat.monsterId === id;
        return `<button class="card ${on ? "on" : ""}" data-act="fight" data-arg="${id}">
          <strong>${m.name}</strong>
          <span>HP ${m.hp} · hit ${m.maxHit} · ${m.style}${m.special ? " · " + m.special : ""}</span>
          <em>${m.desc}</em>
        </button>`;
      }).join("")}</div>
    </details>`).join("");
  const duns = `<h3 class="grp">Dungeons</h3><div class="grid">${CONTENT.dungeons.map((d) => {
    const n = (state.combat.dungeonClears || {})[d.id] || 0;
    const on = state.combat.dungeon === d.id;
    return `<button class="card ${on ? "on" : ""}" data-act="dungeon" data-arg="${d.id}">
      <strong>${d.name}</strong><span>Req ${d.req} · ${d.sequence.length} floors · clears ${n}</span><em>${d.desc}</em>
    </button>`;
  }).join("")}</div>`;
  const st = playerStats(state);
  const foodOpts = Object.keys(state.bank).filter((id) => CONTENT.items[id]?.heal).concat(state.combat.foodId ? [state.combat.foodId] : []);
  const uniqueFood = [...new Set(foodOpts)];
  return `<div class="stats-strip">Style <b>${st.style}</b> · Acc ${st.acc.toFixed(0)} · Power ${st.power.toFixed(0)} · Def ${st.def.toFixed(0)} · Auto-eat ${(state.combat.autoEat * 100).toFixed(0)}%</div>
    <label>Food <select data-act="food">${uniqueFood.map((id) => `<option value="${id}" ${state.combat.foodId === id ? "selected" : ""}>${CONTENT.items[id]?.name} +${CONTENT.items[id]?.heal}</option>`).join("")}</select></label>
    <div class="potions">${Object.keys(state.bank).filter((id) => CONTENT.items[id]?.potion).slice(0, 12).map((id) => `<button data-act="drink" data-arg="${id}">Drink ${CONTENT.items[id].name} (${state.bank[id]})</button>`).join("")}</div>
    ${state.combat.potionId ? `<p class="blurb">Active: ${CONTENT.items[state.combat.potionId].name} · ${state.combat.potionCharges} charges</p>` : ""}
    ${areas}${duns}
    <div class="clog">${(state._clog || []).map((l) => `<div>${l}</div>`).join("")}</div>
  `;
}

export function renderRight(ctx) {
  const { state } = ctx;
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
    return `<div class="slot"><b>${s}</b> ${it ? `<span>${it.name}</span> <button data-act="unequip" data-arg="${s}">x</button>` : "<em>empty</em>"}</div>`;
  }).join("") + `<div class="slot"><b>tools</b> axe ${CONTENT.items[state.tools.axe]?.name || "–"} · pick ${CONTENT.items[state.tools.pick]?.name || "–"} · rod ${CONTENT.items[state.tools.rod]?.name || "–"}</div>
    <button data-act="loadout-save">Save loadout</button>
    ${state.loadouts.map((l, i) => `<button data-act="loadout-load" data-arg="${i}">${l.name}</button>`).join("")}`;
}

function renderBank(ctx) {
  const { state } = ctx;
  const tabs = state.bankTabs.map((t) => `<button class="${t === bankTab ? "on" : ""}" data-act="tab" data-arg="${t}">${t}</button>`).join("");
  const rows = Object.entries(state.bank)
    .filter(([, n]) => n > 0)
    .filter(([id]) => CONTENT.items[id]?.name.toLowerCase().includes(bankFilter))
    .filter(([id]) => (state.itemTabs[id] || "General") === bankTab)
    .sort((a, b) => CONTENT.items[a[0]].name.localeCompare(CONTENT.items[b[0]].name))
    .map(([id, n]) => {
      const it = CONTENT.items[id];
      const eq = it.category === "equipment" || it.category === "ammo" || it.category === "tool";
      return `<div class="brow">
        <span title="${it.desc || ""}">${it.name}</span>
        <b>${n.toLocaleString()}</b>
        ${eq ? `<button data-act="equip" data-arg="${id}">equip</button>` : ""}
        ${it.potion ? `<button data-act="drink" data-arg="${id}">drink</button>` : ""}
        <button data-act="set-tab" data-arg="${id}">tab</button>
        <button data-act="sell" data-arg="${id}">sell</button>
      </div>`;
    }).join("");
  document.getElementById("bank").innerHTML = `<div class="tabs">${tabs}</div><input id="bank-search" placeholder="Search bank" value="${bankFilter}" />${rows || "<p class='blurb'>Empty tab.</p>"}`;
}

function renderQuests(ctx) {
  const { state } = ctx;
  document.getElementById("quests").innerHTML = state.quests.active.map((id) => {
    const q = CONTENT.quests.find((x) => x.id === id);
    const prog = questProgress(state, q).map((p) => `<li class="${p.ok ? "ok" : ""}">${describeReq(state, p.r)} ${p.ok ? "✓" : ""}</li>`).join("");
    return `<div class="q"><strong>${q.name}</strong><p>${q.desc}</p><ul>${prog}</ul></div>`;
  }).join("") + `<p class="blurb">Sealed ${state.quests.done.length}/${CONTENT.quests.length}</p>`;
}

function renderShop(ctx) {
  const { state } = ctx;
  document.getElementById("shop").innerHTML = CONTENT.shop.map((o) => {
    const bought = state.shopBought[o.id] || 0;
    let cost = o.cost;
    if (o.repeatable) cost = Math.floor(cost * Math.pow(1.45, bought));
    const name = o.name || CONTENT.items[o.item]?.name;
    return `<button class="card" data-act="buy" data-arg="${o.id}">
      <strong>${name}</strong><span>${Math.floor(cost).toLocaleString()} marks · x${bought}${o.max ? "/" + o.max : ""}</span><em>${o.desc || ""}</em>
    </button>`;
  }).join("");
}

function renderLog(ctx) {
  document.getElementById("journal").innerHTML = ctx.state.log.slice(0, 14).map((l) => `<div>${l.msg}</div>`).join("");
}

function describeReq(state, r) {
  if (r.type === "action") {
    const a = CONTENT.actions[r.id];
    return `${a?.name || r.id}: ${state.actionCounts?.[r.id] || 0}/${r.count}`;
  }
  if (r.type === "kills") return `Kill ${r.count} in ${r.area}`;
  if (r.type === "dungeon") return `Clear ${r.id}`;
  if (r.type === "harvest") return `Harvest ${state.quests.stats.harvests || 0}/${r.count}`;
  if (r.type === "laps") return `Laps ${state.quests.stats.laps || 0}/${r.count}`;
  if (r.type === "bounty") return `Bounties ${state.quests.stats.bounties || 0}/${r.count}`;
  if (r.type === "drove") return `Collect ${r.animal} ${state.quests.stats.drove[r.animal] || 0}/${r.count}`;
  if (r.type === "level") return `${r.skill} ${r.level}`;
  if (r.type === "anyLevel") return `Any skill ${r.level}`;
  if (r.type === "guildRank") return `Any guild rank ${r.rank}`;
  return r.type;
}

function toast(ctx, msg) {
  log(ctx.state, msg);
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

export { renderTop, recalcHp };
