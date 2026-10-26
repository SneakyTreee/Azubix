// Registriert den Service Worker (Offline-Nutzung, installierbar als App).
// Per Doppelklick (file://) gibt es keinen Service Worker, dann passiert einfach nichts.
(function registerServiceWorker() {
  try {
    const supported = "serviceWorker" in navigator;
    const served = location.protocol === "http:" || location.protocol === "https:";
    if (!supported || !served) {
      return;
    }
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {
        // Ohne Service Worker funktioniert Azubix trotzdem, nur nicht offline.
      });
    });
  } catch {
    // z.B. blockierter Zugriff in privaten Fenstern
  }
})();
