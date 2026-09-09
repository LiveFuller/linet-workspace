import "@testing-library/react";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Testing Library cleanup
// ---------------------------------------------------------------------------
afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// jsdom: matchMedia mock (used by theme/layout/media-query hooks)
// ---------------------------------------------------------------------------
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Ensure existing matchMedia also has modern addEventListener/removeEventListener
if (typeof window !== "undefined" && window.matchMedia) {
  const original = window.matchMedia;
  window.matchMedia = (query: string) => {
    const mql = original(query) as unknown as Record<string, unknown>;
    if (typeof mql["addEventListener"] !== "function" && typeof mql["addListener"] === "function") {
      mql["addEventListener"] = mql["addListener"] as () => void;
    }
    if (typeof mql["removeEventListener"] !== "function" && typeof mql["removeListener"] === "function") {
      mql["removeEventListener"] = mql["removeListener"] as () => void;
    }
    return mql as unknown as MediaQueryList;
  };
}

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// ---------------------------------------------------------------------------
if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "0px";
    readonly thresholds: ReadonlyArray<number> = [0];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
  (globalThis as unknown as Record<string, unknown>)["IntersectionObserver"] =
    MockIntersectionObserver;
}

// ---------------------------------------------------------------------------
// ResizeObserver mock
// ---------------------------------------------------------------------------
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class MockResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: MockResizeObserver,
  });
  (globalThis as unknown as Record<string, unknown>)["ResizeObserver"] =
    MockResizeObserver;
}

// ---------------------------------------------------------------------------
// crypto.randomUUID polyfill (jsdom / older Node)
// ---------------------------------------------------------------------------
if (typeof globalThis.crypto === "undefined") {
  const { webcrypto } = await import("node:crypto");
  (globalThis as unknown as Record<string, unknown>)["crypto"] = webcrypto as unknown as Crypto;
}

if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID !== "function") {
  // RFC 4122 v4 via getRandomValues
  globalThis.crypto.randomUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    // Set version (4) and variant (10xxxxxx)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}` as const;
  };
}
