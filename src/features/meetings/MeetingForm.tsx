// New meeting form. Creating a meeting also creates a linked calendar event.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { EmptyState } from "@/components/primitives";
import { formatDateTimeForInput, localInputToInstant } from "@/lib/dates";

export default function MeetingForm() {
  const { snapshot, persona, t, prefs, repo, refresh } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(formatDateTimeForInput(new Date().toISOString(), prefs.displayTz));
  const [duration, setDuration] = useState("60");
  const [agenda, setAgenda] = useState("");
  const [workstreamId, setWorkstreamId] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);

  if (!snapshot || !persona) return <div className="page"><EmptyState title={t.loading} /></div>;
  if (persona.role === "viewer") return <div className="page"><EmptyState title={t.not_found_title} body={t.persona_note} /></div>;
  const project = snapshot.projects[0];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!title.trim()) errs.push(t.validation_required_title);
    setIssues(errs);
    if (errs.length) return;
    const res = await repo!.createMeeting({
      projectId: project.id,
      title: title.trim(),
      startsAt: localInputToInstant(startsAt, prefs.displayTz),
      durationMin: Number(duration) || 60,
      workstreamId: workstreamId || null,
      agenda,
      participants,
    }, persona.id);
    if (res.ok) {
      toast(t.saved);
      refresh();
      nav(`/meetings/${res.data.id}`);
    } else {
      setIssues([res.error.code === "validation" ? res.error.issues[0]?.message ?? t.error_generic : t.error_generic]);
    }
  };

  return (
    <div className="page page-narrow">
      <h1 className="page-title">{t.meeting_new}</h1>
      {issues.length > 0 && <div className="banner banner-danger" role="alert"><ul className="small">{issues.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="m-title">{t.meeting_title_label} *</label>
          <input id="m-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </div>
        <div className="detail-grid">
          <div className="field">
            <label htmlFor="m-start">{t.meeting_start_label} *</label>
            <input id="m-start" className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="m-dur">{t.meeting_duration_label}</label>
            <input id="m-dur" className="input" type="number" min={5} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="m-ws">{t.task_workstream_label} <span className="muted">({t.optional})</span></label>
          <select id="m-ws" className="select" value={workstreamId} onChange={(e) => setWorkstreamId(e.target.value)}>
            <option value="">{t.none}</option>
            {snapshot.workstreams.map((w) => <option key={w.id} value={w.id}>{prefs.locale === "cs" ? w.name : w.nameEn}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{t.meeting_participants} <span className="muted">({t.optional})</span></label>
          <div className="chip-row">
            {snapshot.people.map((p) => (
              <button key={p.id} type="button" className={`chip ${participants.includes(p.id) ? "active" : ""}`}
                aria-pressed={participants.includes(p.id)}
                onClick={() => setParticipants((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="m-agenda">{t.meeting_agenda_label} <span className="muted">({t.optional})</span></label>
          <textarea id="m-agenda" className="textarea" value={agenda} onChange={(e) => setAgenda(e.target.value)} maxLength={3000} />
        </div>
        <div className="row">
          <button className="btn btn-primary" type="submit">{t.create}</button>
          <button className="btn btn-secondary" type="button" onClick={() => nav(-1)}>{t.cancel}</button>
        </div>
      </form>
    </div>
  );
}
