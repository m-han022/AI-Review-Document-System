import { useMemo } from "react";

import type { Submission } from "../../types";
import { useTranslation } from "../LanguageSelector";
import GradeActions from "../GradeActions";

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

export default function DashboardOverview({ submissions }: DashboardOverviewProps) {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const completed = submissions.filter((item) => item.latest_run?.score !== null && item.latest_run?.score !== undefined).length;
    const processing = submissions.length - completed;
    const failed = 0;
    const completedRate = submissions.length ? Math.round((completed / submissions.length) * 100) : 0;
    const processingRate = submissions.length ? Math.round((processing / submissions.length) * 100) : 0;
    const failedRate = submissions.length ? Math.round((failed / submissions.length) * 100) : 0;
    return [
      {
        key: "statTotal",
        value: submissions.length,
        suffix: undefined,
        hint: t("dashboard.statTotalHint"),
        tone: "neutral",
      },
      {
        key: "statCompleted",
        value: completed,
        suffix: undefined,
        hint: `${completedRate}%`,
        tone: "success",
      },
      {
        key: "statProcessing",
        value: processing,
        suffix: undefined,
        hint: `${processingRate}%`,
        tone: "warning",
      },
      {
        key: "statFailed",
        value: failed,
        suffix: undefined,
        hint: `${failedRate}%`,
        tone: "danger",
      },
      {
        key: "statAverageScore",
        value: formatAverageScore(submissions),
        suffix: "/100",
        hint: t("dashboard.statAverageScoreHint"),
        tone: "primary",
      },
    ] as const;
  }, [submissions, t]);

  const ungradedCount = submissions.filter(
    (item) => item.latest_run?.score === null || item.latest_run?.score === undefined,
  ).length;

  return (
    <section className="dashboard-overview dashboard-overview--plain">
      <div className="dashboard-overview__body">
        <div className="dashboard-stat-grid">
          {stats.map((stat) => (
            <article key={stat.key} className={`dashboard-stat-card dashboard-stat-card--${stat.tone}`.trim()}>
              <span className="dashboard-stat-card__label">{t(`dashboard.${stat.key}`)}</span>
              <div className="dashboard-stat-card__value">
                <strong>{stat.value}</strong>
                {stat.suffix ? <small>{stat.suffix}</small> : null}
              </div>
              <span className="dashboard-stat-card__hint">{stat.hint}</span>
            </article>
          ))}
        </div>

        <GradeActions ungradedCount={ungradedCount} totalCount={submissions.length} />
      </div>
    </section>
  );
}
