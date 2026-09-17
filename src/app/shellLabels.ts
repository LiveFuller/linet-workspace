export const workspaceLabels = {
  cs: { myWork: "Moje práce", project: "Projekt", followUp: "Výstupy z porad", tools: "Další nástroje", workspace: "Pracovní prostor", note: "Konverzace a hovory patří do Teams. Zde sledujte práci a výstupy.", integration: "Propojení s Teams zatím není nastavené." },
  en: { myWork: "My work", project: "Project", followUp: "Meeting follow-up", tools: "More tools", workspace: "Workspace", note: "Keep conversations and calls in Teams. Track work and outcomes here.", integration: "Teams integration is not configured yet." },
};

// Small label helpers for the shell.
import type { Strings } from "@/locales/strings";

export function modeLocalLabel(t: Strings): string {
  return t.mode_local_badge;
}

export function demoPersonaLabel(t: Strings): string {
  return t.persona_switcher;
}
