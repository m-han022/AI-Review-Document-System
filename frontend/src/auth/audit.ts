import type { AppAction } from "./permissions";

export interface UiAuditEvent {
  action: AppAction;
  resourceId?: string;
  outcome: "allowed" | "blocked" | "error";
  detail?: string;
  ts: string;
}

export function emitUiAudit(event: UiAuditEvent): void {
  // RBAC-ready hook point: keep as console for now, swap to API/logger later.
  // No backend enforcement in current phase by requirement.
  console.info("[ui-audit]", event);
}
