import type { GradingRun, GradingRunDetail, GradingRunHistory } from "../../types";

type RunLike = Partial<GradingRun> | Partial<GradingRunHistory> | null | undefined;

export interface RunDataHealth {
  status: string;
  isCompleted: boolean;
  isFailed: boolean;
  hasScore: boolean;
  hasCriteria: boolean;
  hasPageReviews: boolean;
  hasUsableData: boolean;
  isCompletedButMissingCriteria: boolean;
}

export function evaluateRunDataHealth(run: RunLike, detail?: GradingRunDetail | null): RunDataHealth {
  const status = String(run?.status || detail?.grading_run?.status || "").toUpperCase();
  const isCompleted = status === "COMPLETED";
  const isFailed = status.startsWith("FAILED");
  const score = run?.total_score ?? run?.score ?? detail?.grading_run?.total_score ?? detail?.grading_run?.score;
  const hasScore = typeof score === "number";
  const criteriaCount = Array.isArray(detail?.criteria_results) ? detail!.criteria_results.length : 0;
  const pageCount = Array.isArray(detail?.page_reviews)
    ? detail!.page_reviews.length
    : Array.isArray(detail?.slide_reviews)
      ? detail!.slide_reviews.length
      : 0;
  const hasCriteria = criteriaCount > 0;
  const hasPageReviews = pageCount > 0;
  const hasUsableData = hasScore || hasCriteria || hasPageReviews;
  return {
    status,
    isCompleted,
    isFailed,
    hasScore,
    hasCriteria,
    hasPageReviews,
    hasUsableData,
    isCompletedButMissingCriteria: isCompleted && !hasCriteria,
  };
}

