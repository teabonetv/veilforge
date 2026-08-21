import {
  CONTENT, TICK_MS, skillLevel, addXp, addItem, takeItem, bankCount, log,
  masteryBonus, guildBonuses, courseBonuses, chartBonuses, potionStats, petBonuses,
  recalcHp, sumGear, masteryLevel, skillLocked, lockMessage, bankUsed, bankCap, stashItem
} from "./state.js";
import { combatTick, startFight, stopFight, playerInterval, consumePotionCharge } from "./combat.js";
import { checkQuests } from "./quests.js";
import { quayCommissions, vaultFenceRate } from "./market.js";
import { standingBonuses } from "./ledger.js";
import { stacksToAutoSell, autoEatFinest } from "./orders.js";
import { weeklyEclipse } from "./eclipse.js";
import { notePet } from "./logbook.js";

function noteGive(state, id, qty, viaStash = false, why = "yield") {
  if (!id || !(qty > 0)) return true;
  const before = id === "coins" ? (state.coins || 0) : (state.bank[id] || 0);
  const ok = viaStash ? stashItem(state, id, qty, why) : addItem(state, id, qty);
  const after = id === "coins" ? (state.coins || 0) : (state.bank[id] || 0);
  const got = after - before;
  if (got > 0) {
    state._pendingYield = state._pendingYield || [];
    const row = state._pendingYield.find((x) => x.item === id);
    if (row) row.n += got;
    else state._pendingYield.push({ item: id, n: got });
  }
  return ok;
}

function flushYield(state, act, xp) {
  const items = state._pendingYield || [];
  state._pendingYield = [];
  const tag = state._dripTag || null;
  state._dripTag = null;
  if (state._offlineSim) return;
  if (!(xp > 0) && !items.length) return;
  state._dripSeq = (state._dripSeq || 0) + 1;
  state.lastDrip = {
    seq: state._dripSeq,
    xp: Math.round((xp || 0) * 10) / 10,
    skill: act.skill,
    items,
    tag,
    t: Date.now()
  };
  state._uiDirty = true;
}

function trainingMode(state, skill) {
  const id = state.actionMode?.[skill] || "steady";
  if (id === "focused") return { id, time: 0.85, output: 0.75, rare: 1 };
  if (id === "meditative") return { id, time: 1.3, output: 1.3, rare: 0.5 };
  return { id: "steady", time: 1, output: 1, rare: 1 };
}

export function setActionMode(state, skill, mode) {
  if (!["focused", "steady", "meditative"].includes(mode)) return "Unknown cadence.";
  state.actionMode = state.actionMode || {};
  state.actionMode[skill] = mode;
  return null;
}

export function startAction(state, actionId, opts = {}) {
  const act = CONTENT.actions[actionId];
  if (!act) return "Unknown action.";
  const lock = skillLocked(state, act.skill);
  if (lock) return lockMessage(lock);
  if (skillLevel(state, act.skill) < act.level) return `Requires ${act.skill} ${act.level}.`;
  if (act.skill === "course" && act.id === "course-lap") {
    const built = Object.keys(state.course?.built || {}).filter((k) => state.course.built[k]);
    if (built.length < 1) return "Build at least one pillar (pay the cost) before running.";
  }
  if (act.inputs) {
    for (const inp of act.inputs) {
      if (bankCount(state, inp.item) < inp.qty) return `Need ${inp.qty} ${CONTENT.items[inp.item]?.name || inp.item}.`;
    }
  }
  if (state.combat.fighting) stopFight(state);
  let remaining = null;
  if (opts.count != null && Number.isFinite(+opts.count)) {
    const n = Math.floor(+opts.count);
    if (n < 1) return "Nothing to craft with the vault as it stands.";
    remaining = n;
  }
  state.action = { id: actionId, skill: act.skill, started: state.now || 0, progress: 0, duration: actionDuration(state, act), remaining };
  return null;
}

export function maxAffordable(state, act) {
  if (!act?.inputs?.length) return Infinity;
  let n = Infinity;
  for (const inp of act.inputs) {
    const need = Math.max(1, inp.qty || 1);
    n = Math.min(n, Math.floor(bankCount(state, inp.item) / need));
  }
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function stopAction(state) {
  state.action = null;
}

export function actionDuration(state, act) {
  const eclipse = weeklyEclipse(state.now || Date.now());
  const stand = standingBonuses(state);
  const mode = trainingMode(state, act.skill);
  let t = act.time * mode.time;
  if (eclipse.artisanSpeed && ["anvil", "ember", "hearth", "fletch", "loom", "sigil", "vial"].includes(act.skill)) {
    t /= (1 + eclipse.artisanSpeed);
  }
  if (eclipse.gatherSpeed && ["timber", "trawl", "vein"].includes(act.skill)) {
    t /= (1 + eclipse.gatherSpeed);
  }
  const mb = masteryBonus(state, act.masteryId, act.skill);
  const gb = guildBonuses(state, act.skill);
  const cb = courseBonuses(state);
  const ch = chartBonuses(state);
  const pot = potionStats(state);
  const tool = toolSpeed(state, act.skill);
  if (act.skill === "course") {
    t = (act.time || 4000) * (cb.time || 1);
    const speed = 1 + mb.speed + gb.speed + ((pot.speedMul || 1) - 1);
    return Math.max(2800, t / speed);
  }
  if (act.skill === "chart" && act.id?.startsWith("chart-study-")) {
    const starId = act.id.slice("chart-study-".length);
    const slotted = isStarSlotted(state, starId);
    t = (act.time || 8000) * (slotted ? 0.72 : 1.08);
  }
  const speed = 1 + mb.speed + gb.speed + cb.skillSpeed + (ch.speed || 0) + tool + ((pot.speedMul || 1) - 1) + (stand.speed || 0);
  const floor = Math.min(2200, Math.max(200, act.time || 2200));
  return Math.max(floor, t / speed);
}

function isStarSlotted(state, starId) {
  const slots = state.chart?.slots || 2;
  return (state.chart?.active || []).slice(0, slots).includes(starId);
}

function toolSpeed(state, skill) {
  const map = { timber: "axe", vein: "pick", trawl: "rod" };
  const slot = map[skill];
  if (!slot) return 0;
  const id = state.tools[slot];
  return CONTENT.items[id]?.bonus || 0;
}

export function tick(state, dt) {
  const scale = state.settings.tickScale || 1;
  const step = dt * scale;
  state._acc = (state._acc || 0) + step;
  let safety = 0;
  while (state._acc >= TICK_MS && safety++ < 400) {
    state._acc -= TICK_MS;
    tickOnce(state, TICK_MS);
  }
  tickPlots(state, step);
  tickDrove(state, step);
}

function tickOnce(state, ms) {
  state.now = (state.now || 0) + ms;
  if (state.combat.fighting) combatTick(state, ms);
  if (!state.action) return;
  const act = CONTENT.actions[state.action.id];
  if (!act) {
    state.action = null;
    return;
  }
  const stunned = (state.now || 0) < (state.combat.stunUntil || 0);
  if (stunned && act.skill === "whisper") return;
  state.action.duration = actionDuration(state, act);
  state.action.progress += ms;
  const dur = state.action.duration;
  if (state.action.progress >= dur) {
    const id = act.id;
    completeAction(state, act);
    if (!state.action || state.action.id !== id) return;
    if (state.action.remaining != null) {
      state.action.remaining -= 1;
      if (state.action.remaining <= 0) {
        log(state, `Batch finished: ${act.name}.`);
        state.action = null;
        return;
      }
    }
    restartAction(state, act);
  }
}

function completeAction(state, act) {
  if (act.npc) return completeThieve(state, act);
  if (act.id === "course-lap") return completeLap(state, act);
  if (act.id?.startsWith("chart-study-")) return completeChartStudy(state, act);

  if (act.inputs) {
    const ch = chartBonuses(state);
    const mb = masteryBonus(state, act.masteryId, act.skill);
    const gb = guildBonuses(state, act.skill);
    const cb = courseBonuses(state);
    const preserve = Math.min(0.8, (mb.preserve || 0) + (gb.preserve || 0) + (cb.preserve || 0) + (ch.preserve || 0));
    for (const inp of act.inputs) {
      if (Math.random() < preserve) continue;
      if (!takeItem(state, inp.item, inp.qty)) {
        state.action = null;
        return;
      }
    }
  }

  if (act.burn) {
    const ch = chartBonuses(state);
    const cb = courseBonuses(state);
    let chance = act.burn.chance - (skillLevel(state, "hearth") - act.level) * 0.012 - cb.burnReduce - (ch.burnReduce || 0);
    chance = Math.max(0.005, chance);
    if (Math.random() < chance) {
      noteGive(state, act.burn.item, 1);
      state._dripTag = "burn";
      grantSkillBits(state, act, 0.25);
      log(state, `Burned a ${act.name}.`);
      return;
    }
  }

  const outMul = (1 + (masteryBonus(state, act.masteryId, act.skill).output || 0) + (guildBonuses(state, act.skill).output || 0) + (courseBonuses(state).outputMul || 0) + (chartBonuses(state).output || 0)) * trainingMode(state, act.skill).output * (1 + (weeklyEclipse(state.now || Date.now()).outputMul || 0));
  if (act.outputs) {
    let dumped = false;
    for (const o of act.outputs) {
      const n = Math.round((o.min + Math.floor(Math.random() * (o.max - o.min + 1))) * outMul);
      if (!noteGive(state, o.item, n)) dumped = true;
    }
    if (dumped) {
      state._dripTag = "full";
      const blocker = state.stackFull
        ? `${state.stackFull} is capped`
        : `Bank full (${bankUsed(state)}/${bankCap(state)} stacks)`;
      if (!act.inputs) {
        const why = `Halted ${act.name}: ${blocker}. ${gatherSinkHint(act)}`;
        log(state, why);
        state._haltReason = why;
        state.stackFull = null;
        state._yieldWarn = null;
        grantSkillBits(state, act, 1);
        rollPet(state, act.skill);
        consumePotionCharge(state, "action");
        const sold = stacksToAutoSell(state);
        for (const row of sold) sellItems(state, row.id, row.qty);
        if (sold.length) log(state, "Standing order sold commons to unstick the vault.");
        state.action = null;
        state._uiDirty = true;
        return;
      }
      const why = `${blocker}. XP still rolls — sell, cook, or burn to stash more.`;
      if (state._yieldWarn !== why) log(state, why);
      state._yieldWarn = why;
      state.stackFull = null;
      state._uiDirty = true;
    } else {
      state._yieldWarn = null;
    }
  }
  if (act.rare) {
    const rareMul = (1 + (masteryBonus(state, act.masteryId, act.skill).rare || 0) + (guildBonuses(state, act.skill).rare || 0) + (courseBonuses(state).rareMul || 0) + (chartBonuses(state).rare || 0) + (act.skill === "vein" ? (chartBonuses(state).gem || 0) : 0) + (potionStats(state).rareMul ? potionStats(state).rareMul - 1 : 0) + petBonuses(state, act.skill).rare + (standingBonuses(state).rare || 0) + (weeklyEclipse(state.now || Date.now()).rareMul || 0)) * trainingMode(state, act.skill).rare;
    for (const r of act.rare) {
      if (Math.random() < r.chance * rareMul) {
        noteGive(state, r.item, r.min || 1, true, "rare drop");
        state._dripTag = state._dripTag || "rare";
        log(state, `Rare: ${CONTENT.items[r.item]?.name || r.item}`);
      }
    }
  }
  grantSkillBits(state, act, 1);
  rollPet(state, act.skill);
  consumePotionCharge(state, "action");
}

function gatherSinkHint(act) {
  const id = act.outputs?.[0]?.item;
  const cat = CONTENT.items[id]?.category;
  if (cat === "log" || act.skill === "timber") return "Ember burns logs.";
  if (cat === "ore" || act.skill === "vein") return "Smelt at the Anvil.";
  if (cat === "fish" || act.skill === "trawl") return "Cook at Hearth.";
  return "Sell at the Quay or buy vault slots.";
}

function grantSkillBits(state, act, xpMul, xpOverride) {
  const gb = guildBonuses(state, act.skill);
  const cb = courseBonuses(state);
  const ch = chartBonuses(state);
  const pet = petBonuses(state, act.skill);
  let mul = 1 + (gb.xp || 0) + (cb.allXp || 0) + (cb.xpMul || 0) + (ch.allXp || 0) + (ch.xp || 0) + pet.xp + (standingBonuses(state).allXp || 0);
  if (act.skill === "chart") mul += cb.chartXp || 0;
  const baseXp = xpOverride != null ? xpOverride : act.xp;
  const notes = addXp(state, act.skill, baseXp * mul * xpMul);
  const sk = state.skills[act.skill];
  sk.actions += 1;
  state.actionCounts = state.actionCounts || {};
  state.actionCounts[act.id] = (state.actionCounts[act.id] || 0) + 1;
  sk.mastery[act.masteryId] = (sk.mastery[act.masteryId] || 0) + 4 * (1 + (cb.masteryMul || 0));
  sk.pool = (sk.pool || 0) + Math.max(3, Math.round(4 * xpMul * (1 + (cb.masteryMul || 0))));
  state._fx = 1;
  sk.guildProgress += 1;
  const tasks = CONTENT.guildTasks[act.skill];
  const next = tasks[sk.guildRank];
  if (next && sk.guildProgress >= next.need) {
    sk.guildRank += 1;
    log(state, `${next.name} complete — ${next.bonus.label}`);
    state.quests.stats.guildMax = Math.max(state.quests.stats.guildMax, sk.guildRank);
  }
  state.stats.actions += 1;
  notes.forEach((n) => log(state, `Level up: ${n}`));
  flushYield(state, act, baseXp * mul * xpMul);
  state._uiDirty = true;
  checkQuests(state);
}

function completeThieve(state, act) {
  const npc = act.npc;
  const w = state.whisper || (state.whisper = { heat: 0, streak: 0, heatByMark: {} });
  w.heatByMark = w.heatByMark || {};
  const lvl = skillLevel(state, "whisper");
  const markId = npc.id;
  const heat = w.heatByMark[markId] || 0;
  const stunChance = thieveStunChance(state, npc);
  if (Math.random() < stunChance) {
    w.heatByMark[markId] = Math.min(14, heat + 1);
    w.heat = w.heatByMark[markId];
    w.streak = 0;
    const lock = Math.round(npc.stunMs * (1 + w.heatByMark[markId] * 0.1));
    state.combat.stunUntil = (state.now || 0) + lock;
    if (state.action) state.action.progress = 0;
    const scraps = 1 + Math.floor(Math.random() * (2 + Math.min(6, npc.level / 20)));
    noteGive(state, "coins", scraps);
    state._dripTag = "caught";
    grantSkillBits(state, act, 0.22);
    log(state, `${npc.name} caught you. Stunned ${Math.round(lock / 1000)}s · heat ${w.heatByMark[markId]} on this mark. Scrap ${scraps} veilmarks.`);
    return;
  }
  w.heatByMark[markId] = Math.max(0, heat - 1);
  w.heat = w.heatByMark[markId];
  w.streak = (w.streak || 0) + 1;
  const luck = w.streak >= 8 && Math.random() < 0.12;
  const spike = luck ? 3 + Math.floor(Math.random() * 4) : (w.streak >= 4 && Math.random() < 0.18 ? 2 : 1);
  for (const l of npc.loot) {
    if (Math.random() >= l.chance) continue;
    let n = l.min + Math.floor(Math.random() * (l.max - l.min + 1));
    if (l.item === "coins") n = Math.max(1, Math.round(n * spike * (1 + w.streak * 0.03)));
    noteGive(state, l.item, n, true, "pickpocket");
    if (l.item === "coins" && spike > 1) log(state, luck ? `Jackpot steal ×${spike} (${n} veilmarks).` : `Clean lift ×${spike}.`);
  }
  grantSkillBits(state, act, 1);
  rollPet(state, "whisper");
}

export function markHeat(state, npcId) {
  return state.whisper?.heatByMark?.[npcId] || 0;
}

export function thieveStunChance(state, npc) {
  const lvl = skillLevel(state, "whisper");
  const heat = markHeat(state, npc.id);
  return Math.min(0.72, npc.stun + heat * 0.035 - Math.max(0, lvl - npc.level) * 0.004);
}

function completeLap(state, act) {
  const built = Object.keys(state.course.built || {}).filter((k) => state.course.built[k]);
  if (built.length < 1) {
    log(state, "Build a pillar before running the course.");
    state.action = null;
    return;
  }
  const cb = courseBonuses(state);
  const timeMul = cb.time || 1;
  const lvl = skillLevel(state, "course");
  const xp = (18 + built.length * 10 + lvl * 0.45) * timeMul;
  state.quests.stats.laps += 1;
  const marks = Math.max(1, Math.round((3 + built.length * 4) * timeMul));
  noteGive(state, "coins", marks);
  if (timeMul >= 1.2 && Math.random() < 0.12) {
    noteGive(state, "coins", 18 + built.length * 10);
    log(state, "Greedy circuit paid a purse.");
  }
  grantSkillBits(state, act, 1, xp);
  rollPet(state, "course");
}

function completeChartStudy(state, act) {
  const starId = act.id.slice("chart-study-".length);
  const star = CONTENT.constellations.find((c) => c.id === starId);
  state.chart.studied = state.chart.studied || {};
  state.chart.studied[starId] = (state.chart.studied[starId] || 0) + 1;
  const n = state.chart.studied[starId];
  const slotted = isStarSlotted(state, starId);
  const xpMul = slotted ? 1.4 : 1;
  const dust = 1 + (slotted && Math.random() < 0.35 ? 1 : 0);
  noteGive(state, "stardust", dust, true, "chart study");
  grantSkillBits(state, act, xpMul);
  if (slotted) {
    log(state, `Slotted study: ${star?.name || starId} insight ${n}. Stardust +${dust}.`);
  } else {
    log(state, `Filed ${star?.name || starId} (${n}). Slot it to spend the bonus. Stardust +${dust}.`);
  }
  rollPet(state, "chart");
}

function rollPet(state, skill) {
  const pet = CONTENT.pets.find((p) => p.skill === skill);
  if (!pet || state.pets[pet.id]) return;
  const luck = 1 + (chartBonuses(state).rare || 0);
  if (Math.random() < pet.chance * luck) {
    state.pets[pet.id] = true;
    notePet(state, pet.id);
    log(state, `Pet found: ${pet.name}`);
  }
}

function tickPlots(state, ms) {
  if (!state.soil?.plots) return;
  const speed = 1 + (guildBonuses(state, "soil").speed || 0) + (courseBonuses(state).skillSpeed || 0);
  state.soil.plots.forEach((p) => {
    if (!p) return;
    if (!p.ready) {
      p.left -= ms * speed;
      if (p.left <= 0) {
        p.ready = true;
        p.ripeMs = 0;
      }
    } else {
      p.ripeMs = (p.ripeMs || 0) + ms;
    }
  });
}

function tickDrove(state, ms) {
  if (!state.drove?.pens) return;
  const speed = 1 + (guildBonuses(state, "drove").speed || 0) + (courseBonuses(state).skillSpeed || 0);
  state.drove.pens.forEach((p) => {
    if (!p) return;
    const a = CONTENT.animals.find((x) => x.id === p.animal);
    if (!a) return;
    const cycle = a.time / speed;
    const maxCycles = Math.max(12, Math.floor((offlineCapMs(state)) / a.time));
    p.left -= ms;
    while (p.left <= 0) {
      const have = p.cyclesReady || 0;
      if (have >= maxCycles) {
        p.left = cycle;
        p.ready = true;
        break;
      }
      p.cyclesReady = have + 1;
      p.pending = (p.pending || 0) + a.qty;
      p.ready = true;
      p.left += cycle;
    }
  });
}

export function harvestPlot(state, i) {
  const p = state.soil.plots[i];
  if (!p?.ready) return;
  const crop = CONTENT.crops.find((c) => c.seed === p.seed);
  if (!crop) return;
  const lvl = skillLevel(state, "soil");
  const outMul = 1 + (guildBonuses(state, "soil").output || 0) + (courseBonuses(state).outputMul || 0) + (chartBonuses(state).output || 0);
  const extra = Math.min(3, Math.floor((p.ripeMs || 0) / Math.max(8000, crop.growMs * 0.55)));
  const compostMul = p.compost ? 1.4 : 1;
  const qty = Math.max(1, Math.round((2 + Math.floor(crop.t / 3) + extra + (Math.random() < 0.35 ? 1 : 0)) * outMul * compostMul));
  noteGive(state, crop.herb, qty, true, "harvest");
  const seedChance = Math.min(0.82, 0.38 + lvl * 0.004 + crop.t * 0.012);
  let seeds = 0;
  if (Math.random() < seedChance) seeds += 1;
  if (Math.random() < seedChance * 0.35) seeds += 1;
  if (seeds) noteGive(state, crop.seed, seeds, true, "harvest seeds");
  if (crop.log && Math.random() < 0.08 + crop.t * 0.006) noteGive(state, crop.log, 1, true, "harvest log");
  state.soil.plots[i] = null;
  state.quests.stats.harvests += 1;
  const act = { id: `soil-${crop.seed}`, skill: "soil", xp: 22 + crop.t * 16, masteryId: `soil-${crop.t}` };
  grantSkillBits(state, act, 1, act.xp * (1 + qty * 0.12));
  log(state, `Harvest ${CONTENT.items[crop.herb]?.name || crop.herb} ×${qty}${seeds ? ` · seeds ×${seeds}` : ""}${extra ? " · extra ripe" : ""}.`);
  checkQuests(state);
}

function optsCompost(state) {
  if (!state.soil.useCompost) return false;
  return takeItem(state, "compost", 1);
}

export function plantPlot(state, i, seed) {
  if (state.soil.plots[i]) return "Plot occupied.";
  const crop = CONTENT.crops.find((c) => c.seed === seed);
  if (!crop) return "Not a seed.";
  if (skillLevel(state, "soil") < crop.req) return `Soil ${crop.req} required.`;
  if (!takeItem(state, seed, 1)) return "No seed.";
  const speed = 1 + (guildBonuses(state, "soil").speed || 0);
  const compost = optsCompost(state);
  const grow = crop.growMs / speed / (compost ? 1.35 : 1);
  state.soil.plots[i] = { seed, left: grow, ready: false, ripeMs: 0, compost: !!compost };
  if (compost) log(state, "Compost worked in — faster grow, fatter harvest.");
  return null;
}

export function setUseCompost(state, on) {
  state.soil.useCompost = !!on;
}

export function collectPen(state, i) {
  const p = state.drove.pens[i];
  if (!p?.ready) return;
  const a = CONTENT.animals.find((x) => x.id === p.animal);
  if (!a) return;
  const cycles = Math.max(1, p.cyclesReady || 1);
  const outMul = 1 + (guildBonuses(state, "drove").output || 0) + (courseBonuses(state).outputMul || 0) + (chartBonuses(state).output || 0);
  const qty = Math.max(1, Math.round((p.pending || a.qty * cycles) * outMul * (p.fed ? 1.45 : 1)));
  noteGive(state, a.produce, qty, true, "drove collect");
  let rares = 0;
  if (a.rare) {
    const rolls = Math.min(cycles, 24);
    for (let n = 0; n < rolls; n++) {
      if (Math.random() < a.rare.chance) {
        if (noteGive(state, a.rare.item, 1, true, "drove rare")) rares += 1;
      }
    }
  }
  const speed = 1 + (guildBonuses(state, "drove").speed || 0);
  p.left = a.time / speed;
  p.ready = false;
  p.pending = 0;
  p.cyclesReady = 0;
  p.fed = false;
  p.collected = (p.collected || 0) + cycles;
  state.quests.stats.drove[a.id] = (state.quests.stats.drove[a.id] || 0) + cycles;
  const act = { id: `drove-${a.id}`, skill: "drove", xp: a.xp, masteryId: `drove-${a.id}` };
  grantSkillBits(state, act, 1, a.xp * cycles);
  log(state, `Collected ${CONTENT.items[a.produce]?.name || a.produce} ×${qty} (${cycles} cycle${cycles > 1 ? "s" : ""})${rares ? ` · rare ×${rares}` : ""}.`);
  checkQuests(state);
}

export function stockPen(state, i, animalId) {
  const a = CONTENT.animals.find((x) => x.id === animalId);
  if (!a) return "Unknown beast.";
  if (skillLevel(state, "drove") < a.level) return `Drove ${a.level} required.`;
  const cost = 20 + a.level * 4;
  if (!takeItem(state, "coins", cost)) return `Need ${cost} veilmarks.`;
  const speed = 1 + (guildBonuses(state, "drove").speed || 0);
  state.drove.pens[i] = { animal: animalId, left: a.time / speed, ready: false, collected: 0, pending: 0, cyclesReady: 0, fed: false };
  return null;
}

export function feedPen(state, i) {
  const p = state.drove.pens[i];
  if (!p) return "Empty pen.";
  if (p.fed) return "Already fed this cycle.";
  if (!takeItem(state, "fodder", 1)) return "Need pen fodder (stall or shop).";
  p.fed = true;
  log(state, `Fed ${CONTENT.animals.find((x) => x.id === p.animal)?.name || "pen"}. Next collect pays more.`);
  return null;
}

export function buyPillar(state, catId, optId) {
  const cat = CONTENT.coursePillars.find((c) => c.id === catId);
  const opt = cat?.options.find((o) => o.id === optId);
  if (!opt) return "Unknown pillar.";
  if (state.course.built?.[catId] === optId) {
    state.course.chosen[catId] = optId;
    return null;
  }
  const cost = opt.cost || 40;
  if (!takeItem(state, "coins", cost)) return `Need ${cost} veilmarks to build ${opt.name}.`;
  state.course.built = state.course.built || {};
  state.course.built[catId] = optId;
  state.course.chosen[catId] = optId;
  log(state, `Built ${cat.name}: ${opt.name} (−${cost} veilmarks).`);
  return null;
}

export function spendChartRank(state, rankId) {
  const r = (CONTENT.chartRanks || []).find((x) => x.id === rankId);
  if (!r) return "Unknown dust rank.";
  const have = (state.chart.ranks?.[rankId] || 0);
  if (have >= 8) return "That rank is capped.";
  if (!takeItem(state, "stardust", r.cost)) return `Need ${r.cost} stardust.`;
  state.chart.ranks = state.chart.ranks || {};
  state.chart.ranks[rankId] = have + 1;
  log(state, `Spent ${r.cost} stardust on ${r.name} (rank ${have + 1}).`);
  return null;
}

export function openPouch(state) {
  if (!takeItem(state, "seed-pouch", 1)) return "No seed pouch.";
  const seeds = Object.values(CONTENT.items).filter((it) => it.category === "seed");
  const lvl = skillLevel(state, "timber");
  const capT = Math.max(0, Math.floor(lvl / 8));
  let pool = seeds.filter((it) => (it.tier || 0) <= capT);
  if (!pool.length) pool = seeds;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return "The pouch was empty.";
  stashItem(state, pick.id, 1, "pouch");
  log(state, `Opened a seed pouch: ${pick.name}.`);
  return null;
}

export function sellItems(state, id, qty, opts = {}) {
  const it = CONTENT.items[id];
  const have = bankCount(state, id);
  const n = qty === "all" ? have : Math.max(1, Math.min(have, qty | 0));
  if (!it || n <= 0) return "Nothing to sell.";
  takeItem(state, id, n);
  const rate = opts.rate != null ? opts.rate : (state.rules?.mode === "iron" ? 0.4 : vaultFenceRate(it));
  const gp = Math.max(1, Math.floor((it.value || 1) * rate * n));
  addItem(state, "coins", gp);
  log(state, `${opts.quay ? "Quay pawned" : "Sold"} ${it.name} ×${n} for ${gp} veilmarks.`);
  return null;
}

export function fulfillCommission(state, id) {
  const job = quayCommissions().find((j) => j.id === id);
  if (!job) return "That indenture has sailed.";
  if (state.shopBought?.[job.id]) return "Already delivered this dusk.";
  if ((state.bank[job.need.item] || 0) < job.need.qty) {
    return `Need ${job.need.qty} ${CONTENT.items[job.need.item]?.name || job.need.item}.`;
  }
  if ((state.coins || 0) < job.cost) return `Need ${job.cost} veilmarks to underwrite.`;
  takeItem(state, job.need.item, job.need.qty);
  takeItem(state, "coins", job.cost);
  addItem(state, "coins", job.pay);
  state.shopBought[job.id] = 1;
  log(state, `Delivered ${job.name}: −${job.cost} underwrite, +${job.pay} purse.`);
  return null;
}

export function checkpointCost(state, actionId) {
  const act = CONTENT.actions[actionId];
  if (!act) return 0;
  const n = state.skills[act.skill]?.checkpoints?.[act.masteryId] || 0;
  return 20 + n * 18;
}

export function spendCheckpoint(state, actionId) {
  const act = CONTENT.actions[actionId];
  if (!act) return "Unknown action.";
  const sk = state.skills[act.skill];
  const cost = checkpointCost(state, actionId);
  if ((sk.pool || 0) < cost) return `Need ${cost} pool (have ${sk.pool || 0}). Save it, or train this node more.`;
  sk.pool -= cost;
  sk.checkpoints = sk.checkpoints || {};
  sk.checkpoints[act.masteryId] = (sk.checkpoints[act.masteryId] || 0) + 1;
  log(state, `Checkpoint ${act.name} ×${sk.checkpoints[act.masteryId]} (−${cost} pool). This grove is now faster than the ones you skipped.`);
  return null;
}

export function offlineCapMs(state) {
  const hours = Math.max(18, Math.min(24, state.offlineHours || (state.shopBought?.["shop-offline"] ? 24 : 18)));
  return hours * 3600000;
}

function resolveOfflineHunt(state, ms) {
  let left = ms;
  let steps = 0;
  while (left > 0 && state.combat.fighting && steps++ < 400000) {
    const now = state.now || 0;
    const candidates = [now + 80, state.combat.nextHitAt || now, state.combat.enemyNextAt || now];
    if (state.combat.nextBleedAt) candidates.push(state.combat.nextBleedAt);
    if (state.combat.nextPoisonAt) candidates.push(state.combat.nextPoisonAt);
    const next = Math.min(...candidates.filter((t) => t >= now));
    const dt = Math.min(left, Math.max(50, (next - now) || 50));
    state.now = now + dt;
    combatTick(state, dt);
    left -= dt;
  }
  return left;
}

function grantOfflineBatch(state, act, n) {
  const capN = Math.min(Math.max(0, n), 400000);
  let done = 0;
  for (let i = 0; i < capN; i++) {
    if (!state.action || state.action.id !== act.id) break;
    completeAction(state, act);
    restartAction(state, act);
    done += 1;
    if (!state.action) break;
  }
  return done;
}

function restartAction(state, act) {
  if (!state.action || state.action.id !== act.id) return;
  if (act.inputs) {
    for (const inp of act.inputs) {
      if (bankCount(state, inp.item) < inp.qty) {
        log(state, `Halted ${act.name}: missing ingredients.`);
        state.action = null;
        return;
      }
    }
  }
  state.action.progress = 0;
  state.action.duration = actionDuration(state, act);
}

export function applyOffline(state, ms) {
  const cap = offlineCapMs(state);
  const cb = courseBonuses(state);
  const sim = Math.min(Math.max(0, ms), cap) * (1 + (cb.offlineMul || 0));
  if (sim <= 0) return;
  state.lastSave = Date.now();
  const beforeActs = state.stats.actions || 0;
  const beforeCounts = { ...(state.actionCounts || {}) };
  state._offlineSim = true;
  state.stats.offlineMs += sim;
  const saved = state.settings.tickScale;
  state.settings.tickScale = 1;
  const hunting = !!state.combat.fighting;
  const killsBefore = state.stats.kills || 0;
  const deathsBefore = state.stats.deaths || 0;
  const foodBefore = bankCount(state, state.combat.foodId) + bankCount(state, state.combat.foodId2);
  if (hunting) resolveOfflineHunt(state, sim);

  tickPlots(state, sim);
  tickDrove(state, sim);

  let left = hunting ? 0 : sim;
  let steps = 0;
  let truncated = false;
  while (left > 0 && state.action && steps++ < 80000) {
    const act = CONTENT.actions[state.action.id];
    if (!act) {
      state.action = null;
      break;
    }
    const now = state.now || 0;
    if (act.skill === "whisper" && now < (state.combat.stunUntil || 0)) {
      const wait = Math.min(left, state.combat.stunUntil - now);
      state.now = now + wait;
      left -= wait;
      continue;
    }
    const dur = Math.max(1, actionDuration(state, act));
    state.action.duration = dur;
    const need = Math.max(1, dur - (state.action.progress || 0));
    if (need > left) {
      state.action.progress = (state.action.progress || 0) + left;
      state.now = now + left;
      left = 0;
      break;
    }
    state.action.progress = (state.action.progress || 0) + need;
    state.now = now + need;
    left -= need;
    completeAction(state, act);
    restartAction(state, act);
  }
  if (steps >= 80000 && left > 0 && state.action) {
    truncated = true;
    const act = CONTENT.actions[state.action.id];
    if (act) {
      const dur = Math.max(1, actionDuration(state, act));
      const n = Math.floor(left / dur);
      if (n > 0) {
        const done = grantOfflineBatch(state, act, n);
        left -= done * dur;
      }
      if (left > 0 && state.action) {
        state.action.progress = (state.action.progress || 0) + left;
        state.now = (state.now || 0) + left;
        left = 0;
      }
    }
  }
  if (left > 0) state.now = (state.now || 0) + left;

  state.settings.tickScale = saved;
  state._offlineSim = false;
  const mins = Math.round(sim / 60000);
  const topJob = Object.entries(state.actionCounts || {}).sort((a, b) => (b[1] - (beforeCounts[a[0]] || 0)) - (a[1] - (beforeCounts[b[0]] || 0)))[0];
  const jobDelta = topJob ? (topJob[1] - (beforeCounts[topJob[0]] || 0)) : 0;
  const harvestNow = (state.soil?.plots || []).filter((p) => p?.ready).length;
  const droveNow = (state.drove?.pens || []).filter((p) => p?.ready).length;
  const huntKills = (state.stats.kills || 0) - killsBefore;
  const huntDied = (state.stats.deaths || 0) > deathsBefore || (hunting && !state.combat.fighting);
  const foodUsed = foodBefore - (bankCount(state, state.combat.foodId) + bankCount(state, state.combat.foodId2));
  state.lastOffline = {
    minutes: mins,
    actions: (state.stats.actions || 0) - beforeActs,
    job: topJob && jobDelta > 0 ? `${CONTENT.actions[topJob[0]]?.name || topJob[0]} ×${jobDelta}` : (hunting ? `hunt ×${huntKills}` : "no committed job"),
    plotsReady: harvestNow,
    pensReady: droveNow,
    huntPaused: hunting && huntDied,
    kills: huntKills,
    foodUsed: Math.max(0, foodUsed),
    truncated,
    halt: state._haltReason || null,
    t: Date.now()
  };
  const huntNote = hunting ? (huntDied ? " Hunt ended on death." : ` Hunt resolved · ${huntKills} kills.`) : "";
  const truncNote = truncated ? " Remainder settled in bulk." : "";
  log(state, `Offline report: ${mins} min · ${state.lastOffline.actions} actions · ${state.lastOffline.job}.${huntNote}${truncNote}`);
  if (mins > 0) state._dawn = true;
}

export { startFight, stopFight, playerInterval, masteryLevel };
