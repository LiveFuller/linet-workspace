// MorePage — /more  (mobile bottom-nav "More" hub)
import { Link } from "react-router-dom";
import {
  LayoutGrid, CalendarDays, LineChart, GraduationCap, LifeBuoy,
  FolderOpen, Users, Plug, Settings, Search, ListChecks,
  Sun, Briefcase, BookOpen, Shield, ChevronRight, MoreHorizontal
} from "lucide-react";
import { useApp } from "@/app/AppProvider";

export default function MorePage() {
  const { snapshot, t } = useApp();
  const projectId = snapshot?.projects[0]?.id ?? "";

  const Group = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <section className="card" aria-labelledby={title} style={{ padding: 14 }}>
      <h3 id={title} style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-secondary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden style={{ width: 24, height: 24, borderRadius: 8, background: "var(--brand-soft)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-soft-strong)" }}>
          {icon}
        </span>
        {title}
      </h3>
      <ul className="stack" role="list" style={{ gap: 8 }}>
        {children}
      </ul>
    </section>
  );

  const Item = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
    <li>
      <Link
        to={to}
        className="card card-interactive row-between"
        style={{ textDecoration: "none", color: "inherit", minHeight: 44, padding: "10px 12px", gap: 12 }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: "var(--canvas)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--border-ghost)" }}>
            {icon}
          </span>
          <span className="task-title" style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
        </span>
        <span aria-hidden style={{ width: 32, height: 32, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border-ghost)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", flexShrink: 0 }}>
          <ChevronRight size={14} />
        </span>
      </Link>
    </li>
  );

  return (
    <div className="page">
      <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-soft)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-soft-strong)" }}>
          <MoreHorizontal size={18} />
        </span>
        {t.nav_more}
      </h1>
      <p className="xsmall muted mb-12" style={{ lineHeight: 1.5, display: "flex", gap: 6, alignItems: "center" }}>
        <Sun size={12} aria-hidden /> {t.tagline}
      </p>

      <div className="stack mt-12" style={{ gap: 16 }}>
        <Group title={t.nav_group_daily} icon={<Sun size={14} aria-hidden />}>
          <Item to={projectId ? `/projects/${projectId}` : "/"} icon={<LayoutGrid size={18} />} label={t.nav_overview} />
          <Item to="/calendar" icon={<CalendarDays size={18} />} label={t.nav_calendar} />
          <Item to="/tasks" icon={<ListChecks size={18} />} label={t.nav_tasks} />
          <Item to="/search" icon={<Search size={18} />} label={t.search_title} />
        </Group>

        <Group title={t.nav_group_coord} icon={<Briefcase size={14} aria-hidden />}>
          <Item to="/reports" icon={<LineChart size={18} />} label={t.nav_reports} />
          <Item to="/meetings" icon={<CalendarDays size={18} />} label={t.nav_meetings} />
        </Group>

        <Group title={t.nav_group_learn} icon={<BookOpen size={14} aria-hidden />}>
          <Item to="/learning" icon={<GraduationCap size={18} />} label={t.nav_learning} />
          <Item to="/support" icon={<LifeBuoy size={18} />} label={t.nav_support} />
          <Item to="/documents" icon={<FolderOpen size={18} />} label={t.nav_documents} />
        </Group>

        <Group title={t.nav_group_admin} icon={<Shield size={14} aria-hidden />}>
          <Item to="/team" icon={<Users size={18} />} label={t.nav_team} />
          <Item to="/integrations" icon={<Plug size={18} />} label={t.nav_integrations} />
          <Item to="/settings" icon={<Settings size={18} />} label={t.nav_settings} />
        </Group>
      </div>
    </div>
  );
}
