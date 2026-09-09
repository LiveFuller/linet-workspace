// Shared presentational primitives — premium, restrained.
import type { ReactNode } from "react";
import { Inbox as InboxIcon, SearchX, AlertCircle, Sparkles } from "lucide-react";

export function EmptyState({ title, body, icon, action }: { title: string; body?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-illust" aria-hidden>{icon ?? <Sparkles size={20} />}</div>
      <div className="empty-title">{title}</div>
      {body && <div className="empty-body">{body}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty-state" role="alert" style={{ borderColor: "var(--danger-border)", background: "var(--danger-soft)" }}>
      <div className="empty-illust" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}><AlertCircle size={20} aria-hidden /></div>
      <div className="empty-title">Chyba / Error</div>
      <div className="empty-body">{message}</div>
      {onRetry && (
        <button className="btn btn-secondary btn-sm mt-12" onClick={onRetry}>
          Zkusit znovu / Retry
        </button>
      )}
    </div>
  );
}

export function SectionHead({
  title, count, viewAllHref, viewAllLabel,
}: { title: string; count?: number; viewAllHref?: string; viewAllLabel?: string }) {
  return (
    <div className="section-head">
      <h3>{title}</h3>
      {typeof count === "number" && count > 0 && <span className="count-chip">{count}</span>}
      {viewAllHref && <a href={viewAllHref}>{viewAllLabel}</a>}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="empty-state" role="status" aria-live="polite" aria-busy="true">
      <div className="empty-illust" aria-hidden><InboxIcon size={20} /></div>
      <div className="empty-body mt-8">{label}</div>
      <div className="skeleton skeleton-line short" style={{ margin: "16px auto 0", maxWidth: 180 }} aria-hidden />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card" aria-hidden>
      <div className="skeleton skeleton-line" style={{ width: "68%" }} />
      <div className="skeleton skeleton-line short" />
      <div className="skeleton skeleton-line" style={{ width: "42%" }} />
    </div>
  );
}

export function SkeletonStack({ count = 3 }: { count?: number }) {
  return (
    <div className="stack" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

export function SearchEmpty({ query }: { query: string }) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-illust"><SearchX size={20} aria-hidden /></div>
      <div className="empty-title">Nic nenalezeno</div>
      <div className="empty-body">Pro “{query}” jsme nic nenašli. Zkuste jiné slovo nebo filtr.</div>
    </div>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}
