// Accessible modal/sheet: focus management, Escape close, focus return to trigger,
// background scroll lock + focus trap + inert background. Mobile: bottom sheet; ≥768px: centered dialog.
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useApp } from "@/app/AppProvider";

export function Modal({
  title, onClose, children, closeLabel,
}: {
  title: string; onClose: () => void; children: ReactNode; closeLabel?: string;
}) {
  let resolvedClose = closeLabel;
  try {
    const app = useApp();
    resolvedClose = closeLabel ?? app.t.close;
  } catch {
    resolvedClose = closeLabel ?? "Close";
  }
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    // Focus first focusable or panel itself
    const getFocusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
    const focusables = getFocusables();
    (focusables.length ? focusables[0] : panel)?.focus();

    // Lock scroll + inert background for screen readers
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Inert main content to enforce focus trap for assistive tech (attribute-based, no TS property)
    const main = document.getElementById("main-content") as HTMLElement | null;
    const prevHadInert = main?.hasAttribute("inert") ?? false;
    const prevAriaHidden = main?.getAttribute("aria-hidden") ?? null;
    if (main) {
      // Prefer inert attribute if supported; fallback aria-hidden is set anyway for AT
      main.setAttribute("inert", "");
      main.setAttribute("aria-hidden", "true");
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab" && panel) {
        const items = getFocusables();
        if (!items.length) {
          e.preventDefault();
          return;
        }
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      if (main) {
        if (!prevHadInert) main.removeAttribute("inert");
        if (prevAriaHidden !== null) main.setAttribute("aria-hidden", prevAriaHidden);
        else main.removeAttribute("aria-hidden");
      }
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={resolvedClose}>
            <X size={20} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
