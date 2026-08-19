import { SKILLS } from "../content/catalog.js";
import { createState, CONTENT as C } from "../engine/state.js";
import { startAction, tick } from "../engine/sim.js";
import { startFight } from "../engine/combat.js";

const s = createState();
const err = startAction(s, "timber-0");
if (err) throw new Error(err);
for (let i = 0; i < 2000; i++) tick(s, 50);
if ((s.actionCounts["timber-0"] || 0) < 5) throw new Error("timber too slow: " + s.actionCounts["timber-0"]);
const ferr = startFight(s, Object.keys(C.monsters)[0]);
if (ferr) throw new Error(ferr);
for (let i = 0; i < 4000; i++) tick(s, 50);
console.log(JSON.stringify({
  items: Object.keys(C.items).length,
  actions: Object.keys(C.actions).length,
  monsters: Object.keys(C.monsters).length,
  skills: SKILLS.length,
  timber: s.actionCounts["timber-0"],
  timberLv: s.skills.timber.level,
  kills: s.stats.kills,
  hp: s.combat.hp,
  quests: s.quests.done
}, null, 2));
