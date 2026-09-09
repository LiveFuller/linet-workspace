// IntegrationsPage — /integrations
import { useApp } from "@/app/AppProvider";
import { EmptyState } from "@/components/primitives";
import type { IntegrationStatus } from "@/domain/types";

const DEMO_FALLBACK: IntegrationStatus[] = [
  { id: "supabase", state: "demo_simulation", operations: [], lastCheck: null, message: "Databáze: lokální demo (IndexedDB)." },
  { id: "microsoft", state: "not_configured", operations: [], lastCheck: null, message: "Microsoft 365: nenakonfigurováno." },
  { id: "ai", state: "not_configured", operations: [], lastCheck: null, message: "AI: nenakonfigurováno — deterministický helper." },
  { id: "mail", state: "not_configured", operations: [], lastCheck: null, message: "E-mail: nenakonfigurováno — ruční vložení." },
];

function pillClass(state: IntegrationStatus["state"]): string {
  if (state === "connected" || state === "demo_simulation") return "st-done";
  if (state === "error" || state === "degraded") return "st-blocked";
  if (state === "not_configured") return "st-todo";
  if (state === "consent_required") return "st-waiting";
  return "st-todo";
}

export default function IntegrationsPage() {
  const { snapshot, t, repo } = useApp();
  if (!snapshot) return <div className="page"><EmptyState title={t.loading} /></div>;

  const statuses: IntegrationStatus[] = (() => {
    try {
      const maybe = (repo as unknown as { integrationStatuses?: () => IntegrationStatus[] })?.integrationStatuses;
      if (typeof maybe === "function") {
        const res = maybe.call(repo);
        if (Array.isArray(res) && res.length > 0) return res;
      }
    } catch { /* fallback */ }
    return DEMO_FALLBACK;
  })();

  const project = snapshot.projects[0];
  const sot = project?.sourceOfTruth ?? "standalone";

  return (
    <div className="page">
      <h1 className="page-title">{t.integrations_title}</h1>

      <div className="banner banner-info small mb-12" role="note">
        {t.integrations_ms_note}
      </div>
      <div className="banner banner-warn small mb-16" role="note">
        {t.integrations_no_sync_claim}
      </div>

      <div className="card mb-12">
        <h3 style={{ fontSize: 15 }}>{t.integrations_source_of_truth}</h3>
        <p className="small mt-4">
          {sot === "microsoft_backed" ? t.project_sot_ms : t.project_sot_standalone}
        </p>
        <p className="xsmall muted">{t.project_source_of_truth}: {sot}</p>
      </div>

      <ul className="stack">
        {statuses.map((s) => (
          <li key={s.id} className="card">
            <div className="row-between">
              <strong style={{ textTransform: "capitalize" }}>{s.id}</strong>
              <span className={`status-pill ${pillClass(s.state)}`}>{s.state}</span>
            </div>
            <p className="small muted mt-4">{s.message}</p>
            {s.operations.length > 0 && (
              <p className="xsmall mt-8"><strong>{t.integrations_ops}:</strong> {s.operations.join(", ")}</p>
            )}
            <p className="xsmall muted mt-4">
              {t.integrations_last_check}: {s.lastCheck ?? t.none} · {t.integrations_status}: {s.state}
            </p>
          </li>
        ))}
      </ul>

      <p className="xsmall muted mt-16">{t.integrations_setup_path}: {t.settings_about}</p>
    </div>
  );
}
