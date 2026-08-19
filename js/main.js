import { createState, load, save, exportSave, importSave, CONTENT, recalcHp } from "./engine/state.js";
import { tick, applyOffline, stopAction } from "./engine/sim.js";
import { bindUI, renderShell, renderTop, renderRight } from "./ui/shell.js";
import { createWorld } from "./scene/world.js";
import { skillSelect } from "./ui/shell.js";
import { desk, inspectModelOf } from "./ui/desks.js";
import { createPortrait } from "./scene/portrait.js";
import { bootPlatform } from "./platform.js";

bootPlatform();

const canvas = document.getElementById("view");
const world = createWorld(canvas);
const vaultPort = createPortrait(document.getElementById("vault-view"));
const wanderPort = createPortrait(document.getElementById("wander-view"));
let inspectKey = "";
let wanderKey = "";
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
  render: () => renderShell(ctx),
  portraits: {
    resize() {
      vaultPort.resize();
      wanderPort.resize();
    },
    sync() {
      if (desk === "bank") {
        const m = inspectModelOf();
        const key = `${m?.kind}:${m?.seed}`;
        if (key !== inspectKey) {
          inspectKey = key;
          vaultPort.showModel(m);
        }
        vaultPort.resize();
        requestAnimationFrame(() => vaultPort.resize());
      }
      if (desk === "loadout") {
        const key = JSON.stringify(state.equipment);
        if (key !== wanderKey) {
          wanderKey = key;
          wanderPort.showWanderer(state.equipment, CONTENT.items);
        }
        wanderPort.resize();
        requestAnimationFrame(() => wanderPort.resize());
      }
    }
  }
};

bindUI(ctx);
renderShell(ctx);

let last = performance.now();
let uiAcc = 0;
function loop(now) {
  const dt = Math.min(250, now - last);
  last = now;
  try {
    if (document.hidden) {
      requestAnimationFrame(loop);
      return;
    }
    tick(state, dt);
    uiAcc += dt;
    renderTop(ctx);
    world.frame(state, skillSelect());
    if (desk === "bank") vaultPort.frame();
    if (desk === "loadout") wanderPort.frame();
    if (uiAcc > 500) {
      uiAcc = 0;
      renderRight(ctx);
    }
    if (state._uiDirty) {
      state._uiDirty = false;
      renderShell(ctx);
    }
  } catch (err) {
    console.error("Veilforge tick", err);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

setInterval(() => save(state), 4000);
window.addEventListener("beforeunload", () => save(state));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    save(state);
    state._hiddenAt = Date.now();
    return;
  }
  const gone = Date.now() - (state._hiddenAt || state.lastSave || Date.now());
  if (gone > 8000) applyOffline(state, gone);
  last = performance.now();
  ctx.render();
});

document.getElementById("stop-all")?.addEventListener("click", () => {
  stopAction(state);
  ctx.render();
});

document.getElementById("scale")?.addEventListener("change", (e) => {
  state.settings.tickScale = +e.target.value;
});

console.info("Veilforge", Object.keys(CONTENT.items).length, "items", Object.keys(CONTENT.monsters).length, "monsters");
