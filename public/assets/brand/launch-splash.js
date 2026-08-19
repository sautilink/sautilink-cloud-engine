(() => {
  "use strict";

  const script = document.currentScript;
  const product = script?.dataset.product || location.hostname;
  const version = script?.dataset.version || "1";
  const storageKey = `sautilink-launch:${product}:${version}`;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const startedAt = performance.now();
  let showSplash = true;

  try {
    showSplash = sessionStorage.getItem(storageKey) !== "seen";
    if (showSplash) sessionStorage.setItem(storageKey, "seen");
  } catch (_) {
    showSplash = true;
  }

  document.documentElement.dataset.launchSplash = showSplash ? "full" : "skip";

  function registerServiceWorker() {
    if (script?.dataset.registerSw !== "true" || !("serviceWorker" in navigator) || location.protocol !== "https:") return;
    window.addEventListener("load", () => navigator.serviceWorker.register(script.dataset.sw || "/sw.js").catch(() => {}), { once: true });
  }

  function initSplash() {
    const splash = document.getElementById("sl-launch-splash");
    if (!splash || !showSplash) {
      splash?.remove();
      document.documentElement.dataset.launchSplash = "complete";
      return;
    }

    const minimum = reducedMotion ? 320 : 1900;
    const maximum = reducedMotion ? 900 : 4200;
    let dismissed = false;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      splash.classList.add("is-leaving");
      window.setTimeout(() => {
        splash.remove();
        document.documentElement.dataset.launchSplash = "complete";
      }, reducedMotion ? 20 : 420);
    };

    const finishAfterMinimum = () => window.setTimeout(dismiss, Math.max(0, minimum - (performance.now() - startedAt)));

    if (document.readyState === "complete") finishAfterMinimum();
    else window.addEventListener("load", finishAfterMinimum, { once: true });
    window.setTimeout(dismiss, maximum);
  }

  registerServiceWorker();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSplash, { once: true });
  else initSplash();
})();
