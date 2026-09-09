// SupportDetailPage — /support/:ticketId
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Copy, ShieldAlert, LifeBuoy, ChevronLeft, Pencil, Save, CalendarClock, User2, Tag, AlertTriangle } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { EmptyState, SkeletonStack } from "@/components/primitives";
import { formatInstant, formatDateOnly } from "@/lib/dates";
import { canViewSupportTicket } from "@/domain/permissions";

type SupportStatus = "captured" | "awaiting_official_ticket" | "with_linet_it" | "waiting_user" | "resolved";

const STATUS_ORDER: SupportStatus[] = ["captured", "awaiting_official_ticket", "with_linet_it", "waiting_user", "resolved"];

export default function SupportDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { snapshot, persona, t, prefs, repo, refresh } = useApp();
  const { toast } = useToast();

  const [officialRef, setOfficialRef] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState<string | null>(null);
  const [statusSel, setStatusSel] = useState<SupportStatus | null>(null);
  const [updateBody, setUpdateBody] = useState("");
  const [visibleToRequester, setVisibleToRequester] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingRef, setEditingRef] = useState(false);

  if (!snapshot || !persona || !ticketId) return <div className="page page-narrow"><SkeletonStack count={3} /></div>;

  const ticket = snapshot.supportTickets.find((x) => x.id === ticketId);
  if (!ticket) {
    return <div className="page page-narrow"><EmptyState title={t.not_found_title} body={t.not_found_object} icon={<LifeBuoy size={20} aria-hidden />} /></div>;
  }

  const canView = canViewSupportTicket(persona, ticket);
  if (!canView) {
    return (
      <div className="page page-narrow">
        <EmptyState title={t.not_found_title} body={t.support_private_note} icon={<ShieldAlert size={20} aria-hidden />} />
        <Link className="btn btn-secondary mt-12" to="/support" style={{ minHeight: 44 }}>{t.back}</Link>
      </div>
    );
  }

  const isCoordinator = persona.role === "it_coordinator" || persona.role === "workspace_admin";
  const isRequester = ticket.requesterId === persona.id;
  const canEditTicket = isCoordinator || isRequester || persona.role === "workspace_admin";

  const requester = snapshot.people.find((p) => p.id === ticket.requesterId);
  const coordinator = ticket.coordinatorId ? snapshot.people.find((p) => p.id === ticket.coordinatorId) : null;

  const currentOfficialRef = officialRef !== null ? officialRef : ticket.officialTicketRef ?? "";
  const currentFollowUp = followUpDate !== null ? followUpDate : ticket.followUpDate ?? "";
  const currentStatus = statusSel ?? ticket.status;

  const statusClass = (s: string) =>
    s === "resolved" ? "st-done" : s === "captured" ? "st-todo" : s === "with_linet_it" ? "st-progress" : "st-waiting";

  const dirtyRef = officialRef !== null && officialRef !== (ticket.officialTicketRef ?? "");
  const dirtyFollow = followUpDate !== null && followUpDate !== (ticket.followUpDate ?? "");
  const dirtyStatus = statusSel !== null && statusSel !== ticket.status;

  const saveTicket = async () => {
    if (!repo || !canEditTicket) return;
    const patch: Record<string, unknown> = {};
    if (dirtyRef) patch.officialTicketRef = currentOfficialRef.trim() || null;
    if (dirtyFollow) patch.followUpDate = currentFollowUp || null;
    if (dirtyStatus) patch.status = currentStatus;
    if (Object.keys(patch).length === 0) return;
    setBusy(true);
    const res = await repo.updateSupportTicket(ticket.id, patch as never, persona.id);
    setBusy(false);
    if (res.ok) {
      toast(t.saved);
      refresh();
      setOfficialRef(null);
      setFollowUpDate(null);
      setStatusSel(null);
      setEditingRef(false);
    }
  };

  const assignToMe = async () => {
    if (!repo || !isCoordinator || ticket.coordinatorId) return;
    setBusy(true);
    const res = await repo.updateSupportTicket(ticket.id, { coordinatorId: persona.id } as never, persona.id);
    setBusy(false);
    if (res.ok) { toast(t.saved); refresh(); }
  };

  const markResolved = async () => {
    if (!repo) return;
    setBusy(true);
    const res = await repo.updateSupportTicket(ticket.id, { status: "resolved" } as never, persona.id);
    setBusy(false);
    if (res.ok) { toast(t.support_resolved); refresh(); }
  };

  const reopen = async () => {
    if (!repo) return;
    setBusy(true);
    const res = await repo.updateSupportTicket(ticket.id, { status: "captured" } as never, persona.id);
    setBusy(false);
    if (res.ok) { toast(t.support_reopened); refresh(); }
  };

  const addUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateBody.trim() || !repo) return;
    setBusy(true);
    const vis = isCoordinator ? visibleToRequester : true;
    const res = await repo.addSupportUpdate(ticket.id, updateBody.trim(), vis, persona.id);
    setBusy(false);
    if (res.ok) {
      setUpdateBody("");
      toast(t.saved);
      refresh();
    }
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(updateBody);
      toast(t.support_copy_update_draft);
    } catch {
      const el = document.createElement("textarea");
      el.value = updateBody;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
      toast(t.support_copy_update_draft);
    }
  };

  const catLabel = (t.support_categories as Record<string, string>)[ticket.category] ?? ticket.category;
  const impactLabel = (t.support_impact_levels as Record<string, string>)[ticket.impact] ?? ticket.impact;
  const statusLabel = (t.support_status as Record<string, string>)[ticket.status] ?? ticket.status;

  const updates = snapshot.supportUpdates
    .filter((u) => u.ticketId === ticket.id)
    .filter((u) => {
      if (u.visibleToRequester) return true;
      if (isCoordinator) return true;
      if (u.authorId === persona.id) return true;
      return false;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="page page-narrow">
      <div className="row-between mb-12" style={{ gap: 12 }}>
        <Link className="btn btn-ghost btn-sm" to="/support" style={{ minHeight: 44 }}>
          <ChevronLeft size={16} aria-hidden /> {t.back}
        </Link>
        <span className={`status-pill ${statusClass(ticket.status)}`} style={{ flexShrink: 0 }}>{statusLabel}</span>
      </div>

      {/* Privacy banner */}
      <div className="banner banner-warn small mb-12" role="note" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <ShieldAlert size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{t.support_private_note}</span>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h1 style={{ fontSize: 20, lineHeight: 1.3 }}>{ticket.title}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <span className="status-pill st-todo" style={{ display: "inline-flex", gap: 6 }}><Tag size={12} aria-hidden /> {catLabel}</span>
          <span className={`status-pill ${ticket.impact === "high" ? "st-blocked" : ticket.impact === "medium" ? "st-waiting" : "st-todo"}`} style={{ display: "inline-flex", gap: 6 }}>
            <AlertTriangle size={12} aria-hidden /> {impactLabel}
          </span>
          <span className={`status-pill ${statusClass(ticket.status)}`}>{statusLabel}</span>
        </div>
        <dl className="detail-grid mt-12 kv small" style={{ gap: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <User2 size={14} aria-hidden style={{ color: "var(--text-tertiary)" }} />
            <div><dt>{t.task_owner_label}</dt><dd>{requester?.name ?? t.none}</dd></div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <LifeBuoy size={14} aria-hidden style={{ color: "var(--text-tertiary)" }} />
            <div><dt>{t.support_coordinator}</dt><dd>{coordinator?.name ?? t.none}</dd></div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <CalendarClock size={14} aria-hidden style={{ color: "var(--text-tertiary)" }} />
            <div><dt>{t.support_followup}</dt><dd>{ticket.followUpDate ? formatDateOnly(ticket.followUpDate, prefs.locale) : t.none}</dd></div>
          </div>
          <div><dt>{t.support_category}</dt><dd>{catLabel}</dd></div>
        </dl>
        {ticket.description && <p className="small mt-12" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, background: "var(--canvas)", border: "1px solid var(--border-ghost)", borderRadius: 10, padding: 12 }}>{ticket.description}</p>}
        <p className="xsmall muted mt-8" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span>{formatInstant(ticket.createdAt, prefs.locale, prefs.displayTz, true)}</span>
          <span aria-hidden>·</span>
          <span>{formatInstant(ticket.updatedAt, prefs.locale, prefs.displayTz, false)}</span>
        </p>
      </div>

      {/* Inline edit: Official ref + follow-up + status */}
      <div className="card mt-12" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Pencil size={14} aria-hidden style={{ color: "var(--brand-strong)" }} /> {t.support_official_ref}
        </h3>

        {/* Official ref inline edit */}
        <div className="field" style={{ marginBottom: 14 }}>
          <div className="row-between" style={{ marginBottom: 6 }}>
            <label htmlFor="sp-ref" style={{ marginBottom: 0 }}>{t.support_official_ref}</label>
            {!editingRef && canEditTicket && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingRef(true)} style={{ minHeight: 32, padding: "4px 10px" }}>
                <Pencil size={12} aria-hidden /> {t.edit}
              </button>
            )}
          </div>
          {editingRef || dirtyRef ? (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input
                id="sp-ref"
                className="input"
                value={currentOfficialRef}
                onChange={(e) => setOfficialRef(e.target.value)}
                disabled={!canEditTicket || busy}
                placeholder={t.support_official_ref_hint}
                style={{ flex: 1, minHeight: 44 }}
                autoFocus={editingRef}
              />
              <button className="btn btn-primary btn-sm" onClick={saveTicket} disabled={busy || !canEditTicket || !dirtyRef} style={{ minHeight: 44, flexShrink: 0 }}>
                <Save size={14} aria-hidden /> {t.save}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setOfficialRef(null); setEditingRef(false); }} disabled={busy} style={{ minHeight: 44 }}>{t.cancel}</button>
            </div>
          ) : (
            <div
              onClick={() => canEditTicket && setEditingRef(true)}
              role={canEditTicket ? "button" : undefined}
              tabIndex={canEditTicket ? 0 : undefined}
              onKeyDown={(e) => { if (canEditTicket && (e.key === "Enter" || e.key === " ")) setEditingRef(true); }}
              style={{
                minHeight: 44, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--border-ghost)",
                background: canEditTicket ? "var(--surface)" : "var(--canvas)", cursor: canEditTicket ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              }}
            >
              <span className="small" style={{ color: currentOfficialRef ? "var(--ink)" : "var(--text-tertiary)", fontStyle: currentOfficialRef ? "normal" : "italic" }}>
                {currentOfficialRef || t.support_official_ref_hint}
              </span>
              {canEditTicket && <Pencil size={14} aria-hidden style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />}
            </div>
          )}
          <p className="xsmall muted mt-4" style={{ lineHeight: 1.4 }}>{t.support_official_ref_hint}</p>
        </div>

        <div className="detail-grid" style={{ gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sp-follow">{t.support_followup}</label>
            <input
              id="sp-follow"
              className="input"
              type="date"
              value={currentFollowUp}
              onChange={(e) => setFollowUpDate(e.target.value)}
              disabled={!canEditTicket || busy}
              style={{ minHeight: 44 }}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sp-status">{t.task_status_label}</label>
            <select
              id="sp-status"
              className="select"
              value={currentStatus}
              onChange={(e) => setStatusSel(e.target.value as SupportStatus)}
              disabled={!canEditTicket || busy}
              style={{ minHeight: 44 }}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{(t.support_status as Record<string, string>)[s] ?? s}</option>
              ))}
            </select>
          </div>
        </div>
        {(dirtyFollow || dirtyStatus) && (
          <div className="row wrap mt-12" style={{ gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={saveTicket} disabled={busy || !canEditTicket} style={{ minHeight: 44 }}>
              <Save size={14} aria-hidden /> {t.save}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setFollowUpDate(null); setStatusSel(null); }} disabled={busy} style={{ minHeight: 44 }}>{t.cancel}</button>
          </div>
        )}
        {!canEditTicket && <p className="xsmall muted mt-8">{t.support_private_note}</p>}
      </div>

      <div className="row wrap mt-12" style={{ gap: 8 }}>
        {!ticket.coordinatorId && isCoordinator && (
          <button className="btn btn-secondary btn-sm" onClick={assignToMe} disabled={busy} style={{ minHeight: 44 }}>
            {t.support_assign_me}
          </button>
        )}
        {ticket.status !== "resolved" ? (
          <button className="btn btn-success btn-sm" onClick={markResolved} disabled={busy || !canEditTicket} style={{ minHeight: 44 }}>
            {t.support_mark_resolved}
          </button>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={reopen} disabled={busy || !canEditTicket} style={{ minHeight: 44 }}>
            {t.support_reopen}
          </button>
        )}
      </div>

      {/* Updates */}
      <section className="section-block mt-16" aria-labelledby="h-updates">
        <div className="section-head">
          <h3 id="h-updates" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LifeBuoy size={16} aria-hidden style={{ color: "var(--brand-strong)" }} /> {t.support_updates}
          </h3>
          <span className="count-chip">{updates.length}</span>
        </div>
        {updates.length === 0 ? (
          <EmptyState title={t.none} body={t.support_updates} icon={<LifeBuoy size={20} aria-hidden />} />
        ) : (
          <ul className="stack" role="list">
            {updates.map((u) => {
              const author = snapshot.people.find((p) => p.id === u.authorId);
              return (
                <li key={u.id} className="card" style={{ padding: 14 }}>
                  <div className="row-between" style={{ gap: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span aria-hidden style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--brand-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{author?.initials ?? "?"}</span>
                      <strong className="small" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{author?.name ?? "?"}</strong>
                    </span>
                    <span className="xsmall muted" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                      {formatInstant(u.createdAt, prefs.locale, prefs.displayTz, false)}{!u.visibleToRequester ? ` · ${t.support_update_visible_requester}: ${t.no}` : ""}
                    </span>
                  </div>
                  <p className="small mt-8" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{u.body}</p>
                  {!u.visibleToRequester && <span className="status-pill st-waiting mt-8" style={{ fontSize: 11 }}><ShieldAlert size={10} aria-hidden /> {t.support_private_note.slice(0, 30)}…</span>}
                </li>
              );
            })}
          </ul>
        )}

        <form className="card mt-12" onSubmit={addUpdate} style={{ padding: 16 }}>
          <div className="field">
            <label htmlFor="sp-upd">{t.support_add_update}</label>
            <textarea
              id="sp-upd"
              className="textarea"
              value={updateBody}
              onChange={(e) => setUpdateBody(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder={t.support_add_update}
              style={{ minHeight: 88 }}
            />
          </div>
          {isCoordinator && (
            <label className="row small mb-8" style={{ gap: 8, fontWeight: 400, minHeight: 44, cursor: "pointer" }}>
              <input type="checkbox" checked={visibleToRequester} onChange={(e) => setVisibleToRequester(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--brand)" }} />
              {t.support_update_visible_requester}
            </label>
          )}
          <p className="xsmall muted mb-8" style={{ lineHeight: 1.4 }}>{t.support_send_hint}</p>
          <div className="row wrap" style={{ gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !updateBody.trim()} style={{ minHeight: 44 }}>
              {t.support_add_update}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyDraft} disabled={!updateBody.trim()} style={{ minHeight: 44 }}>
              <Copy size={14} aria-hidden /> {t.support_copy_update_draft}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
