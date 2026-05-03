import React from "react";

interface DialogProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
}

export default function Dialog({
  open,
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  pending = false,
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(event) => event.stopPropagation()}
        style={{ width: '450px', maxWidth: '90vw' }}
      >
        <div className="dialog-card__header">
          <h3 id="dialog-title">{title}</h3>
        </div>

        <div className="dialog-card__content" style={{ padding: '0 24px 24px' }}>
          {children}
        </div>

        <div className="dialog-card__actions">
          <button className="btn-secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button className="btn-primary" onClick={onConfirm} disabled={pending} style={{ background: '#6366f1', color: 'white' }}>
            {pending ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
