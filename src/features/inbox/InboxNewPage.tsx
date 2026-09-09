// Inbox capture: note / pasted email / transcript / link. Review flow creates a task
// exactly once (dedupe fingerprint + processed state link).
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { EmptyState } from "@/components/primitives";


const SAMPLE_EMAIL = `From: nákup@example.invalid
To: projekty@example.invalid
Subject: Žádost o nabídku — příslušenství lůžek
Date: Tue, 08 Sep 2026 10:15:00 +0200
Message-ID: <sample-2@example.invalid>

Dobrý den,

prosím o nabídku na příslušenství k lůžkům pro nemocnici (bočnice, noční stolky, držáky infuzních stojanů).
Termín dodání do konce příštího měsíce.

Děkuji,
Jana Nováková, nákup`;

interface ParsedEmail {
  from: string | null;
  subject: string | null;
  date: string | null;
  messageId: string | null;
  body: string;
}

function parseEmail(text: string): ParsedEmail {
  const lines = text.split(/\r?\n/);
  const headerEnd = lines.findIndex((l, i) => i > 0 && l.trim() === "");
  const head = headerEnd === -1 ? lines.slice(0, 8) : lines.slice(0, headerEnd);
  const body = headerEnd === -1 ? lines.slice(8).join("\n") : lines.slice(headerEnd + 1).join("\n");
  const get = (key: string) => {
    const line = head.find((l) => l.toLowerCase().startsWith(`${key.toLowerCase()}:`));
    return line ? line.slice(key.length + 1).trim() : null;
  };
  return {
    from: get("From"),
    subject: get("Subject"),
    date: get("Date"),
    messageId: get("Message-ID"),
    body: body.trim(),
  };
}

export default function InboxNewPage() {
  const { snapshot, persona, t, repo, refresh } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [kind, setKind] = useState<"note" | "email" | "transcript" | "link">("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [issues, setIssues] = useState<string[]>([]);

  const reviewId = params.get("item");
  const reviewItem = reviewId ? snapshot?.inbox.find((x) => x.id === reviewId) : null;
  const reviewParsed = useMemo(() => reviewItem && reviewItem.kind === "email" ? parseEmail(reviewItem.body) : null, [reviewItem]);

  if (!snapshot || !persona) return <div className="page"><EmptyState title={t.loading} /></div>;
  const project = snapshot.projects[0];

  // ---------- Review mode ----------
  if (reviewItem) {
    const createdTask = reviewItem.createdTaskId ? snapshot.tasks.find((x) => x.id === reviewItem.createdTaskId) : null;
    return (
      <div className="page page-narrow">
        <div className="row-between mb-8">
          <button className="btn btn-ghost btn-sm" onClick={() => nav("/inbox")}>← {t.back}</button>
          <span className={`status-pill ${reviewItem.state === "processed" ? "st-done" : "st-progress"}`}>
            {reviewItem.state === "processed" ? t.inbox_processed : reviewItem.state === "ignored" ? t.inbox_ignored_state : t.inbox_unprocessed}
          </span>
        </div>
        <div className="card">
          <h1 style={{ fontSize: 19 }}>{reviewItem.title}</h1>
          {reviewParsed && (
            <dl className="detail-grid mt-12 kv">
              <div><dt>{t.inbox_email_from}</dt><dd>{reviewParsed.from ?? t.none}</dd></div>
              <div><dt>{t.inbox_email_subject}</dt><dd>{reviewParsed.subject ?? t.none}</dd></div>
              <div><dt>{t.task_source}</dt><dd>{reviewItem.sourceMessageId ?? `${t.none} (fingerprint: ${reviewItem.fingerprint.slice(0, 10)}…)`}</dd></div>
            </dl>
          )}
          <details className="mt-12">
            <summary className="small" style={{ cursor: "pointer", fontWeight: 600 }}>{t.inbox_body_label}</summary>
            <pre className="small mt-8" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{reviewItem.body}</pre>
          </details>
        </div>

        {createdTask ? (
          <div className="banner banner-info mt-12 small">
            <span>{t.inbox_linked_task}: <strong>{createdTask.title}</strong></span>
          </div>
        ) : reviewItem.state === "unprocessed" || reviewItem.state === "in_review" ? (
          <ReviewForm
            initialTitle={reviewParsed?.subject ?? reviewItem.title}
            onSubmit={async (draft) => {
              const res = await repo!.createTask({
                projectId: project.id,
                title: draft.title,
                description: reviewParsed ? `${t.inbox_email_from}: ${reviewParsed.from ?? "?"}\n\n${reviewParsed.body}`.slice(0, 3900) : reviewItem.body.slice(0, 3900),
                ownerId: draft.ownerId || null,
                workstreamId: null,
                labelIds: [],
                dueDate: draft.dueDate || null,
                status: "todo",
                statusNote: null,
                source: "email_capture",
                sourceRef: reviewItem.sourceMessageId ?? reviewItem.fingerprint,
                sourceUrl: null,
              }, persona.id);
              if (res.ok) {
                await repo!.updateInboxItem(reviewItem.id, { state: "processed", createdTaskId: res.data.id }, persona.id);
                toast(t.inbox_created);
                refresh();
                nav(`/tasks/${res.data.id}`);
              } else if (res.error.code === "conflict") {
                toast(t.inbox_duplicate);
              } else {
                toast(t.error_generic);
              }
            }}
            onIgnore={async () => {
              await repo!.updateInboxItem(reviewItem.id, { state: "ignored" }, persona.id);
              toast(t.inbox_ignored);
              refresh();
              nav("/inbox");
            }}
          />
        ) : (
          <p className="small muted mt-12">{t.inbox_ignored_state}</p>
        )}
      </div>
    );
  }

  // ---------- Capture mode ----------
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!title.trim()) errs.push(t.validation_required_title);
    if (!body.trim()) errs.push(t.error_generic);
    setIssues(errs);
    if (errs.length) return;
    const parsed = kind === "email" ? parseEmail(body) : null;
    const res = await repo!.addInboxItem({
      projectId: project.id,
      kind,
      title: title.trim(),
      body,
      sourceMessageId: parsed?.messageId ?? null,
      isPrivateDraft: isPrivate,
    }, persona.id);
    if (res.ok) {
      toast(t.saved);
      refresh();
      nav(kind === "email" ? `/inbox/new?item=${res.data.id}` : "/inbox");
    } else if (res.error.code === "conflict") {
      toast(t.inbox_duplicate);
    } else {
      toast(t.error_generic);
    }
  };

  return (
    <div className="page page-narrow">
      <h1 className="page-title">{t.inbox_new}</h1>
      {issues.length > 0 && <div className="banner banner-danger" role="alert"><ul className="small">{issues.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      <form onSubmit={submit} noValidate>
        <div className="segmented mb-12" role="tablist" aria-label={t.inbox_new}>
          {(["note", "email", "transcript", "link"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "active" : ""}
              onClick={() => { setKind(k); if (k === "email") setIsPrivate(false); }}>
              {k === "note" ? t.inbox_add_note : k === "email" ? t.inbox_add_email : k === "transcript" ? t.inbox_add_transcript : t.inbox_add_link}
            </button>
          ))}
        </div>
        {kind === "email" && (
          <div className="row mb-12">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setBody(SAMPLE_EMAIL); setTitle("Fw: Žádost o nabídku — příslušenství lůžek"); }}>
              {t.inbox_try_sample}
            </button>
          </div>
        )}
        <div className="field">
          <label htmlFor="in-title">{t.task_title_label} *</label>
          <input id="in-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="in-body">{t.inbox_body_label} *</label>
          <textarea id="in-body" className="textarea" value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 160 }} required />
          {kind === "email" && body && (() => { const p = parseEmail(body); return p.body ? null : <p className="hint">{t.inbox_parse_uncertain}</p>; })()}
        </div>
        <div className="field">
          <label htmlFor="in-private" className="row" style={{ fontWeight: 400, cursor: "pointer" }}>
            <input id="in-private" type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} style={{ width: 20, height: 20 }} />
            <span style={{ fontWeight: 650 }}>{t.inbox_private_draft}</span>
          </label>
          <p className="hint">{isPrivate ? t.inbox_private_draft : t.inbox_shared_triage}</p>
        </div>
        <div className="row">
          <button className="btn btn-primary" type="submit">{t.save}</button>
          <button className="btn btn-secondary" type="button" onClick={() => nav("/inbox")}>{t.cancel}</button>
        </div>
      </form>
    </div>
  );
}

function ReviewForm({
  initialTitle, onSubmit, onIgnore,
}: {
  initialTitle: string;
  onSubmit: (draft: { title: string; ownerId: string; dueDate: string }) => Promise<void>;
  onIgnore: () => Promise<void>;
}) {
  const { snapshot, t } = useApp();
  const [title, setTitle] = useState(initialTitle);
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  return (
    <div className="card mt-12">
      <h3>{t.inbox_review}</h3>
      <p className="xsmall muted mb-12">{t.inbox_parse_uncertain}</p>
      <div className="field">
        <label htmlFor="rv-title">{t.inbox_email_parse_title}</label>
        <input id="rv-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </div>
      <div className="detail-grid">
        <div className="field">
          <label htmlFor="rv-owner">{t.task_owner_label} <span className="muted">({t.optional})</span></label>
          <select id="rv-owner" className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">{t.task_owner_unassigned}</option>
            {snapshot!.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rv-due">{t.task_due_label} <span className="muted">({t.optional})</span></label>
          <input id="rv-due" className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div className="row wrap">
        <button className="btn btn-primary" onClick={() => onSubmit({ title: title.trim(), ownerId, dueDate })} disabled={!title.trim()}>
          {t.inbox_create_task}
        </button>
        <button className="btn btn-secondary" onClick={onIgnore}>{t.inbox_ignored_state}</button>
      </div>
    </div>
  );
}
