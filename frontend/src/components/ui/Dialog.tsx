import type { ReactNode } from "react";
import { useTranslation } from "../LanguageSelector";

interface DialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
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
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card dialog-card--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-card__header">
          <h3 id="dialog-title">{title}</h3>
        </div>

        <div className="dialog-card__content dialog-card__content--compact">
          {children}
        </div>

        <div className="dialog-card__actions">
          <button className="btn-secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button className="btn-primary" onClick={onConfirm} disabled={pending}>
            {pending ? t("common.loading") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
