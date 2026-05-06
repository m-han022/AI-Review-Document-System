import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Project } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { formatUploadedAt } from "../submissions/utils";
import { FileReviewIcon, ShieldCheckIcon, TargetIcon } from "../ui/Icon";
import { PageHeader } from "../ui/PageHeader";
import { toBusinessStatus } from "../ui/businessStatus";
import { EmptyState, StatusBadge } from "../ui/States";

interface DashboardOverviewProps {
  projects: Project[];
  onSelectProject?: (projectId: string) => void;
  onOpenReviews?: () => void;
  onOpenExport?: () => void;
}

type ScoreStatus = "NO DATA" | "GOOD" | "WARNING" | "CRITICAL";

function scoreStatus(score: number | null): ScoreStatus {
  if (score === null) return "NO DATA";
  if (score >= 80) return "GOOD";
  if (score >= 60) return "WARNING";
  return "CRITICAL";
}

function statusTone(status: ScoreStatus): "muted" | "success" | "warning" | "danger" {
  if (status === "GOOD") return "success";
  if (status === "WARNING") return "warning";
  if (status === "CRITICAL") return "danger";
  return "muted";
}

function shortName(value: string, max = 24) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

export default function DashboardOverview({ projects, onSelectProject }: DashboardOverviewProps) {
  const { lang, t } = useTranslation();

  const graded = useMemo(() => projects.filter((item) => typeof item.latest_score === "number"), [projects]);
  const statusLabelMap: Record<ScoreStatus, string> = {
    "NO DATA": t("dashboard.statusPending"),
    GOOD: t("dashboard.statusCompleted"),
    WARNING: t("dashboard.statusWarning"),
    CRITICAL: t("dashboard.statusCritical"),
  };

  const documentScoreBars = useMemo(
    () =>
      graded
        .map((p) => ({ id: p.project_id, label: shortName(p.project_name, 18), score: Math.round(p.latest_score ?? 0) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
    [graded],
  );

  const stats = useMemo(() => {
    const total = projects.length;
    const completed = graded.length;
    const avgScore = completed > 0 ? Math.round(graded.reduce((acc, p) => acc + (p.latest_score ?? 0), 0) / completed) : 0;
    return { total, completed, avgScore };
  }, [projects, graded]);

  const attention = useMemo(() => {
    const failed = projects.filter((p) => toBusinessStatus(p.latest_status) === "attentionNeeded").length;
    const processing = projects.filter((p) => toBusinessStatus(p.latest_status) === "processing").length;
    const lowScore = projects.filter((p) => typeof p.latest_score === "number" && (p.latest_score ?? 0) < 60).length;
    const notReviewed = projects.filter((p) => p.latest_score === null).length;
    return { failed, processing, lowScore, notReviewed };
  }, [projects]);

  const attentionItems = useMemo(() => {
    const items = [
      { key: "failed", tone: "danger" as const, count: attention.failed, label: t("dashboard.attention.failed") },
      { key: "low", tone: "warning" as const, count: attention.lowScore, label: t("dashboard.attention.lowScore") },
      { key: "processing", tone: "primary" as const, count: attention.processing, label: t("dashboard.attention.processing") },
      { key: "notReviewed", tone: "muted" as const, count: attention.notReviewed, label: t("dashboard.attention.notReviewed") },
    ];
    return items.filter((item) => item.count > 0);
  }, [attention, t]);

  const latestProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.latest_updated_at).getTime() - new Date(a.latest_updated_at).getTime()).slice(0, 8),
    [projects],
  );
  const handleOpenProject = (projectId: string) => onSelectProject?.(projectId);
  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, projectId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenProject(projectId);
    }
  };

  return (
    <section className="prod-dashboard" aria-label={t("dashboard.qualityPageTitle")}>
      <PageHeader title={t("dashboard.qualityPageTitle")} subtitle={t("dashboard.qualityPageSubtitle")} />

      <div className="prod-dashboard__kpis">
        <div className="prod-kpi-card">
          <div className="prod-kpi-card__head">
            <span className="prod-kpi-card__icon"><TargetIcon size="md" /></span>
            <StatusBadge tone="primary">{t("dashboard.scoreLabel")}</StatusBadge>
          </div>
          <strong className="prod-kpi-card__title">{t("dashboard.qualityPageTitle")}</strong>
          <div className="prod-kpi-card__value">{stats.avgScore} <span>/ 100</span></div>
          <p>{t("dashboard.avgScore")}</p>
        </div>

        <div className="prod-kpi-card">
          <div className="prod-kpi-card__head">
            <span className="prod-kpi-card__icon"><FileReviewIcon size="md" /></span>
            <StatusBadge tone="success">{t("dashboard.statusCompleted")}</StatusBadge>
          </div>
          <strong className="prod-kpi-card__title">{t("project.totalDocuments")}</strong>
          <div className="prod-kpi-card__value">{stats.total}</div>
          <p>{stats.completed} {t("dashboard.statusCompleted")}</p>
        </div>

        <div className="prod-kpi-card">
          <div className="prod-kpi-card__head">
            <span className="prod-kpi-card__icon"><ShieldCheckIcon size="md" /></span>
            <StatusBadge tone="warning">{t("common.status")}</StatusBadge>
          </div>
          <strong className="prod-kpi-card__title">{t("dashboard.activeProjects")}</strong>
          <div className="prod-kpi-card__value">{projects.length}</div>
          <p>{t("dashboard.realtimeData")}</p>
        </div>
      </div>

      <div className="prod-dashboard__grid prod-dashboard__grid--main">
        <section className="prod-card">
          <header className="prod-card__head">
            <div>
              <h2>{t("dashboard.scoreBarsTitle")}</h2>
              <p>{t("dashboard.topProjects")}</p>
            </div>
          </header>
          <div className="prod-chart prod-chart--dashboard-bars">
            {documentScoreBars.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={documentScoreBars} margin={{ top: 20, right: 18, bottom: 40, left: 0 }}>
                  <CartesianGrid stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
                  <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 12 }} width={36} />
                  <RechartsTooltip formatter={(value) => [`${value}/100`, t("dashboard.scoreLabel")]} />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="#5263FF">
                    <LabelList dataKey="score" position="top" fill="#0f172a" fontSize={12} fontWeight={700} />
                    {documentScoreBars.map((entry, index) => {
                      const status = scoreStatus(entry.score);
                      const color = status === "GOOD" ? "#22C55E" : status === "WARNING" ? "#EAB308" : "#EF4444";
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title={t("dashboard.noData")} description={t("dashboard.noDataDescription")} compact />
            )}
          </div>
        </section>

        <section className="prod-card">
          <header className="prod-card__head">
            <div>
              <h2>{t("dashboard.actionPanelTitle")}</h2>
              <p>{t("dashboard.attention.subtitle")}</p>
            </div>
          </header>
          <div className="prod-dashboard__actions">
            {attentionItems.length ? (
              attentionItems.map((item) => (
                <div className="prod-option-summary" key={item.key}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <strong>{item.label}</strong>
                    <StatusBadge tone={item.tone}>{item.count}</StatusBadge>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title={t("dashboard.attention.noneTitle")} description={t("dashboard.attention.noneDesc")} compact />
            )}
          </div>
        </section>
      </div>

      <section className="prod-card prod-card--dashboard-latest">
        <header className="prod-card__head">
          <div>
            <h2>{t("dashboard.latestReviewsTitle")}</h2>
            <p>{t("dashboard.latestActivity")}</p>
          </div>
        </header>
        <div className="prod-table-wrap">
          <table className="prod-history-table">
            <thead>
              <tr><th>{t("dashboard.projectNameLabel")}</th><th>{t("dashboard.scoreLabel")}</th><th>{t("dashboard.reviewedAtLabel")}</th><th>{t("dashboard.statusLabel")}</th></tr>
            </thead>
            <tbody>
              {latestProjects.length ? latestProjects.map((p) => {
                const status = scoreStatus(p.latest_score);
                return (
                  <tr
                    key={p.project_id}
                    onClick={() => handleOpenProject(p.project_id)}
                    onKeyDown={(event) => handleRowKeyDown(event, p.project_id)}
                    tabIndex={0}
                    role="button"
                    className="prod-history-table__row-clickable"
                  >
                    <td style={{ fontWeight: 500 }}>{shortName(p.project_name, 30)}</td>
                    <td>{p.latest_score !== null ? `${Math.round(p.latest_score)}/100` : t("common.noValue")}</td>
                    <td style={{ fontSize: "13px", color: "#64748B" }}>{formatUploadedAt(p.latest_updated_at, lang)}</td>
                    <td><StatusBadge tone={statusTone(status)}>{statusLabelMap[status]}</StatusBadge></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={4}><EmptyState title={t("dashboard.noData")} compact /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
