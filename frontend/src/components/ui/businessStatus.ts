export type BusinessStatus = "processing" | "reviewReady" | "attentionNeeded" | "exporting";

export function toBusinessStatus(technicalStatus: string | null | undefined): BusinessStatus {
  const normalized = technicalStatus?.toLowerCase() ?? "";
  if (normalized === "completed" || normalized === "graded") return "reviewReady";
  if (normalized === "failed" || normalized === "retry") return "attentionNeeded";
  if (normalized === "exporting") return "exporting";
  return "processing";
}

export function businessStatusTone(status: BusinessStatus): "success" | "warning" | "danger" | "primary" {
  if (status === "reviewReady") return "success";
  if (status === "attentionNeeded") return "danger";
  if (status === "exporting") return "primary";
  return "warning";
}

