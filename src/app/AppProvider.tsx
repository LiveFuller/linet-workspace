// AppProvider: loads snapshot, wires subscriptions, persona, prefs, theme, clock, online state.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import type { DataSnapshot, WorkspaceRepository } from "@/data/contracts/repository";
import { getRepository, loadPrefs, savePrefs, DEFAULT_PREFS, PERSONA_KEY, type AppStoreState, type Prefs } from "./store";
import type { Person } from "@/domain/types";
import { todayInZone, DEFAULT_CLOCK, TZ_PRAGUE } from "@/lib/dates";
import { STRINGS } from "@/locales/strings";

interface Ctx extends AppStoreState {
  setPersona: (p: Person | null) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
  refresh: () => void;
  today: string; // date-only in project timezone
  t: typeof STRINGS["cs"];
}

const AppCtx = createContext<Ctx | null>(null);

function detectSupabaseMode(): boolean {
  return import.meta.env.VITE_DATA_MODE === "supabase";
}

// Lazy: only initialize Supabase repository in supabase mode (and only after config validation).
async function initRepository(): Promise<WorkspaceRepository> {
  if (detectSupabaseMode()) {
    const { createSupabaseRepository } = await import("@/data/supabase/SupabaseRepository");
    return createSupabaseRepository();
  }
  return getRepository();
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<WorkspaceRepository | null>(null);
  const [snapshot, setSnapshot] = useState<DataSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersonaState] = useState<Person | null>(null);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [online, setOnline] = useState(navigator.onLine);
  const [storagePersistent, setStoragePersistent] = useState(false);
  const clockRef = useRef(DEFAULT_CLOCK);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setPrefsState(loadPrefs());
    (async () => {
      if (navigator.storage?.persist) {
        try {
          const already = await navigator.storage.persisted();
          if (!already) await navigator.storage.persist(); // request; may be denied
          setStoragePersistent(await navigator.storage.persisted());
        } catch { /* not supported */ }
      }
    })();
  }, []);

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => root.setAttribute("data-theme", dark ? "dark" : "light");
    if (prefs.theme === "dark") apply(true);
    else if (prefs.theme === "light") apply(false);
    else {
      const mq = matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches);
      const h = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener("change", h);
      return () => mq.removeEventListener("change", h);
    }
  }, [prefs.theme]);

  // Keyboard focus visibility (avoid outline on pointer)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") document.body.classList.add("using-keyboard");
    };
    const onPtr = () => document.body.classList.remove("using-keyboard");
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPtr);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onPtr); };
  }, []);

  // Online/offline
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const refresh = useCallback(() => {
    setTick((x) => x + 1);
  }, []);

  // Boot repository
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let alive = true;
    (async () => {
      const r = await initRepository();
      const ready = await r.ready();
      if (!alive) return;
      if (!ready.ok) {
        setError(ready.error.code === "not_configured" ? ready.error.message : `${ready.error.code}: ${"message" in ready.error ? ready.error.message : ""}`);
        setLoading(false);
        return;
      }
      setRepo(r);
      const snap = await r.loadSnapshot();
      if (!alive) return;
      if (snap.ok) {
        setSnapshot(snap.data);
        // restore persona if stored
        const savedId = localStorage.getItem(PERSONA_KEY);
        if (r.mode === "local" && savedId) {
          const p = snap.data.people.find((x) => x.id === savedId) ?? null;
          if (p) {
            const local = r as unknown as { setPersona?: (p: Person | null) => void };
            local.setPersona?.(p);
            setPersonaState(p);
          }
        }
      } else {
        setError(snap.error.code);
      }
      setLoading(false);
      unsubscribe = r.subscribe(() => {
        r.loadSnapshot().then((s) => { if (s.ok && alive) setSnapshot(s.data); });
      });
    })();
    return () => { alive = false; unsubscribe?.(); };
  }, []);

  // Reload snapshot on tick (post-mutation refresh)
  useEffect(() => {
    if (!repo || loading) return;
    repo.loadSnapshot().then((s) => { if (s.ok) setSnapshot(s.data); });
  }, [tick, repo, loading]);

  const setPersona = useCallback((p: Person | null) => {
    setPersonaState(p);
    const local = repo as unknown as { setPersona?: (p: Person | null) => void };
    local?.setPersona?.(p);
    if (p && repo?.mode === "local") localStorage.setItem(PERSONA_KEY, p.id);
    if (!p) localStorage.removeItem(PERSONA_KEY);
  }, [repo]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const project = snapshot?.projects[0] ?? null;
  const today = useMemo(
    () => todayInZone(clockRef.current, project?.timezone ?? TZ_PRAGUE),
    [project?.timezone, tick]
  );

  const value: Ctx = useMemo(() => ({
    repo: repo ?? (null as unknown as WorkspaceRepository), snapshot, loading, error, persona, prefs,
    clock: clockRef.current, online, storagePersistent,
    setPersona, setPrefs, refresh, today,
    t: STRINGS[prefs.locale],
  }), [repo, snapshot, loading, error, persona, prefs, online, storagePersistent, setPersona, setPrefs, refresh, today]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

export function useT2() {
  return useApp().t;
}
