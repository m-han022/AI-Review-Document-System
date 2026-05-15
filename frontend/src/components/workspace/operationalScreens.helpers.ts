import type { Project } from "../../types";

export interface OperationalMetrics {
  reviewed: Project[];
  pending: number;
  needsAction: Project[];
  avgScore: number | null;
  trend: Array<{ value: number | null }>;
}

export function buildOperationalMetrics(projects: Project[]): OperationalMetrics {
  const reviewed = projects.filter((p) => p.latest_score !== null);
  const pending = projects.length - reviewed.length;
  const needsAction = reviewed.filter((p) => (p.latest_score ?? 0) < 80);
  const avgScore = reviewed.length
    ? Math.round(reviewed.reduce((sum, p) => sum + (p.latest_score ?? 0), 0) / reviewed.length)
    : null;

  const trend = projects
    .filter((p) => p.latest_score !== null)
    .sort((a, b) => new Date(a.latest_updated_at).getTime() - new Date(b.latest_updated_at).getTime())
    .slice(-10)
    .map((p) => ({ value: p.latest_score }));

  return { reviewed, pending, needsAction, avgScore, trend };
}

export function buildLatestRows(projects: Project[], limit = 8): Project[] {
  return [...projects]
    .sort((a, b) => new Date(b.latest_updated_at).getTime() - new Date(a.latest_updated_at).getTime())
    .slice(0, limit);
}

export function hasReviewedScore(project: Project): boolean {
  return typeof project.latest_score === "number";
}
