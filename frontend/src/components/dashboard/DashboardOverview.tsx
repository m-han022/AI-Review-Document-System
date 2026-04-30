import { Suspense, lazy, useMemo } from "react";

import { getDocumentTypeKey } from "../../constants/documentTypes";
import { useRubricList } from "../../hooks/useRubrics";
import type { Submission } from "../../types";
import { useTranslation } from "../LanguageSelector";
import GradeActions from "../GradeActions";
import Badge from "../ui/Badge";
import SectionBlock from "../ui/SectionBlock";

const IssueBreakdownChart = lazy(() => import("./charts/IssueBreakdownChart"));
const ScoreGaugeChart = lazy(() => import("./charts/ScoreGaugeChart"));
const WeakCriteriaChart = lazy(() => import("./charts/WeakCriteriaChart"));

interface DashboardOverviewProps {
  submissions: Submission[];
}

function formatAverageScore(submissions: Submission[]) {
  const scored = submissions.filter((item) => typeof item.latest_run?.score === "number");
  if (!scored.length) {
    return "0.0";
  }
  const average = scored.reduce((sum, item) => sum + (item.latest_run?.score ?? 0), 0) / scored.length;
  return average.toFixed(1);
}

function formatPercent(value: number, total: number) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}

export default function DashboardOverview({ submissions }: DashboardOverviewProps) {
  const { t } = useTranslation();
  const rubrics = useRubricList();

  const overview = useMemo(() => {
    const completed = submissions.filter(
      (item) => item.latest_run?.score !== null && item.latest_run?.score !== undefined,
    ).length;
    const processing = submissions.length - completed;
    const failed = submissions.filter(
      (item) => item.status === "failed" || item.status === "error" || item.latest_run?.status === "failed",
    ).length;
    const graded = submissions.filter((item) => typeof item.latest_run?.score === "number");
    const lowScoreCount = graded.filter((item) => (item.latest_run?.score ?? 0) < 60).length;

    const allSlides = graded.flatMap((item) => item.latest_run?.slide_reviews ?? []);
    const ngSlideCount = allSlides.filter((slide) => slide.status === "NG").length;
    const okSlideCount = allSlides.filter((slide) => slide.status === "OK").length;
    const issueBuckets = new Map<string, number>();
    graded.forEach((submission) => {
      Object.entries(submission.latest_run?.issue_breakdown ?? {}).forEach(([key, count]) => {
        issueBuckets.set(key, (issueBuckets.get(key) ?? 0) + Number(count));
      });
    });

    const criteriaMap = new Map<string, { total: number; max: number; count: number }>();
    graded.forEach((submission) => {
      submission.latest_run?.criteria_results.forEach((criterion) => {
        const current = criteriaMap.get(criterion.key) ?? { total: 0, max: 0, count: 0 };
        current.total += criterion.score;
        current.max += criterion.max_score;
        current.count += 1;
        criteriaMap.set(criterion.key, current);
      });
    });

    const weakCriteria = [...criteriaMap.entries()]
      .map(([key, value]) => ({
        key,
        label: t(`upload.criteria.${key}`),
        ratio: value.max > 0 ? value.total / value.max : 0,
        average: value.count > 0 ? value.total / value.count : 0,
      }))
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 3);

    const focusItems = [...graded]
      .sort((a, b) => (a.latest_run?.score ?? 0) - (b.latest_run?.score ?? 0))
      .slice(0, 3)
      .map((item) => ({
        id: item.project_id,
        name: item.filename,
        score: item.latest_run?.score ?? 0,
      }));

    const activeVersions = rubrics
      .filter((rubric) => rubric.active)
      .slice(0, 4)
      .map((rubric) => ({
        key: `${rubric.document_type}-${rubric.version}`,
        label: t(getDocumentTypeKey(rubric.document_type)),
        version: rubric.version,
      }));

    const reviewedToday = graded.filter((item) => {
      const gradedAt = item.latest_run?.graded_at;
      if (!gradedAt) {
        return false;
      }

      const reviewDate = new Date(gradedAt);
      const today = new Date();
      return (
        reviewDate.getFullYear() === today.getFullYear()
        && reviewDate.getMonth() === today.getMonth()
        && reviewDate.getDate() === today.getDate()
      );
    }).length;

    return {
      total: submissions.length,
      completed,
      processing,
      failed,
      averageScore: formatAverageScore(submissions),
      lowScoreCount,
      okSlideCount,
      ngSlideCount,
      weakCriteria,
      issueBreakdown: [
        { key: "logic", label: t("dashboard.issueCategory.logic"), count: issueBuckets.get("logic") ?? 0 },
        { key: "quantitative", label: t("dashboard.issueCategory.quantitative"), count: issueBuckets.get("quantitative") ?? 0 },
        { key: "impact", label: t("dashboard.issueCategory.impact"), count: issueBuckets.get("impact") ?? 0 },
        { key: "governance", label: t("dashboard.issueCategory.governance"), count: issueBuckets.get("governance") ?? 0 },
        { key: "expression", label: t("dashboard.issueCategory.expression"), count: issueBuckets.get("expression") ?? 0 },
        { key: "other", label: t("dashboard.issueCategory.other"), count: issueBuckets.get("other") ?? 0 },
      ].filter((item) => item.count > 0),
      focusItems,
      activeVersions,
      reviewedToday,
    };
  }, [rubrics, submissions, t]);

  const ungradedCount = submissions.filter(
    (item) => item.latest_run?.score === null || item.latest_run?.score === undefined,
  ).length;
  const chartFallback = <div className="chart-card chart-card--loading" aria-hidden="true" />;

  return (
    <section className="dashboard-overview dashboard-overview--plain">
      <div className="dashboard-overview__body">
        <div className="dashboard-overview__grid">
          <SectionBlock className="dashboard-overview-card dashboard-overview-card--summary">
            <SectionBlock.Body>
              <div className="dashboard-overview-card__header">
                <div>
                  <span className="dashboard-overview-card__eyebrow">{t("dashboard.qualityTitle")}</span>
                  <h3>{t("dashboard.statAverageScore")}</h3>
                </div>
                <Badge tone={overview.processing > 0 ? "warning" : "success"}>
                  {overview.processing > 0 ? t("project.pending") : t("common.ready")}
                </Badge>
              </div>
              <Suspense fallback={chartFallback}>
                <ScoreGaugeChart
                  score={Number(overview.averageScore)}
                  label={t("dashboard.statAverageScore")}
                  statusLabel={overview.processing > 0 ? t("project.pending") : t("common.ready")}
                />
              </Suspense>
              <div className="dashboard-overview-card__summary-grid">
                <article className="dashboard-overview-card__summary-item">
                  <span>{t("dashboard.statTotal")}</span>
                  <strong>{overview.total}</strong>
                </article>
                <article className="dashboard-overview-card__summary-item">
                  <span>{t("dashboard.statCompleted")}</span>
                  <strong>{formatPercent(overview.completed, overview.total)}</strong>
                </article>
                <article className="dashboard-overview-card__summary-item">
                  <span>{t("dashboard.statReviewedToday")}</span>
                  <strong>{overview.reviewedToday}</strong>
                </article>
                <article className="dashboard-overview-card__summary-item">
                  <span>{t("dashboard.statActiveVersions")}</span>
                  <strong>{overview.activeVersions.length}</strong>
                </article>
              </div>
            </SectionBlock.Body>
          </SectionBlock>

          <SectionBlock className="dashboard-overview-card">
            <SectionBlock.Header
              title={t("dashboard.issueBreakdownTitle")}
              subtitle={t("dashboard.issueBreakdownSubtitle")}
            />
            <SectionBlock.Body>
              {overview.issueBreakdown.length ? (
                <Suspense fallback={chartFallback}>
                  <IssueBreakdownChart data={overview.issueBreakdown} totalLabel={t("project.issueCount")} />
                </Suspense>
              ) : (
                <div className="dashboard-overview-card__list">
                  <div className="dashboard-overview-card__list-row">
                    <span>{t("dashboard.okSlides")}</span>
                    <strong>{overview.okSlideCount}</strong>
                  </div>
                  <div className="dashboard-overview-card__list-row">
                    <span>{t("dashboard.ngSlides")}</span>
                    <strong>{overview.ngSlideCount}</strong>
                  </div>
                </div>
              )}
            </SectionBlock.Body>
          </SectionBlock>

          <SectionBlock className="dashboard-overview-card">
            <SectionBlock.Header
              title={t("dashboard.weakCriteriaTitle")}
              subtitle={t("dashboard.weakCriteriaSubtitle")}
            />
            <SectionBlock.Body>
              {overview.weakCriteria.length ? (
                <Suspense fallback={chartFallback}>
                  <WeakCriteriaChart data={overview.weakCriteria} />
                </Suspense>
              ) : (
                <p className="dashboard-overview-card__empty">{t("dashboard.weakCriteriaEmpty")}</p>
              )}
            </SectionBlock.Body>
          </SectionBlock>

          <SectionBlock className="dashboard-overview-card">
            <SectionBlock.Header
              title={t("dashboard.activeVersionsTitle")}
              subtitle={t("dashboard.activeVersionsSubtitle")}
            />
            <SectionBlock.Body>
              <div className="dashboard-overview-card__stack">
                {overview.activeVersions.length ? (
                  overview.activeVersions.map((item) => (
                    <div className="dashboard-overview-card__focus-item" key={item.key}>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{t("project.rubricVersion")}</span>
                      </div>
                      <Badge tone="primary">{item.version}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="dashboard-overview-card__empty">{t("dashboard.activeVersionEmpty")}</p>
                )}
              </div>
            </SectionBlock.Body>
          </SectionBlock>

          <SectionBlock className="dashboard-overview-card">
            <SectionBlock.Header
              title={t("dashboard.focusTitle")}
              subtitle={t("dashboard.focusSubtitle")}
            />
            <SectionBlock.Body>
              <div className="dashboard-overview-card__stack">
                {overview.focusItems.length ? (
                  overview.focusItems.map((item) => (
                    <div className="dashboard-overview-card__focus-item" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.id}</span>
                      </div>
                      <Badge tone={item.score < 60 ? "danger" : item.score < 80 ? "warning" : "success"}>
                        {item.score}/100
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="dashboard-overview-card__empty">{t("dashboard.focusEmpty")}</p>
                )}
              </div>
            </SectionBlock.Body>
          </SectionBlock>
        </div>

        <GradeActions ungradedCount={ungradedCount} totalCount={submissions.length} />
      </div>
    </section>
  );
}
