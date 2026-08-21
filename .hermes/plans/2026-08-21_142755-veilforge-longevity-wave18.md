# VeilForge Longevity Wave (Wave 18) — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Convert VeilForge from a ~200-hour game into an unbounded one by shipping the four longevity machines — an infinite combat ladder, a completion ledger with progression teeth, challenge saves, and mastery milestones — plus the six critic fixes that block them.

**Architecture:** All systems are data-driven off `buildContent()` in `js/content/catalog.js` and simulated in pure engine modules (`js/engine/*.js`) with no DOM access, so every feature lands as: content/data → engine functions → UI render → selftest assertions. The UI is string-template HTML driven by a single delegated click handler (`bindUI`'s `data-act` switch in `js/ui/shell.js`); new surfaces are new `data-act` cases. Persistence is one JSON blob (`veilforge-save-v1`) merged over `createState()` defaults via `deepMerge`, so all new state must be added to `createState()` AND normalized in `normalizeState()` to survive old saves. Verification is `node js/data/selftest.mjs` (deterministic seeded RNG, no deps) plus manual playtest at `python -m http.server 8080`.

**Tech Stack:** Vanilla ES modules, no framework, no build step. Three.js vendored for scene only. Tests: `js/data/selftest.mjs` (extend it; it throws on failure).

---

## Standing rules (apply to EVERY task)

- **Do NOT rewrite Halt.** One job at a time is identity. The Echo pauses the hunt like any other fight; offline combat resolution stops on death. No queues anywhere.
- **Do NOT clone Melvor's gated tutorial.** Nothing in this plan locks content behind sequential completion. The ledger whispers, never gates.
- **Read-only constraint from the review phase is LIFTED for execution**, but commit after every task, small commits, `feat:`/`fix:` prefixes.
- Never break existing saves: every state field gets a default in `createState()` and a guard in `normalizeState()`.

## Current context / assumptions

- Working tree has uncommitted Wave 17 prep (gold goal cards, beat counter, quest copy). **Task 0 commits it first** so this plan builds on a clean base.
- Verified anchors (from review): desk registry `renderDesks` at `js/ui/desks.js:77`; vault lenses at `desks.js:121-143`; inspect panel `renderInspect` at `desks.js:166`; pet chips `desks.js:257`; event switch cases in `shell.js:166-203` (`case "dungeon"`, `case "bounty"`, `case "chart-rank"`); boot/save loop `js/main.js:20-27` (offline on load), `main.js:132-151` (autosave 4s + visibilitychange); burst branch `combat.js:507-510`; die() `_deathSheet` at `combat.js:614/618`; offline sim `sim.js:595-663`; bank-full warn `sim.js:202-213`; food heal formula `catalog.js:165`; heat model `sim.js:261-293`; beat reader `quests.js:5-21`.
- Selftest currently passes: `node js/data/selftest.mjs` → JSON summary + exit 0. It seeds `Math.random` deterministically (line 8), so all new assertions must be written against that same seed.
- The plan assumes Wave 17 items 1–2 (teaching pass, death sheet) may land separately; Task 12 includes the death-sheet data capture because the Echo needs it anyway. If Wave 17 ships it first, skip Task 12's overlap.

## Proposed approach (wave order)

Phase A (stabilize): commit WIP, fix the three absence bugs (burst, bank-full halt, offline combat). Phase B (visibility): Sealed Pages ledger + mastery milestones. Phase C (unbounded): The Echo ladder + bounty chains. Phase D (replay): challenge saves + commissions. Each phase ends green in the selftest and playable in the browser.

---

# PHASE A — Stabilize the floor

### Task 0: Commit the working tree as wave-17-prep

**Objective:** Snapshot the uncommitted teaching-pass work so later diffs are clean.

**Files:** existing modified files only (`css/app.css`, `js/content/catalog.js`, `js/content/imprint.js`, `js/data/selftest.mjs`, `js/engine/quests.js`, `js/ui/shell.js`, untracked `WAVE17.md`).

**Step 1: Run the selftest to confirm the tree is green**

Run: `cd C:/Users/Luke/veilforge && node js/data/selftest.mjs`
Expected: JSON summary, exit code 0.

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: wave17 prep - gold goal cards, beat counter, idle-this-job copy"
```

**Done when:** `git status --short` is empty and selftest passes.

---

### Task 1: Cap burst damage so hour-one cannot one-shot

**Objective:** No monster hit can exceed `maxHp - 1` against characters below Vitality 10; above that, bursts stay scary but survivable at full HP with food.

**Files:**
- Modify: `js/engine/combat.js:507-510` (burst branch inside `enemyHit`)
- Test: `js/data/selftest.mjs`

**Step 1: Write failing test**

Append to `selftest.mjs` before its final output block:

```js
// Burst cannot one-shot a fresh character from full HP.
{
  const s = createState();
  s.equipment.weapon = "drift-saber";
  s.bank["food-0"] = 50;
  startFight(s, Object.values(CONTENT.monsters).find(m => m.special === "burst" && m.area === "Cinder Docks").id);
  let died = false;
  for (let i = 0; i < 4000 && !died; i++) {
    const hpBefore = s.combat.hp;
    if (hpBefore <= 1) { died = true; break; }
    // force enemy swings only
    s.combat.nextHitAt = s.now + 1e9;
    combatTick(s, 3000);
    s.now += 3000;
  }
  if (s.stats.deaths > 0) throw new Error("burst one-shot fresh character: deaths=" + s.stats.deaths);
}
```

Import `combatTick` in the selftest's combat import line.

**Step 2: Run test to verify failure**

Run: `node js/data/selftest.mjs`
Expected: FAIL — "burst one-shot fresh character" (with seed 20260820 the Vault Crab burst lands within 4000 ticks).

**Step 3: Implement minimal fix**

In `enemyHit`, replace the burst multiplier line:

```js
if (m.special === "burst" && Math.random() < (boss ? 0.28 : 0.2)) {
  const cap = skillLevel(state, "vitality") < 10 ? Math.max(1, state.combat.maxHp - 1) : Infinity;
  dmg = Math.floor(dmg * (m.burstMul || 2.35) + (m.maxHit * 0.4));
  dmg = Math.min(dmg, cap);
  specialNotes.push("BURST");
}
```

**Step 4: Run test to verify pass**

Run: `node js/data/selftest.mjs`
Expected: PASS, all prior assertions still green.

**Step 5: Commit**

```bash
git add js/engine/combat.js js/data/selftest.mjs
git commit -m "fix: burst cannot one-shot below vitality 10"
```

**Done when:** selftest green; manual playtest: stand in Cinder Docks on Vault Crab for 3 minutes at level 1, no death from full HP.

---

### Task 2: Halt gather jobs when the vault is full

**Objective:** An input-less action whose output cannot be stashed halts with one clear ledger line instead of running silently all night.

**Files:**
- Modify: `js/engine/sim.js:196-214` (`completeAction` dumped-output branch)
- Test: `js/data/selftest.mjs`

**Step 1: Write failing test**

```js
// Full vault halts a gather job instead of spinning.
{
  const s = createState();
  for (let i = 0; i < 40; i++) addItem(s, "log-" + i % 14, 1); // fill stacks
  while (bankUsed(s) < bankCap(s)) addItem(s, "gem-" + (bankUsed(s) % 8), 1);
  const err = startAction(s, "timber-0");
  if (err) throw new Error("setup: " + err);
  applyOffline(s, 2 * 3600000);
  if (s.action) throw new Error("gather kept running into full vault");
  if (!s.log.some(l => /Halted .*vault/.test(l.msg))) throw new Error("no halt reason logged");
}
```

**Step 2: Run test to verify failure**

Run: `node js/data/selftest.mjs`
Expected: FAIL — "gather kept running into full vault".

**Step 3: Implement**

In `completeAction`, inside `if (dumped)` after the warning log:

```js
if (!act.inputs) {
  log(state, `Halted ${act.name}: vault full. Sell, burn, or cook to make room.`);
  state.action = null;
}
```

(Leave input-crafting behaviour unchanged — it already halts via `restartAction`.)

**Step 4: Run test to verify pass**

Run: `node js/data/selftest.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add js/engine/sim.js js/data/selftest.mjs
git commit -m "fix: gathers halt when vault is full instead of idling into nothing"
```

**Done when:** selftest green; playtest: fill vault, idle Timber, job stops within one action with a named reason.

---

### Task 3: Offline combat resolution with death-stop

**Objective:** While a hunt is committed, `applyOffline` resolves fights sequentially — kills, drops, food consumed — and stops at the first death (keeping the "hunt paused at the last blow" fiction).

**Files:**
- Modify: `js/engine/sim.js:595-663` (`applyOffline`)
- Test: `js/data/selftest.mjs`

**Step 1: Write failing tests**

```js
// Offline hunting kills, eats, and stops on death.
{
  const s = createState();
  s.equipment.weapon = "drift-saber";
  s.bank["food-0"] = 200;
  startFight(s, CONTENT.monsters["cinder-docks-ash-mite"] ? "cinder-docks-ash-mite" : Object.values(CONTENT.monsters).find(m => m.area === "Cinder Docks" && !m.dungeonOnly).id);
  const foodBefore = 200;
  applyOffline(s, 3600000);
  if ((s.stats.kills || 0) < 10) throw new Error("offline hunt resolved too few kills: " + s.stats.kills);
  if (s.bank["food-0"] >= foodBefore) throw new Error("offline hunt ate no food");
  if (s.lastOffline && s.lastOffline.huntPaused && s.lastOffline.kills > 0 && s.combat.fighting) {
    // paused-by-death is valid; just require the report to say which
    if (!s.lastOffline.huntEnd) throw new Error("hunt end not reported");
  }
}
```

**Step 2: Run test to verify failure**

Run: `node js/data/selftest.mjs`
Expected: FAIL — "offline hunt resolved too few kills: 0".

**Step 3: Implement**

In `applyOffline`, replace the `hunting` clock-shift block with a resolution loop (keep `shiftCombatClocks` for stun/dry timers):

```js
const hunting = !!state.combat.fighting;
let huntKills = 0;
let huntEnd = null; // "cleared-area" | "death" | "out-of-food" | "still-fighting"
if (hunting) {
  const stepMs = 500;
  let t = 0;
  while (t < sim) {
    const chunk = Math.min(stepMs, sim - t);
    shiftCombatClocks(state, chunk);
    combatTick(state, chunk);
    state.now += chunk;
    t += chunk;
    if (!state.combat.fighting) { huntEnd = state._deathSheet ? "death" : "stopped"; break; }
    const m = CONTENT.monsters[state.combat.monsterId];
    const foodN = bankCount(state, state.combat.foodId) + bankCount(state, state.combat.foodId2 || "");
    if (m && foodN === 0 && state.combat.hp <= m.maxHit * 3) { huntEnd = "out-of-food"; stopFight(state, "offline"); break; }
  }
  huntKills = (state.stats.kills || 0) - killBefore; // capture killBefore before loop
}
```

Add `kills` and `huntEnd` to `state.lastOffline`. Note: `combatTick` already handles auto-eat, respawn (`kill()` → `startFight(respawn:true)`), and dungeon chaining — do not duplicate that logic. Performance: 1h at 500ms steps = 7200 ticks of cheap math; acceptable. Guard the whole loop behind `steps < 200000`.

**Step 4: Run test to verify pass**

Run: `node js/data/selftest.mjs`
Expected: PASS. Also confirm total runtime stays under ~5s (the seeded RNG makes fights deterministic).

**Step 5: Commit**

```bash
git add js/engine/sim.js js/data/selftest.mjs
git commit -m "feat: offline hunts resolve with food drain and death-stop"
```

**Done when:** selftest green; playtest: commit a fight, close tab 10 minutes, reopen — offline report shows kills and food eaten, or "hunt fell" if it died.

---

# PHASE B — Visibility: the ledger and mastery teeth

### Task 4: Sealed Pages ledger — data layer

**Objective:** One read-only aggregation module computing every completion stat the UI needs.

**Files:**
- Create: `js/engine/ledger.js`
- Test: `js/data/selftest.mjs`

**Step 1: Write failing test**

```js
import { ledgerStats } from "../engine/ledger.js"; // top of file with other imports
// ...
{
  const s = createState();
  s.combat.kills["cinder-docks-ash-mite"] = 3;
  s.pets["pet-timber"] = true;
  const ls = ledgerStats(s);
  if (ls.monsters.seen !== 1 || ls.monsters.total !== Object.keys(CONTENT.monsters).length) throw new Error("monster tally wrong");
  if (ls.pets.owned !== 1 || ls.pets.total !== 22) throw new Error("pet tally wrong");
  if (typeof ls.completionPct !== "number" || ls.completionPct <= 0) throw new Error("completion pct wrong");
}
```

**Step 2: Run test to verify failure**

Run: `node js/data/selftest.mjs`
Expected: FAIL — module not found.

**Step 3: Implement `js/engine/ledger.js`**

```js
import { CONTENT } from "./state.js";

export function ledgerStats(state) {
  const monsters = Object.values(CONTENT.monsters);
  const seen = monsters.filter(m => (state.combat.kills?.[m.id] || 0) > 0);
  const pets = CONTENT.pets.filter(p => state.pets?.[p.id]);
  const dungeons = CONTENT.dungeons.filter(d => (state.combat.dungeonClears || {})[d.id] > 0);
  const quests = CONTENT.quests.filter(q => state.quests.done.includes(q.id));
  const actionsTouched = Object.keys(state.actionCounts || {}).filter(id => CONTENT.actions[id]).length;
  const uniques = collectUniqueIds().filter(id => (state.bank[id] || 0) > 0 || Object.values(state.equipment).includes(id));
  const total = monsters.length + CONTENT.pets.length + CONTENT.dungeons.length + CONTENT.quests.length;
  const have = seen.length + pets.length + dungeons.length + quests.length;
  return {
    monsters: { seen: seen.length, total: monsters.length },
    pets: { owned: pets.length, total: CONTENT.pets.length },
    dungeons: { cleared: dungeons.length, total: CONTENT.dungeons.length },
    quests: { sealed: quests.length, total: CONTENT.quests.length },
    actions: { touched: actionsTouched, total: Object.keys(CONTENT.actions).length },
    uniques: { found: uniques.length, total: collectUniqueIds().length },
    completionPct: Math.round(1000 * have / total) / 10
  };
}

function collectUniqueIds() {
  const ids = new Set();
  for (const m of Object.values(CONTENT.monsters)) if (m.unique) ids.add(m.unique.item);
  for (const d of CONTENT.dungeons) ids.add(d.reward.item);
  return [...ids];
}
```

**Step 4: Run test to verify pass**

Run: `node js/data/selftest.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add js/engine/ledger.js js/data/selftest.mjs
git commit -m "feat: sealed pages ledger data layer"
```

---

### Task 5: Sealed Pages ledger — desk UI

**Objective:** A fifth desk ("Ledger") showing the five tabs (Monsters, Dungeons, Pets, Uniques, Quests) with owned/missing states, drop tables, and hint text for missing entries. Reuses the existing vault lens pattern rather than inventing a surface.

**Files:**
- Modify: `js/ui/desks.js:121-143` (add `"ledger"` lens to the existing lens row — cheaper than a new desk shell)
- Modify: `js/ui/desks.js:166+` (`renderInspect`: add ledger branches)
- Modify: `index.html` if a nav button is needed (follow existing `#desk-nav [data-arg]` pattern at `desks.js:96-102`)
- Test: `js/data/selftest.mjs` (DOM-free parts only)

**Step 1: Write failing test**

```js
// Ledger lens lists all monsters with kill counts and hints for unseen ones.
{
  const s = createState();
  const ls = ledgerStats(s);
  if (ls.uniques.total < 20) throw new Error("unique tracker found too few uniques: " + ls.uniques.total);
}
```

**Step 2: Run to verify current state**

Run: `node js/data/selftest.mjs`
Expected: PASS or FAIL depending on unique count (130 field mobs + 10 bosses ≈ 24 uniques — should pass; adjust threshold if not).

**Step 3: Implement UI**

In `renderVault`'s lens row add `["ledger", "Sealed Pages"]`. New branch:

```js
} else if (vaultLens === "ledger") {
  const sub = vaultCat; // reuse chips as sub-tabs: monsters|dungeons|pets|uniques|quests
  tiles = renderLedgerTiles(ctx, sub);
}
```

`renderLedgerTiles` renders per sub-tab:
- **Monsters:** every monster tile; qty = kill count; unseen ones get dimmed style + name replaced with "???" until Bounty level reveals area (use `skillLevel(state,"bounty") >= m.slayerReq`).
- **Pets:** 22 tiles, owned lit with name, unowned dimmed with hint "Long work at {skill}".
- **Dungeons:** clears count + reward item shown even if never cleared.
- **Uniques:** found items lit; missing show source ("Hunted by {monster}" parsed from `CONTENT.monsters` unique fields).
- **Quests:** sealed vs open, reward preview from `q.reward`.

Header line in `#vault-meta`: `{completionPct}% of the citadel remembered · {pets.owned}/{pets.total} companions`.

Inspect panel: extend `renderInspect` pet branch (already exists at desks.js:204-211) to show drop-rate hint; extend monster branch (186-195) — it already shows drop lines, keep.

**Step 4: Verify in browser**

Run: `python -m http.server 8080` then browse `http://localhost:8080/`, open Vault desk → Sealed Pages lens.
Expected: tabs render, counts match a fresh save (0 everywhere except totals).

**Step 5: Commit**

```bash
git add js/ui/desks.js index.html css/app.css
git commit -m "feat: sealed pages ledger UI in vault desk"
```

**Done when:** playtester can answer "how many pets exist and where does the Timber one come from" in under 15 seconds.

---

### Task 6: Completion rewards — give the ledger teeth

**Objective:** Ledger percentages grant account-wide boons at thresholds, Melvor-style but original flavour: "Citadel Standing."

**Files:**
- Modify: `js/engine/ledger.js` (add `standingRank(state)` returning 0–4)
- Modify: `js/engine/state.js` (add standing bonuses into `courseBonuses`-style global accessor OR a new `standingBonuses(state)`)
- Modify: `js/content/catalog.js` (export `STANDING_TIERS = [{pct:25, allXp:0.02},{pct:50, rare:0.03},{pct:75, speed:0.03},{pct:100, allXp:0.05, rare:0.05}]`)
- Test: `js/data/selftest.mjs`

**Step 1: Write failing test**

```js
import { standingBonuses } from "../engine/state.js";
{
  const s = createState();
  if (Object.keys(standingBonuses(s)).length === 0) throw new Error("standing returns nothing at 0%");
  // force-complete everything quest-wise and check rank climbs
  s.quests.done = CONTENT.quests.map(q => q.id);
  const sb = standingBonuses(s);
  if (!(sb.allXp > 0)) throw new Error("quest completion should move standing");
}
```

**Step 2–4:** Implement `standingBonuses` summing `STANDING_TIERS` where `ledgerStats(state).completionPct >= tier.pct`; wire it into `grantSkillBits`' XP multiplier chain in `sim.js` (one line next to `pet.xp`) and into `rareMul` in `completeAction`. Run selftest → PASS.

**Step 5: Commit**

```bash
git add js/engine/ledger.js js/engine/state.js js/engine/sim.js js/content/catalog.js js/data/selftest.mjs
git commit -m "feat: citadel standing - completion percentage grants account boons"
```

**Done when:** selftest asserts boon application; UI shows standing rank in ledger header.

---

### Task 7: Mastery milestones

**Objective:** Per-action mastery levels 25/50/75/100 unlock named perks (visible in job dock), converting invisible labour into a chase.

**Files:**
- Modify: `js/content/catalog.js` (add `MASTERY_MILESTONES` table: `{25:{label:"Practised", batchBonus:1}, 50:{label:"Seasoned", speed:0.04}, 75:{label:"Master", preserve:0.03}, 100:{label:"Legend", rare:0.05}}`)
- Modify: `js/engine/state.js` `masteryBonus()` (fold milestone bonuses in)
- Modify: `js/ui/shell.js` `renderJobDock` (~line 990) — show milestone label + next threshold
- Test: `js/data/selftest.mjs`

**Step 1: Failing test**

```js
{
  const s = createState();
  s.skills.timber.mastery["timber-0"] = 12 * 49 * 49; // masteryLevel -> 50 exactly per sqrt(xp/12)
  const mb = masteryBonus(s, "timber-0", "timber");
  if (!(mb.speed >= 0.04)) throw new Error("milestone speed missing at mastery 50: " + JSON.stringify(mb));
}
```

**Steps 2–4:** TDD cycle as usual. Milestones stack with existing linear terms (do not replace them).

**Step 5: Commit**

```bash
git add js/content/catalog.js js/engine/state.js js/ui/shell.js js/data/selftest.mjs
git commit -m "feat: mastery milestones with named perks at 25/50/75/100"
```

**Done when:** job dock shows "Seasoned · next: Master at 75" on a grinded node; selftest proves bonus applies.

---

# PHASE C — Unbounded content

### Task 8: The Echo — infinite combat ladder

**Objective:** Endless scaling floors beneath The Last Page. Depth D multiplies monster stats; escalating unique drops; personal depth record saved.

**Files:**
- Modify: `js/content/catalog.js` (after dungeonDefs loop: push one pseudo-dungeon `{id:"the-echo", name:"The Echo", req:118, infinite:true}` + generator function `echoMonster(depth, style)` producing monsters on demand — NOT pre-generated)
- Modify: `js/engine/combat.js` `startFight` (accept generated echo monsters; `opts.echoDepth`), `kill()` (on echo kill: increment `state.combat.echoDepth`, roll echo unique at `max(0.002, 0.06 - depth*0.0005)`, continue to next depth instead of clearing)
- Modify: `js/engine/state.js` (`createState`: `combat.echoDepth: 0, echoBest: 0`; `normalizeState`: defaults)
- Modify: `js/ui/shell.js` `renderAreas` dungeon section — special card for The Echo showing best depth + "Descend" button
- Test: `js/data/selftest.mjs`

**Step 1: Failing test**

```js
{
  const s = createState();
  s.skills.bounty.xp = XP_TABLE[120];
  ["might","vitality"].forEach(k => s.skills[k].xp = XP_TABLE[120]);
  s.equipment.weapon = "veilborn-saber";
  s.bank["food-13"] = 500; s.combat.foodId = "food-13";
  s.bank["dungeon-key"] = 9;
  const err = startDungeon(s, "the-echo");
  if (err) throw new Error("echo entry failed: " + err);
  for (let i = 0; i < 600 && s.combat.fighting; i++) { combatTick(s, 200); s.now += 200; }
  if ((s.combat.echoDepth || 0) < 2) throw new Error("echo did not descend: depth=" + s.combat.echoDepth);
}
```

**Steps 2–4:** TDD. Key design constants (tune once, in catalog.js only):
- Stat scale: `mul = 1.18^depth`; HP additionally `+ 30*depth`.
- Echo uniques: reuse `idify("Echo " + TIER_NAMES[min(13, 2+floor(depth/5))] + "-amulet")` pattern — actually generate NEW items `echo-N` sigils with one random stat +, added to a small static array (12 authored sigils cycling by depth).
- Death behaves exactly like dungeon death (reset to entrance, `_deathSheet` names The Echo + depth).
- **Halt rule respected:** descending is one continuous committed fight; leaving = abandon.

**Step 5: Commit**

```bash
git add js/content/catalog.js js/engine/combat.js js/engine/state.js js/ui/shell.js js/data/selftest.mjs
git commit -m "feat: the echo - infinite descendo ladder with depth records"
```

**Done when:** selftest descends past depth 2; playtest at cap gear reaches depth ~15 before dying; death sheet names depth.

---

### Task 9: Bounty escalation chains

**Objective:** Chain contracts (3 linked hunts ending in an elite variant) paying exclusive token-shop gear.

**Files:**
- Modify: `js/engine/combat.js` `rollBounty` (10% of rolls become chains: pick 3 monsters ascending slayerReq, final gets elite prefix +1.35× stats via wrapper object registered lazily into CONTENT.monsters)
- Modify: `js/content/catalog.js` shop (3 chain-exclusive items: `chain-ring`, `chain-cape`, `chain-relic`, priced 400/900/1600 tokens)
- Modify: `js/ui/shell.js` bounty panel (show chain steps: "II/III")
- Test: `js/data/selftest.mjs`

**Step 1: Failing test**

```js
{
  const s = createState();
  s.skills.bounty.xp = XP_TABLE[60];
  let sawChain = false;
  for (let i = 0; i < 200 && !sawChain; i++) { rollBounty(s, { free: true }); if (s.bounty.chain) sawChain = true; }
  if (!sawChain) throw new Error("no chain contract rolled in 200 tries");
}
```

**Steps 2–4:** TDD. Elite wrapper: `CONTENT.monsters["elite-" + baseId] = {...base, name: "Elite " + base.name, hp: hp*1.35, maxHit: maxHit+2, acc: acc*1.2}` created on first roll (lazy registration keeps initial content size unchanged). Chain completes award `bounty-token ×25` + flag `state.bounty.chainsDone++`.

**Step 5: Commit**

```bash
git add js/engine/combat.js js/content/catalog.js js/ui/shell.js js/data/selftest.mjs
git commit -m "feat: bounty chains with elite closers and token-shop exclusives"
```

**Done when:** selftest rolls a chain within 200 tries; killing through a chain pays 25 tokens.

---

# PHASE D — Replay and economy

### Task 10: Challenge saves

**Objective:** Two new-save rule flags: Hardcore (combat-art death penalty: fighting styles reset to 1 on any combat death) and Wanderer's Path (Quay purchases disabled; sell rate fixed at 40%).

**Files:**
- Modify: `js/engine/state.js` (`createState`: `rules: {mode:"standard"}`, `normalizeState`: preserve rules; `deepMerge` already carries unknown keys — verify `safeMergeKey` allows "rules", extend its allowlist in `js/util/text.js` if not)
- Modify: `js/main.js` wipe flow (offer mode picker on new game: three buttons writing `state.rules.mode`)
- Modify: `js/engine/combat.js` `die()` (hardcore: zero XP in might/mark/weave/guard/vitality via `sk.xp = XP_TABLE[1]`)
- Modify: `js/engine/market.js` + `js/ui/desks.js` stall render (wanderer path: hide Pay buttons, note why)
- Modify: `js/ui/shell.js` header chip showing active mode
- Test: `js/data/selftest.mjs`

**Step 1: Failing test**

```js
{
  const s = createState();
  s.rules.mode = "hardcore";
  s.skills.might.xp = XP_TABLE[40];
  s.combat.fighting = true; s.combat.monsterId = "cinder-docks-ash-mite";
  s.combat.hp = 1;
  enemyHitForTest(s); // or drive combatTick until death
  if (skillLevel(s, "might") !== 1) throw new Error("hardcore did not reset might");
}
```

**Steps 2–4:** TDD. Export/import already serializes whole state — modes survive export free. Wipe flow: `ctx.wipe` gains optional mode param; settings sheet gets the picker.

**Step 5: Commit**

```bash
git add js/engine/state.js js/util/text.js js/main.js js/engine/combat.js js/engine/market.js js/ui/desks.js js/ui/shell.js js/data/selftest.mjs
git commit -m "feat: hardcore and wanderer's path challenge modes"
```

**Done when:** selftest proves both rules bite; a fresh save can be started in each mode and exported/imported intact.

---

### Task 11: Workshop Commissions (economy re-weave)

**Objective:** Rotating high-value crafts demanding outputs from 6+ skills, paying millions — the late coin sink.

**Files:**
- Create: `js/engine/commissions.js` (deterministic daily rotation from date seed: pick 1 of ~12 authored commission templates)
- Modify: `js/content/catalog.js` (commission templates + 2 reward uniques)
- Modify: `js/ui/desks.js` stall render (Commission board section)
- Modify: `js/engine/sim.js` or market.js (`deliverCommission(state)` checking bank contents, consuming, paying)
- Test: `js/data/selftest.mjs`

**Step 1: Failing test**

```js
import { currentCommission, deliverCommission } from "../engine/commissions.js";
{
  const s = createState();
  const c = currentCommission(s, Date.parse("2026-08-21"));
  if (!c || !c.requires?.length >= 6) throw new Error("commission malformed");
  c.requires.forEach(r => addItem(s, r.item, r.qty));
  const coinsBefore = s.coins;
  const err = deliverCommission(s, Date.parse("2026-08-21"));
  if (err) throw new Error("delivery failed: " + err);
  if (s.coins <= coinsBefore) throw new Error("no payment");
}
```

**Steps 2–4:** TDD. Template example: `{name:"Ledger Reliquary", requires:[{item:"bar-11",qty:40},{item:"rune-star",qty:60},{item:"gem-7",qty:12},{item:"herb-9",qty:80},{item:"hide",qty:200},{item:"essence",qty:150}], pays: 250000, unique:"echo-sigil-0"}`. Rotation: `templates[daySeed % templates.length]`. One delivery per day per save (`state.commissions = {lastDay:null, done:0}`).

**Step 5: Commit**

```bash
git add js/engine/commissions.js js/content/catalog.js js/ui/desks.js js/data/selftest.mjs
git commit -m "feat: workshop commissions - daily cross-skill mega-crafts"
```

**Done when:** selftest delivers a commission; Quay board shows today's ask with per-line have/need.

---

### Task 12: Death forensics capture (shared with Wave 17 #2)

**Objective:** Record killer-blow provenance at death time so both the death sheet and Echo records are honest.

**Files:**
- Modify: `js/engine/combat.js` `die()` (extend `_deathSheet` with `{blowType, triEdge, foodRemaining, lastFive: _clog.slice(0,5)}`)
- Modify: `js/ui/shell.js` death-ack rendering (modal card instead of strip button IF Wave 17 hasn't already done it)
- Test: `js/data/selftest.mjs`

**Step 1: Failing test**

```js
{
  const s = createState();
  s.combat.fighting = true;
  s.combat.monsterId = Object.values(CONTENT.monsters).find(m => m.special === "poison").id;
  s.combat.poison = 12; s.combat.hp = 1;
  tickPoisonForTest(s); // or combatTick loop
  if (!s._deathSheet?.blowType) throw new Error("death sheet lacks blow type");
}
```

**Steps 2–4:** TDD. `tickPoison` and `enemyHit` each know their cause — pass a `cause` string into `die(state, cause)`. Default `"hit"`.

**Step 5: Commit**

```bash
git add js/engine/combat.js js/ui/shell.js js/data/selftest.mjs
git commit -m "feat: death forensics - blow type, triangle, larder captured at fall"
```

**Done when:** every selftest death path produces a populated `_deathSheet.blowType`.

---

### Task 13: Whisper heat moves onto the mark

**Objective:** Heat becomes per-NPC with decay; board copy updated to match reality.

**Files:**
- Modify: `js/engine/sim.js` `completeThieve` (heat keyed `state.whisper.heat[npc.id]`, decays 1 per success regardless; global fallback for old saves via normalizeState migration)
- Modify: `js/ui/shell.js` `renderWhisper` (per-mark heat shown on NPC cards)
- Test: `js/data/selftest.mjs`

**Step 1: Failing test**

```js
{
  const s = createState();
  s.whisper.heat = { "dock-beggar": 10 };
  const act = CONTENT.actions["whisper-dock-beggar"];
  for (let i = 0; i < 60; i++) completeThieveIfVisible(s, act); // drive many attempts
  // clerk untouched:
  const clerkStunBase = 0.22; // lantern-clerk
  if ((s.whisper.heat["lantern-clerk"] || 0) > 0) throw new Error("heat leaked across marks");
}
```

**Steps 2–4:** TDD. Migration in `normalizeState`: if `whisper.heat` is a number, wrap as `{legacy: n}` and spread onto all NPCs? No — simplest honest migration: convert number `n` to `{}` and accept the loss (heat resets on update; log one line "The marks have forgotten you."). Keep it simple.

**Step 5: Commit**

```bash
git add js/engine/sim.js js/ui/shell.js js/data/selftest.mjs
git commit -m "fix: whisper heat is per-mark with decay"
```

**Done when:** selftest proves isolation; Whisper board shows heat per NPC.

---

### Task 14: Food economy retune + wave docs

**Objective:** Close the hour-one food math and leave the wave documented.

**Files:**
- Modify: `js/content/catalog.js:165` (`foodHeal = 6 + t*5 + ...` — food-0 heals 6)
- Modify: `progress.json` (wave 18 entry, pieces list, comparison.biggestGap updated)
- Modify: `WAVE17.md` → add `WAVE18.md` summarizing shipped scope
- Test: `js/data/selftest.mjs`

**Step 1: Failing test**

```js
{
  const s = createState();
  s.bank["food-0"] = 24;
  s.equipment.weapon = "drift-saber";
  startFight(s, Object.values(CONTENT.monsters).find(m => m.area === "Cinder Docks" && !m.dungeonOnly && !m.special).id);
  for (let i = 0; i < 600 && s.combat.fighting; i++) { combatTick(s, 300); s.now += 300; }
  if (s.bank["food-0"] <= 0 && s.stats.deaths > 0) throw new Error("post-q-cook larder still loses the marathon");
}
```

**Steps 2–4:** Bump heal, run, verify 24 food sustains ≥10 consecutive early fights in the sim. Update progress.json honestly (status fields per piece; do NOT claim Melvor Idle 2 beaten — house rule).

**Step 5: Commit**

```bash
git add js/content/catalog.js progress.json WAVE18.md js/data/selftest.mjs
git commit -m "balance: food-0 heals 6; wave 18 docs"
```

**Done when:** selftest green end-to-end; `python -m http.server 8080` smoke test of a fresh save touching every new surface (ledger, echo entry, commission board, mode picker) without console errors.

---

## Files likely to change (summary)

| File | Tasks |
|---|---|
| `js/data/selftest.mjs` | all (assertions per task) |
| `js/engine/combat.js` | 1, 3, 8, 9, 10, 12 |
| `js/engine/sim.js` | 2, 3, 6, 13 |
| `js/engine/state.js` | 6, 8, 10 (+normalizeState every new field) |
| `js/engine/ledger.js` (new) | 4, 5, 6 |
| `js/engine/commissions.js` (new) | 11 |
| `js/content/catalog.js` | 6, 7, 8, 9, 11, 14 |
| `js/ui/desks.js` | 5, 10, 11 |
| `js/ui/shell.js` | 7, 8, 9, 10, 12, 13 |
| `js/main.js` | 10 |
| `js/util/text.js` | 10 (safeMergeKey allowlist) |
| `index.html`, `css/app.css` | 5, 10 (nav button, mode chip) |
| `progress.json`, `WAVE18.md` | 14 |

## Tests / validation

- Per-task: extend `js/data/selftest.mjs` FIRST (red), implement (green), commit. Full suite command: `node js/data/selftest.mjs` — must stay under ~10s total by Task 8 (echo loop is the risk; keep step counts bounded).
- Manual smoke per phase: `python -m http.server 8080` → fresh save + imported save both boot; every new surface opens; no console errors; autosave survives reload (check `localStorage["veilforge-save-v1"]` grows).
- Save-compat check: load a PRE-wave save (export one before starting) after each phase — `normalizeState` must not throw and must populate all new fields.

## Risks, tradeoffs, open questions

- **Offline combat perf (Task 3):** worst case 24h × 500ms steps ≈ 173k ticks. Mitigation: adaptive step (500ms while HP > 50%, 100ms below), hard cap 200k iterations, bail to `huntPaused` on overrun. If still slow, resolve analytically (expected kills/min) as fallback — trade simulation purity for speed.
- **Determinism vs fun (Tasks 1, 8):** the seeded selftest makes balance provable but brittle; any rebalance shifts later assertions. Keep assertions threshold-based (`>= N`) not exact-count.
- **Echo power creep (Task 8):** 1.18^depth outruns gear fast; depth ~15–20 should be the natural wall for capped gear. If playtest shows depth 30+, raise to 1.22^depth. Open question: should Echo uniques be BiS or sidegrade? Recommendation: sidegrades with set-synergy (feeds Task 7's set-bonus visibility).
- **Hardcore severity (Task 10):** full art reset may be too brutal; alternative is one-life-per-depth in Echo only. Decide at implementation with a playtest; the flag design supports either.
- **Commission pricing (Task 11):** 250k payout vs <150k lifetime sinks means commissions ARE the sink valve; if inflation appears, add a second daily slot before touching rates.
- **Scope honesty:** this plan deliberately excludes grove dioramas and Chart rerolls (Wave 17 #4/#5 territory) — sequencing those AFTER the longevity machines keeps player-hour ROI highest-first.

## Execution handoff

Plan complete and saved. Ready to execute using subagent-driven-development — I'll dispatch a fresh subagent per task with two-stage review (spec compliance then code quality). Shall I proceed?
