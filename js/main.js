import { createState, load, save, exportSave, importSave, CONTENT, recalcHp } from "./engine/state.js";
import { tick, applyOffline, stopAction } from "./engine/sim.js";
import { bindUI, renderShell, renderTop, renderRight } from "./ui/shell.js";
import { createWorld } from "./scene/world.js";
import { skillSelect } from "./ui/shell.js";

const canvas = document.getElementById("view");
const world = createWorld(canvas);
let state = load() || createState();
if (load()) {
  const gone = Date.now() - (state.lastSave || Date.now());
  if (gone > 8000) applyOffline(state, gone);
}
recalcHp(state);
if (state.combat.hp <= 0) state.combat.hp = state.combat.maxHp;

const ctx = {
  state,
  root: document.getElementById("app"),
  exportSave: () => exportSave(state),
  importSave: (s) => {
    state = importSave(s);
    ctx.state = state;
    renderShell(ctx);
  },
  wipe: () => {
    localStorage.removeItem("veilforge-save-v1");
    state = createState();
    ctx.state = state;
    recalcHp(state);
    renderShell(ctx);
  },
  render: () => renderShell(ctx)
};

bindUI(ctx);
renderShell(ctx);

let last = performance.now();
let uiAcc = 0;
function loop(now) {
  const dt = Math.min(250, now - last);
  last = now;
  try {
    tick(state, dt);
    uiAcc += dt;
    renderTop(ctx);
    world.frame(state, skillSelect());
    if (uiAcc > 500) {
      uiAcc = 0;
      renderRight(ctx);
    }
  } catch (err) {
    console.error("Veilforge tick", err);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

setInterval(() => save(state), 4000);
window.addEventListener("beforeunload", () => save(state));

document.getElementById("stop-all")?.addEventListener("click", () => {
  stopAction(state);
  ctx.render();
});

document.getElementById("scale")?.addEventListener("change", (e) => {
  state.settings.tickScale = +e.target.value;
});

console.info("Veilforge", Object.keys(CONTENT.items).length, "items", Object.keys(CONTENT.monsters).length, "monsters");
