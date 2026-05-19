import type { Project } from "../../types";

export const PAGE_SIZE = {
  dashboard: 5,
  full: 10,
  reference: 20,
} as const;

export type TableVariant = "full" | "dashboard" | "reference";

export function resolvePageSize(variant: TableVariant): number {
  return PAGE_SIZE[variant];
}

export function paginateProjects(projects: Project[], currentPage: number, pageSize: number): Project[] {
  const start = (currentPage - 1) * pageSize;
  return projects.slice(start, start + pageSize);
}

