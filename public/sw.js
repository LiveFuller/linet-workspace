/**
 * LINET Workspace — minimal service worker
 *
 * Cache: linet-ws-v1 (bump on shell changes).
 * Strategy: network-first for /api/, cache-first for assets, shell fallback for navigations.
 * Note: persistent storage (navigator.storage.persist) is requested separately
 * in the app bootstrap (src/app/AppProvider.tsx). Offline is best-effort —
 * the Cache API is not guaranteed durable without a persistent-storage grant.
 */

const CACHE_NAME = "linet-ws-v1";
const BASE = "/linetapp";
const SHELL_URLS = [`${BASE}/`, `${BASE}/index.html`, `${BASE}/manifest.webmanifest`];

// Install — precache shell. skipWaiting so new SW activates immediately.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

// Activate — clean old caches, claim clients immediately.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Fetch — network-first for /api/, cache-first for same-origin assets,
// navigation fallback to cached shell when offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip cross-origin requests entirely.
  if (url.origin !== self.location.origin) return;

  // Network-first for API calls.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache successful GET API responses opportunistically.
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          // No cached API response — return 503-like response.
          return new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }),
    );
    return;
  }

  // For navigation requests, try network then fall back to cached shell.
  const isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(req).catch(async () => {
        // Try exact cached request first, then shell.
        const cached = await caches.match(req);
        if (cached) return cached;
        const shell = await caches.match(`${BASE}/index.html`);
        if (shell) return shell;
        const root = await caches.match(`${BASE}/`);
        if (root) return root;
        return new Response("Offline — workspace shell not cached yet.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
    );
    return;
  }

  // Cache-first for same-origin assets (JS/CSS/images/fonts/manifest).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cache successful same-origin responses.
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          // Asset fetch failed and nothing cached — propagate failure.
          // For manifest specifically, try cached copy one more time.
          if (url.pathname.endsWith(".webmanifest")) {
            const m = await caches.match(`${BASE}/manifest.webmanifest`);
            if (m) return m;
          }
          throw new Error("offline and not cached: " + url.pathname);
        });
    }),
  );
});
