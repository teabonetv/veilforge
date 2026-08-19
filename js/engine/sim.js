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
  if (act.inputs) {
    for (const inp of act.inputs) {
      if (bankCount(state, inp.item) < inp.qty) return `Need ${inp.qty} ${CONTENT.items[inp.item]?.name || inp.item}.`;
    }
  }
  if (state.combat.fighting && act.skill !== "course") stopFight(state);
  state.action = { id: actionId, skill: act.skill, started: performance.now(), progress: 0, duration: actionDuration(state, act) };
  return null;
}

export function stopAction(state) {
  state.action = null;
}

export function actionDuration(state, act) {
  let t = act.time;
  if (act.skill === "course") t = 4000 * courseBonuses(state).time;
  const mb = masteryBonus(state, act.masteryId);
  const gb = guildBonuses(state, act.skill);
  const cb = courseBonuses(state);
  const ch = chartBonuses(state);
  const pot = potionStats(state);
  const tool = toolSpeed(state, act.skill);
  const speed = 1 + mb.speed + gb.speed + cb.skillSpeed + (ch.speed || 0) + tool + ((pot.speedMul || 1) - 1);
  return Math.max(280, t / speed);
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
  state.action.progress += ms;
  const dur = state.action.duration || actionDuration(state, act);
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

function grantSkillBits(state, act, xpMul) {
  const gb = guildBonuses(state, act.skill);
  const cb = courseBonuses(state);
  const ch = chartBonuses(state);
  const pet = petBonuses(state, act.skill);
  const mul = 1 + (gb.xp || 0) + (cb.allXp || 0) + (cb.xpMul || 0) + (ch.allXp || 0) + (ch.xp || 0) + pet.xp;
  const notes = addXp(state, act.skill, act.xp * mul * xpMul);
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
  if (Math.random() < npc.stun) {
    state.combat.stunUntil = (state.now || 0) + npc.stunMs;
    state.action = null;
    log(state, `${npc.name} caught you. Stunned.`);
    grantSkillBits(state, act, 0.15);
    return;
  }
  for (const l of npc.loot) {
    if (Math.random() < l.chance) addItem(state, l.item, l.min + Math.floor(Math.random() * (l.max - l.min + 1)));
  }
  grantSkillBits(state, act, 1);
  rollPet(state, "whisper");
}

function completeLap(state, act) {
  const chosen = Object.keys(state.course.chosen).filter((k) => state.course.chosen[k]);
  if (chosen.length < 1) {
    log(state, "Choose pillars before running the course.");
    return;
  }
  const xp = 16 + chosen.length * 8 + skillLevel(state, "course");
  act.xp = xp;
  grantSkillBits(state, act, 1);
  state.quests.stats.laps += 1;
  if (Math.random() < 0.04) addItem(state, "coins", 12 + chosen.length * 8);
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
  state.soil.plots.forEach((p, i) => {
    if (!p) return;
    p.left -= ms;
    if (p.left <= 0) p.ready = true;
  });
}

function tickDrove(state, ms) {
  state.drove.pens.forEach((p) => {
    if (!p) return;
    p.left -= ms;
    if (p.left <= 0) p.ready = true;
  });
}

export function harvestPlot(state, i) {
  const p = state.soil.plots[i];
  if (!p?.ready) return;
  const crop = CONTENT.crops.find((c) => c.seed === p.seed);
  if (!crop) return;
  addItem(state, crop.herb, 1 + (Math.random() < 0.2 ? 1 : 0));
  if (Math.random() < 0.15) addItem(state, crop.seed, 1);
  state.soil.plots[i] = null;
  state.quests.stats.harvests += 1;
  addXp(state, "soil", 10 + crop.t * 8);
  state.skills.soil.actions += 1;
  state.skills.soil.guildProgress += 1;
  checkQuests(state);
}

export function plantPlot(state, i, seed) {
  if (state.soil.plots[i]) return "Plot occupied.";
  const crop = CONTENT.crops.find((c) => c.seed === seed);
  if (!crop) return "Not a seed.";
  if (skillLevel(state, "soil") < crop.req) return `Soil ${crop.req} required.`;
  if (!takeItem(state, seed, 1)) return "No seed.";
  state.soil.plots[i] = { seed, left: crop.growMs / (1 + guildBonuses(state, "soil").speed), ready: false };
  return null;
}

export function collectPen(state, i) {
  const p = state.drove.pens[i];
  if (!p?.ready) return;
  const a = CONTENT.animals.find((x) => x.id === p.animal);
  addItem(state, a.produce, a.qty);
  if (a.rare && Math.random() < a.rare.chance) addItem(state, a.rare.item, 1);
  p.left = a.time;
  p.ready = false;
  p.collected = (p.collected || 0) + 1;
  state.quests.stats.drove[a.id] = (state.quests.stats.drove[a.id] || 0) + 1;
  addXp(state, "drove", a.xp);
  state.skills.drove.actions += 1;
  state.skills.drove.guildProgress += 1;
  checkQuests(state);
}

export function stockPen(state, i, animalId) {
  const a = CONTENT.animals.find((x) => x.id === animalId);
  if (!a) return "Unknown beast.";
  if (skillLevel(state, "drove") < a.level) return `Drove ${a.level} required.`;
  const cost = 20 + a.level * 4;
  if (!takeItem(state, "coins", cost)) return `Need ${cost} veilmarks.`;
  state.drove.pens[i] = { animal: animalId, left: a.time, ready: false, collected: 0 };
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
