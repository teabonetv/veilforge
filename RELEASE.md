# Store release

Veilforge is a static web game. Native stores wrap the same `www/` pack.

| Store | Wrapper | Command | You still need |
| --- | --- | --- | --- |
| Google Play | Capacitor Android | `npm run cap:sync` then signed AAB in Android Studio | Play Console, signing key, privacy URL |
| App Store | Capacitor iOS | `npx cap add ios` on a Mac, then Archive | Apple Developer, Xcode |
| Steam | Electron | `npm run dist:win` / `dist:mac` / `dist:linux` | Steamworks App ID, SteamPipe upload |

```bash
npm install
npm test
npm run icons
npm run pack
```

`www/` is generated. Do not point Capacitor `webDir` at the repo root.

Dev progress sheet (`progress.html`) stays in the repo for the web build and is hidden in native shells (`data-ship` on `<html>`).

Full checklists: `stores/steam/README.md` and `stores/mobile/README.md`. Host `stores/privacy.html` on HTTPS for store forms.
