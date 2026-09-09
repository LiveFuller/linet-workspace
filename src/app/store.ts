// App store: repository + snapshot + persona + preferences, with subscription.
import { createContext, useContext } from "react";
import type { DataSnapshot, WorkspaceRepository } from "@/data/contracts/repository";
import { LocalRepository } from "@/data/local/LocalRepository";
import type { Locale } from "@/locales/strings";
import type { Person } from "@/domain/types";
import type { Clock } from "@/lib/dates";

export type ThemePref = "light" | "dark" | "system";

export interface Prefs {
  locale: Locale;
  displayTz: string;
  theme: ThemePref;
  soundOnComplete: boolean; // muted by default
  notifAssign: boolean;
  notifDeadline: boolean;
  notifSupport: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  locale: "cs",
  displayTz: "Europe/Prague",
  theme: "light",
  soundOnComplete: false,
  notifAssign: true,
  notifDeadline: true,
  notifSupport: true,
};

export interface AppStoreState {
  repo: WorkspaceRepository;
  snapshot: DataSnapshot | null;
  loading: boolean;
  error: string | null;
  persona: Person | null;
  prefs: Prefs;
  clock: Clock;
  online: boolean;
  storagePersistent: boolean;
}

// Singleton wiring (demo mode default; supabase mode replaces repository).
let repo: WorkspaceRepository | null = null;

export function getRepository(): WorkspaceRepository {
  if (!repo) {
    repo = new LocalRepository();
  }
  return repo;
}

export const AppStoreCtx = createContext<AppStoreState | null>(null);

export function useAppStore(): AppStoreState {
  const ctx = useContext(AppStoreCtx);
  if (!ctx) throw new Error("useAppStore outside provider");
  return ctx;
}

export function useT() {
  const { prefs } = useAppStore();
  return prefs.locale;
}

export const PREFS_KEY = "linet-workspace-prefs";
export const PERSONA_KEY = "linet-workspace-persona";

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFS };
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch { /* ignore */ }
}
