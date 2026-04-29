interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
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
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
          <p>{description}</p>
        </div>

        {details?.length ? (
          <div className="dialog-card__details">
            {details.map((detail) => (
              <span key={detail} className="dialog-card__chip">
                {detail}
              </span>
            ))}
          </div>
        ) : null}

        <div className="dialog-card__actions">
          <button className="btn-secondary btn-secondary--compact" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button className="btn-danger-soft btn-danger-soft--compact" onClick={onConfirm} disabled={pending}>
            {pending ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
