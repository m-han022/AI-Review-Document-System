type StatusBadgeTone = "success" | "warning" | "danger" | "muted";

type Translator = (key: string) => string;

function normalizeStatus(status?: string | null): string {
  return (status || "").trim().toLowerCase();
}

export function auditStatusTone(status?: string | null): StatusBadgeTone {
  const normalized = normalizeStatus(status);
  if (normalized === "completed") return "success";
  if (normalized === "failed") return "danger";
  if (normalized === "pending" || normalized === "extracting" || normalized === "grading") return "warning";
  return "muted";
}

export function auditStatusLabel(status: string, t: Translator): string {
  const normalized = normalizeStatus(status);
  if (normalized === "pending") return t("status.pending");
  if (normalized === "extracting") return t("status.extracting");
  if (normalized === "grading") return t("status.grading");
  if (normalized === "completed") return t("status.completed");
  if (normalized === "failed") return t("status.failed");
  return status;
}

export function auditErrorSummary(message?: string | null): string {
  if (!message) return "";
  const normalized = message.trim();
  if (!normalized) return "";
  if (normalized.includes("Run timed out while pending/extracting/grading")) {
    return "Het thoi gian cho xu ly";
  }
  if (normalized.includes("no Celery worker is responding") || normalized.includes("No Celery worker is responding")) {
    return "Khong co worker xu ly";
  }
  if (normalized.includes("Celery broker is not reachable")) {
    return "Khong ket noi duoc broker";
  }
  if (normalized.length <= 64) return normalized;
  return `${normalized.slice(0, 61)}...`;
}

export function auditReviewedAtLabel(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function isFailedAuditStatus(status?: string | null): boolean {
  return normalizeStatus(status) === "failed";
}
