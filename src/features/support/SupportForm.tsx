// SupportForm — /support/new
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LifeBuoy, ShieldAlert, ChevronLeft, Tag, AlertTriangle, FileText, Send } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { EmptyState, SkeletonStack } from "@/components/primitives";

type Category = "access" | "copilot" | "teams" | "vpn" | "hardware" | "training" | "other";
type Impact = "low" | "medium" | "high";

export default function SupportForm() {
  const { snapshot, persona, t, repo, refresh } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<Impact>("medium");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!snapshot || !persona) return <div className="page page-narrow"><SkeletonStack count={2} /></div>;

  const canCreate = persona.role !== "viewer";
  if (!canCreate) {
    return (
      <div className="page page-narrow">
        <EmptyState title={t.not_found_title} body={t.support_private_note} icon={<ShieldAlert size={20} aria-hidden />} />
        <button className="btn btn-secondary mt-12" onClick={() => nav(-1)} style={{ minHeight: 44 }}>{t.back}</button>
      </div>
    );
  }

  const projectId = snapshot.projects[0]?.id;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!title.trim()) {
      setErr(t.validation_required_title);
      return;
    }
    if (!projectId || !repo) return;
    setBusy(true);
    const res = await repo.createSupportTicket(
      { projectId, title: title.trim(), category, description: description.trim(), impact },
      persona.id
    );
    setBusy(false);
    if (res.ok) {
      toast(t.support_created);
      refresh();
      nav(`/support/${res.data.id}`);
    } else {
      if (res.error.code === "validation") {
        setErr(res.error.issues.map((i) => i.message).join("; "));
      } else if (res.error.code === "forbidden") {
        setErr((res.error as { message?: string }).message ?? t.error_generic);
      } else {
        setErr(t.error_generic);
      }
    }
  };

  const categories = t.support_categories as Record<Category, string>;
  const impacts = t.support_impact_levels as Record<Impact, string>;

  return (
    <div className="page page-narrow">
      <button className="btn btn-ghost btn-sm mb-12" onClick={() => nav(-1)} style={{ minHeight: 44 }}>
        <ChevronLeft size={16} aria-hidden /> {t.back}
      </button>

      <div className="card" style={{ background: "var(--brand-soft)", borderColor: "var(--brand-soft-strong)", padding: 16, marginBottom: 16 }}>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
          <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <LifeBuoy size={18} />
          </span>
          {t.support_new}
        </h1>
        <p className="small muted mt-8" style={{ lineHeight: 1.5 }}>{t.support_saved_app_vs_official}</p>
      </div>

      <div className="banner banner-info small mb-12" role="note" style={{ display: "flex", gap: 10 }}>
        <ShieldAlert size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{t.support_saved_app_vs_official}</span>
      </div>

      {err && <div className="banner banner-warn small mb-12" role="alert" style={{ display: "flex", gap: 10 }}><AlertTriangle size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} /> <span>{err}</span></div>}

      <form className="card" onSubmit={onSubmit} noValidate style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span aria-hidden style={{ width: 32, height: 32, borderRadius: 8, background: "var(--canvas)", border: "1px solid var(--border-ghost)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--brand-strong)" }}>
            <FileText size={16} />
          </span>
          <h3 style={{ fontSize: 15 }}>{t.support_new}</h3>
        </div>

        <div className="field">
          <label htmlFor="sp-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={12} aria-hidden style={{ color: "var(--text-tertiary)" }} /> {t.task_title_label} *
          </label>
          <input
            id="sp-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            aria-required="true"
            placeholder={t.task_title_label}
            style={{ minHeight: 44 }}
          />
        </div>

        <div className="detail-grid" style={{ gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sp-cat" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Tag size={12} aria-hidden style={{ color: "var(--text-tertiary)" }} /> {t.support_category}
            </label>
            <select id="sp-cat" className="select" value={category} onChange={(e) => setCategory(e.target.value as Category)} style={{ minHeight: 44 }}>
              {(Object.keys(categories) as Category[]).map((k) => (
                <option key={k} value={k}>{categories[k]}</option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sp-impact" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={12} aria-hidden style={{ color: "var(--text-tertiary)" }} /> {t.support_impact}
            </label>
            <select id="sp-impact" className="select" value={impact} onChange={(e) => setImpact(e.target.value as Impact)} style={{ minHeight: 44 }}>
              {(["low", "medium", "high"] as Impact[]).map((k) => (
                <option key={k} value={k}>{impacts[k] ?? k}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="sp-desc">{t.task_desc_label}</label>
          <textarea
            id="sp-desc"
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder={t.task_desc_label}
            style={{ minHeight: 110 }}
          />
        </div>

        <p className="xsmall muted" style={{ lineHeight: 1.4, display: "flex", gap: 8 }}>
          <Send size={12} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t.support_send_hint}</span>
        </p>

        <div className="row wrap mt-16" style={{ gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()} style={{ minHeight: 44 }}>
            <Send size={16} aria-hidden /> {busy ? t.loading : t.create}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => nav(-1)} disabled={busy} style={{ minHeight: 44 }}>
            {t.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
