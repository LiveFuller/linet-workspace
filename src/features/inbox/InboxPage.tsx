// Inbox: shared triage list. Emails parse to a review form; duplicates detected.
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PlusCircle, Search, Inbox as InboxIcon } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { EmptyState, SearchEmpty } from "@/components/primitives";
import { formatInstant } from "@/lib/dates";

type StateFilter = "all" | "unprocessed" | "processed" | "ignored";

export default function InboxPage() {
  const { snapshot, t, prefs } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const state = (params.get("state") as StateFilter | null) ?? "all";

  if (!snapshot) return <div className="page"><EmptyState title={t.loading} icon={<InboxIcon size={20} />} /></div>;
  const { inbox } = snapshot;

  const sorted = useMemo(() => [...inbox].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [inbox]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sorted.filter((item) => {
      if (state !== "all" && item.state !== state) return false;
      if (!needle) return true;
      return item.title.toLowerCase().includes(needle) || item.body.toLowerCase().includes(needle);
    });
  }, [sorted, q, state]);

  const setQ = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  };

  const setState = (value: StateFilter) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("state");
    else next.set("state", value);
    setParams(next, { replace: true });
  };

  const statePill = (s: string) =>
    s === "processed" ? <span className="status-pill st-done">{t.inbox_processed}</span>
    : s === "ignored" ? <span className="status-pill st-todo">{t.inbox_ignored_state}</span>
    : <span className="status-pill st-progress">{t.inbox_unprocessed}</span>;

  return (
    <div className="page">
      <div className="row-between mb-8">
        <h1 className="page-title">{t.inbox_title}</h1>
        <button className="btn btn-primary btn-sm" onClick={() => nav("/inbox/new")}>
          <PlusCircle size={16} aria-hidden /> {t.inbox_new}
        </button>
      </div>
      <p className="xsmall muted mb-16">{t.inbox_live_addr_note}</p>

      <div className="card mb-12" style={{ padding: 12 }}>
        <div className="field" style={{ marginBottom: 10 }}>
          <label htmlFor="inbox-q" className="xsmall" style={{ fontWeight: 600 }}>{t.filter_search}</label>
          <div style={{ position: "relative" }}>
            <Search size={16} aria-hidden style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
            <input
              id="inbox-q"
              className="input"
              placeholder={t.filter_search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>
        <div className="chip-row" role="tablist" aria-label={t.filters}>
          {(["all", "unprocessed", "processed", "ignored"] as StateFilter[]).map((s) => (
            <button
              key={s}
              className={`chip ${state === s ? "active" : ""}`}
              role="tab"
              aria-selected={state === s}
              onClick={() => setState(s)}
            >
              {s === "all" ? t.tasks_view_all : s === "unprocessed" ? t.inbox_unprocessed : s === "processed" ? t.inbox_processed : t.inbox_ignored_state}
            </button>
          ))}
        </div>
        {q && <p className="xsmall muted mt-8">{filtered.length} · “{q}”</p>}
      </div>

      {filtered.length === 0 ? (
        q ? <SearchEmpty query={q} /> : <EmptyState title={t.inbox_title} body={t.none} icon={<InboxIcon size={20} />} />
      ) : (
        <ul className="stack">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                className="card card-interactive"
                style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}
                onClick={() => nav(`/inbox/new?item=${item.id}`)}
                aria-label={`${item.title} — ${item.state}`}
              >
                <span className="task-main" style={{ flex: 1, minWidth: 0 }}>
                  <span className="task-title" style={{ display: "block", fontWeight: 650 }}>{item.title}</span>
                  <span className="task-meta" style={{ marginTop: 4 }}>
                    {item.kind === "email" ? t.inbox_add_email : item.kind === "note" ? t.inbox_add_note : t.inbox_add_transcript}
                    {" · "}{formatInstant(item.createdAt, prefs.locale, prefs.displayTz, false)}
                    {item.isPrivateDraft ? ` · ${t.inbox_private_draft}` : ` · ${t.inbox_shared_triage}`}
                  </span>
                </span>
                {statePill(item.state)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {sorted.length === 0 && filtered.length === 0 && !q && (
        <div className="mt-12">
          <EmptyState title={t.inbox_title} body={t.none} icon={<InboxIcon size={20} />} />
        </div>
      )}
    </div>
  );
}
