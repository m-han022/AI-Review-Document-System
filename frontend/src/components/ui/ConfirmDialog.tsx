import { useEffect } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  cancelLabel: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  details,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (open) {
      document.body.classList.add("is-modal-open");
    } else {
      document.body.classList.remove("is-modal-open");
    }
    return () => {
      document.body.classList.remove("is-modal-open");
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-card__header">
          <h3 id="confirm-dialog-title">{title}</h3>
          <p style={{ marginTop: '8px', color: 'var(--ds-color-text-muted)', fontSize: '14px' }}>
            {description}
          </p>
        </div>

        {details?.length ? (
          <div className="dialog-card__content" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {details.map((detail) => (
              <span key={detail} style={{ 
                padding: '4px 8px', borderRadius: 'var(--ds-radius-sm)', 
                backgroundColor: 'var(--ds-color-bg-muted)', fontSize: '12px',
                color: 'var(--ds-color-text-main)', border: '1px solid var(--ds-color-border)'
              }}>
                {detail}
              </span>
            ))}
          </div>
        ) : null}

        <div className="dialog-card__actions">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
