import type { Project } from "../../types";
import { useTranslation } from "../LanguageSelector";
import SubmissionsTable from "../SubmissionsTable";

import { FileReviewIcon, ShieldCheckIcon, TargetIcon } from "../ui/Icon";

interface ReviewListOverviewProps {
  projects: Project[];
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
}

export default function ReviewListOverview({ projects, activeProjectId, onSelectProject }: ReviewListOverviewProps) {
  const { t } = useTranslation();

  const stats = {
    total: projects.length,
    completed: projects.filter((p) => p.latest_score !== null).length,
    avgScore: projects.length > 0 ? Math.round(projects.reduce((acc, p) => acc + (p.latest_score ?? 0), 0) / projects.length) : 0,
  };

  return (
    <section className="dashboard-reference" aria-label={t("dashboard.reviewList.ariaLabel")}>


      <div className="review-stats-grid-v3">
        <div className="review-stat-card-v3">
          <div className="review-stat-icon-v3 review-stat-icon-v3--info"><FileReviewIcon size="md" /></div>
          <div className="review-stat-info-v3">
            <span className="review-stat-value-v3">{stats.total}</span>
            <span className="review-stat-label-v3">{t("dashboard.reviewList.totalDocs")}</span>
          </div>
        </div>

        <div className="review-stat-card-v3">
          <div className="review-stat-icon-v3 review-stat-icon-v3--success"><ShieldCheckIcon size="md" /></div>
          <div className="review-stat-info-v3">
            <span className="review-stat-value-v3">{stats.completed}</span>
            <span className="review-stat-label-v3">{t("dashboard.reviewList.completed")}</span>
          </div>
        </div>

        <div className="review-stat-card-v3">
          <div className="review-stat-icon-v3 review-stat-icon-v3--warning"><TargetIcon size="md" /></div>
          <div className="review-stat-info-v3">
            <span className="review-stat-value-v3">{stats.avgScore}</span>
            <span className="review-stat-label-v3">{t("dashboard.reviewList.avgScore")}</span>
          </div>
        </div>
      </div>

      <section className="review-reference-panel">
        <header className="review-reference-panel__head review-reference-panel__head--compact">
          <div>
            <h2 className="review-reference-panel__title">{t("dashboard.reviewList.listTitle")}</h2>
            <p className="review-reference-panel__subtitle">{t("dashboard.reviewList.listSubtitle")}</p>
          </div>
        </header>

        <SubmissionsTable
          projects={projects}
          activeProjectId={activeProjectId ?? null}
          onSelectProject={onSelectProject}
          variant="reference"
        />
      </section>
    </section>
  );
}
