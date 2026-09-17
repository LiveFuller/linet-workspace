/**
 * LINET Workspace — minimal service worker
 *
 * Cache: versioned per full registration scope (bump on shell changes).
 * Strategy: bypass API/tracking, cache-first public assets, network-first navigations.
 * Note: persistent storage (navigator.storage.persist) is requested separately
 * in the app bootstrap (src/app/AppProvider.tsx). Offline is best-effort —
 * the Cache API is not guaranteed durable without a persistent-storage grant.
 */

const BASE = new URL(self.registration.scope);
const CACHE_PREFIX = `linet-ws:${encodeURIComponent(BASE.href)}:`;
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const SHELL_URLS = ["./", "index.html", "manifest.webmanifest"].map(
  (path) => new URL(path, BASE).href,
);

// Install — precache shell. skipWaiting so new SW activates immediately.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

// Activate — clean only this scope's old caches, claim clients immediately.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) =>
            (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) ||
            (BASE.pathname === "/linetapp/" &&
              (key === "linet-ws-v1" || key === "linet-ws-v2")),
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// Fetch — bypass API/tracking; only this scope's public assets and navigations.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;

  const path = url.pathname.slice(BASE.pathname.length);
  if (/^(api|r)(\/|$)/.test(path) || /^\/(api|r)(\/|$)/.test(url.pathname)) return;
  if (req.headers.has("authorization") || req.headers.has("range")) return;

  const isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(req).catch(async () => {
        // Only the precached shell is an offline navigation fallback.
        try {
          const cache = await caches.open(CACHE_NAME);
          const shell = await cache.match(SHELL_URLS[1]);
          if (shell) return shell;
          const root = await cache.match(SHELL_URLS[0]);
          if (root) return root;
        } catch {}
        return new Response("Offline — workspace shell not cached yet.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
    );
    return;
  }

  if (!path.startsWith("assets/") && !path.startsWith("icons/") &&
      path !== "manifest.webmanifest") return;

  // Keep writes alive without delaying or failing a successful network response.
  let cacheWrite = Promise.resolve();
  const response = (async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
    } catch {}

    const res = await fetch(req);
    if (res.ok && !res.redirected &&
        !(res.headers.get("content-type") || "").includes("text/html") &&
        !/\b(no-store|private)\b/i.test(res.headers.get("cache-control") || "")) {
      cacheWrite = (async () => {
        try {
          const clone = res.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, clone);
        } catch {}
      })();
    }
    return res;
  })();
  event.respondWith(response);
  event.waitUntil(response.then(() => cacheWrite).catch(() => {}));
});
