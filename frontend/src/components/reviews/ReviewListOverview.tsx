import type { Project } from "../../types";
import { useTranslation } from "../LanguageSelector";
import SubmissionsTable from "../SubmissionsTable";
import { FileReviewIcon, ShieldCheckIcon, TargetIcon } from "../ui/Icon";
import { Card, StatusBadge } from "../ui";
import "../dashboard/DashboardOverview.css";

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
    <div className="dashboard-container">
      {/* Stats Section */}
      <div className="dashboard-kpis">
        <Card className="kpi-card">
          <div className="kpi-card__header">
            <div className="kpi-card__icon"><FileReviewIcon size="md" /></div>
            <StatusBadge tone="primary">{t("dashboard.reviewList.totalDocs")}</StatusBadge>
          </div>
          <div className="kpi-card__value">{stats.total}</div>
          <div className="kpi-card__label">{t("dashboard.reviewList.totalDocs")}</div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-card__header">
            <div className="kpi-card__icon"><ShieldCheckIcon size="md" /></div>
            <StatusBadge tone="success">{t("dashboard.reviewList.completed")}</StatusBadge>
          </div>
          <div className="kpi-card__value">{stats.completed}</div>
          <div className="kpi-card__label">{t("dashboard.reviewList.completed")}</div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-card__header">
            <div className="kpi-card__icon"><TargetIcon size="md" /></div>
            <StatusBadge tone="warning">{t("dashboard.reviewList.avgScore")}</StatusBadge>
          </div>
          <div className="kpi-card__value">{stats.avgScore}</div>
          <div className="kpi-card__label">{t("dashboard.reviewList.avgScore")}</div>
        </Card>
      </div>

      {/* List Panel */}
      <Card title={t("dashboard.reviewList.listTitle")} subtitle={t("dashboard.reviewList.listSubtitle")}>
        <div className="ds-table-container" style={{ marginTop: 'var(--ds-space-4)' }}>
          <SubmissionsTable
            projects={projects}
            activeProjectId={activeProjectId ?? null}
            onSelectProject={onSelectProject}
            variant="reference"
          />
        </div>
      </Card>
    </div>
  );
}
