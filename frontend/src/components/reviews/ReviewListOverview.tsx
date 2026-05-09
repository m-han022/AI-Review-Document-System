import { useMemo } from "react";
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
  onCreateProject,
}: ReviewListOverviewProps) {
  const { t } = useTranslation();

  const trends = useMemo(() => {
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(now.getDate() - 7);
    const previousStart = new Date(now);
    previousStart.setDate(now.getDate() - 14);

    const inCurrentWindow: Project[] = [];
    const inPreviousWindow: Project[] = [];

    projects.forEach((project) => {
      const updatedAt = new Date(project.latest_updated_at);
      if (Number.isNaN(updatedAt.getTime())) return;
      if (updatedAt >= currentStart) {
        inCurrentWindow.push(project);
      } else if (updatedAt >= previousStart && updatedAt < currentStart) {
        inPreviousWindow.push(project);
      }
    });

    const currentCompleted = inCurrentWindow.filter((p) => p.latest_score !== null).length;
    const previousCompleted = inPreviousWindow.filter((p) => p.latest_score !== null).length;

    const averageScore = (items: Project[]) => {
      const scored = items.filter((p) => p.latest_score !== null).map((p) => p.latest_score as number);
      if (!scored.length) return null;
      return scored.reduce((sum, value) => sum + value, 0) / scored.length;
    };

    const currentAvgScore = averageScore(inCurrentWindow);
    const previousAvgScore = averageScore(inPreviousWindow);

    const toTrend = (delta: number, unit = "", hasData = true) => {
      if (!hasData) return { tone: "steady", label: "—" };
      if (delta > 0) return { tone: "up", label: `▲ ${delta}${unit}` };
      if (delta < 0) return { tone: "down", label: `▼ ${Math.abs(delta)}${unit}` };
      return { tone: "steady", label: `~ 0${unit}` };
    };

    return {
      total: toTrend(inCurrentWindow.length - inPreviousWindow.length),
      completed: toTrend(currentCompleted - previousCompleted),
      avgScore: toTrend(
        Math.round((currentAvgScore ?? 0) - (previousAvgScore ?? 0)),
        "%",
        currentAvgScore !== null && previousAvgScore !== null,
      ),
    };
  }, [projects]);

  const stats = {
    total: projects.length,
    completed: projects.filter((p) => p.latest_score !== null).length,
    avgScore: projects.length > 0 ? Math.round(projects.reduce((acc, p) => acc + (p.latest_score ?? 0), 0) / projects.length) : 0,
  };

  return (
    <div className="review-list-container">
      <header className="review-list-header-v4">
        <div className="header-text-v4">
          <h1 className="header-title-v4">{t("submissions.title") || "Tất cả dự án"}</h1>
          <p className="header-subtitle-v4">
            {t("submissions.subtitle") || "Theo dõi danh sách dự án, trạng thái review và mở chi tiết từng dự án."}
            {projects.length > 0 && (
              <> • <strong>{t("submissions.count", { count: projects.length })}</strong></>
            )}
          </p>
        </div>
        <div className="header-actions-v4">
          <Button variant="primary" onClick={onCreateProject}>
            <PlusIcon size="sm" />
            {t("submissions.createProjectNew") || "Dự án mới"}
          </Button>
        </div>
      </header>

      <div className="review-list-kpis">
        <Card className="kpi-card-v4">
          <div className="kpi-card-v4__header">
            <div className={`kpi-card-v4__trend ${trends.total.tone}`}>{trends.total.label}</div>
          </div>
          <div className="kpi-card-v4__body">
            <div className="kpi-card-v4__headline">
              <div className="kpi-card-v4__value">{stats.total}</div>
              <div className="kpi-card-v4__icon primary"><FileReviewIcon size="md" /></div>
            </div>
            <div className="kpi-card-v4__label">{t("dashboard.reviewList.totalDocs")}</div>
            <div className="kpi-card-v4__sparkline" aria-hidden="true">
              <span style={{ height: "28%" }} />
              <span style={{ height: "45%" }} />
              <span style={{ height: "38%" }} />
              <span style={{ height: "58%" }} />
              <span style={{ height: "70%" }} />
              <span style={{ height: "62%" }} />
              <span style={{ height: "78%" }} />
            </div>
          </div>
        </Card>

        <Card className="kpi-card-v4">
          <div className="kpi-card-v4__header">
            <div className={`kpi-card-v4__trend ${trends.completed.tone}`}>{trends.completed.label}</div>
          </div>
          <div className="kpi-card-v4__body">
            <div className="kpi-card-v4__headline">
              <div className="kpi-card-v4__value">{stats.completed}</div>
              <div className="kpi-card-v4__icon success"><ShieldCheckIcon size="md" /></div>
            </div>
            <div className="kpi-card-v4__label">{t("dashboard.reviewList.completed")}</div>
            <div className="kpi-card-v4__sparkline" aria-hidden="true">
              <span style={{ height: "22%" }} />
              <span style={{ height: "35%" }} />
              <span style={{ height: "50%" }} />
              <span style={{ height: "46%" }} />
              <span style={{ height: "64%" }} />
              <span style={{ height: "72%" }} />
              <span style={{ height: "80%" }} />
            </div>
          </div>
        </Card>

        <Card className="kpi-card-v4">
          <div className="kpi-card-v4__header">
            <div className={`kpi-card-v4__trend ${trends.avgScore.tone}`}>{trends.avgScore.label}</div>
          </div>
          <div className="kpi-card-v4__body">
            <div className="kpi-card-v4__headline">
              <div className="kpi-card-v4__value">{stats.avgScore} <span>/100</span></div>
              <div className="kpi-card-v4__icon warning"><TargetIcon size="md" /></div>
            </div>
            <div className="kpi-card-v4__label">{t("dashboard.reviewList.avgScore")}</div>
            <div className="kpi-card-v4__sparkline" aria-hidden="true">
              <span style={{ height: "40%" }} />
              <span style={{ height: "48%" }} />
              <span style={{ height: "44%" }} />
              <span style={{ height: "50%" }} />
              <span style={{ height: "55%" }} />
              <span style={{ height: "52%" }} />
              <span style={{ height: "57%" }} />
            </div>
          </div>
        </Card>
      </div>

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
