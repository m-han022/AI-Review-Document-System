import BaseModal from "./BaseModal";
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
  tone?: "danger" | "primary" | "warning";
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
  tone = "danger",
}: ConfirmDialogProps) {
  return (
    <BaseModal
      open={open}
      onClose={onCancel}
      title={title}
      subtitle={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={isLoading} size="md">
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "primary"} onClick={onConfirm} isLoading={isLoading} size="md">
            {confirmLabel}
          </Button>
        </>
      }
    >
      {details?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
    </BaseModal>
  );
}
