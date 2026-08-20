# Veilforge

A browser idle / incremental RPG in the spirit of Melvor Idle and Melvor Idle 2 — duskbound, not a reskin.

Open `index.html` via any static server (or the Cloud Agent preview). Live build notes: `progress.html`. Store packaging (Android, iOS, Steam): `RELEASE.md`.

## Run

```bash
python3 -m http.server 8080
```

Then visit `/` for the game and `/progress.html` for the live sheet.

```bash
npm install
npm test
npm run pack      # www/ for Capacitor + Electron
npm run electron  # packs www/ then opens a desktop window (falls back to repo index.html if www is missing)
```

## What is here

- 22 skills (gather, artisan, unique, and war-arts) with a 120 level cap
- Data-driven tiers, 400+ items, 400+ actions, 12 combat fields, 8 dungeons
- Weapon identities (riposte, shred, bleed, pierce, echo) instead of a single BiS stick
- Mastery per action plus Guild ranks (task-based, Melvor Idle 2 energy)
- Course pillars, Chart slots, Soil plots, Drove pens, Whisper risk
- Auto-eat, vows/prayers, spellbooks, bounty contracts, pets, shop tools
- Offline resolution, export/import, Three.js citadel and arena
