# Veilforge — Wave 18 (longevity)

Shipped on `cursor/longevity-wave-03e0`. The dusk keeps a ledger. Halt is still Halt. Do not claim Melvor Idle 2 was beaten.

## Landed

- Backup save + checksum wrap, orphan sweep, SAVE_VERSION 3
- Collection log (`logbook`) + Codex desk with silhouette slots + LOG % badge
- Five-tier rarity, standing boons, mastery 25/50/75/100
- ~100 diaries with wearable titles
- Drop tables as 1/X on monster cards
- Boss mechanics + telegraphs on ~30 closers/field uniques; combat deeds
- The Echo infinite ladder (runtime depths, catalog `echo-0` only)
- Bounty 3-link chains + token shop chain gear
- Dual training modes, Vow Renewal, Standing Orders, Hardcore / Wanderer's Path
- Weekly Eclipse banner, Dawn/Edict sheets, hiscore client contract
- Teaching copy: Select … then press Idle this job
- CI selftest workflow, SW cache hash in pack-web, Electron fail-fast, multi-size `.ico`

## Honest gaps

- Unique Imagine cells are still 28px lookalikes, not a painted 24px atlas
- Act/beat engine has 6 acts and ~20 beats, not 50–70 authored lines
- Echo later depths reuse `echo-0`'s Imagine cell (PIX uniqueness budget)
- Hiscores POST to a static Pages URL; no board server
- Capacitor Preferences is fire-and-forget; full dual-read hydrate is still thin
- Selftest still seeds global `Math.random` when run as main (import path does not)

## Comparison

Melvor's overnight trust is closer (offline hunts, vault halt, Dawn). Completion log and rarity exist. First hour is still a beat scan, not a gated tutorial.

## Builder round B — combat feel & fairness (branch wt-b)

- Boss mechanic state now resets every fight/floor: no stale curse, telegraphs, enrage/phase flags, or add hits bleeding across respawns or dungeon chains.
- Phase/enrage mutations to catalog monster stats are captured and restored on fight end; phase no longer heals the boss back to 50%.
- Curse is a timed wound (8s, 4s + softer tax with a live combat draught — "counter: vial" is real) and actually applies its taken multiplier.
- Veilward ("counter: style") now keys off the held weapon's live style, so swapping styles genuinely counters it.
- Remnant adds obey held-the-line mercy + auto-eat; they can no longer kill from full HP.
- Burst wind-up is visible ("COILED") and auto-eat braces toward 90% HP while coiled, one ration per beat.
- Fight board shows flavored telegraphs with countdown + counter, live status lines (poison/curse/ward/bleed/shred), and death sheets name the tax paid, floors cleared, curse, and triangle disadvantage.
- Selftests CF1–CF7 pin all of the above.

