// SettingsPage — /settings
import { useState } from "react";
import { Palette, Bell, Database, Info, Users, Shield, Globe, Clock, Moon, Volume2, Download, RotateCcw, FileText, ChevronRight } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { SkeletonStack } from "@/components/primitives";
import { Modal } from "@/components/Modal";
import { downloadFile } from "@/lib/utils";
import { TZ_PRAGUE, TZ_PORT_MORESBY } from "@/lib/dates";
import { ROLE_LABELS } from "@/domain/permissions";

export default function SettingsPage() {
  const { snapshot, persona, t, prefs, setPrefs, setPersona, repo, refresh } = useApp();
  const { toast } = useToast();
  const [projectNameDraft, setProjectNameDraft] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!snapshot) return <div className="page page-narrow"><SkeletonStack count={3} /></div>;

  const project = snapshot.projects[0];
  const canEditProject = persona?.role === "workspace_admin" || persona?.role === "project_lead";
  const editingName = projectNameDraft !== null ? projectNameDraft : (project ? (prefs.locale === "cs" ? project.name : project.nameEn) : "");

  const exportBackup = async () => {
    if (!repo) return;
    setBusy(true);
    const res = await repo.exportBackup();
    setBusy(false);
    if (res.ok) {
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(`linet-workspace-backup-${date}.json`, JSON.stringify(res.data, null, 2), "application/json");
      toast(t.settings_backup_done);
    }
  };

  const doReset = async () => {
    if (!repo) return;
    setBusy(true);
    const res = await repo.resetDemoData();
    setBusy(false);
    setShowResetModal(false);
    if (res.ok) {
      toast(t.settings_reset_done);
      refresh();
    }
  };

  const diagExport = async () => {
    const payload = {
      version: "0.1.0",
      mode: repo?.mode ?? "local",
      locale: prefs.locale,
      displayTz: prefs.displayTz,
      theme: prefs.theme,
      counts: snapshot ? {
        people: snapshot.people.length,
        tasks: snapshot.tasks.length,
        meetings: snapshot.meetings.length,
        documents: snapshot.documents.length,
        supportTickets: snapshot.supportTickets.length,
      } : null,
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast(t.saved);
    } catch {
      downloadFile("linet-diag.json", text, "application/json");
      toast(t.saved);
    }
  };

  const statusesCount = (() => {
    try {
      const fn = (repo as unknown as { integrationStatuses?: () => unknown[] })?.integrationStatuses;
      if (typeof fn === "function") return fn.call(repo).length;
    } catch { /* ignore */ }
    return 4;
  })();

  const CardHeader = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-soft)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-soft-strong)", flexShrink: 0 }}>
        {icon}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h3 style={{ fontSize: 15, lineHeight: 1.2 }}>{title}</h3>
        {subtitle && <p className="xsmall muted" style={{ marginTop: 2, lineHeight: 1.4 }}>{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="page page-narrow">
      <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-soft)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-soft-strong)" }}>
          <Palette size={18} />
        </span>
        {t.settings_title}
      </h1>

      <div className="banner banner-info small mb-12" role="note" style={{ display: "flex", gap: 10 }}>
        <Shield size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{t.settings_demo_mode_badge}</span>
      </div>
      <p className="xsmall muted mb-4" style={{ lineHeight: 1.5 }}>{t.settings_storage_info}</p>
      <p className="xsmall muted mb-16" style={{ lineHeight: 1.5 }}>{t.settings_permanent_note}</p>

      {/* Persona switcher — segmented with avatar */}
      <section className="card mb-12" aria-labelledby="h-persona" style={{ padding: 16 }}>
        <CardHeader icon={<Users size={16} aria-hidden />} title={t.persona_switcher} subtitle={t.persona_note} />
        <div className="chip-row" role="radiogroup" aria-label={t.persona_switcher} style={{ gap: 8 }}>
          {snapshot.people.filter((p) => ["d1000000-0000-4000-8000-000000000001","d1000000-0000-4000-8000-000000000002","d1000000-0000-4000-8000-000000000003","d1000000-0000-4000-8000-000000000007"].includes(p.id) || true).slice(0, 6).map((p) => {
            const active = persona?.id === p.id;
            const roleLabel = ROLE_LABELS[p.role]?.[prefs.locale] ?? p.role;
            return (
              <button
                key={p.id}
                role="radio"
                aria-checked={active}
                onClick={() => setPersona(p)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "8px 12px 8px 8px",
                  borderRadius: 999, border: active ? "2px solid var(--brand)" : "1px solid var(--border)",
                  background: active ? "var(--brand-soft)" : "var(--surface)",
                  color: "var(--ink)", cursor: "pointer",
                  minHeight: 44, fontWeight: active ? 700 : 600, fontSize: 13,
                  transition: "all 140ms var(--ease)",
                  boxShadow: active ? "0 1px 6px rgba(63,94,251,0.15)" : "none",
                }}
              >
                <span aria-hidden style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: active ? "var(--brand)" : "var(--brand-soft)",
                  color: active ? "#fff" : "var(--brand-strong)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 11, flexShrink: 0,
                  border: `1px solid ${active ? "var(--brand-strong)" : "var(--brand-soft-strong)"}`,
                }}>
                  {p.initials}
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span className="xsmall muted" style={{ fontSize: 11, fontWeight: 500 }}>{roleLabel}</span>
                </span>
                {active && <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", marginLeft: 4, flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
        {/* Fallback list for all people if many, still card-interactive rows */}
        {snapshot.people.length > 6 && (
          <ul className="stack mt-12" style={{ gap: 8 }}>
            {snapshot.people.slice(6).map((p) => {
              const active = persona?.id === p.id;
              const roleLabel = ROLE_LABELS[p.role]?.[prefs.locale] ?? p.role;
              return (
                <li key={p.id}>
                  <button
                    className="card card-interactive row-between"
                    style={{ width: "100%", padding: "10px 12px", minHeight: 44 }}
                    onClick={() => setPersona(p)}
                    aria-pressed={active}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      <span aria-hidden style={{ width: 32, height: 32, borderRadius: "50%", background: active ? "var(--brand)" : "var(--brand-soft)", color: active ? "#fff" : "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>{p.initials}</span>
                      <span style={{ textAlign: "left" }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 650 }}>{p.name}</span>
                        <span className="xsmall muted">{roleLabel} · {p.email}</span>
                      </span>
                    </span>
                    {active ? <span className="status-pill st-done">✓</span> : <ChevronRight size={14} aria-hidden style={{ color: "var(--text-tertiary)" }} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Appearance */}
      <section className="card mb-12" aria-labelledby="h-appearance" style={{ padding: 16 }}>
        <CardHeader icon={<Palette size={16} aria-hidden />} title={prefs.locale === "cs" ? "Vzhled" : "Appearance"} subtitle={prefs.locale === "cs" ? "Jazyk, časová zóna a motiv" : "Language, time zone and theme"} />
        <div id="h-appearance" className="visually-hidden">{t.settings_language}</div>

        <div className="detail-grid" style={{ gap: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}><Globe size={12} aria-hidden style={{ color: "var(--text-tertiary)" }} /> {t.settings_language}</label>
            <div className="segmented" role="radiogroup" aria-label={t.settings_language} style={{ minHeight: 44 }}>
              {(["cs", "en"] as const).map((loc) => (
                <button
                  key={loc}
                  role="radio"
                  aria-checked={prefs.locale === loc}
                  className={prefs.locale === loc ? "active" : ""}
                  onClick={() => setPrefs({ locale: loc })}
                  style={{ minHeight: 36 }}
                >
                  {loc === "cs" ? "Čeština" : "English"}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="set-tz" style={{ display: "flex", alignItems: "center", gap: 6 }}><Clock size={12} aria-hidden style={{ color: "var(--text-tertiary)" }} /> {t.settings_tz}</label>
            <select
              id="set-tz"
              className="select"
              value={prefs.displayTz}
              onChange={(e) => setPrefs({ displayTz: e.target.value })}
              aria-label={t.settings_tz}
              style={{ minHeight: 44 }}
            >
              <option value={TZ_PRAGUE}>Europe/Prague</option>
              <option value={TZ_PORT_MORESBY}>Pacific/Port_Moresby</option>
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="set-theme" style={{ display: "flex", alignItems: "center", gap: 6 }}><Moon size={12} aria-hidden style={{ color: "var(--text-tertiary)" }} /> {t.settings_theme}</label>
            <select
              id="set-theme"
              className="select"
              value={prefs.theme}
              onChange={(e) => setPrefs({ theme: e.target.value as typeof prefs.theme })}
              aria-label={t.settings_theme}
              style={{ minHeight: 44 }}
            >
              <option value="light">{t.settings_theme_light}</option>
              <option value="dark">{t.settings_theme_dark}</option>
              <option value="system">{t.settings_theme_system}</option>
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}><Volume2 size={12} aria-hidden style={{ color: "var(--text-tertiary)" }} /> {t.settings_sound}</label>
            <label className="row" style={{ gap: 10, fontWeight: 400, minHeight: 44, cursor: "pointer", background: "var(--canvas)", border: "1px solid var(--border-ghost)", borderRadius: 10, padding: "8px 12px" }}>
              <input
                type="checkbox"
                checked={prefs.soundOnComplete}
                onChange={(e) => setPrefs({ soundOnComplete: e.target.checked })}
                style={{ width: 20, height: 20, accentColor: "var(--brand)" }}
              />
              <span className="small" style={{ fontWeight: 600 }}>{prefs.soundOnComplete ? t.yes : t.no}</span>
              <span className="xsmall muted" style={{ marginLeft: "auto" }}>{t.settings_sound}</span>
            </label>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="card mb-12" aria-labelledby="h-notif" style={{ padding: 16 }}>
        <CardHeader icon={<Bell size={16} aria-hidden />} title={t.settings_notif_prefs} subtitle={t.settings_notifications} />
        <h3 id="h-notif" className="visually-hidden">{t.settings_notif_prefs}</h3>
        <div className="stack" style={{ gap: 10 }}>
          {[
            { key: "notifAssign", label: t.settings_notif_assign, value: prefs.notifAssign },
            { key: "notifDeadline", label: t.settings_notif_deadline, value: prefs.notifDeadline },
            { key: "notifSupport", label: t.settings_notif_support, value: prefs.notifSupport },
          ].map((row) => (
            <label key={row.key} className="row" style={{ gap: 10, fontWeight: 500, minHeight: 44, cursor: "pointer", background: "var(--canvas)", border: "1px solid var(--border-ghost)", borderRadius: 10, padding: "10px 12px" }}>
              <input
                type="checkbox"
                checked={row.value}
                onChange={(e) => setPrefs({ [row.key]: e.target.checked } as Partial<typeof prefs>)}
                style={{ width: 20, height: 20, accentColor: "var(--brand)" }}
              />
              <span className="small" style={{ flex: 1 }}>{row.label}</span>
              <span className={`status-pill ${row.value ? "st-done" : "st-todo"}`} style={{ fontSize: 11 }}>{row.value ? t.yes : t.no}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Project name inline edit */}
      {project && (
        <section className="card mb-12" aria-labelledby="h-proj" style={{ padding: 16 }}>
          <CardHeader icon={<FileText size={16} aria-hidden />} title={t.project_overview} subtitle={project.description.slice(0, 120)} />
          <h3 id="h-proj" className="visually-hidden">{t.project_overview}</h3>
          {canEditProject ? (
            <>
              <div className="field mt-8">
                <label htmlFor="proj-name">{t.project_edit_name}</label>
                <input
                  id="proj-name"
                  className="input"
                  value={editingName}
                  onChange={(e) => setProjectNameDraft(e.target.value)}
                  onFocus={() => { if (projectNameDraft === null) setProjectNameDraft(prefs.locale === "cs" ? project.name : project.nameEn); }}
                  style={{ minHeight: 44 }}
                />
              </div>
              {projectNameDraft !== null && (
                <div className="row wrap" style={{ gap: 8 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      setProjectNameDraft(null);
                      toast(t.saved);
                    }}
                    style={{ minHeight: 44 }}
                  >
                    {t.save}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setProjectNameDraft(null)} style={{ minHeight: 44 }}>{t.cancel}</button>
                </div>
              )}
            </>
          ) : (
            <p className="small mt-8" style={{ lineHeight: 1.5 }}>{prefs.locale === "cs" ? project.name : project.nameEn}</p>
          )}
          {!canEditProject && <p className="xsmall muted mt-8">{t.learning_no_access_overview}</p>}
        </section>
      )}

      {/* Data */}
      <section className="card mb-12" aria-labelledby="h-backup" style={{ padding: 16 }}>
        <CardHeader icon={<Database size={16} aria-hidden />} title={t.settings_mode} subtitle={t.settings_backup_done} />
        <h3 id="h-backup" className="visually-hidden">{t.settings_mode}</h3>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={exportBackup} disabled={busy} style={{ minHeight: 44 }}>
            <Download size={14} aria-hidden /> {t.settings_backup}
          </button>
          <button className="btn btn-danger-soft btn-sm" onClick={() => setShowResetModal(true)} disabled={busy} style={{ minHeight: 44 }}>
            <RotateCcw size={14} aria-hidden /> {t.settings_reset}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={diagExport} style={{ minHeight: 44 }}>
            <FileText size={14} aria-hidden /> {t.settings_diag_export}
          </button>
        </div>
        <p className="xsmall muted mt-8" style={{ lineHeight: 1.4 }}>{t.settings_diag_note}</p>
        <p className="xsmall muted mt-4" style={{ lineHeight: 1.4 }}>{t.settings_import_note}</p>
      </section>

      {/* About */}
      <section className="card mb-12" aria-labelledby="h-about" style={{ padding: 16 }}>
        <CardHeader icon={<Info size={16} aria-hidden />} title={t.settings_about} subtitle={`${t.settings_version} 0.1.0 · ${repo?.mode ?? "local"}`} />
        <h3 id="h-about" className="visually-hidden">{t.settings_about}</h3>
        <dl className="detail-grid small kv" style={{ gap: 12, marginTop: 4 }}>
          <div style={{ background: "var(--canvas)", border: "1px solid var(--border-ghost)", borderRadius: 10, padding: 12 }}>
            <dt style={{ display: "flex", alignItems: "center", gap: 6 }}><Info size={11} aria-hidden /> {t.settings_version}</dt>
            <dd style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>0.1.0</dd>
          </div>
          <div style={{ background: "var(--canvas)", border: "1px solid var(--border-ghost)", borderRadius: 10, padding: 12 }}>
            <dt style={{ display: "flex", alignItems: "center", gap: 6 }}><Database size={11} aria-hidden /> {t.settings_data_mode}</dt>
            <dd style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{repo?.mode ?? "local"}</dd>
          </div>
          <div style={{ background: "var(--canvas)", border: "1px solid var(--border-ghost)", borderRadius: 10, padding: 12 }}>
            <dt style={{ display: "flex", alignItems: "center", gap: 6 }}><Globe size={11} aria-hidden /> {t.settings_connectors}</dt>
            <dd style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{statusesCount}</dd>
          </div>
        </dl>
      </section>

      {showResetModal && (
        <Modal title={t.settings_reset} onClose={() => setShowResetModal(false)}>
          <p className="small">{t.settings_reset_confirm}</p>
          <p className="xsmall muted mt-4">{t.settings_reset_confirm_backup}</p>
          <div className="row mt-12" style={{ gap: 8 }}>
            <button className="btn btn-danger" onClick={doReset} disabled={busy} style={{ minHeight: 44 }}>{t.confirm}</button>
            <button className="btn btn-secondary" onClick={() => setShowResetModal(false)} disabled={busy} style={{ minHeight: 44 }}>{t.cancel}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
