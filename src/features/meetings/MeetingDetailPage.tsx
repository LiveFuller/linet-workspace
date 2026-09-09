// Meeting workspace: transcript review, deterministic action proposals, approve-once.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, FileText, ThumbsDown, Clock3, Upload, Sparkles, Lightbulb } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { EmptyState } from "@/components/primitives";
import { Modal } from "@/components/Modal";
import { formatInstant } from "@/lib/dates";
import { extractActionCandidates, parseTranscript, SAMPLE_SRT } from "@/domain/transcript";
import type { MeetingActionProposal } from "@/domain/types";

const RELATIVE_DATE_RE = /(dní|dne|dnů|dny|days?|t[ýy]den|t[ýy]dne|t[ýy]dnu|t[ýy]dn[ůu]|week)/i;

export default function MeetingDetailPage() {
  const { snapshot, persona, t, prefs, repo, refresh } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();
  const { meetingId } = useParams();
  const [showImport, setShowImport] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [showProposal, setShowProposal] = useState<MeetingActionProposal | null>(null);
  const [helperRan, setHelperRan] = useState(false);
  // notes local state — debounced save, explicit Save button
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  if (!snapshot || !persona || !meetingId) return <div className="page"><EmptyState title={t.loading} icon={<Sparkles size={20} />} /></div>;
  const meeting = snapshot.meetings.find((m) => m.id === meetingId);
  if (!meeting) {
    return <div className="page page-narrow"><EmptyState title={t.not_found_title} body={t.not_found_object} icon={<FileText size={20} />} /></div>;
  }
  const transcripts = snapshot.transcripts.filter((x) => x.meetingId === meeting.id).sort((a, b) => a.position - b.position);
  const proposals = snapshot.proposals.filter((p) => p.meetingId === meeting.id);
  const decisions = snapshot.decisions.filter((d) => d.sourceMeetingId === meeting.id);
  const canReview = persona.role !== "viewer";
  const project = snapshot.projects.find((p) => p.id === meeting.projectId)!;

  // keep draft in sync when meeting changes (e.g. after refresh), but not while user edits
  useEffect(() => {
    setNotesDraft(meeting.notesSummary);
  }, [meeting.notesSummary, meeting.id]);

  const saveNotes = async (value: string) => {
    if (!canReview) return;
    setNotesSaving(true);
    const res = await repo!.updateMeeting(meeting.id, { notesSummary: value }, persona.id);
    setNotesSaving(false);
    if (res.ok) {
      toast(t.saved);
      setNotesSavedAt(new Date().toISOString());
      refresh();
    } else {
      toast(t.error_generic);
    }
  };

  const onNotesChange = (value: string) => {
    setNotesDraft(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (value !== meeting.notesSummary) saveNotes(value);
    }, 900);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const doImport = async (filename: string, content: string) => {
    const segments = parseTranscript(filename, content);
    if (segments.length === 0) {
      toast(t.error_generic);
      return;
    }
    const res = await repo!.importTranscript(meeting.id, segments, persona.id);
    if (res.ok) {
      toast(t.meeting_transcript_imported);
      setHelperRan(false);
      refresh();
      setShowImport(false);
      setPastedText("");
    } else {
      toast(res.error.code === "validation" ? res.error.issues[0]?.message ?? t.error_generic : t.error_generic);
    }
  };

  const runHelper = async () => {
    // Deterministic helper — honestly labeled, requires human review of every proposal.
    const candidates = extractActionCandidates(transcripts);
    let created = 0;
    let conflicts = 0;
    for (const [i, c] of candidates.entries()) {
      const res = await repo!.addProposal({
        meetingId: meeting.id,
        evidenceText: c.evidenceText,
        proposedTitle: c.proposedTitle,
        proposedOwnerId: null, // owner guess would be fabrication — human decides
        proposedDueDate: null, // relative dates need confirmation
        sourceActionKey: `helper-${meeting.id.slice(0, 8)}-${c.segmentIndex}-${i}`,
      }, persona.id);
      if (res.ok) created++;
      else conflicts++;
    }
    setHelperRan(true);
    toast(t.meeting_extract_generated(created + (conflicts > 0 ? 1 : 0)));
    refresh();
  };

  const approve = async (p: MeetingActionProposal, draft: { title: string; ownerId: string; dueDate: string }) => {
    const res = await repo!.approveProposal(p.id, {
      projectId: project.id,
      title: draft.title,
      description: "",
      ownerId: draft.ownerId || null,
      workstreamId: meeting.workstreamId,
      labelIds: [],
      dueDate: draft.dueDate || null,
      status: "todo",
      statusNote: null,
      source: "meeting_action",
      sourceRef: p.sourceActionKey,
      sourceUrl: null,
    }, persona.id);
    if (res.ok) {
      toast(t.meeting_proposal_accepted);
      setShowProposal(null);
      refresh();
    } else if (res.error.code === "conflict") {
      toast(t.meeting_proposal_link_exists);
      setShowProposal(null);
    } else {
      toast(t.error_generic);
    }
  };

  const notesDirty = notesDraft !== meeting.notesSummary;

  return (
    <div className="page">
      <div className="row-between mb-8">
        <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)} aria-label={t.back}>← {t.back}</button>
        <Link to={`/tasks/new`} className="btn btn-secondary btn-sm">{t.add_task}</Link>
      </div>
      <div className="card">
        <h1 style={{ fontSize: 21 }}>{meeting.title}</h1>
        <p className="small muted mt-4">
          {formatInstant(meeting.startsAt, prefs.locale, prefs.displayTz)} · {meeting.durationMin} min ·{" "}
          {meeting.status === "planned" ? t.meeting_status_planned
            : meeting.status === "in_review" ? t.meeting_status_in_review
            : meeting.status === "notes_published" ? t.meeting_status_published
            : t.meeting_status_archived}
        </p>
        {meeting.agenda && (
          <>
            <h4 className="mt-12">{t.meeting_agenda_label}</h4>
            <p className="small" style={{ whiteSpace: "pre-wrap" }}>{meeting.agenda}</p>
          </>
        )}
        <h4 className="mt-12">{t.meeting_participants}</h4>
        <p className="small">{meeting.participants.map((id) => snapshot.people.find((p) => p.id === id)?.name).filter(Boolean).join(", ") || t.none}</p>
      </div>

      {/* Notes */}
      <section className="section-block" aria-labelledby="h-notes">
        <div className="section-head">
          <h3 id="h-notes">{t.meeting_notes}</h3>
          {canReview && meeting.status !== "notes_published" && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                await repo!.updateMeeting(meeting.id, { publishedNotes: meeting.notesSummary, status: "notes_published" }, persona.id);
                toast(t.meeting_published);
                refresh();
              }}
            >
              {t.meeting_publish_notes}
            </button>
          )}
        </div>
        <textarea
          className="textarea"
          aria-label={t.meeting_notes}
          value={notesDraft}
          disabled={!canReview}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={t.meeting_notes}
          style={{ minHeight: 128 }}
        />
        <div className="row-between mt-8">
          <div className="xsmall muted">
            {notesDirty ? t.task_editing : notesSavedAt ? `${t.saved} · ${formatInstant(notesSavedAt, prefs.locale, prefs.displayTz)}` : <span className="muted">{t.meeting_notes}</span>}
            {notesSaving && <span className="xsmall muted"> · {t.loading}</span>}
          </div>
          {canReview && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => saveNotes(notesDraft)}
              disabled={!notesDirty || notesSaving}
            >
              {t.save}
            </button>
          )}
        </div>
        {meeting.publishedNotes && (
          <div className="banner banner-info mt-8 small">
            <span>{t.meeting_status_published}: {meeting.publishedNotes.slice(0, 120)}{meeting.publishedNotes.length > 120 ? "…" : ""}</span>
          </div>
        )}
        {!canReview && <p className="xsmall muted mt-8">{t.persona_note}</p>}
      </section>

      {/* Transcript */}
      <section className="section-block" aria-labelledby="h-transcript">
        <div className="section-head">
          <h3 id="h-transcript">{t.meeting_transcript}</h3>
          {canReview && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>
              <Upload size={15} aria-hidden /> {t.meeting_import_transcript}
            </button>
          )}
        </div>
        {transcripts.length === 0 ? (
          <EmptyState
            title={t.meeting_no_transcript}
            body={t.meeting_transcript_source}
            icon={<FileText size={20} aria-hidden />}
            action={canReview ? <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}><Upload size={15} aria-hidden /> {t.meeting_import_transcript}</button> : undefined}
          />
        ) : (
          <>
            <p className="xsmall muted">{t.meeting_transcript_source}</p>
            <ul className="stack">
              {transcripts.map((seg) => (
                <li key={seg.id} className="card" style={{ padding: "10px 14px" }}>
                  <div className="row-between">
                    <span className="xsmall" style={{ fontWeight: 700 }}>
                      {seg.speaker ?? t.none}
                      {seg.startMs !== null && (
                        <span className="muted" style={{ fontWeight: 400 }}>
                          {" "}[{Math.floor(seg.startMs / 60000)}:{String(Math.floor((seg.startMs % 60000) / 1000)).padStart(2, "0")}]
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="small" style={{ margin: 0 }}>{seg.text}</p>
                </li>
              ))}
            </ul>
            {canReview && (
              <div className="mt-12">
                <button className="btn btn-secondary btn-sm" onClick={runHelper}>
                  <FileText size={15} aria-hidden /> {t.meeting_extract_helper}
                </button>
                <p className="hint">{t.meeting_extract_hint}</p>
                {helperRan && <p className="xsmall muted">{t.meeting_extract_method_helper}</p>}
              </div>
            )}
          </>
        )}
      </section>

      {/* Proposals */}
      <section className="section-block" aria-labelledby="h-prop">
        <div className="section-head"><h3 id="h-prop">{t.meeting_proposals}</h3><span className="count-chip">{proposals.length}</span></div>
        {proposals.length === 0 ? (
          <EmptyState
            title={t.meeting_proposals}
            body={t.meeting_extract_hint}
            icon={<Lightbulb size={20} aria-hidden />}
            action={transcripts.length > 0 && canReview ? <button className="btn btn-secondary btn-sm" onClick={runHelper}><Sparkles size={15} aria-hidden /> {t.meeting_extract_helper}</button> : undefined}
          />
        ) : (
          <ul className="stack">
            {proposals.map((p) => {
              return (
                <li key={p.id} className="card">
                  <div className="row-between">
                    <strong className="small">{p.proposedTitle}</strong>
                    <span className={`status-pill ${p.state === "accepted" ? "st-done" : p.state === "rejected" ? "st-blocked" : p.state === "postponed" ? "st-waiting" : "st-progress"}`}>
                      {p.state === "accepted" ? t.meeting_proposal_accepted
                        : p.state === "rejected" ? t.meeting_proposal_rejected
                        : p.state === "postponed" ? t.meeting_proposal_postponed
                        : t.meeting_proposal_needs_review}
                    </span>
                  </div>
                  <blockquote className="small" style={{ borderLeft: "3px solid var(--brand-soft-strong)", margin: "10px 0 0", padding: "8px 12px", background: "var(--brand-ghost)", borderRadius: "0 10px 10px 0", fontStyle: "italic", color: "var(--text-secondary)" }}>
                    „{p.evidenceText}“
                    <span className="xsmall muted" style={{ fontStyle: "normal", marginLeft: 6 }}>— {p.extractionMethod === "deterministic_helper" ? t.meeting_extract_method_helper : p.extractionMethod === "ai_provider" ? t.meeting_extract_method_ai : t.meeting_extract_method_manual}</span>
                  </blockquote>
                  {p.proposedDueDate === null && p.state === "needs_review" && RELATIVE_DATE_RE.test(p.evidenceText) && (
                    <p className="xsmall mt-8" style={{ color: "var(--warning)", fontWeight: 600 }}>{t.meeting_relative_date_confirm}</p>
                  )}
                  {p.createdTaskId && (
                    <p className="xsmall mt-8">→ <Link to={`/tasks/${p.createdTaskId}`}>{t.nav_tasks}: {p.createdTaskId.slice(0, 8)}…</Link></p>
                  )}
                  {canReview && (p.state === "needs_review" || p.state === "postponed") && (
                    <div className="row wrap mt-8">
                      <button className="btn btn-primary btn-sm" onClick={() => setShowProposal(p)}>
                        <Check size={15} aria-hidden /> {t.meeting_proposal_accept}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={async () => { await repo!.updateProposal(p.id, { state: "rejected" }, persona.id); refresh(); }}
                      >
                        <ThumbsDown size={15} aria-hidden /> {t.meeting_proposal_reject}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={async () => { await repo!.updateProposal(p.id, { state: "postponed" }, persona.id); refresh(); }}
                      >
                        <Clock3 size={15} aria-hidden /> {t.meeting_proposal_postpone}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Decisions from this meeting */}
      {decisions.length > 0 && (
        <section className="section-block" aria-labelledby="h-dec">
          <div className="section-head"><h3 id="h-dec">{t.decisions_title}</h3></div>
          <ul className="stack small">
            {decisions.map((d) => (
              <li key={d.id} className="card">
                <strong>{d.title}</strong>
                <p className="xsmall muted">{d.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Import dialog */}
      {showImport && (
        <Modal title={t.meeting_import_transcript} onClose={() => setShowImport(false)}>
          <div className="field">
            <label htmlFor="tr-file">TXT / SRT / VTT</label>
            <input
              id="tr-file" type="file" accept=".txt,.srt,.vtt,text/plain"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const content = await f.text();
                await doImport(f.name, content);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="tr-paste">{t.inbox_add_transcript}</label>
            <textarea id="tr-paste" className="textarea" value={pastedText} onChange={(e) => setPastedText(e.target.value)} style={{ minHeight: 120 }} />
          </div>
          <div className="row wrap">
            <button
              className="btn btn-primary"
              disabled={pastedText.trim().length === 0}
              onClick={() => doImport("pasted.txt", pastedText)}
            >
              {t.meeting_import_transcript}
            </button>
            <button className="btn btn-secondary" onClick={() => doImport("sample.srt", SAMPLE_SRT)}>
              {t.inbox_try_sample}
            </button>
          </div>
        </Modal>
      )}

      {/* Approve dialog */}
      {showProposal && (
        <ProposalDialog
          proposal={showProposal}
          onClose={() => setShowProposal(null)}
          onApprove={approve}
        />
      )}
    </div>
  );
}

function ProposalDialog({
  proposal, onClose, onApprove,
}: {
  proposal: MeetingActionProposal;
  onClose: () => void;
  onApprove: (p: MeetingActionProposal, draft: { title: string; ownerId: string; dueDate: string }) => Promise<void>;
}) {
  const { snapshot, t, today } = useApp();
  const [title, setTitle] = useState(proposal.proposedTitle);
  const [ownerId, setOwnerId] = useState(proposal.proposedOwnerId ?? "");
  const [dueDate, setDueDate] = useState(proposal.proposedDueDate ?? "");
  return (
    <Modal title={t.meeting_proposal_accept} onClose={onClose}>
      <blockquote className="small" style={{ borderLeft: "3px solid var(--brand-soft-strong)", padding: "10px 12px", background: "var(--brand-ghost)", borderRadius: "0 10px 10px 0", fontStyle: "italic" }}>
        „{proposal.evidenceText}“
      </blockquote>
      <div className="field mt-12">
        <label htmlFor="p-title">{t.task_title_label} *</label>
        <input id="p-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </div>
      <div className="field">
        <label htmlFor="p-owner">{t.task_owner_label} <span className="muted">({t.optional})</span></label>
        <select id="p-owner" className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          <option value="">{t.task_owner_unassigned}</option>
          {snapshot!.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="p-due">{t.task_due_label} <span className="muted">({t.optional})</span></label>
        <input id="p-due" className="input" type="date" min={today} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {proposal.evidenceText && RELATIVE_DATE_RE.test(proposal.evidenceText) && !dueDate && (
          <p className="xsmall" style={{ color: "var(--warning)", fontWeight: 600 }}>{t.meeting_relative_date_confirm}</p>
        )}
      </div>
      <div className="row">
        <button
          className="btn btn-primary"
          onClick={() => onApprove(proposal, { title: title.trim(), ownerId, dueDate })}
          disabled={!title.trim()}
        >
          {t.meeting_proposal_accept}
        </button>
        <button className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
      </div>
    </Modal>
  );
}
