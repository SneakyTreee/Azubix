// Service Worker für Azubix: App-Shell offline verfügbar machen.
// Bei jeder Änderung an Dateien der App-Shell CACHE_VERSION erhöhen.
const CACHE_VERSION = "v3.1.0-1";
const CACHE_NAME = `azubix-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icons/favicon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/css/tokens.css",
  "./assets/css/base.css",
  "./assets/css/layout.css",
  "./assets/css/forms.css",
  "./assets/css/sections.css",
  "./assets/css/results.css",
  "./assets/css/overlays.css",
  "./assets/css/responsive.css",
  "./assets/css/print.css",
  "./assets/js/core/storage.js",
  "./assets/js/core/hefte.js",
  "./assets/js/core/state.js",
  "./assets/js/core/dates.js",
  "./assets/js/data/berufe.js",
  "./assets/js/data/holidays.js",
  "./assets/js/data/rahmenplan.js",
  "./assets/js/app/schedule.js",
  "./assets/js/ai/client.js",
  "./assets/js/ai/prompts.js",
  "./assets/js/ai/templates.js",
  "./assets/js/ai/writer.js",
  "./assets/js/ui/feedback.js",
  "./assets/js/ui/form.js",
  "./assets/js/ui/settings.js",
  "./assets/js/ui/results.js",
  "./assets/js/ui/day-editor.js",
  "./assets/js/ui/shell.js",
  "./assets/js/ui/transfer.js",
  "./assets/js/ui/setup.js",
  "./assets/js/app/generation.js",
  "./assets/js/app/quality.js",
  "./assets/js/app/export.js",
  "./assets/js/app/export-docs.js",
  "./assets/js/app/ics.js",
  "./assets/js/main.js",
  "./assets/js/pwa.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Einzeln laden: eine fehlende Datei soll nicht die ganze Installation abbrechen.
      await Promise.all(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("azubix-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  // Fremde Ursprünge (KI-Anbieter, Feiertags-API, Schriften) nie cachen: Browser-Standard.
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) {
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        if (request.mode === "navigate") {
          const shell = await cache.match("./index.html");
          if (shell) {
            return shell;
          }
        }
        throw error;
      }
    })(),
  );
});
