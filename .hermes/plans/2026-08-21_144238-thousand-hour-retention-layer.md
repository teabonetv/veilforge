# VeilForge "Thousand-Hour" Retention Layer — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Convert VeilForge from a well-engineered 200–500 hour game into a multi-thousand-hour retention platform by building the missing goal-delivery systems — completion ledger, achievements, slayer-depth bounty, boss mechanics, visible drop tables, dual training modes, money sinks, daily seeds — on top of the persistence hardening those systems require.

**Architecture:** All new systems ride the existing pure engine (no DOM deps) so the headless selftest keeps covering everything. Persistence gets a save-slot backup + migration ladder + transient-field scrubber BEFORE any feature accumulates player progress. Features are layered: ledger and achievements are aggregation-only (read existing state), bounty/boss/daily changes extend the combat/sim engines in place. UI follows the current string-template + `escapeHtml` discipline inside `shell.js`'s render cycle.

**Tech Stack:** Vanilla ES modules (existing), `node js/data/selftest.mjs` as the test harness (zero dependencies), GitHub Pages / Capacitor / Electron targets unchanged.

---

## Current Context & Assumptions

- Repo: `C:\Users\Luke\veilforge`, branch `main`, HEAD = d2fbde4. Six files carry uncommitted WAVE17 work (`css/app.css`, `js/content/catalog.js`, `js/content/imprint.js`, `js/data/selftest.mjs`, `js/engine/quests.js`, `js/ui/shell.js`) plus untracked `WAVE17.md`. **Task 0 commits that slice first** so this plan builds on a clean tree.
- Verified numbers: 22 skills, MAX_LEVEL 120, XP curve 13.03M→99 / 104M→120 (RS formula ÷4); content = 453 items, 396 actions (154 anvil, 98 loom, only 14 per gather skill), 130 monsters, 10 dungeons, 22 pets, 20 quests, 76 shop offers; gather nodes: 1 decision every ~8.6 levels.
- Zero hits repo-wide for: prestige, achievements, completion log, drop-table UI, daily/seeded rotation.
- Selftest passes clean today (`EXIT=0`; output pins items=453, actions=396, monsters=130, skills=22). It is throw-on-first-failure with a global seeded `Math.random` patch — the plan keeps using it but adds named-case reporting early so later tasks get full diagnostics.
- Known defects from the adversarial audit that MUST land before dependent features:
  - Offline loop truncates at 80k steps (sim.js:609) → breaks at <1.08 s/action (blocks Task 6's speed modes).
  - Transient `_`-prefixed fields serialized into saves (state.js `save()`) → bloats the ledger-era save format (fix first).
  - `version: 2` badge written unconditionally, no migration switch; one unconditional quest remap (state.js `normalizeState`) → must become a ladder before achievements add new state.
  - Single localStorage slot, no backup (state.js `save/load`) → unacceptable once the save carries ledger/achievement progress.
  - `firstHourBeat()` fallback highlights completed reqs (quests.js diff); render mutates `selectedAction` (shell.js renderActions) — fix during wave-17 commit pass, not later.
- Constraints honored throughout: no new runtime dependencies; web/Electron/Capacitor parity; `sw.js` CACHE string bumped once per release wave (manual, flagged as future automation).

## Wave Order (dependency-driven)

| Wave | Theme | Why this order |
|---|---|---|
| 0 | Hygiene + test-harness upgrade | Everything else needs diagnostics + clean tree |
| 1 | Save resilience + migration ladder + CI | The vault under every later system |
| 2 | Completion ledger | Pure aggregation; immediate player value; foundation for % hooks |
| 3 | Achievements/diaries + visible drop tables | Rides quest engine + ledger |
| 4 | Bounty slayer depth + boss mechanics | Combat engine changes, needs readable deaths first |
| 5 | Training modes + economy sinks | Balance-layer work after goals exist |
| 6 | Daily seed rotation | Uses deterministic RNG pattern from Task 0.4 |

---

# WAVE 0 — Hygiene & Test Harness

### Task 0.1: Commit the in-flight WAVE17 slice

**Objective:** Clean tree before any new work; fold in the two small audit fixes to the same feature.

**Files:**
- Modify: `js/engine/quests.js` (`firstHourBeat`)
- Modify: `js/ui/shell.js:963-965` (`renderActions`)

**Step 1: Fix the goal-beat fallback** — in `quests.js`, change the `open` computation so it never returns a satisfied req:

```js
const open = (q.req || []).find((r) => r.type === "action" && (state.actionCounts?.[r.id] || 0) < r.count) || null;
```

Delete the trailing `|| (q.req || []).find((r) => r.type === "action")`. Replace the hardcoded `qid === "q-blood" ? "might" : null` with a lookup of the first action req's skill via `CONTENT.actions`.

**Step 2: Stop mutating selection during render** — in `shell.js` `renderActions`, delete the line `if (!selectedAction && goalId && ...) selectedAction = goalId;`. The `goal` CSS class + dock hint already carry the feature.

**Step 3: Verify**

Run: `node js/data/selftest.mjs`
Expected: PASS, JSON summary printed, exit 0.

**Step 4: Commit**

```bash
git add css/app.css js/content/catalog.js js/content/imprint.js js/data/selftest.mjs js/engine/quests.js js/ui/shell.js WAVE17.md
git commit -m "feat: first-hour goal beats + wave17 notes; beat fallback and selection purity fixes"
```

### Task 0.2: Named-case selftest runner

**Objective:** One broken assertion reports ALL failures, not just the first.

**Files:**
- Modify: `js/data/selftest.mjs`

**Step 1:** Wrap the entire current top-level script body into `const CASES = []; function test(name, fn) { CASES.push({ name, fn }); }` calls — each logical block becomes one named case (e.g. `"content uniqueness"`, `"offline resolution"`). Keep assertion style identical (`if (!cond) throw`).

**Step 2:** Append the runner:

```js
let failed = 0;
for (const c of CASES) {
  try { c.fn(); } catch (e) { failed++; console.error(`FAIL ${c.name}: ${e.message}`); }
}
if (failed) { console.error(`${failed} case(s) failed`); process.exit(1); }
console.log(JSON.stringify(summaryObject)); // existing final log
```

**Step 3:** Scope the RNG patch — replace the global `Math.random = ...` override with `export const rng = makeRng(20260820)` passed explicitly where needed; restore `Math.random` determinism by seeding through engine functions instead (engine already routes randomness through `Math.random`; introduce `state._rng` defaulting to `Math.random`, used by sim/combat, so tests inject the LCG without touching globals).

**Step 4: Verify**

Run: `node js/data/selftest.mjs`
Expected: PASS with case count printed; then deliberately break one case locally and confirm remaining failures still print (revert).

**Step 5: Commit** — `git commit -am "test: named-case runner, scoped RNG injection"`

### Task 0.3: Dead flag + literal cleanup

**Objective:** Remove audited cruft touching persistence paths.

**Files:**
- Modify: `js/engine/state.js:168` — delete `state.bankFull = true;`
- Modify: `js/main.js:49` — import `SAVE_KEY` from state.js (export it) and use it in `wipe`
- Modify: `package.json` — `"web": "python -m http.server 8080"`

**Step 1:** Apply edits. **Step 2:** `grep -rn bankFull js/` → zero hits. Run selftest → PASS. **Step 3:** Commit — `chore: remove dead bankFull flag, single SAVE_KEY source, portable dev server`

---

# WAVE 1 — Save Resilience, Migration Ladder, CI

### Task 1.1: Save scrubbing — stop serializing transients

**Objective:** Saves contain only durable state.

**Files:**
- Modify: `js/engine/state.js` (`save`, `exportSave`, new helper)

**Step 1: Write failing test** (selftest, new case):

```js
test("save payload excludes transient keys", () => {
  const s = createState();
  startFight(s, Object.keys(C.monsters)[0]);
  s._hiddenAt = Date.now(); s._clog = ["x"]; s._floaters = [{n:1}];
  const roundtrip = JSON.parse(b64ToUtf8(exportSave(s)));
  for (const k of Object.keys(roundtrip)) if (k.startsWith("_")) throw new Error("leaked " + k);
});
```

**Step 2:** Run → FAIL ("leaked _clog"). **Step 3:** Implement in state.js:

```js
const TRANSIENT = /^_|^(lastDrip|lastOffline)$/; // keep lastOffline? NO — see Step 3b
function durable(state) {
  const out = {};
  for (const [k, v] of Object.entries(state)) if (!TRANSIENT.test(k)) out[k] = v;
  return out;
}
```

Then `save()` writes `JSON.stringify(durable(state))` and `exportSave` encodes `durable(state)`. **Decision point:** `lastOffline`/`lastDrip` currently feed the "welcome back" panel after reload — keep `lastOffline` durable (rename allowlist approach: strip `/^_/` + explicit denylist `[_hiddenAt, _uiDirty, lastDrip]`), document choice in a comment.

**Step 4:** Run → PASS. Old saves (which contain `_clog` etc.) still load because `deepMerge(createState(), saved)` tolerates unknown keys; add a case asserting a legacy save with junk underscore keys imports cleanly. **Step 5:** Commit — `fix: persist only durable state; legacy transients tolerated on load`

### Task 1.2: Backup slot + load fallback chain

**Objective:** No single corrupted/truncated write can end a character.

**Files:**
- Modify: `js/engine/state.js` (`save`, `load`; add `SAVE_BAK = "veilforge-save-bak-v1"`)

**Step 1: Failing test cases:** (a) primary key contains garbage JSON, bak contains valid save → `load()` returns the bak state; (b) both corrupt → returns null AND logs to console; (c) healthy load leaves bak untouched from previous tick.

**Step 2:** Implement rotate-on-write:

```js
export function save(state) {
  state.lastSave = Date.now();
  try {
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) localStorage.setItem(SAVE_BAK, prev);
    localStorage.setItem(SAVE_KEY, JSON.stringify(durable(state)));
  } catch (e) { /* module-level _saveFail + console.warn, never serialized */ }
}
```

`load()` tries primary → parse fail → bak → null. On bak recovery, immediately `save()` to re-establish both slots and push a log line: `"Recovered your forge from the ember-backup."`

**Step 3:** Run all cases → PASS. **Step 4:** Commit — `feat: rotating save backup with recovery path`

### Task 1.3: Version migration ladder

**Objective:** Schema changes become ordered, testable rungs.

**Files:**
- Modify: `js/engine/state.js` (`normalizeState` head)

**Step 1: Failing test:** craft `{"version":1,"name":"Old","bank":{"log-0":2}}` → expect version 2, name preserved, quests remap applied exactly once.

**Step 2:** Implement:

```js
const MIGRATIONS = {
  1: (s) => { remapQuestId(s, "whisper-dock-beggar", "q-whisper"); s.version = 2; return s; },
};
function migrate(s) {
  let guard = 10;
  while (MIGRATIONS[s.version] && guard--) s = MIGRATIONS[s.version](s);
  return s;
}
```

`importSave`/`load` call `migrate` before `deepMerge`; move the current unconditional `remapQuestId` call inside migration 1. Future waves append rungs 3+ here — that is the whole point.

**Step 3:** PASS + legacy-save tolerance case. **Step 4:** Commit — `feat: version-gated migration ladder`

### Task 1.4: Content-id reconciliation sweep

**Objective:** Renamed/deleted items can't squat in the bank forever.

**Files:**
- Modify: `js/engine/state.js` (end of `normalizeState`)

**Step 1: Failing test:** state with `bank: {"ghost-item": 1, "log-0": 2}` → post-normalize bank has only log-0; equipment/tools slots referencing unknown ids nulled; orphaned `itemTabs` pruned; a `state.log` entry notes each removal.

**Step 2:** Implement sweep against `CONTENT.items` for bank/itemTabs/equipment/tools (keep `coins` special-case). **Step 3:** PASS. **Step 4:** Commit — `feat: reconcile persisted ids against content on load`

### Task 1.5: CI gate

**Objective:** Nothing merges/ships red.

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1:**

```yaml
name: ci
on: [push, pull_request]
jobs:
  selftest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node js/data/selftest.mjs
```

**Step 2:** Push branch, confirm green run on GitHub. **Step 3:** Commit — `ci: selftest gate on push and PR`

---

# WAVE 2 — Completion Ledger

### Task 2.1: Discovery tracking primitives

**Objective:** First-seen events recorded durably.

**Files:**
- Modify: `js/engine/state.js` — `createState` gains `seen: { items: {}, monsters: {}, dungeons: {}, pets: {} }`; `addItem` marks `seen.items[id]=1`; `combat.js` kill path marks `seen.monsters[m.id]=(n||0)+1`; dungeon clear path marks `seen.dungeons[d.id]=(n||0)+1`.

**Step 1: Failing tests:** fresh state kills Ash Mite → `seen.monsters["ash-mite"]===1`; item grant via `noteGive` marks seen; old save WITHOUT `seen` loads (deepMerge fills `{}`) and gains entries on next actions.

**Step 2–4:** Implement, verify, commit — `feat: durable discovery tracking`

### Task 2.2: Ledger aggregation module

**Objective:** One pure module computing completion percentages.

**Files:**
- Create: `js/engine/ledger.js`
- Test: new selftest cases

**Step 1:** Implement pure functions:

```js
export function ledgerStats(content, seen, state) {
  return {
    items: pct(seen.items, content.items),
    monsters: pct(seen.monsters, content.monsters),
    dungeons: pct(seen.dungeons, content.dungeons),
    pets: pct(state.pets, content.pets),
    actionsMastered: /* mastery >= threshold count over CONTENT.actions */,
    total: weighted overall %
  };
}
```

**Step 2: Failing test:** hand-built seen map → exact expected percentages; empty state → 0% everywhere; maxed synthetic state → 100%. **Step 3–5:** Implement/pass/commit — `feat: ledger aggregation`

### Task 2.3: Ledger desk UI

**Objective:** Players can SEE the percentages.

**Files:**
- Modify: `js/ui/desks.js` (new desk entry), `js/ui/shell.js` (nav button), `css/app.css` (ledger styles)

**Step 1:** Add "Ledger" desk rendering grouped sections (Items / Bestiary / Dungeons / Pets / Mastery bars) with per-row discovered/total and a header overall %. Rows use existing icon markup; unknown entries render as silhouettes with `???.` **Step 2:** Manual verification checklist in browser (`npm run web`): nav appears, counts match selftest numbers, escapeHtml applied to all names. **Step 3:** Commit — `feat: completion ledger desk`

---

# WAVE 3 — Achievements & Drop Tables

### Task 3.1: Achievement table + engine

**Objective:** 100 permanent goals riding the quest req system.

**Files:**
- Create: `js/content/achievements.js` (~100 defs, tiers ×3)
- Create: `js/engine/achievements.js`
- Modify: `js/engine/state.js` — `createState` gains `achv: { claimed: {}, done: {} }`

**Step 1:** Achievement def shape mirrors quest reqs exactly:

```js
{ id: "kill-ash-mite-100", name: "Mite Knight", tier: 2,
  req: [{ type: "kills-monster", id: "ash-mite", count: 100 }],
  reward: { title: "Mite Knight" } }
```

Extend `questProgress`-style evaluator with two new req types: `kills-monster` (reads `seen.monsters`), `stat` (reads `state.stats`). Engine: `checkAchievements(state)` called from the same places `checkQuests` is called; grants titles to `state.titles[]`. **Step 2: Failing tests:** thresholds fire/not-fire at boundaries; claim persists across save/load; unknown achievement id ignored. **Step 3–5:** Implement/pass/commit — `feat: achievement engine + first 100 diaries`

### Task 3.2: Achievement panel + titles

**Objective:** Visible boards, wearable rewards.

**Files:** Modify `js/ui/desks.js` (tab inside Ledger desk), `js/ui/shell.js` (title picker in settings area), `css/app.css`.

Steps: grid of achievement cards (done = gold, hidden-tier shows `???` until adjacent tier done), title selector writes `state.activeTitle`, header renders it. Verify + commit — `feat: achievement board and titles`

### Task 3.3: Drop-table inspector

**Objective:** Exact odds visible everywhere.

**Files:**
- Modify: `js/ui/shell.js` (job dock + bestiary rows), `js/ui/desks.js`

**Step 1:** For actions with `act.rare`: list `item name — 1/X` where X = `1/chance` rounded, adjusted live for the player's current rare-multipliers (mastery/guild/pet shown as "you: 1/Y"). Same for monster rare tables in bestiary. All odds derived from CONTENT, zero duplication. **Step 2:** Spot-check three known rares against source chances; escapeHtml audit. **Step 3:** Commit — `feat: transparent drop tables`

---

# WAVE 4 — Slayer Depth & Boss Mechanics

### Task 4.1: Readable death sheet (WAVE17 #2 — prerequisite)

**Objective:** Every death states why.

**Files:**
- Modify: `js/engine/combat.js` (`die()`), `js/ui/shell.js` (death modal)

**Step 1:** Extend `_deathSheet` (already exists) with structured cause: `{ killingBlow: dmg, style: m.style, triangleEdge, foodRemaining, foodHeal, specWasted }` computed in `die()` before teardown. Render as a 4-line sheet replacing the current dismiss button text. **Step 2:** Kill yourself in test via forced `enemyHit` → assert fields present. **Step 3:** Commit — `feat: structured death report`

### Task 4.2: Bounty ladder

**Objective:** Slayer-shaped treadmill.

**Files:**
- Modify: `js/engine/combat.js` (`rollBounty`), `js/engine/state.js` (`bounty` shape), `js/content/catalog.js` (tier defs)

**Step 1: Design constants (in catalog):** tiers T1 base monsters → T2 elites (area-tagged) → T3 dungeon closers (unlock: 1 clear of owning dungeon). Streak multiplier: +4%/streak capped +40%, resets on skip-without-block-token. Master bounty: weekly-scale (real-time date-seeded), requires T3 token, drops unique cosmetic.

**Step 2: Failing tests:** tier gating by clears/streak; streak math incl. cap; block-list still consumes token; master bounty deterministic per ISO-date seed.

**Step 3–5:** Implement/pass/commit — `feat: bounty tiers, streaks, master contracts`

### Task 4.3: Boss mechanics kit

**Objective:** 15 named closers behave differently.

**Files:**
- Modify: `js/engine/combat.js` (phase hooks), `js/content/catalog.js` (boss defs)

**Step 1:** Add optional `mechanics` array to dungeon-closer monsters:

```js
mechanics: [
  { kind: "shieldPhase", everyMs: 45000, durMs: 8000, dr: 0.6, tell: "raises a veilward" },
  { kind: "summonAdds", atHpFrac: 0.5, addId: "ash-mite", count: 2 },
  { kind: "enrage", atMs: 180000, mult: 1.5 }
]
```

Engine evaluates mechanics in `combatTick` (shield = damage reduction window with combatLog tell; adds = temporary extra enemyNextAt lane hitting player; enrage = interval/mult boost). Cap kit to these THREE kinds — YAGNI. Assign combos to closers in catalog. **Step 2: Failing tests:** shield reduces player dmg during window only; enrage fires once; adds spawn at threshold and clear on boss death; offline (`applyOffline` while hunting) freezes mechanics unchanged (matches existing hunt-pause semantics). **Step 3–5:** Implement/pass/commit — `feat: three-mechanic boss kit + closer assignments`

### Task 4.4: Death-sheet integration for mechanics

Boss kills credit `seen.dungeons`; mechanics tells appear in `_clog`; ledger "closers slain" row wired. Verify + commit — `chore: wire boss telemetry into ledger`

---

# WAVE 5 — Training Modes & Economy

### Task 5.1: Dual training modes per gather skill

**Objective:** A real decision at every node.

**Files:**
- Modify: `js/engine/sim.js` (`startAction` opts, `actionDuration`, yield roll), `js/content/catalog.js` (mode flags per action), `js/ui/shell.js` (dock toggle)

**Prerequisite check FIRST:** Task from audit — offline truncation. Before shipping any mode faster than today's timber, implement analytic tail resolution in `applyOffline` (compute remaining actions when step budget exhausts: `remainingActions = floor(left / duration)`, apply flat yields/xp without drips) + selftest case: mocked 0.8s action, 24h offline → yields within 2% of analytic expectation. Commit separately — `fix: analytic offline tail beyond step budget`.

**Step 1:** Modes: `focused` (×0.85 time, −25% output), `meditative` (×1.3 time, +30% output, halved rare chance), default unchanged. Stored as `state.actionMode` (per-skill map), respected in `actionDuration` + output rolls, serialized (durable), reset-safe on load via normalizeState default.

**Step 2: Failing tests:** duration/output math per mode; mode survives save/load; offline respects active mode.

**Step 3–5:** Implement/pass/commit — `feat: focused/meditative training modes`

### Task 5.2: Money sinks

**Objective:** Late-game marks mean something.

**Files:**
- Modify: `js/content/catalog.js` (shop offers), `js/engine/market.js` (quay specials), `js/ui/desks.js`

**Step 1:** Three sinks, escalating cost curves: (a) cosmetic forge banners/titles (pure prestige, ledger-tracked); (b) bank aesthetics + +2 slot purchases scaling ×1.35/level beyond current cap upgrades; (c) "Endowment" pillars — permanent account-wide micro-buffs (+0.5% xp etc.) with geometric costs (cost_n = 5000 × 1.6^n), capped at 20 levels. **Step 2: Failing test:** endowment cost curve matches formula; purchase persists; caps enforced. **Step 3–5:** Implement/pass/commit — `feat: escalating coin sinks`

---

# WAVE 6 — Daily Seed Rotation

### Task 6.1: Deterministic daily modifier

**Objective:** A reason to open the app today, no server.

**Files:**
- Create: `js/engine/daily.js`
- Modify: `js/engine/state.js` (`daily: { seed: "", claimed: {} }`), `js/main.js` (roll on boot)
- Modify: `js/ui/shell.js` (banner chip)

**Step 1:** Seed = UTC date string; modifier table (~14 defs) chosen via the same LCG pattern as Task 0.2 seeded by date hash. Effects stack multiplicatively with existing bonus pipeline (reuse `courseBonuses` accumulation shape): e.g. "Docks burn hot: +40% marks in Cinder Docks, −15% guard". Displayed as banner; ledger tracks days-active streak.

**Step 2: Failing tests:** same UTC day → identical modifier across two `createState`s; midnight boundary rolls cleanly; streak increments on consecutive days, resets after gap; modifier actually shifts `actionDuration`/drop math in sim tests.

**Step 3–5:** Implement/pass/commit — `feat: date-seeded daily conditions`

---

# Files Likely to Change (summary)

| Area | Files |
|---|---|
| Persistence | `js/engine/state.js` (scrub, backup, migrations, reconcile, seen, achv, daily) |
| Engines | `sim.js` (modes, offline tail), `combat.js` (death sheet, bounty, bosses), NEW `ledger.js`, `achievements.js`, `daily.js` |
| Content | `catalog.js` (tiers, mechanics, shop), NEW `content/achievements.js` |
| UI | `shell.js`, `desks.js`, `app.css` |
| Infra | `selftest.mjs`, `.github/workflows/ci.yml`, `sw.js` (one CACHE bump per shipped wave), `main.js` |

# Validation Strategy

- **Per task:** named-case selftest green (`node js/data/selftest.mjs`, EXIT=0).
- **Per wave:** manual smoke in browser via `npm run web` — boot, 60s idle, fight, die, save/reload, export/import roundtrip; Capacitor parity check after Waves 1–2 and 6 (`npm run cap:sync` + Android Studio run) since persistence changes touch WebView localStorage.
- **Release:** bump `sw.js` CACHE (e.g. `veilforge-v19` after Wave 2), run `npm run pack`, confirm `www/` integrity; Electron smoke via `npm run electron`.
- **Regression tripwires pinned in selftest:** items=453, actions=396, monsters=130, skills=22, minutesToLv5 ≈ 3.95, offline3h ≥ 900 (update deliberately, never silently).

# Risks, Tradeoffs, Open Questions

1. **Save-format breakage risk** (Wave 1) — mitigated by migration ladder + bak slot landing BEFORE features; old saves must load at every task (tests enforce).
2. **Balance drift** from modes/dailies stacking multiplicatively — cap total observed multiplier in a debug selftest case; consider one "audit log" dev-only line showing effective multipliers.
3. **Scope creep in achievements** — hard cap v1 at 100 defs; the ENGINE is the product, the list can grow.
4. **Boss adds vs. pure-engine purity** — adds must be simulated within existing combatTick lanes, not a second entity system; if it can't fit the lane model, cut summonAdds (keep shield+enrage) rather than fork architecture.
5. **Client-trust ceiling** — dailies/streaks are spoofable by clock edits; accepted (single-player), documented in code comment. Never build commerce on top.
6. **Open question for Luke:** reward economy for master bounties (cosmetic-only vs. slight PVE power?) — decide before Task 4.2.
7. **Open question:** iOS wave testing requires a Mac pass (RELEASE.md) — schedule or defer.
