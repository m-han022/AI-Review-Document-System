export type AppAction =
  | "project.view"
  | "project.create"
  | "project.edit"
  | "project.delete"
  | "review.regrade"
  | "review.export"
  | "config.change";

export type AppRole = "viewer" | "operator" | "manager" | "admin";

export interface PermissionContext {
  role: AppRole;
}

export interface FeaturePermissionFlags {
  enableSoftGuard: boolean;
}

export const defaultPermissionFlags: FeaturePermissionFlags = {
  enableSoftGuard: false,
};

const roleMatrix: Record<AppRole, AppAction[]> = {
  viewer: ["project.view"],
  operator: ["project.view", "review.regrade", "review.export", "project.create"],
  manager: ["project.view", "review.regrade", "review.export", "project.create", "project.edit"],
  admin: [
    "project.view",
    "project.create",
    "project.edit",
    "project.delete",
    "review.regrade",
    "review.export",
    "config.change",
  ],
};

export function canPerform(action: AppAction, ctx: PermissionContext, flags = defaultPermissionFlags): boolean {
  if (!flags.enableSoftGuard) return true;
  return roleMatrix[ctx.role].includes(action);
}
