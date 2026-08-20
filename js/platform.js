/** Native / ship helpers. Safe in the browser, Capacitor WebView, and Electron. */

export const isElectron = /Electron/i.test(navigator.userAgent);
export const isCapacitor = Boolean(window.Capacitor?.isNativePlatform?.());
export const isNative = isElectron || isCapacitor;
export const canUseSW = location.protocol === "https:" || location.hostname === "localhost";

export function bootPlatform() {
  if (isNative) document.documentElement.dataset.ship = "1";

  document.documentElement.style.setProperty("--sat", "env(safe-area-inset-top)");
  document.documentElement.style.setProperty("--sab", "env(safe-area-inset-bottom)");

  const cap = window.Capacitor?.Plugins;
  cap?.StatusBar?.setBackgroundColor?.({ color: "#0c0714" }).catch?.(() => {});
  cap?.StatusBar?.setStyle?.({ style: "DARK" }).catch?.(() => {});
  cap?.SplashScreen?.hide?.().catch?.(() => {});

  cap?.App?.addListener?.("backButton", ({ canGoBack }) => {
    const fork = document.getElementById("fork-modal");
    const level = document.getElementById("level-modal");
    if (fork?.classList.contains("open")) {
      fork.querySelector("[data-act='fork-no']")?.click();
      return;
    }
    if (level && !level.hidden) {
      const all = level.querySelector("[data-act='dismiss-levels']");
      (all || level.querySelector("[data-act='dismiss-level']"))?.click();
      return;
    }
    if (canGoBack) window.history.back();
    else cap.App.exitApp();
  });

  if (canUseSW && !isNative) {
    navigator.serviceWorker?.register("./sw.js").catch(() => {});
  }
}
