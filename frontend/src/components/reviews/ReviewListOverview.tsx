import type { Project } from "../../types";
import { useTranslation } from "../LanguageSelector";
import SubmissionsTable from "../SubmissionsTable";
import { FileReviewIcon, ShieldCheckIcon, TargetIcon, PlusIcon } from "../ui/Icon";
import { Card, StatusBadge, Button } from "../ui";
import "./ReviewListOverview.css";

interface ReviewListOverviewProps {
  projects: Project[];
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
  onCreateProject?: () => void;
}

export default function ReviewListOverview({ 
  projects, 
  activeProjectId, 
  onSelectProject,
  onCreateProject 
}: ReviewListOverviewProps) {
  const { t } = useTranslation();

  const stats = {
    total: projects.length,
    completed: projects.filter((p) => p.latest_score !== null).length,
    avgScore: projects.length > 0 ? Math.round(projects.reduce((acc, p) => acc + (p.latest_score ?? 0), 0) / projects.length) : 0,
  };

  return (
    <div className="review-list-container">
      {/* Page Header - Elite Polish */}
      <header className="review-list-header-v4">
        <div className="header-text-v4">
          <h1 className="header-title-v4">{t("submissions.title") || "Tất cả dự án"}</h1>
          <p className="header-subtitle-v4">
            {t("submissions.subtitle") || "Theo dõi danh sách dự án, trạng thái review và mở chi tiết từng dự án."}
            {projects.length > 0 && (
              <> • <strong>{projects.length}</strong> {t("submissions.countSuffix") || "Dự án"}</>
            )}
          </p>
        </div>
        <div className="header-actions-v4">
          <Button variant="primary" onClick={onCreateProject}>
            <PlusIcon size="sm" />
            {t("project.createNew") || "Dự án mới"}
          </Button>
        </div>
      </header>

      {/* Stats Section */}
      <div className="review-list-kpis">
        <Card className="kpi-card-v4">
          <div className="kpi-card-v4__header">
            <div className="kpi-card-v4__icon primary"><FileReviewIcon size="md" /></div>
            <div className="kpi-card-v4__trend up">▲ 2</div>
          </div>
          <div className="kpi-card-v4__body">
            <div className="kpi-card-v4__value">{stats.total}</div>
            <div className="kpi-card-v4__label">{t("dashboard.reviewList.totalDocs")}</div>
          </div>
        </Card>

        <Card className="kpi-card-v4">
          <div className="kpi-card-v4__header">
            <div className="kpi-card-v4__icon success"><ShieldCheckIcon size="md" /></div>
            <div className="kpi-card-v4__trend up">▲ 1</div>
          </div>
          <div className="kpi-card-v4__body">
            <div className="kpi-card-v4__value">{stats.completed}</div>
            <div className="kpi-card-v4__label">{t("dashboard.reviewList.completed")}</div>
          </div>
        </Card>

        <Card className="kpi-card-v4">
          <div className="kpi-card-v4__header">
            <div className="kpi-card-v4__icon warning"><TargetIcon size="md" /></div>
            <div className="kpi-card-v4__trend steady">~ 0%</div>
          </div>
          <div className="kpi-card-v4__body">
            <div className="kpi-card-v4__value">{stats.avgScore} <span>/100</span></div>
            <div className="kpi-card-v4__label">{t("dashboard.reviewList.avgScore")}</div>
          </div>
        </Card>
      </div>

      {/* List Panel */}
      <section className="review-list-main">
        <header className="list-section-header">
          <div className="list-header-left">
            <h2 className="list-title-v4">{t("dashboard.reviewList.listTitle") || "Danh sách tài liệu"}</h2>
            <p className="list-subtitle-v4">{t("dashboard.reviewList.listSubtitle") || "Danh sách tài liệu đã tải lên và kết quả review chi tiết"}</p>
          </div>
          <div className="list-header-right">
             <StatusBadge tone="primary">{projects.length} {t("submissions.activeProjects") || "Dự án đang chạy"}</StatusBadge>
          </div>
        </header>

        <div className="ds-table-card-v4">
          <SubmissionsTable
            projects={projects}
            activeProjectId={activeProjectId ?? null}
            onSelectProject={onSelectProject}
            variant="full"
          />
        </div>
      </section>
    </div>
  );
}
