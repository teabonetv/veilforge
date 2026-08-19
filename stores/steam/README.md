# Steam — Veilforge

This folder is store copy and depot notes. The playable desktop build is the Electron app in `dist/` after `npm run dist:win` / `dist:mac` / `dist:linux`.

## Partner steps (you do these once)

1. Create a Steamworks partner account and a new app (game).
2. Replace `480` in `steam_appid.example.txt` with your real App ID. Copy the file beside the shipped executable as `steam_appid.txt` only for local testing; Steam installs inject the ID themselves.
3. In Steamworks: Community → Store presence — use `listing.md` for the page blurb.
4. Upload depots with SteamPipe / ContentBuilder. Point the depot at:
   - Windows: `dist/win-unpacked/` or the NSIS installer plus unpacked dir for a depot
   - macOS: `dist/mac/`
   - Linux: `dist/linux-unpacked/`
5. Set launch options:
   - Windows: `Veilforge.exe`
   - macOS: `Veilforge.app`
   - Linux: `Veilforge`
6. Achievements / overlay: add `steamworks.js` later and set `STEAM_APP_ID` in `electron/main.cjs`. The game already saves locally and does not require Steam to play.

## Build on this repo

```bash
npm install
npm test
npm run dist:linux   # AppImage + unpacked dir (this Linux agent)
# On Windows CI or a Windows box:
npm run dist:win
# On macOS with codesign identities:
npm run dist:mac
```

Do not ship `progress.html`. `npm run pack` copies only the game into `www/`.
