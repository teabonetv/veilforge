# Android & iOS — Veilforge

Capacitor 6 wraps the packed `www/` folder. This machine can generate the Android Gradle project; iOS requires Xcode on macOS.

## One-time

- Apple Developer Program (iOS) and an App Store Connect app record (`com.veilforge.idle`).
- Google Play Console and a Play app with the same application id.
- Host `stores/privacy.html` at a public HTTPS URL and paste it into both consoles.

## Commands

```bash
npm install
npm test
npm run pack
npx cap add android   # first time only; commit the android/ folder
npx cap add ios       # macOS only; first time only
npm run cap:sync
npx cap open android  # Android Studio → Generate Signed Bundle
npx cap open ios      # Xcode → Archive → App Store Connect
```

Release signing:

- Android: create a Play App Signing key in Android Studio; never commit `*.jks` or `local.properties`.
- iOS: set the team in Xcode, bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` to match `package.json`.

## Store listing (both stores)

**Name:** Veilforge  
**Subtitle:** The Last Workshop  
**Category:** Games / Role Playing  

**Short:** Duskbound idle RPG. Commit to a craft, or Halt and pay the tax.

**Full:** The last workshop still takes apprentices. Train twenty-two skills to 120, fill a mean little bank, and fight with a combat triangle that cares which weapon you brought. Offline progress counts. Your save never leaves the device unless you export it.

**Age:** 12+ / Teen — fantasy combat, no chat, no ads in 1.0, no loot boxes.

**Data safety / privacy nutrition:** no analytics SDK, no ads, no account. Save data is localStorage on device. Optional user-initiated export.

**Assets:** `branding/icon.png` (1024) plus `branding/icon-*.png`. Phone screenshots: run the web game at 1080×1920. Tablet / iPad: 2048×2732.
