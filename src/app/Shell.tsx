// App shell: top bar (mobile) + bottom nav (mobile) + sidebar (desktop) + command palette.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Bell, CalendarDays, CheckSquare, GraduationCap, Home, LayoutGrid,
  LifeBuoy, LineChart, FolderOpen, Plug, Search, Settings,
  Users, Inbox as InboxIcon, Menu, Plus, Sparkles,
  QrCode, Building2, Send,
} from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { Modal } from "@/components/Modal";
import { modeLocalLabel, workspaceLabels } from "./shellLabels";

function NotificationsModal({ onClose }: { onClose: () => void }) {
  const { snapshot, persona, repo, t, refresh } = useApp();
  const { toast } = useToast();
  const mine = (snapshot?.notifications ?? []).filter((n) => n.personId === persona?.id);
  return (
    <Modal title={t.notifications_title} onClose={onClose}>
      {mine.length === 0 && (
        <div className="empty-state">
          <div className="empty-illust"><Bell size={20} aria-hidden /></div>
          <div className="empty-title">{t.notifications_empty}</div>
        </div>
      )}
      <ul className="stack">
        {mine.map((n) => (
          <li key={n.id} className="card" style={{ padding: 14 }}>
            <div className="row-between">
              <strong className="small">{n.title}</strong>
              {n.readAt ? <span className="xsmall muted">✓</span> : <span className="status-pill st-progress" style={{ fontSize: 11 }}>nové</span>}
            </div>
            <p className="small muted" style={{ margin: "6px 0 10px", lineHeight: 1.5 }}>{n.body}</p>
            <div className="row">
              <Link className="btn btn-secondary btn-sm" to={n.destination} onClick={onClose}>{t.today_view_all}</Link>
              {!n.readAt && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    await repo!.markNotificationRead(n.id);
                    refresh();
                  }}
                >
                  Označit přečtené
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {mine.length > 0 && (
        <button
          className="btn btn-secondary btn-sm mt-12"
          onClick={async () => {
            if (persona) await repo!.markAllNotificationsRead(persona.id);
            toast(t.saved);
            refresh();
          }}
        >
          {t.notifications_mark_all}
        </button>
      )}
    </Modal>
  );
}

function AddSheet({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const nav = useNavigate();
  const go = (path: string) => { onClose(); nav(path); };
  return (
    <Modal title={t.add_choose} onClose={onClose}>
      <div className="stack">
        <button className="card card-interactive row" style={{ padding: 14, width: "100%" }} onClick={() => go("/tasks/new")}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--brand-soft)", color: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CheckSquare size={18} aria-hidden />
          </span>
          <span style={{ textAlign: "left" }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{t.add_task}</span>
            <span className="xsmall muted">Název + majitel → hotovo za 10 s</span>
          </span>
        </button>
        <button className="card card-interactive row" style={{ padding: 14, width: "100%" }} onClick={() => go("/meetings/new")}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--canvas-subtle)", color: "var(--ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CalendarDays size={18} aria-hidden />
          </span>
          <span style={{ textAlign: "left" }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{t.add_meeting}</span>
            <span className="xsmall muted">Naplánovat poradu / review</span>
          </span>
        </button>
        <button className="card card-interactive row" style={{ padding: 14, width: "100%" }} onClick={() => go("/inbox/new")}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--warning-soft)", color: "var(--warning)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <InboxIcon size={18} aria-hidden />
          </span>
          <span style={{ textAlign: "left" }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{t.add_inbox_item}</span>
            <span className="xsmall muted">Poznámka, e-mail, přepis</span>
          </span>
        </button>
        <button className="card card-interactive row" style={{ padding: 14, width: "100%" }} onClick={() => go("/support/new")}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--danger-soft)", color: "var(--danger)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <LifeBuoy size={18} aria-hidden />
          </span>
          <span style={{ textAlign: "left" }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{t.add_support}</span>
            <span className="xsmall muted">Požadavek na IT / přístupy</span>
          </span>
        </button>
      </div>
    </Modal>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const items = useMemo(() => {
    const all = [
      { label: "Waygo Owner", desc: "Owner dashboard / QR metrics", icon: QrCode, to: "/waygo", keys: "g w" },
      { label: "Waygo Hotely", desc: "Hotely & QR kódy", icon: Building2, to: "/waygo/hotels", keys: "g h" },
      { label: "Waygo Outreach", desc: "Pipeline & AI drafts", icon: Send, to: "/waygo/outreach", keys: "g o" },
      { label: t.add_task, desc: "Vytvořit úkol", icon: CheckSquare, to: "/tasks/new", keys: "t" },
      { label: t.nav_tasks, desc: "Zobrazit úkoly", icon: CheckSquare, to: "/tasks", keys: "g t" },
      { label: t.nav_calendar, desc: "Kalendář / agenda", icon: CalendarDays, to: "/calendar", keys: "g c" },
      { label: t.nav_meetings, desc: "Schůzky a review", icon: LayoutGrid, to: "/meetings", keys: "g m" },
      { label: t.nav_inbox, desc: "Sběrná schránka", icon: InboxIcon, to: "/inbox", keys: "g i" },
      { label: t.nav_reports, desc: "Reporty", icon: LineChart, to: "/reports", keys: "g r" },
      { label: t.nav_learning, desc: "Učení", icon: GraduationCap, to: "/learning", keys: "g l" },
      { label: t.nav_support, desc: "Podpora", icon: LifeBuoy, to: "/support", keys: "g s" },
      { label: t.nav_documents, desc: "Dokumenty", icon: FolderOpen, to: "/documents", keys: "g d" },
      { label: t.nav_team, desc: "Tým a vytížení", icon: Users, to: "/team", keys: "g t" },
    ];
    if (!q.trim()) return all.slice(0, 7);
    const nq = q.toLowerCase();
    return all.filter((x) => x.label.toLowerCase().includes(nq) || x.desc.toLowerCase().includes(nq));
  }, [q, t]);

  const go = (to: string) => { onClose(); nav(to); };

  return (
    <>
      <div className="cmdk-overlay" onClick={onClose} aria-hidden />
      <div className="cmdk-panel" role="dialog" aria-modal="true" aria-label="Příkazy">
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder={`${t.search_placeholder} — zkuste “úkol”, “schůzka”…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && items[0]) go(items[0].to);
          }}
        />
        <div className="cmdk-list" role="listbox">
          {items.map((it) => (
            <button key={it.to} className="cmdk-item" role="option" aria-selected={false} onClick={() => go(it.to)}>
              <it.icon size={18} aria-hidden />
              <span style={{ fontWeight: 600 }}>{it.label}</span>
              <span className="muted small">{it.desc}</span>
              <kbd>{it.keys}</kbd>
            </button>
          ))}
          {items.length === 0 && <div className="small muted" style={{ padding: 16, textAlign: "center" }}>{t.search_empty}</div>}
        </div>
      </div>
    </>
  );
}

function TopBar() {
  const { t, snapshot, persona, prefs, online } = useApp();
  const [showNotif, setShowNotif] = useState(false);
  const [showCmd, setShowCmd] = useState(false);
  void useNavigate;
  const unread = (snapshot?.notifications ?? []).filter((n) => n.personId === persona?.id && !n.readAt).length;
  const project = snapshot?.projects[0];
  const isCs = prefs.locale === "cs";

  // Cmd+K
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCmd((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <>
      <header className="top-bar" role="banner">
        <Link to="/" className="brand" aria-label="LINET Workspace">
          <span className="brand-mark">L</span>
          <span className="brand-word">LINET</span>
          <span className="brand-sub">Workspace</span>
        </Link>

        <button className="search-pill" onClick={() => setShowCmd(true)} aria-label={t.search_title}>
          <Search size={16} aria-hidden />
          <span>{t.search_placeholder}</span>
          <kbd>⌘K</kbd>
        </button>

        <span className="spacer" />

        <button className="icon-btn" aria-label={t.search_title} onClick={() => setShowCmd(true)} style={{ display: "inline-flex" }}>
          <Search size={18} aria-hidden />
        </button>

        <button className="icon-btn" aria-label={`${t.notifications_title}${unread ? ` (${unread})` : ""}`} onClick={() => setShowNotif(true)}>
          <Bell size={18} aria-hidden />
          {unread > 0 && unread < 10 && <span className="badge-dot" aria-hidden />}
          {unread >= 1 && unread < 10 ? null : unread >= 10 ? <span className="badge-count" aria-hidden>{unread > 99 ? "99+" : unread}</span> : null}
          {unread > 0 && unread < 10 ? <span className="badge-count" style={{ minWidth: 16, height: 16, fontSize: 10, padding: "0 4px" }} aria-hidden>{unread}</span> : null}
        </button>

        {!online && <span className="status-pill st-waiting" role="status" style={{ fontSize: 11, padding: "2px 8px" }}>{t.offline_badge}</span>}

        <span className="status-pill" style={{ background: "var(--brand-soft)", color: "var(--brand-strong)", borderColor: "var(--brand-soft-strong)", fontSize: 11 }} role="status" aria-label="Demo režim">
          <Sparkles size={12} aria-hidden /> {modeLocalLabel(t)}
        </span>
      </header>

      <div className="project-context no-print">
        <span className="dot" aria-hidden />
        <span className="small" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {project ? (isCs ? project.name : project.nameEn) : t.loading}
        </span>
        <span className="xsmall muted" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: online ? "var(--success)" : "var(--warning)", display: "inline-block" }} aria-hidden />
          {online ? "Online" : "Offline"}
        </span>
      </div>

      {showNotif && <NotificationsModal onClose={() => setShowNotif(false)} />}
      {showCmd && <CommandPalette onClose={() => setShowCmd(false)} />}
    </>
  );
}

function BottomNav() {
  const { t, prefs } = useApp();
  const labels = workspaceLabels[prefs.locale];
  const [showAdd, setShowAdd] = useState(false);
  return (
    <>
      <nav className="bottom-nav" aria-label={t.appName}>
        <NavLink to="/" end>
          <Home size={20} aria-hidden />
          <span>{labels.myWork}</span>
        </NavLink>
        <NavLink to="/waygo" end>
          <QrCode size={20} aria-hidden />
          <span>Waygo</span>
        </NavLink>
        <button
          onClick={() => setShowAdd(true)}
          aria-label={t.nav_add}
          style={{ background: "none", border: "none", flex: 1, display: "flex", justifyContent: "center" }}
        >
          <span className="nav-add"><Plus size={24} aria-hidden /></span>
        </button>
        <NavLink to="/meetings">
          <CalendarDays size={20} aria-hidden />
          <span>{t.nav_meetings}</span>
        </NavLink>
        <NavLink to="/more">
          <Menu size={20} aria-hidden />
          <span>{t.nav_more}</span>
        </NavLink>
      </nav>
      {showAdd && <AddSheet onClose={() => setShowAdd(false)} />}
    </>
  );
}

function Sidebar() {
  const { t, prefs } = useApp();
  const labels = workspaceLabels[prefs.locale];
  return (
    <nav className="sidebar" aria-label={t.appName}>
      <div className="brand-block">
        <span className="brand-mark">L</span>
        <span className="brand-word">LINET</span>
        <span className="brand-sub">Workspace</span>
      </div>
      <div className="sidebar-group-label">{labels.myWork}</div>
      <NavLink to="/" end><Home size={18} aria-hidden /> {t.nav_today}</NavLink>
      <NavLink to="/tasks"><CheckSquare size={18} aria-hidden /> {t.nav_tasks}</NavLink>
      <NavLink to="/inbox"><InboxIcon size={18} aria-hidden /> {t.nav_inbox}</NavLink>
      <div className="sidebar-group-label">{labels.project}</div>
      <NavLink to="/waygo" end><QrCode size={18} aria-hidden /> Waygo</NavLink>
      <NavLink to="/calendar"><CalendarDays size={18} aria-hidden /> {t.nav_calendar}</NavLink>
      <NavLink to="/meetings"><LayoutGrid size={18} aria-hidden /> {t.nav_meetings}</NavLink>
      <div className="sidebar-group-label">{t.nav_group_coord}</div>
      <NavLink to="/reports"><LineChart size={18} aria-hidden /> {t.nav_reports}</NavLink>
      <NavLink to="/team"><Users size={18} aria-hidden /> {t.nav_team}</NavLink>
      <div className="sidebar-group-label">{labels.tools}</div>
      <NavLink to="/learning"><GraduationCap size={18} aria-hidden /> {t.nav_learning}</NavLink>
      <NavLink to="/support"><LifeBuoy size={18} aria-hidden /> {t.nav_support}</NavLink>
      <NavLink to="/documents"><FolderOpen size={18} aria-hidden /> {t.nav_documents}</NavLink>
      <NavLink to="/integrations"><Plug size={18} aria-hidden /> {t.nav_integrations}</NavLink>
      <NavLink to="/settings"><Settings size={18} aria-hidden /> {t.nav_settings}</NavLink>
    </nav>
  );
}

export function AppShell({ routes }: { routes: React.ReactNode }) {
  return (
    <div className="app-body">
      <a href="#main-content" className="skip-link">Přeskočit na obsah / Skip to content</a>
      <Sidebar />
      <div className="app-maincol">
        <TopBar />
        <main id="main-content" className="main-area">
          {routes}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

export { TopBar, BottomNav };
