import { XIcon } from "./Icon";
import { useTranslation } from "../LanguageSelector";

export interface ToastItem {
  id: number;
  tone: "success" | "warning" | "danger";
  message: string;
}

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export default function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  const { t } = useTranslation();

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`.trim()}>
          <p>{toast.message}</p>
          <button className="toast__close" onClick={() => onDismiss(toast.id)} aria-label={t("common.dismissNotification")}>
            <XIcon size="sm" />
          </button>
        </div>
      ))}
    </div>
  );
}
