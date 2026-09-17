/* global navigator, document, fetch, caches, location -- Playwright page callbacks execute in the browser. */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { preview } from "vite";

// Run after building with the same base and output directory.
const [base = "/linetapp/", outDir = "dist"] = process.argv.slice(2);
assert.ok(base.startsWith("/") && base.endsWith("/"));
const server = await preview({ base, build: { outDir }, preview: { host: "127.0.0.1", port: 0, open: false } });
let browser;
try {
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + base);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const registration = await page.evaluate(async () => {
    const current = await navigator.serviceWorker.ready;
    return { scope: current.scope, script: current.active?.scriptURL };
  });
  assert.deepEqual(registration, { scope: origin + base, script: origin + base + "sw.js" });

  // Populate runtime caches under the now-active worker before going offline.
  await page.reload();
  await page.locator("#main-content").waitFor();
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const url = link.href;
    const value = await (await fetch(url)).json();
    return { start: new URL(value.start_url, url).href, scope: new URL(value.scope, url).href };
  });
  assert.deepEqual(manifest, { start: origin + base, scope: origin + base });
  await page.waitForFunction(async () => {
    const names = await caches.keys();
    const own = names.find((name) => name.startsWith(`linet-ws:${encodeURIComponent(new URL("./", location.href).href)}:`));
    if (!own) return false;
    const cache = await caches.open(own);
    const scripts = [...document.querySelectorAll("script[src]")];
    return (await Promise.all(scripts.map((script) => cache.match(script.src)))).every(Boolean);
  });
  await context.setOffline(true);
  await page.goto(origin + base + "tasks");
  await page.locator("#main-content").waitFor();
  assert.ok((await page.locator("#main-content").innerText()).trim().length > 0);
  assert.deepEqual(errors, []);
  console.log(`PASS ${base}: real Chromium registration, manifest scope, cached offline task navigation`);
  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
