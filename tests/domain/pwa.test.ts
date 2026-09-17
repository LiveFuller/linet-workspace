// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const workerSource = readFileSync("public/sw.js", "utf8");
const mainSource = readFileSync("src/app/main.tsx", "utf8");
const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as {
  start_url: string; scope: string; icons: { src: string }[];
};
const origin = "https://workspace.test";
const bases = ["/", "/linetapp/", "/custom/nested/"];
type WorkerEvent = {
  request?: Request;
  waitUntil: (promise: Promise<unknown>) => void;
  respondWith: (promise: Promise<Response>) => void;
};

function harness(base = "/linetapp/") {
  const scope = origin + base;
  const prefix = `linet-ws:${encodeURIComponent(scope)}:`;
  const name = prefix + "v3";
  const entries = new Map<string, Response>();
  const key = (request: Request | string) => typeof request === "string" ? request : request.url;
  const cache = {
    addAll: vi.fn(async (_urls: string[]) => {}),
    match: vi.fn(async (request: Request | string) => entries.get(key(request))?.clone()),
    put: vi.fn(async (request: Request | string, response: Response) => { entries.set(key(request), response); }),
  };
  const caches = {
    open: vi.fn(async (_name: string) => cache),
    keys: vi.fn(async () => [name, prefix + "v2", "linet-ws-v1", "linet-ws-v2", "unrelated", "linet-ws:https%3A%2F%2Fworkspace.test%2Fsibling%2F:v2"]),
    delete: vi.fn(async (_name: string) => true),
  };
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const self = {
    registration: { scope },
    addEventListener: (type: string, handler: (event: WorkerEvent) => void) => handlers.set(type, handler),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };
  const fetch = vi.fn(async (_request: Request) => new Response("network", { headers: { "content-type": "text/javascript" } }));
  runInNewContext(workerSource, { self, caches, fetch, URL, Response, Promise });
  function dispatch(type: string, request?: Request) {
    const waits: Promise<unknown>[] = [];
    const respondWith = vi.fn<(promise: Promise<Response>) => void>();
    handlers.get(type)!({ request, respondWith, waitUntil: (promise) => waits.push(promise) });
    return {
      respondWith,
      response: respondWith.mock.calls[0]?.[0],
      done: () => Promise.all(waits),
      waits,
    };
  }
  function request(path: string, init: RequestInit = {}) {
    return new Request(new URL(path, scope), init);
  }
  return { scope, prefix, name, cache, caches, self, fetch, entries, dispatch, request };
}

describe.each(bases)("PWA deployment at %s", (base) => {
  it("registers the actual bootstrap URL and scope on load", async () => {
    const basenameStatement = mainSource.match(/^const basename = .*;$/m)?.[0];
    expect(basenameStatement).toBeDefined();
    const registration = mainSource.slice(mainSource.indexOf('// Register service worker'));
    const source = `${basenameStatement}\n${registration}`.replaceAll("import.meta.env", "env");
    const register = vi.fn(async () => {});
    const callbacks: (() => void)[] = [];
    const addEventListener = vi.fn((_event: string, callback: () => void) => callbacks.push(callback));
    runInNewContext(source, { env: { BASE_URL: base, PROD: true }, navigator: { serviceWorker: { register } }, window: { addEventListener } });
    expect(register).not.toHaveBeenCalled();
    expect(addEventListener).toHaveBeenCalledWith("load", expect.any(Function));
    callbacks[0]();
    expect(register).toHaveBeenCalledWith(base + "sw.js", { scope: base });
    for (const [prod, supported] of [[false, true], [true, false]]) {
      addEventListener.mockClear();
      runInNewContext(source, { env: { BASE_URL: base, PROD: prod }, navigator: supported ? { serviceWorker: { register } } : {}, window: { addEventListener } });
      expect(addEventListener).not.toHaveBeenCalled();
    }
  });

  it("resolves the installed manifest and icons within its deployment", () => {
    const manifestUrl = origin + base + "manifest.webmanifest";
    expect(new URL(manifest.start_url, manifestUrl).href).toBe(origin + base);
    expect(new URL(manifest.scope, manifestUrl).href).toBe(origin + base);
    for (const icon of manifest.icons) expect(new URL(icon.src, manifestUrl).pathname).toBe(base + icon.src);
  });

  it("precaches only this deployment and waits before activating", async () => {
    const h = harness(base);
    await h.dispatch("install").done();
    expect(h.caches.open).toHaveBeenCalledWith(h.name);
    expect(h.cache.addAll).toHaveBeenCalledWith([h.scope, h.scope + "index.html", h.scope + "manifest.webmanifest"]);
    expect(h.self.skipWaiting).toHaveBeenCalledOnce();
  });

  it("cleans only owned caches, including legacy caches only at their original scope", async () => {
    const h = harness(base);
    await h.dispatch("activate").done();
    expect(h.caches.delete.mock.calls.map(([name]) => name)).toEqual(base === "/linetapp/" ? [h.prefix + "v2", "linet-ws-v1", "linet-ws-v2"] : [h.prefix + "v2"]);
    expect(h.self.clients.claim).toHaveBeenCalledOnce();
  });

  it("uses network-first navigation and own shell only when offline", async () => {
    const h = harness(base);
    h.entries.set(h.scope + "index.html", new Response("own shell"));
    const request = h.request("tasks", { headers: { accept: "text/html" } });
    expect(await (await h.dispatch("fetch", request).response)!.text()).toBe("network");
    h.fetch.mockRejectedValue(new Error("offline"));
    expect(await (await h.dispatch("fetch", request).response)!.text()).toBe("own shell");
    expect(h.caches.open.mock.calls.every(([name]) => name === h.name)).toBe(true);
    h.entries.clear();
    expect((await h.dispatch("fetch", request).response)!.status).toBe(503);
    h.entries.set(h.scope, new Response("root shell"));
    expect(await (await h.dispatch("fetch", request).response)!.text()).toBe("root shell");
  });

  it.each(["api/items", "r/hotel", "api", "r"])("bypasses %s even for HTML navigations", (path) => {
    const h = harness(base);
    expect(h.dispatch("fetch", h.request(path, { headers: { accept: "text/html" } })).respondWith).not.toHaveBeenCalled();
    expect(h.fetch).not.toHaveBeenCalled();
  });
});

describe("PWA request boundaries and caching", () => {
  it.each([
    ["https://other.test/linetapp/assets/app.js", {}],
    ["https://workspace.test/sibling/assets/app.js", {}],
    ["https://workspace.test/linetapp-extra/assets/app.js", {}],
    ["assets/app.js", { method: "POST" }],
    ["assets/app.js", { headers: { authorization: "test" } }],
    ["assets/app.js", { headers: { range: "bytes=0-4" } }],
    ["account.json", {}],
  ] as [string, RequestInit][])("does not intercept %s %j", (path, init) => {
    const h = harness();
    expect(h.dispatch("fetch", h.request(path, init)).respondWith).not.toHaveBeenCalled();
  });

  it.each(["assets/app.js", "icons/icon-192.png", "manifest.webmanifest"])("caches %s and serves it offline", async (path) => {
    const h = harness();
    const request = h.request(path);
    const event = h.dispatch("fetch", request);
    expect(event.waits).toHaveLength(1);
    expect(await (await event.response)!.text()).toBe("network");
    await event.done();
    expect(h.cache.put).toHaveBeenCalledOnce();
    h.fetch.mockRejectedValue(new Error("offline"));
    expect(await (await h.dispatch("fetch", request).response)!.text()).toBe("network");
    expect(h.fetch).toHaveBeenCalledOnce();
  });

  it.each([
    { status: 404 },
    { headers: { "cache-control": "private, max-age=60" } },
    { headers: { "cache-control": "no-store" } },
    { headers: { "content-type": "text/html; charset=utf-8" } },
  ] as ResponseInit[])("does not cache an unsuitable response %j", async (init) => {
    const h = harness();
    h.fetch.mockResolvedValue(new Response("response", init));
    const event = h.dispatch("fetch", h.request("assets/app.js"));
    await event.done();
    expect(await (await event.response)!.text()).toBe("response");
    expect(h.cache.put).not.toHaveBeenCalled();
  });

  it("does not cache redirected assets", async () => {
    const h = harness();
    const response = new Response("redirected");
    Object.defineProperty(response, "redirected", { value: true });
    h.fetch.mockResolvedValue(response);
    await h.dispatch("fetch", h.request("assets/app.js")).done();
    expect(h.cache.put).not.toHaveBeenCalled();
  });

  it("keeps pending cache writes alive", async () => {
    const h = harness();
    let finish!: () => void;
    h.cache.put.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const event = h.dispatch("fetch", h.request("assets/app.js"));
    expect(await (await event.response)!.text()).toBe("network");
    let completed = false;
    const done = event.done().then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    finish();
    await done;
    expect(completed).toBe(true);
  });

  it.each(["open", "put"] as const)("does not fail a successful fetch when cache %s fails", async (method) => {
    const h = harness();
    if (method === "open") h.caches.open.mockRejectedValue(new Error("unavailable"));
    else h.cache.put.mockRejectedValue(new Error("quota"));
    const event = h.dispatch("fetch", h.request("assets/app.js"));
    expect(await (await event.response)!.text()).toBe("network");
    await expect(event.done()).resolves.toBeDefined();
  });

  it("propagates an uncached offline asset failure without an unhandled lifetime rejection", async () => {
    const h = harness();
    h.fetch.mockRejectedValue(new Error("offline"));
    const event = h.dispatch("fetch", h.request("assets/app.js"));
    await expect(event.response).rejects.toThrow("offline");
    await expect(event.done()).resolves.toBeDefined();
  });
});
