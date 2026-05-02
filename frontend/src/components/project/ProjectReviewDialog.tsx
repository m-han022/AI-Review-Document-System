import { useEffect, useId, useRef, type ReactNode } from "react";

interface ProjectReviewDialogProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  score?: ReactNode;
  closeLabel: string;
}

export default function ProjectReviewDialog({
  title,
  onClose,
  children,
  wide = false,
  score,
  closeLabel,
}: ProjectReviewDialogProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="detail-summary-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="detail-summary-dialog__backdrop" onClick={onClose} />
      <div className={`detail-summary-dialog__card ${wide ? "detail-summary-dialog__card--wide" : ""}`.trim()}>
        <div className="detail-summary-dialog__header">
          <div>
            <h3 id={titleId}>{title}</h3>
            {score ? <span className="detail-summary-dialog__score">{score}</span> : null}
          </div>
          <button
            ref={closeButtonRef}
            className="btn-secondary btn-secondary--compact"
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
          >
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
