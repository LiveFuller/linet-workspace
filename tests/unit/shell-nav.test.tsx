import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/app/Shell";
import { workspaceLabels } from "@/app/shellLabels";

// Mock the app context: the shell only reads labels/prefs/persona/notification fields here.
let mockApp: Record<string, unknown>;
vi.mock("@/app/AppProvider", () => ({
  useApp: () => mockApp,
}));

vi.mock("@/components/Toaster", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const baseContext = {
  t: {
    appName: "LINET Workspace",
    nav_today: "Dnes",
    nav_tasks: "Úkoly",
    nav_inbox: "Inbox",
    nav_calendar: "Kalendář",
    nav_meetings: "Porady",
    nav_reports: "Reporty",
    nav_team: "Tým",
    nav_learning: "Vzdělávání",
    nav_support: "Podpora",
    nav_documents: "Dokumenty",
    nav_integrations: "Integrace",
    nav_settings: "Nastavení",
    nav_more: "Více",
    nav_add: "Přidat",
    nav_group_coord: "Koordinace",
    search_title: "Hledat",
    notifications_title: "Notifikace",
    mode_local_badge: "Demo",
    search_placeholder: "Hledat…",
    offline_badge: "Offline",
    loading: "Načítání…",
  },
  snapshot: { notifications: [], projects: [{ id: "p1", name: "Projekt", nameEn: "Project" }] },
  persona: { id: "u1", name: "Test" },
  prefs: { locale: "cs" as const },
  online: true,
};

function renderShell(locale: "cs" | "en" = "cs") {
  mockApp = { ...baseContext, prefs: { ...baseContext.prefs, locale } };
  render(
    <MemoryRouter initialEntries={["/"]}>
      <AppShell routes={<div />} />
    </MemoryRouter>,
  );
  const navs = screen.getAllByRole("navigation", { name: "LINET Workspace" });
  const sidebar = navs.find((n) => n.className.includes("sidebar"));
  const bottom = navs.find((n) => n.className.includes("bottom-nav"));
  expect(sidebar).toBeTruthy();
  expect(bottom).toBeTruthy();
  return { sidebar: sidebar!, bottom: bottom! };
}

describe("Teams-oriented shell navigation", () => {
  beforeEach(() => {
    mockApp = { ...baseContext };
  });

  it("renders Czech sidebar groups with My work first and a single Waygo entry", () => {
    const { sidebar } = renderShell("cs");
    const labels = workspaceLabels.cs;
    const groupTexts = Array.from(sidebar.querySelectorAll(".sidebar-group-label")).map((el) => el.textContent);
    expect(groupTexts[0]).toBe(labels.myWork);
    expect(groupTexts).toContain(labels.project);
    expect(groupTexts).toContain(labels.tools);
    // Waygo appears exactly once as a nav link (subpages stay reachable from its hub).
    expect(within(sidebar).getAllByRole("link", { name: /Waygo/ })).toHaveLength(1);
    expect(within(sidebar).getByText("Dnes")).toBeTruthy();
  });

  it("renders English sidebar groups when locale is en", () => {
    const { sidebar } = renderShell("en");
    const labels = workspaceLabels.en;
    const groupTexts = Array.from(sidebar.querySelectorAll(".sidebar-group-label")).map((el) => el.textContent);
    expect(groupTexts[0]).toBe(labels.myWork);
    expect(groupTexts).toContain(labels.project);
    expect(groupTexts).toContain(labels.tools);
  });

  it("mobile bottom nav labels home as My work and keeps add action", () => {
    const { bottom } = renderShell("cs");
    expect(within(bottom).getByText(workspaceLabels.cs.myWork)).toBeTruthy();
    expect(within(bottom).getByRole("button", { name: "Přidat" })).toBeTruthy();
    expect(within(bottom).getByText("Waygo")).toBeTruthy();
  });

  it("keeps secondary destinations reachable via links in the sidebar", () => {
    const { sidebar } = renderShell("cs");
    for (const name of ["Úkoly", "Kalendář", "Porady", "Reporty", "Tým", "Nastavení"]) {
      expect(within(sidebar).getAllByRole("link", { name: new RegExp(name) }).length).toBeGreaterThan(0);
    }
  });
});
