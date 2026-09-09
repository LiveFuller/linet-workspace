// DocumentsPage — /documents
import { useState } from "react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { EmptyState, SkeletonStack } from "@/components/primitives";
import { formatDateOnly } from "@/lib/dates";
import { renderSafeMarkdown } from "@/lib/utils";
import { isSafeUrl } from "@/domain/validation";
import { FolderOpen, FileText, GraduationCap, ClipboardList, Paperclip, Link2, ExternalLink, Eye, X, Plus } from "lucide-react";

type Category = "reference" | "procedure" | "training" | "meeting_notes" | "attachment" | "link";

const CATS: Category[] = ["reference", "procedure", "training", "meeting_notes", "attachment", "link"];

const CAT_ICON: Record<Category, React.ReactNode> = {
  reference: <FileText size={14} aria-hidden />,
  procedure: <ClipboardList size={14} aria-hidden />,
  training: <GraduationCap size={14} aria-hidden />,
  meeting_notes: <FileText size={14} aria-hidden />,
  attachment: <Paperclip size={14} aria-hidden />,
  link: <Link2 size={14} aria-hidden />,
};

export default function DocumentsPage() {
  const { snapshot, persona, t, prefs, repo, refresh } = useApp();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [openDocId, setOpenDocId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("reference");
  const [description, setDescription] = useState("");
  const [workstreamId, setWorkstreamId] = useState<string>("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [urlErr, setUrlErr] = useState<string | null>(null);

  if (!snapshot || !persona) return <div className="page"><SkeletonStack count={3} /></div>;

  const canAdd = persona.role !== "viewer";
  const projectId = snapshot.projects[0]?.id;

  const catsLabel = t.document_categories as Record<Category, string>;

  const docs = snapshot.documents
    .filter((d) => filter === "all" || d.category === filter)
    .slice()
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !repo || !projectId) return;
    if (!canAdd) return;
    const urlTrim = url.trim() || null;
    // Validate via isSafeUrl
    if (urlTrim && !isSafeUrl(urlTrim)) {
      setUrlErr(t.documents_url_hint);
      return;
    }
    setUrlErr(null);
    const safeUrl = urlTrim && isSafeUrl(urlTrim) ? urlTrim : null;
    setBusy(true);
    const res = await repo.createDocument(
      {
        projectId,
        title: title.trim(),
        category,
        description: description.trim(),
        workstreamId: workstreamId || null,
        url: safeUrl,
        content: content.trim() || null,
      },
      persona.id
    );
    setBusy(false);
    if (res.ok) {
      toast(t.saved);
      setTitle("");
      setDescription("");
      setUrl("");
      setContent("");
      setUrlErr(null);
      refresh();
    }
  };

  return (
    <div className="page">
      <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-soft)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-soft-strong)" }}>
          <FolderOpen size={18} />
        </span>
        {t.documents_title}
      </h1>
      <p className="xsmall muted mb-12" style={{ lineHeight: 1.5 }}>{t.documents_url_hint}</p>

      {/* Category chips 44px */}
      <div className="chip-row mb-12" role="group" aria-label={t.documents_category} style={{ gap: 8 }}>
        <button
          className={`chip ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
          aria-pressed={filter === "all"}
          style={{ minHeight: 44 }}
        >
          <FolderOpen size={14} aria-hidden /> {t.today_view_all}
        </button>
        {CATS.map((c) => (
          <button
            key={c}
            className={`chip ${filter === c ? "active" : ""}`}
            onClick={() => setFilter(c)}
            aria-pressed={filter === c}
            style={{ minHeight: 44 }}
          >
            {CAT_ICON[c]} {catsLabel[c] ?? c}
          </button>
        ))}
      </div>

      {docs.length === 0 ? (
        <EmptyState title={t.documents_empty} icon={<FolderOpen size={20} aria-hidden />} />
      ) : (
        <ul className="stack" role="list">
          {docs.map((d) => {
            const owner = snapshot.people.find((p) => p.id === d.ownerId);
            const ws = d.workstreamId ? snapshot.workstreams.find((w) => w.id === d.workstreamId) : null;
            const isOpen = openDocId === d.id;
            const hasValidUrl = isSafeUrl(d.url);
            return (
              <li key={d.id} className="card card-interactive" style={{ padding: 16 }}>
                <div className="row-between" style={{ gap: 12, alignItems: "flex-start" }}>
                  <span style={{ display: "flex", gap: 12, minWidth: 0, flex: 1 }}>
                    <span aria-hidden style={{ width: 40, height: 40, borderRadius: 10, background: "var(--canvas)", border: "1px solid var(--border-ghost)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--brand-strong)", flexShrink: 0 }}>
                      {CAT_ICON[d.category as Category] ?? <FileText size={16} />}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: 14.5, lineHeight: 1.35, display: "block", overflowWrap: "break-word" }}>{d.title}</strong>
                      {d.description && <span className="small muted" style={{ display: "block", marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{d.description}</span>}
                      <span className="xsmall muted" style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", marginTop: 6, alignItems: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span aria-hidden style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--brand-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{owner?.initials ?? "?"}</span>
                          {owner?.name ?? t.none}
                        </span>
                        <span>· {formatDateOnly(d.updatedAt.slice(0, 10), prefs.locale)}</span>
                        {ws ? <span>· {prefs.locale === "cs" ? ws.name : ws.nameEn}</span> : null}
                      </span>
                    </span>
                  </span>
                  <span className="status-pill st-todo" style={{ flexShrink: 0, whiteSpace: "nowrap", display: "inline-flex", gap: 6 }}>
                    {CAT_ICON[d.category as Category]} {catsLabel[d.category as Category] ?? d.category}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, marginLeft: 52 }} className="xsmall muted">
                  {d.localSample && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--brand-soft)", color: "var(--brand-ink)", border: "1px solid var(--brand-soft-strong)", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 650 }}><Eye size={10} aria-hidden /> {t.documents_local_sample}</span>}
                  {d.url && hasValidUrl && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--canvas)", border: "1px solid var(--border-ghost)", borderRadius: 999, padding: "2px 8px", fontSize: 11 }}>{d.url.slice(0, 32)}{d.url.length > 32 ? "…" : ""}</span>}
                </div>

                <div className="row wrap mt-12" style={{ gap: 8, marginLeft: 52 }}>
                  {d.url && hasValidUrl ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        try { window.open(d.url!, "_blank", "noopener,noreferrer"); } catch { /* ignore */ }
                      }}
                      style={{ minHeight: 44 }}
                    >
                      <ExternalLink size={14} aria-hidden /> {t.documents_open}
                    </button>
                  ) : d.localSample && d.content ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => setOpenDocId(isOpen ? null : d.id)} style={{ minHeight: 44 }}>
                      {isOpen ? <><X size={14} aria-hidden /> {t.close}</> : <><Eye size={14} aria-hidden /> {t.documents_open}</>}
                    </button>
                  ) : (
                    <span className="xsmall muted" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>{t.none}</span>
                  )}
                </div>

                {isOpen && d.content && (
                  <div className="card mt-12" style={{ background: "var(--canvas)", padding: 0, overflow: "hidden", borderStyle: "dashed" }}>
                    <div style={{ maxHeight: 360, overflowY: "auto", padding: 16 }} className="small">
                      <div dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(d.content) }} style={{ lineHeight: 1.6 }} />
                    </div>
                    <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-ghost)", background: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }} className="xsmall muted">
                      <span>{t.documents_local_sample}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setOpenDocId(null)} style={{ minHeight: 32, padding: "4px 10px" }}><X size={12} aria-hidden /> {t.close}</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canAdd ? (
        <form className="card mt-16" onSubmit={onSubmit} style={{ padding: 18 }}>
          <h3 style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span aria-hidden style={{ width: 32, height: 32, borderRadius: 8, background: "var(--brand-soft)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-soft-strong)" }}><Plus size={16} /></span>
            {t.documents_new}
          </h3>
          <div className="field">
            <label htmlFor="doc-title">{t.task_title_label} *</label>
            <input id="doc-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required aria-required="true" style={{ minHeight: 44 }} />
          </div>
          <div className="detail-grid" style={{ gap: 12 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="doc-cat">{t.documents_category}</label>
              <select id="doc-cat" className="select" value={category} onChange={(e) => setCategory(e.target.value as Category)} style={{ minHeight: 44 }}>
                {CATS.map((c) => <option key={c} value={c}>{catsLabel[c] ?? c}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="doc-ws">{t.task_workstream_label}</label>
              <select id="doc-ws" className="select" value={workstreamId} onChange={(e) => setWorkstreamId(e.target.value)} style={{ minHeight: 44 }}>
                <option value="">{t.none}</option>
                {snapshot.workstreams.map((w) => <option key={w.id} value={w.id}>{prefs.locale === "cs" ? w.name : w.nameEn}</option>)}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="doc-desc">{t.task_desc_label}</label>
            <textarea id="doc-desc" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} style={{ minHeight: 88 }} />
          </div>
          <div className="field">
            <label htmlFor="doc-url">{t.documents_url_label}</label>
            <input
              id="doc-url"
              className="input"
              value={url}
              onChange={(e) => { setUrl(e.target.value); if (urlErr) setUrlErr(null); }}
              placeholder="https://"
              type="url"
              style={{ minHeight: 44, borderColor: urlErr ? "var(--danger-border)" : undefined }}
              aria-invalid={!!urlErr}
              aria-describedby={urlErr ? "doc-url-err" : undefined}
            />
            {urlErr ? <p id="doc-url-err" className="xsmall" style={{ color: "var(--danger)", marginTop: 6 }}>{urlErr}</p> : <p className="xsmall muted" style={{ marginTop: 6 }}>{t.documents_url_hint}</p>}
          </div>
          <div className="field">
            <label htmlFor="doc-content">{t.documents_content_label}</label>
            <textarea id="doc-content" className="textarea" value={content} onChange={(e) => setContent(e.target.value)} rows={5} maxLength={50000} style={{ minHeight: 110, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }} placeholder={"# Nadpis\n\n- bod 1\n- bod 2"} />
            <p className="xsmall muted" style={{ marginTop: 6 }}>{t.documents_content_label} — {t.documents_local_sample}</p>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !title.trim()} style={{ minHeight: 44 }}>
            <Plus size={14} aria-hidden /> {busy ? t.loading : t.create}
          </button>
        </form>
      ) : (
        <div className="banner banner-warn small mt-16" style={{ display: "flex", gap: 10 }}><ShieldAlert size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} /> <span>{t.persona_note}</span></div>
      )}
    </div>
  );
}

function ShieldAlert({ size, ...props }: { size: number } & React.SVGProps<SVGSVGElement>) {
  // local fallback if not imported
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
