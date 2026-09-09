// SupportPage — /support
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, LifeBuoy, ShieldAlert, Wifi, Monitor, GraduationCap, Box, Layers, Clock3, Inbox } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { EmptyState, SkeletonStack } from "@/components/primitives";
import { formatDateOnly } from "@/lib/dates";

type Tab = "mine" | "queue";
type StatusFilter = "all" | "captured" | "awaiting_official_ticket" | "with_linet_it" | "waiting_user" | "resolved";

const CAT_ICON: Record<string, React.ReactNode> = {
  access: <ShieldAlert size={16} aria-hidden />,
  copilot: <Box size={16} aria-hidden />,
  teams: <Layers size={16} aria-hidden />,
  vpn: <Wifi size={16} aria-hidden />,
  hardware: <Monitor size={16} aria-hidden />,
  training: <GraduationCap size={16} aria-hidden />,
  other: <LifeBuoy size={16} aria-hidden />,
};

export default function SupportPage() {
  const { snapshot, persona, t, prefs } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("mine");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  if (!snapshot || !persona) return <div className="page"><SkeletonStack count={3} /></div>;

  const canSeeQueue = persona.role === "it_coordinator" || persona.role === "workspace_admin";
  const mine = snapshot.supportTickets.filter((tk) => tk.requesterId === persona.id);
  const queue = snapshot.supportTickets;
  const list = tab === "mine" ? mine : queue;

  const filtered = useMemo(() => {
    const base = statusFilter === "all" ? list : list.filter((tk) => tk.status === statusFilter);
    return [...base].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [list, statusFilter]);

  const statusClass = (s: string) =>
    s === "resolved" ? "st-done"
    : s === "captured" ? "st-todo"
    : s === "with_linet_it" ? "st-progress"
    : "st-waiting";

  const statusOpts: { value: StatusFilter; label: string }[] = [
    { value: "all", label: t.today_view_all },
    { value: "captured", label: (t.support_status as Record<string, string>).captured },
    { value: "awaiting_official_ticket", label: (t.support_status as Record<string, string>).awaiting_official_ticket },
    { value: "with_linet_it", label: (t.support_status as Record<string, string>).with_linet_it },
    { value: "waiting_user", label: (t.support_status as Record<string, string>).waiting_user },
    { value: "resolved", label: (t.support_status as Record<string, string>).resolved },
  ];

  return (
    <div className="page">
      <div className="row-between mb-12" style={{ gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-soft)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-soft-strong)" }}>
              <LifeBuoy size={18} />
            </span>
            {t.support_title}
          </h1>
          <p className="xsmall muted mt-4" style={{ lineHeight: 1.4 }}>{t.support_private_note}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => nav("/support/new")} style={{ minHeight: 44, flexShrink: 0 }}>
          <PlusCircle size={16} aria-hidden /> {t.support_new}
        </button>
      </div>

      <div className="segmented mb-12" role="tablist" aria-label={t.support_title} style={{ minHeight: 44 }}>
        <button
          role="tab"
          aria-selected={tab === "mine"}
          className={tab === "mine" ? "active" : ""}
          onClick={() => setTab("mine")}
          style={{ minHeight: 36 }}
        >
          {t.support_my_requests} · {mine.length}
        </button>
        <button
          role="tab"
          aria-selected={tab === "queue"}
          className={tab === "queue" ? "active" : ""}
          onClick={() => { if (canSeeQueue) setTab("queue"); }}
          disabled={!canSeeQueue}
          title={!canSeeQueue ? t.support_private_note : undefined}
          aria-disabled={!canSeeQueue}
          style={{ minHeight: 36 }}
        >
          {t.support_queue} · {queue.length}
        </button>
      </div>

      {!canSeeQueue && tab === "queue" && (
        <div className="banner banner-warn small mb-12" role="note">{t.support_private_note}</div>
      )}

      <div className="chip-row mb-12" role="group" aria-label={t.support_status.captured}>
        {statusOpts.map((o) => (
          <button
            key={o.value}
            className={`chip ${statusFilter === o.value ? "active" : ""}`}
            onClick={() => setStatusFilter(o.value)}
            aria-pressed={statusFilter === o.value}
            style={{ minHeight: 44 }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t.support_none}
          body={statusFilter !== "all" ? t.filters_clear : undefined}
          icon={<Inbox size={20} aria-hidden />}
          action={statusFilter !== "all" ? <button className="btn btn-secondary btn-sm" onClick={() => setStatusFilter("all")} style={{ minHeight: 44 }}>{t.filters_clear}</button> : undefined}
        />
      ) : (
        <ul className="stack" role="list">
          {filtered.map((tk) => {
            const cat = (t.support_categories as Record<string, string>)[tk.category] ?? tk.category;
            const st = (t.support_status as Record<string, string>)[tk.status] ?? tk.status;
            const impactLabel = tk.impact ? (t.support_impact_levels as Record<string, string>)[tk.impact] ?? tk.impact : "";
            return (
              <li key={tk.id}>
                <Link
                  to={`/support/${tk.id}`}
                  className="card card-interactive row-between"
                  style={{ textDecoration: "none", color: "inherit", gap: 12, minHeight: 44 }}
                >
                  <span style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, flex: 1 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: "var(--canvas)", border: "1px solid var(--border-ghost)",
                        display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--brand-strong)",
                      }}
                    >
                      {CAT_ICON[tk.category] ?? <LifeBuoy size={16} />}
                    </span>
                    <span className="task-main" style={{ minWidth: 0 }}>
                      <span className="task-title" style={{ fontSize: 14.5, display: "block", lineHeight: 1.35 }}>{tk.title}</span>
                      <span className="task-meta" style={{ marginTop: 4, gap: 8 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 650 }}>
                          {cat} {impactLabel ? `· ${impactLabel}` : ""}
                        </span>
                        {tk.followUpDate && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Clock3 size={11} aria-hidden /> {t.support_followup}: {formatDateOnly(tk.followUpDate, prefs.locale)}
                          </span>
                        )}
                        <span className="xsmall muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {formatDateOnly(tk.createdAt.slice(0, 10), prefs.locale)}
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className={`status-pill ${statusClass(tk.status)}`} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{st}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="banner banner-info small mt-16" role="note" style={{ display: "flex", gap: 10 }}>
        <LifeBuoy size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{t.support_saved_app_vs_official}</span>
      </div>
    </div>
  );
}
