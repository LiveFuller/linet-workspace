// Meetings list + weekly review entry.
import { Link } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { EmptyState } from "@/components/primitives";
import { formatInstant } from "@/lib/dates";

export default function MeetingsPage() {
  const { snapshot, t, prefs } = useApp();
  if (!snapshot) return <div className="page"><EmptyState title={t.loading} /></div>;
  const { meetings } = snapshot;
  const sorted = [...meetings].sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));

  return (
    <div className="page">
      <div className="row-between mb-8">
        <h1 className="page-title">{t.meetings_title}</h1>
        <Link className="btn btn-primary btn-sm" to="/meetings/new">
          <PlusCircle size={16} aria-hidden /> {t.meeting_new}
        </Link>
      </div>
      <ul className="stack">
        {sorted.map((m) => {
          const proposalCount = snapshot.proposals.filter((p) => p.meetingId === m.id).length;
          const openCount = snapshot.proposals.filter((p) => p.meetingId === m.id && p.state === "needs_review").length;
          return (
            <li key={m.id}>
              <Link to={`/meetings/${m.id}`} className="card row-between" style={{ textDecoration: "none", color: "inherit" }}>
                <div>
                  <strong className="small">{m.title}</strong>
                  <p className="xsmall muted">
                    {formatInstant(m.startsAt, prefs.locale, prefs.displayTz)} · {m.durationMin} min
                    {m.hasTranscript && ` · ${t.meeting_transcript}`}
                  </p>
                </div>
                <div className="row">
                  {openCount > 0 && <span className="status-pill st-waiting">{openCount} {t.meeting_proposal_needs_review}</span>}
                  <span className="status-pill st-todo">{proposalCount} {t.meeting_proposals}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {sorted.length === 0 && <EmptyState title={t.meetings_title} body={t.none} />}
    </div>
  );
}
