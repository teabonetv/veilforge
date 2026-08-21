# VeilForge Longevity Overhaul — Art & Design Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn VeilForge's beautiful first 200 hours into a thousands-of-hours game by adding the chase layer, prestige, boss identity, content depth, narrative, and social proof the genre benchmarks (Melvor Idle 1/2, RuneScape, WoW) prove are load-bearing — with the duskbound art direction carried through every addition.

**Architecture:** Six systems, built in dependency order: (1) Rarity + Collection Log — the chase economy every other system feeds; (2) Prestige/Vow Renewal + Automation — the second game past level 120; (3) Boss Mechanics + Combat Achievements — mechanical depth at the emotional peaks; (4) Ledger Arcs + Citadel Transformation — narrative moat reusing the existing first-hour-beat pipeline; (5) Hiscores + Weekly Modifiers + Ambient Presence — social glue; (6) Offline Dawn Ledger — the returning-player ritual. Every system ships with its art-direction spec inline, because in this game the art IS the system (the collection log's empty silhouettes, the dawn screen, the citadel scars are the retention mechanics).

**Tech Stack:** Vanilla ES modules (no framework), Three.js r1xx (vendored, `js/vendor/three.module.js`), CSS custom properties in `css/app.css`, localStorage save via `js/engine/state.js`, Capacitor/Electron shells unchanged. Test runner: `node js/data/selftest.mjs` (existing pattern — extend it, don't introduce a framework).

**Constraints carried over:** All prior review work was read-only; this plan is the implementation blueprint. Repo is `C:\Users\Luke\veilforge` (branch `main`). Uncommitted WAVE17 work (`firstHourBeat`, `card.goal`) is the foundation — build on it, don't clobber it.

---

## Current context / assumptions

- **Content scale today:** 22 skills × MAX_LEVEL 120 (`js/content/catalog.js:50`), ~215 catalogue ids, 83-line quest file (`js/engine/quests.js`), ~11 bosses in the beasts atlas, one wanderer. Estimated 200–500 hours of natural play. Target: thousands.
- **Existing strengths to reuse:** semantic palette tokens (gold=value/goal, rose=combat, lilac=info, mint=progress); serif display voice (Palatino/Cormorant); `firstHourBeat()` guidance pipeline (uncommitted, working); Vow system (thematically perfect prestige hook); per-action mastery data (exists, invisible in UI); Three.js citadel with lighting rig (`js/scene/world.js`, 769 lines) that is atmospheric but stateless.
- **Known debts this plan deliberately does NOT fix here** (separate passes, already specified in the hostile review): icon atlas redraw at 24px-first, combat duel strip rebuild, lock-state unification, radius tokens. The rarity system (Phase 1) will *require* the rarity colour language, so Task 1.1 introduces the tokens; full icon redraw is a parallel art commission, not blocked by this plan.
- **Assumption:** `js/engine/state.js` owns save/load and bank; `js/engine/sim.js` owns actions; `js/engine/combat.js` (849 lines) owns fights/dungeons; `js/ui/shell.js` (1,472 lines) renders everything via template strings; `js/ui/desks.js` renders Vault/Wanderer/Quay desks. New UI follows the same template-string + `data-act` pattern.
- **Assumption:** No multiplayer server exists. Hiscores are opt-in, debounced, anonymous-by-default (player-chosen name), served as static JSON later — the plan specifies client contract only.

---

# PHASE 1 — The Chase: Rarity Ladder & Collection Log

The single highest hours-per-effort system. Every drop table, boss unique, and pet feeds one persistent, visible collection. RS's collection log is the genre's biggest thousand-hour engine; Melvor copied it deliberately.

## Design spec (art direction + system, inseparable)

**Rarity ladder — five tiers, five colour registers (new tokens):**

| Tier | Name | Token | Value on duskbound panels | Usage |
|---|---|---|---|---|
| 1 | Common | `--rarity-common` | `#9a8bb0` (existing --muted) | baseline items, no decoration |
| 2 | Uncommon | `--rarity-uncommon` | `#7ddeb2` (existing --ok mint) | subtle tint on name only |
| 3 | Rare | `--rarity-rare` | `#7b6cff` (existing --dusk) | tinted name + faint tile glow |
| 4 | Exotic | `--rarity-exotic` | `#e8c9a0` (existing --gold) | gold name + gold tile rule |
| 5 | Duskbound | `--rarity-dusk` | NEW `#f0b7ff` | animated shimmer border, drop fanfare |

Rules: rarity colour appears in exactly four places — drop floater, tile border/name, inspect panel rule, log slot. Nowhere else. Gold keeps its existing "goal/commitment" meaning; Exotic borrows it deliberately (exotic items ARE goals). Duskbound gets the only animated treatment in the game — one shimmer, 2.4s, respects `prefers-reduced-motion`.

**Collection Log:** a new desk (nav button "Ledger of Hours" — no, that collides with quest Ledger; name it **"Codex"**) — grid of every collectible, grouped: Beasts / Bosses / Gates / Relics / Pets. Unfilled slots show a **silhouette of the actual item** (CSS `filter: brightness(0) invert(0.35)` on the existing pix cell — zero new art needed) at 40% opacity with a "?" — the silhouette-tease is the psychological hook. Filled slots show full colour + count + first-obtained date. Log % per category and total, shown as a small badge on the brand column (`LOG 34%` in gold, 10px letter-spaced — matches `.desk-tag` styling language).

## Tasks

### Task 1.1: Rarity tokens + tier data
**Objective:** Establish the five-tier rarity vocabulary in CSS and content data.

**Files:**
- Modify: `css/app.css` (add to `:root` block, lines 1–23)
- Create: `js/content/rarity.js`
- Test: `js/data/selftest.mjs`

**Step 1: Write failing test** (add to `js/data/selftest.mjs` alongside existing checks):
```js
import { RARITY, rarityOf } from "../content/rarity.js";
assert(RARITY.length === 5, "five rarity tiers");
assert(rarityOf({ rarity: "dusk" }).name === "Duskbound", "dusk tier resolves");
assert(rarityOf({}).name === "Common", "default tier is common");
```
**Step 2: Run** `node js/data/selftest.mjs` — expect FAIL (module not found).
**Step 3: Create `js/content/rarity.js`:**
```js
export const RARITY = [
  { id: "common", name: "Common", token: "--rarity-common", weight: 1000 },
  { id: "uncommon", name: "Uncommon", token: "--rarity-uncommon", weight: 220 },
  { id: "rare", name: "Rare", token: "--rarity-rare", weight: 45 },
  { id: "exotic", name: "Exotic", token: "--rarity-exotic", weight: 8 },
  { id: "dusk", name: "Duskbound", token: "--rarity-dusk", weight: 1 },
];
const BY_ID = Object.fromEntries(RARITY.map(r => [r.id, r]));
export const rarityOf = (item) => BY_ID[item?.rarity ?? "common"] ?? BY_ID.common;
```
**Step 4:** Add to `:root` in `css/app.css`: `--rarity-dusk: #f0b7ff;` (other four reuse existing tokens via `var()` at usage sites).
**Step 5: Run selftest** — expect PASS. **Commit:** `feat(rarity): five-tier rarity vocabulary`

### Task 1.2: Tag catalogue drops with rarity
**Objective:** Every beast/boss/gate drop table entry gets a `rarity` field; uniques get `dusk`/`exotic`.

**Files:**
- Modify: `js/content/catalog.js` (beast/boss/gate drop arrays, ~215 entries)
- Test: `js/data/selftest.mjs`

**Step 1: Failing test:** `assert(catalog every beast drop has rarity field)`.
**Step 2: Run** — FAIL. **Step 3:** Sweep catalogue: existing staples → `common`/`uncommon`; add 1–2 new `exotic` per boss (weapon trinket tier reusing existing item kinds); add one `dusk` unique per boss (11 total — name + kind only, art reuses atlas cells + hue until icon pass). **Step 4: PASS. Commit:** `feat(content): rarity across drop tables`

### Task 1.3: Drop pipeline honours rarity
**Objective:** Combat drops roll rarity; floaters and bank entries carry it.

**Files:**
- Modify: `js/engine/combat.js` (drop roll section)
- Modify: `js/ui/shell.js` (`#yield-hits .drip` builder — add `.drip.rare`-style class per tier; existing CSS at app.css:103–117 already has the drip pattern)
- Modify: `css/app.css` (`.drip.exotic`, `.drip.dusk` colour rules; `@keyframes shimmer` for dusk drops)
- Test: `js/data/selftest.mjs`

**Steps:** failing test that `rollDrop()` returns `{item, rarity}` → implement weighted roll using `RARITY.weight` → floater classes `drip exotic`/`drip drip-dusk` with gold/`--rarity-dusk` colours → dusk tier gets one-shot shimmer animation → PASS → commit `feat(combat): rarity-weighted drops + tier floaters`.

### Task 1.4: Codex desk — collection log UI
**Objective:** New desk screen showing every collectible with silhouette-tease unfilled slots.

**Files:**
- Modify: `index.html` (add `<div id="codex-desk" hidden>` sibling to `#bank-desk`, mirroring `.desk-head` + `.vault-layout` structure at index.html:84–98)
- Modify: `js/ui/desks.js` (render function following `renderVault` pattern)
- Modify: `js/ui/shell.js` (`desk-nav` button + `data-act="desk" data-arg="codex"` routing — pattern exists at index.html:76–83)
- Modify: `css/app.css` (`.logslot` styles: unfilled = `filter: brightness(0) invert(0.35); opacity: .4`; filled = full colour + count; category header rules)
- Test: `js/data/selftest.mjs`

**Steps:** failing test that codex state object tracks `{itemId: {count, firstSeen}}` → implement `js/engine/logbook.js` (create: ~60 lines, persisted into existing save blob) → render desk → wire nav → visual check via `python -m http.server` + headless Chrome screenshot (established workflow) → PASS → commit `feat(codex): collection log desk with silhouette slots`.

### Task 1.5: Log % badge + persistence
**Objective:** `LOG 34%` badge on brand column; log survives save/load/wipe.

**Files:**
- Modify: `js/ui/shell.js` (`.brand-col` render, index.html:26–34)
- Modify: `js/engine/state.js` (include `logbook` in save blob + export/import)
- Test: selftest — save → mutate → load → log counts identical.

**Commit:** `feat(codex): log completion badge + save integration`

---

# PHASE 2 — The Second Game: Prestige, Vow Renewal & Automation

## Design spec

**Vow Renewal (prestige):** At skill level 120, the player may **renew the vow**: levels reset to 1 for that skill, XP rates gain +8% per renewal (multiplicative cap ×3), and one **Vow Mark** is permanently etched on the wanderer profile (small gold glyph ring around the skill's icon — art = existing `.vico` frame + gold ring, no new assets). Renewal count gates late-game automation tiers. Thematically: "The dusk endures" — you don't abandon the craft, you deepen it.

**Automation ladder (Melvor's endgame engine):** unlock chain gated behind renewal counts + hundred-hour milestones: Auto-Eat+ (exists as food chip → upgrade to threshold rule) → Auto-Bank (bank when full) → Auto-Sell (sell below rarity threshold) → Idle Scripts (conditional rules: "eat when HP<50%", "switch job when mastery 99"). UI: a new "Standing Orders" panel in the job dock (`.job-dock` already the right home) — rules rendered as plain-language sentences with inline selects, serif voice: *"When hunger bites below half, eat the finest first."*

## Tasks

### Task 2.1: Renewal state + rules
**Objective:** `renewals[skillId]` in state; renewal allowed at 120; resets levels, keeps mastery.

**Files:** Modify `js/engine/state.js`, `js/engine/sim.js` (xp gain applies renewal multiplier), `js/data/selftest.mjs`.
**Steps:** failing test (renew at 120 → level 1, multiplier applied, mastery intact, mark count +1) → implement (~40 lines) → PASS → commit `feat(prestige): vow renewal`.

### Task 2.2: Renewal UI — the Rite
**Objective:** A modal rite (reuse `#level-modal` sheet pattern, app.css:523–530) with serif copy; gold ring appears on renewed skills' nav icons.

**Files:** Modify `js/ui/shell.js` (modal + `.skill.renewed .skico` gold ring), `css/app.css` (ring = `box-shadow: 0 0 0 2px var(--gold-dim)`).
**Steps:** implement → visual screenshot check → commit `feat(prestige): renewal rite modal + vow marks`.

### Task 2.3: Automation ladder — Standing Orders
**Objective:** Rule engine + panel: auto-eat threshold, auto-bank, auto-sell rarity floor, one conditional script slot per renewal.

**Files:** Create `js/engine/orders.js`; Modify `js/engine/sim.js` (tick hook), `js/ui/shell.js` (panel in `.job-dock`), `css/app.css` (`.order-row` styles), `js/data/selftest.mjs`.
**Steps:** failing tests per rule (eat-at-threshold fires only when below; sell respects rarity floor) → implement engine → UI panel with plain-language rows → PASS → commit `feat(automation): standing orders engine + panel`.

### Task 2.4: Milestone gating
**Objective:** Automation tiers unlock via renewal counts (1/2/3/5) + playtime thresholds.

**Files:** Modify `js/engine/orders.js`, `js/content/imprint.js` (unlock copy in the imprint voice).
**Commit:** `feat(automation): renewal-gated tiers`

---

# PHASE 3 — Boss Identity: Mechanics & Combat Achievements

## Design spec

Each of the ~11 existing bosses gets ONE signature mechanic the UI can express, plus 25–30 total bosses across the arc (new entries reuse atlas cells + hue rotation until the icon commission lands). Combat achievements graded per boss: Clear / Speed (par time) / Enduring (no food) / Scarred (kill at <10% HP). Achievement medallions show on boss intro cards.

**Art direction:** boss mechanics must be readable in the fight-board and the 3D scene: per-boss arena tint (fog colour + key-light hue shift in world.js — the rig already supports it), a telegraph element (rose pulse on the relevant bar/zone 1.5s before the mechanic lands), and the kill moment finally gets its due (foe desaturation flash + rose wash + unique floater — closes hostile-review item #2).

## Tasks

### Task 3.1: Mechanic framework
**Objective:** Bosses can declare `mechanic: {type, cadence, telegraph, counter}`; sim enforces it.

**Files:** Modify `js/engine/combat.js`; Create `js/content/mechanics.js` (3 starter mechanics: `curse` (cleanse via vial action), `phase` (foe swaps stat profile at 50%), `guard` (player must switch weapon style — swapWeaponStyle already exists in combat.js)); `js/data/selftest.mjs`.
**Steps:** failing test per mechanic (curse applies debuff until cleansed; phase flips profile; guard halves damage until style swap) → implement framework + 3 mechanics → assign to 3 bosses → PASS → commit `feat(bosses): mechanic framework + first three`.

### Task 3.2: Telegraph + kill moment art
**Objective:** Rose pulse telegraph on the duel strip / fight board; death gets desaturation + wash + floater.

**Files:** Modify `js/ui/shell.js` (duel render), `css/app.css` (`@keyframes telegraph`, `.duel.death` wash), `js/scene/world.js` (per-boss fog/light tint hook — expose `setArenaTint(hex)` from createWorld, call on fight start).
**Steps:** implement → screenshot verify mid-fight vs kill-frame differ → commit `feat(bosses): telegraphs + death moment + arena tints`.

### Task 3.3: Combat achievements
**Objective:** Per-boss graded achievements, persisted, shown on boss cards; feeds Codex.

**Files:** Create `js/engine/deeds.js`; Modify `js/engine/combat.js` (grade on kill), `js/ui/shell.js` (medallions), `js/data/selftest.mjs`.
**Commit:** `feat(bosses): combat achievements + medallions`

### Task 3.4: Boss roster expansion to ~30
**Objective:** Content pass — new bosses for Gates tiers 4+, each with one mechanic from the framework (add `enrage`, `summon` types).

**Files:** Modify `js/content/catalog.js`, `js/content/mechanics.js`.
**Commit:** `feat(content): boss roster to 30`

---

# PHASE 4 — Narrative Moat: Ledger Arcs & Citadel Transformation

## Design spec

Extend the `firstHourBeat` pipeline (uncommitted WAVE17 work — the foundation) from "first hour" to **acts**: 6 acts × 8–12 beats each, delivered through quest chains in the existing ledger. Act finales are **citadel transformations** — the Three.js scene permanently changes (new spire, lit windows count grows with total level, aurora hue shifts per act). The world remembers.

**Presentation:** quest beats graduate from the 13px `#commit` line to a proper **edict modal** — Cormorant italic body, gold-ruled sheet, wax-seal glyph (drawn, not emoji) — the serif voice finally gets a stage worthy of it.

## Tasks

### Task 4.1: Act/beat engine
**Objective:** Generalise `firstHourBeat` → `currentBeat(state)` spanning 6 acts; beats reference quest steps, skills, bosses, log slots.

**Files:** Modify `js/engine/quests.js` (83 lines today — the whole arc lives here, target ~400 lines with data), `js/ui/shell.js` (codex strip renders current beat + act name).
**Steps:** failing test (act 1 beat 3 requires specific action; completing advances; act 6 finale fires citadel transform) → implement → PASS → commit `feat(quests): act/beat engine`.

### Task 4.2: Edict modal
**Objective:** Story beats presented in the letter/edict sheet; skippable, logged to Journal.

**Files:** Modify `index.html` (reuse `#fork-modal` shell), `js/ui/shell.js`, `css/app.css` (`.edict` sheet: gold rule, Cormorant body, wax-seal via inline SVG).
**Commit:** `feat(quests): edict presentation`

### Task 4.3: Citadel transformation hooks
**Objective:** `world.js` gains `applyActTier(n)`: window lights, spire additions, aurora hue per act; persisted in save.

**Files:** Modify `js/scene/world.js`, `js/engine/state.js` (act tier in save), `js/main.js` (apply on boot).
**Steps:** failing test (state round-trips act tier) → implement 6 tiers → screenshot new-save vs act-3 save differ → commit `feat(scene): citadel remembers`.

### Task 4.4: Arc content — 6 acts of beats
**Objective:** Writing pass: 50–70 beats in the imprint voice, each beat = one concrete instruction + one line of story.

**Files:** Modify `js/engine/quests.js` (data), `js/content/imprint.js` (voice pass).
**Commit:** `feat(quests): the six acts`

---

# PHASE 5 — Social Proof: Hiscores, Weekly Modifiers, Ambient Presence

## Design spec

No server dependency for core play. Three layers: **(1) Weekly Eclipse** — rotating modifier ("Famine: food drains 2×"), cosmetic-only reward (pet tint), deterministic from week number so it works offline; **(2) Hiscores** — opt-in, debounced POST of {name, totalLevel, logPct, deepestGate} to a static-JSON endpoint (contract only here; endpoint later); **(3) Ambient presence** — the "dusk ledger": anonymous milestone lines drifting through the Journal ("A keeper in your booth sold 4,000 logs today") generated from the player's own real history + seeded variety — honest (labelled as local echo) and enormously effective against aloneness-in-the-dark.

## Tasks

### Task 5.1: Weekly Eclipse engine
**Objective:** `weekNumber → modifier` deterministic; modifier hooks sim/combat; banner on codex strip.

**Files:** Create `js/engine/eclipse.js`; Modify `js/engine/sim.js`, `js/engine/combat.js`, `js/ui/shell.js`, `js/data/selftest.mjs`.
**Steps:** failing test (same week = same modifier across boots; modifier actually changes food drain) → implement → PASS → commit `feat(eclipse): weekly modifiers`.

### Task 5.2: Hiscore client (contract only)
**Objective:** Opt-in settings toggle; debounced submit; fetch-render top-100 panel in Codex desk.

**Files:** Modify `js/engine/state.js` (settings flag), Create `js/engine/scores.js`, Modify `js/ui/desks.js` (hiscore pane), `js/platform.js` (endpoint base).
**Commit:** `feat(scores): opt-in hiscore client`

### Task 5.3: Dusk ledger ambient lines
**Objective:** Journal gains occasional ambient milestone lines seeded from real player stats.

**Files:** Modify `js/engine/state.js` (log generator), `js/ui/shell.js` (journal render).
**Commit:** `feat(journal): the dusk ledger`

---

# PHASE 6 — The Returning Ritual: Offline Dawn Ledger

## Design spec

Deterministic offline resolution (no RNG drift): on load, compute what happened while away, then present **the Dawn screen** — full-stage modal: the citadel at night (existing canvas, camera pulled back), moon crossing, torches burning down as yields count up line by line, ending "The forge held. +14,203 timber. Dawn." The single biggest art moment in the plan; also the retention hook (Melvor's offline fidelity is a core selling point).

## Tasks

### Task 6.1: Deterministic offline sim
**Objective:** On boot, resolve elapsed time against current jobs with the existing rates (cap 12h base, extendable by renewal tier to 24h).

**Files:** Modify `js/engine/sim.js`, `js/engine/state.js` (lastSeen timestamp), `js/data/selftest.mjs`.
**Steps:** failing test (2h away at 3s/action = exact action count, no RNG divergence) → implement → PASS → commit `feat(offline): deterministic resolution`.

### Task 6.2: The Dawn screen
**Objective:** Full modal presentation of offline results; citadel night-scene backdrop; line-by-line yield count-up; reduced-motion static variant.

**Files:** Modify `index.html` (reuse `#level-modal` shell), `js/ui/shell.js`, `css/app.css` (`.dawn` sheet, count-up animation, `prefers-reduced-motion` fallback), `js/scene/world.js` (camera pull + torch burn-down hook, 20 lines).
**Steps:** implement → screenshot verify (fresh boot after timestamp shift) → commit `feat(offline): dawn ledger screen`.

---

# Execution order & dependencies

```
Phase 1 (Codex)  ──→ Phase 3 (boss uniques feed Codex) ──→ Phase 4 (act finales reference log)
Phase 2 (Prestige) ──→ gates Phase 3.4 boss tiers & Phase 6 offline cap extension
Phase 5 (Eclipse)  ── independent, any time after Phase 1
Phase 6 (Dawn)     ── after Phase 2 (offline cap ties to renewal tier)
```
Phases 1→2→3→4 are the spine; 5 and 6 slot in parallel once 1 and 2 land.

# Files likely to change (summary)

| File | Involvement |
|---|---|
| `css/app.css` | every phase: rarity tokens, codex slots, telegraphs, edict/dawn sheets |
| `index.html` | codex-desk container, edict/dawn reuse of modal shells |
| `js/content/catalog.js` | rarity tags (1.2), boss roster (3.4) |
| `js/content/rarity.js` | NEW (1.1) |
| `js/content/mechanics.js` | NEW (3.1) |
| `js/engine/state.js` | logbook, renewals, act tier, eclipse, lastSeen, settings |
| `js/engine/combat.js` | rarity drops (1.3), mechanics (3.1), achievements (3.3) |
| `js/engine/sim.js` | renewal multipliers (2.1), orders hook (2.3), eclipse (5.1), offline (6.1) |
| `js/engine/quests.js` | act/beat engine (4.1, 4.4) |
| `js/engine/logbook.js` | NEW (1.4) |
| `js/engine/orders.js` | NEW (2.3) |
| `js/engine/deeds.js` | NEW (3.3) |
| `js/engine/eclipse.js` | NEW (5.1) |
| `js/engine/scores.js` | NEW (5.2) |
| `js/ui/shell.js` | every phase: badges, panels, modals, duel, journal |
| `js/ui/desks.js` | codex desk (1.4), hiscore pane (5.2) |
| `js/scene/world.js` | arena tints (3.2), act tiers (4.3), dawn camera (6.2) |
| `js/data/selftest.mjs` | every phase: failing-test-first harness |

# Tests / validation

- **Harness:** extend `js/data/selftest.mjs` (existing project pattern — no new framework). Every engine task is failing-test-first per the task steps above.
- **Per-phase visual gate:** `python -m http.server 8091` + headless Chrome screenshots (established in this session) compared against the phase's "Done when" criteria from the hostile review: rarity floaters visible, silhouette slots tease, kill frame differs from mid-fight, act-3 citadel differs from fresh save, dawn screen renders after timestamp shift.
- **Regression:** full selftest run green before each commit; save/export/import round-trip test after every phase touching state.js.

# Risks, tradeoffs, open questions

- **Scope risk (largest):** Phase 4's 50–70 beats and Phase 3.4's roster expansion are content labour, not code. Mitigation: they're last in their phases, ship behind the engines, and can grow incrementally post-launch.
- **Save migration:** every state.js addition needs a default for existing saves (undefined → sensible initial). Mitigation: one `migrateSave()` choke point added in Task 1.5, all later fields flow through it.
- **Rarity inflation:** five tiers is the ceiling — RS's pain teaches that more registers dilute the chase. Exotic/Duskbound must stay sub-1% feel. Tuning pass after Phase 3 uniques exist.
- **Perf:** world.js additions (tints, act tiers, dawn camera) are material/light changes, not geometry — safe on mobile; verify on the 120px mobile view.
- **Icon debt interaction:** rarity colours + hue-rotate filter on painted atlas will fight (hostile review item #1). The 24px-first icon commission should land before Phase 3's roster expansion, or Duskbound uniques will look muddy at exactly the moment they should sing.
- **Open questions for Luke:**
  1. Codex vs "Ledger" naming — Codex proposed (Ledger is the quest pane); confirm.
  2. Renewal multiplier tuning (+8%/stack, ×3 cap) — feel target: renewal should be obvious but never mandatory.
  3. Hiscores endpoint — static JSON on GitHub Pages viable for v1, or defer Phase 5.2 entirely?
  4. Offline cap: 12h base / 24h renewed — confirm appetite (generous offline = kinder but weakens the dawn ritual's daily pull).

---

*Plan saved per plan-mode: no code, assets, or repo files were modified — this document is the only artifact.*
