import {
  CONTENT, TICK_MS, skillLevel, addXp, addItem, takeItem, bankCount, log,
  masteryBonus, guildBonuses, courseBonuses, chartBonuses, potionStats, petBonuses,
  recalcHp, sumGear, masteryLevel
} from "./state.js";
import { combatTick, startFight, stopFight, playerInterval, consumePotionCharge } from "./combat.js";
import { checkQuests } from "./quests.js";

export function startAction(state, actionId) {
  const act = CONTENT.actions[actionId];
  if (!act) return "Unknown action.";
  if (skillLevel(state, act.skill) < act.level) return `Requires ${act.skill} ${act.level}.`;
  if (act.skill === "course" && act.id === "course-lap") {
    const chosen = Object.keys(state.course?.chosen || {}).filter((k) => state.course.chosen[k]);
    if (chosen.length < 1) return "Choose pillars before running the course.";
  }
  if (act.inputs) {
    for (const inp of act.inputs) {
      if (bankCount(state, inp.item) < inp.qty) return `Need ${inp.qty} ${CONTENT.items[inp.item]?.name || inp.item}.`;
    }
  }
  if (state.combat.fighting && act.skill !== "course") stopFight(state);
  state.action = { id: actionId, skill: act.skill, started: state.now || 0, progress: 0, duration: actionDuration(state, act) };
  return null;
}

export function stopAction(state) {
  state.action = null;
}

export function actionDuration(state, act) {
  let t = act.time;
  const mb = masteryBonus(state, act.masteryId);
  const gb = guildBonuses(state, act.skill);
  const cb = courseBonuses(state);
  const ch = chartBonuses(state);
  const pot = potionStats(state);
  const tool = toolSpeed(state, act.skill);
  if (act.skill === "course") {
    t = (act.time || 4000) * (cb.time || 1);
    const speed = 1 + mb.speed + gb.speed + ((pot.speedMul || 1) - 1);
    return Math.max(480, t / speed);
  }
  if (act.skill === "chart" && act.id?.startsWith("chart-study-")) {
    const starId = act.id.slice("chart-study-".length);
    const slotted = isStarSlotted(state, starId);
    t = (act.time || 8000) * (slotted ? 0.72 : 1.08);
  }
  const speed = 1 + mb.speed + gb.speed + cb.skillSpeed + (ch.speed || 0) + tool + ((pot.speedMul || 1) - 1);
  return Math.max(280, t / speed);
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
  while (state._acc >= TICK_MS && safety++ < 40) {
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
    completeAction(state, act);
    if (state.action && state.action.id === act.id) {
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
  }
}

function completeAction(state, act) {
  if (act.npc) return completeThieve(state, act);
  if (act.id === "course-lap") return completeLap(state, act);
  if (act.id?.startsWith("chart-study-")) return completeChartStudy(state, act);

  if (act.inputs) {
    const ch = chartBonuses(state);
    const mb = masteryBonus(state, act.masteryId);
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
      addItem(state, act.burn.item, 1);
      grantSkillBits(state, act, 0.25);
      log(state, `Burned a ${act.name}.`);
      return;
    }
  }

  const outMul = 1 + (masteryBonus(state, act.masteryId).output || 0) + (guildBonuses(state, act.skill).output || 0) + (courseBonuses(state).outputMul || 0) + (chartBonuses(state).output || 0);
  if (act.outputs) {
    for (const o of act.outputs) {
      const n = Math.round((o.min + Math.floor(Math.random() * (o.max - o.min + 1))) * outMul);
      addItem(state, o.item, n);
    }
  }
  if (act.rare) {
    const rareMul = 1 + (masteryBonus(state, act.masteryId).rare || 0) + (guildBonuses(state, act.skill).rare || 0) + (courseBonuses(state).rareMul || 0) + (chartBonuses(state).rare || 0) + (potionStats(state).rareMul ? potionStats(state).rareMul - 1 : 0) + petBonuses(state, act.skill).rare;
    for (const r of act.rare) {
      if (Math.random() < r.chance * rareMul) {
        addItem(state, r.item, r.min || 1);
        log(state, `Rare: ${CONTENT.items[r.item]?.name || r.item}`);
      }
    }
  }
  grantSkillBits(state, act, 1);
  rollPet(state, act.skill);
  consumePotionCharge(state);
}

function grantSkillBits(state, act, xpMul, xpOverride) {
  const gb = guildBonuses(state, act.skill);
  const cb = courseBonuses(state);
  const ch = chartBonuses(state);
  const pet = petBonuses(state, act.skill);
  let mul = 1 + (gb.xp || 0) + (cb.allXp || 0) + (cb.xpMul || 0) + (ch.allXp || 0) + (ch.xp || 0) + pet.xp;
  if (act.skill === "chart") mul += cb.chartXp || 0;
  const baseXp = xpOverride != null ? xpOverride : act.xp;
  const notes = addXp(state, act.skill, baseXp * mul * xpMul);
  const sk = state.skills[act.skill];
  sk.actions += 1;
  state.actionCounts = state.actionCounts || {};
  state.actionCounts[act.id] = (state.actionCounts[act.id] || 0) + 1;
  sk.mastery[act.masteryId] = (sk.mastery[act.masteryId] || 0) + 4 * (1 + (cb.masteryMul || 0));
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
  checkQuests(state);
}

function completeThieve(state, act) {
  const npc = act.npc;
  const w = state.whisper || (state.whisper = { heat: 0, streak: 0 });
  const lvl = skillLevel(state, "whisper");
  const heat = w.heat || 0;
  const stunChance = Math.min(0.72, npc.stun + heat * 0.035 - Math.max(0, lvl - npc.level) * 0.004);
  if (Math.random() < stunChance) {
    w.heat = Math.min(14, heat + 1);
    w.streak = 0;
    const lock = Math.round(npc.stunMs * (1 + w.heat * 0.1));
    state.combat.stunUntil = (state.now || 0) + lock;
    if (state.action) state.action.progress = 0;
    const scraps = 1 + Math.floor(Math.random() * (2 + Math.min(6, npc.level / 20)));
    addItem(state, "coins", scraps);
    grantSkillBits(state, act, 0.22);
    log(state, `${npc.name} caught you. Stunned ${Math.round(lock / 1000)}s · heat ${w.heat}. Scrap ${scraps} veilmarks.`);
    return;
  }
  w.heat = Math.max(0, heat - 1);
  w.streak = (w.streak || 0) + 1;
  const luck = w.streak >= 8 && Math.random() < 0.12;
  const spike = luck ? 3 + Math.floor(Math.random() * 4) : (w.streak >= 4 && Math.random() < 0.18 ? 2 : 1);
  for (const l of npc.loot) {
    if (Math.random() >= l.chance) continue;
    let n = l.min + Math.floor(Math.random() * (l.max - l.min + 1));
    if (l.item === "coins") n = Math.max(1, Math.round(n * spike * (1 + w.streak * 0.03)));
    addItem(state, l.item, n);
    if (l.item === "coins" && spike > 1) log(state, luck ? `Jackpot steal ×${spike} (${n} veilmarks).` : `Clean lift ×${spike}.`);
  }
  grantSkillBits(state, act, 1);
  rollPet(state, "whisper");
}

function completeLap(state, act) {
  const chosen = Object.keys(state.course.chosen || {}).filter((k) => state.course.chosen[k]);
  if (chosen.length < 1) {
    log(state, "Choose pillars before running the course.");
    state.action = null;
    return;
  }
  const cb = courseBonuses(state);
  const timeMul = cb.time || 1;
  const lvl = skillLevel(state, "course");
  const xp = (18 + chosen.length * 10 + lvl * 0.45) * timeMul;
  grantSkillBits(state, act, 1, xp);
  state.quests.stats.laps += 1;
  const marks = Math.max(1, Math.round((3 + chosen.length * 4) * timeMul));
  addItem(state, "coins", marks);
  if (timeMul >= 1.2 && Math.random() < 0.12) {
    addItem(state, "coins", 18 + chosen.length * 10);
    log(state, "Greedy circuit paid a purse.");
  }
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
  grantSkillBits(state, act, xpMul);
  if (slotted) {
    log(state, `Slotted study: ${star?.name || starId} insight ${n}. Live bonus armed.`);
  } else {
    log(state, `Filed ${star?.name || starId} (${n}). Slot it to spend the bonus.`);
  }
  rollPet(state, "chart");
}

function rollPet(state, skill) {
  const pet = CONTENT.pets.find((p) => p.skill === skill);
  if (!pet || state.pets[pet.id]) return;
  const luck = 1 + (chartBonuses(state).rare || 0);
  if (Math.random() < pet.chance * luck) {
    state.pets[pet.id] = true;
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
    const maxCycles = Math.max(12, Math.floor((8 * 3600000) / a.time));
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
  const qty = Math.max(1, Math.round((2 + Math.floor(crop.t / 3) + extra + (Math.random() < 0.35 ? 1 : 0)) * outMul));
  addItem(state, crop.herb, qty);
  const seedChance = Math.min(0.82, 0.38 + lvl * 0.004 + crop.t * 0.012);
  let seeds = 0;
  if (Math.random() < seedChance) seeds += 1;
  if (Math.random() < seedChance * 0.35) seeds += 1;
  if (seeds) addItem(state, crop.seed, seeds);
  if (crop.log && Math.random() < 0.08 + crop.t * 0.006) addItem(state, crop.log, 1);
  state.soil.plots[i] = null;
  state.quests.stats.harvests += 1;
  const act = { id: `soil-${crop.seed}`, skill: "soil", xp: 22 + crop.t * 16, masteryId: `soil-${crop.t}` };
  grantSkillBits(state, act, 1, act.xp * (1 + qty * 0.12));
  log(state, `Harvest ${CONTENT.items[crop.herb]?.name || crop.herb} ×${qty}${seeds ? ` · seeds ×${seeds}` : ""}${extra ? " · extra ripe" : ""}.`);
  checkQuests(state);
}

export function plantPlot(state, i, seed) {
  if (state.soil.plots[i]) return "Plot occupied.";
  const crop = CONTENT.crops.find((c) => c.seed === seed);
  if (!crop) return "Not a seed.";
  if (skillLevel(state, "soil") < crop.req) return `Soil ${crop.req} required.`;
  if (!takeItem(state, seed, 1)) return "No seed.";
  const speed = 1 + (guildBonuses(state, "soil").speed || 0);
  state.soil.plots[i] = { seed, left: crop.growMs / speed, ready: false, ripeMs: 0 };
  return null;
}

export function collectPen(state, i) {
  const p = state.drove.pens[i];
  if (!p?.ready) return;
  const a = CONTENT.animals.find((x) => x.id === p.animal);
  if (!a) return;
  const cycles = Math.max(1, p.cyclesReady || 1);
  const outMul = 1 + (guildBonuses(state, "drove").output || 0) + (courseBonuses(state).outputMul || 0) + (chartBonuses(state).output || 0);
  const qty = Math.max(1, Math.round((p.pending || a.qty * cycles) * outMul));
  addItem(state, a.produce, qty);
  let rares = 0;
  if (a.rare) {
    const rolls = Math.min(cycles, 24);
    for (let n = 0; n < rolls; n++) {
      if (Math.random() < a.rare.chance) {
        addItem(state, a.rare.item, 1);
        rares += 1;
      }
    }
  }
  const speed = 1 + (guildBonuses(state, "drove").speed || 0);
  p.left = a.time / speed;
  p.ready = false;
  p.pending = 0;
  p.cyclesReady = 0;
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
  state.drove.pens[i] = { animal: animalId, left: a.time / speed, ready: false, collected: 0, pending: 0, cyclesReady: 0 };
  return null;
}

export function applyOffline(state, ms) {
  const capH = state.shopBought["shop-offline"] ? 24 : 18;
  const cap = capH * 3600000;
  const cb = courseBonuses(state);
  const sim = Math.min(ms, cap) * (1 + (cb.offlineMul || 0));
  state.stats.offlineMs += sim;
  const saved = state.settings.tickScale;
  state.settings.tickScale = 1;
  const chunks = Math.min(12000, Math.floor(sim / 250));
  for (let i = 0; i < chunks; i++) tick(state, 250);
  state.settings.tickScale = saved;
  log(state, `Offline: ${Math.round(sim / 60000)} min resolved.`);
}

export { startFight, stopFight, playerInterval, masteryLevel };
