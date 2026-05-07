import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Project } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { formatUploadedAt } from "../submissions/utils";
import { FileReviewIcon, ShieldCheckIcon, TargetIcon } from "../ui/Icon";
import { toBusinessStatus } from "../ui/businessStatus";
import { EmptyState, StatusBadge } from "../ui/States";
import { Card } from "../ui";
import "./DashboardOverview.css";

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

function DistributionBar({ label, count, total, tone }: { label: string; count: number; total: number; tone: "success" | "warning" | "danger" }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const colorMap = {
    success: "var(--ds-color-success)",
    warning: "var(--ds-color-warning)",
    danger: "var(--ds-color-danger)"
  };

  return (
    <div className="dist-bar">
      <div className="dist-bar__head">
        <span style={{ color: 'var(--ds-color-text-muted)' }}>{label}</span>
        <strong style={{ color: 'var(--ds-color-text-main)' }}>{count}</strong>
      </div>
      <div className="dist-bar__track">
        <div 
          className="dist-bar__fill" 
          style={{ 
            width: `${percentage}%`, 
            backgroundColor: colorMap[tone] 
          }} 
        />
      </div>
    </div>
  );
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

  const distribution = useMemo(() => {
    const counts = { GOOD: 0, WARNING: 0, CRITICAL: 0 };
    graded.forEach(p => {
      const status = scoreStatus(p.latest_score);
      if (status !== "NO DATA") counts[status]++;
    });
    return counts;
  }, [graded]);

  const highRiskProjects = useMemo(() => {
    return projects
      .filter(p => (p.latest_score !== null && p.latest_score < 60) || toBusinessStatus(p.latest_status) === "attentionNeeded")
      .sort((a, b) => (a.latest_score ?? 0) - (b.latest_score ?? 0))
      .slice(0, 3);
  }, [projects]);

  const handleOpenProject = (projectId: string) => onSelectProject?.(projectId);

  return (
    <div className="dashboard-container">
      {/* KPI Cards Section */}
      <div className="dashboard-kpis">
        <Card className="kpi-card">
          <div className="kpi-card__header">
            <div className="kpi-card__icon"><TargetIcon size="md" /></div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <StatusBadge tone="primary">{t("dashboard.scoreLabel")}</StatusBadge>
              <span className="kpi-trend kpi-trend--up">▲ 4.2%</span>
            </div>
          </div>
          <div className="kpi-card__value">{stats.avgScore} <span>/ 100</span></div>
          <div className="kpi-card__label">{t("dashboard.avgScore")}</div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-card__header">
            <div className="kpi-card__icon"><FileReviewIcon size="md" /></div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <StatusBadge tone="success">{t("dashboard.statusCompleted")}</StatusBadge>
              <span className="kpi-trend kpi-trend--up">▲ 1</span>
            </div>
          </div>
          <div className="kpi-card__value">{stats.total}</div>
          <div className="kpi-card__label">{stats.completed} {t("dashboard.statusCompleted")}</div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-card__header">
            <div className="kpi-card__icon"><ShieldCheckIcon size="md" /></div>
            <StatusBadge tone="warning">{t("common.status")}</StatusBadge>
          </div>
          <div className="kpi-card__value">{projects.length}</div>
          <div className="kpi-card__label">{t("dashboard.activeProjects")}</div>
        </Card>
      </div>

      {/* Main Grid Section */}
      <div className="dashboard-main-grid">
        <div className="dashboard-main-stack">
          {/* Main Chart Card */}
          <Card 
            title={t("dashboard.scoreBarsTitle")} 
            subtitle={t("dashboard.topProjects")}
          >
            <div className="dashboard-chart-container">
              {documentScoreBars.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={documentScoreBars} margin={{ top: 20, right: 10, bottom: 40, left: -20 }}>
                    <CartesianGrid stroke="var(--ds-color-border)" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fill: "var(--ds-color-text-muted)", fontSize: 11 }} 
                      interval={0} 
                      angle={-25} 
                      textAnchor="end" 
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fill: "var(--ds-color-text-muted)", fontSize: 12 }} 
                      width={40} 
                    />
                    <RechartsTooltip 
                      contentStyle={{ 
                        borderRadius: 'var(--ds-radius-md)', 
                        border: '1px solid var(--ds-color-border)',
                        boxShadow: 'var(--ds-shadow-md)'
                      }}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} fill="var(--ds-color-primary)">
                      {documentScoreBars.map((entry, index) => {
                        const status = scoreStatus(entry.score);
                        const color = status === "GOOD" ? "var(--ds-color-success)" : status === "WARNING" ? "var(--ds-color-warning)" : "var(--ds-color-danger)";
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title={t("dashboard.noData")} compact />
              )}
            </div>
          </Card>

          {/* Latest Activity Card */}
          <Card 
            title={t("dashboard.latestReviewsTitle")} 
            subtitle={t("dashboard.latestActivity")}
          >
            <div className="ds-table-container">
              <table className="ds-table ds-table--compact">
                <thead>
                  <tr>
                    <th>{t("dashboard.projectNameLabel")}</th>
                    <th>{t("dashboard.scoreLabel")}</th>
                    <th>{t("dashboard.reviewedAtLabel")}</th>
                    <th>{t("dashboard.statusLabel")}</th>
                  </tr>
                </thead>
                <tbody>
                  {latestProjects.length ? latestProjects.map((p) => {
                    const status = scoreStatus(p.latest_score);
                    return (
                      <tr key={p.project_id} onClick={() => handleOpenProject(p.project_id)} className="is-clickable">
                        <td className="font-bold ds-text-truncate" style={{ maxWidth: '200px' }}>{shortName(p.project_name, 40)}</td>
                        <td>{p.latest_score !== null ? `${Math.round(p.latest_score)}/100` : "—"}</td>
                        <td className="text-muted">{formatUploadedAt(p.latest_updated_at, lang)}</td>
                        <td><StatusBadge tone={statusTone(status)}>{statusLabelMap[status]}</StatusBadge></td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={4}><EmptyState title={t("dashboard.noData")} compact /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Sidebar Sections */}
        <aside className="dashboard-sidebar">
          <Card>
            <div className="sidebar-section">
              <h3 className="sidebar-section__title">{t("dashboard.qualityDistribution")}</h3>
              <div className="quality-distribution-bars">
                <DistributionBar label={t("dashboard.statusCompleted")} count={distribution.GOOD} total={graded.length} tone="success" />
                <DistributionBar label={t("dashboard.statusWarning")} count={distribution.WARNING} total={graded.length} tone="warning" />
                <DistributionBar label={t("dashboard.statusCritical")} count={distribution.CRITICAL} total={graded.length} tone="danger" />
              </div>
            </div>

            <div style={{ margin: '24px 0', borderTop: '1px solid var(--ds-color-border)' }} />

            <div className="sidebar-section">
              <h3 className="sidebar-section__title">{t("dashboard.actionPanelTitle")}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {attentionItems.map((item) => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--ds-color-bg-muted)', borderRadius: 'var(--ds-radius-md)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.label}</span>
                    <StatusBadge tone={item.tone}>{item.count}</StatusBadge>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ margin: '24px 0', borderTop: '1px solid var(--ds-color-border)' }} />

            <div className="sidebar-section">
              <h3 className="sidebar-section__title">{t("dashboard.highRiskWatchlist")}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {highRiskProjects.map(p => (
                  <div key={p.project_id} onClick={() => handleOpenProject(p.project_id)} className="risk-item">
                    <div className="risk-item__head">
                      <span className="risk-item__name">{shortName(p.project_name, 20)}</span>
                      <span className="risk-item__score">{p.latest_score !== null ? `${Math.round(p.latest_score)}%` : 'ERR'}</span>
                    </div>
                    <div className="risk-item__date">{t("dashboard.lastUpdate")}: {formatUploadedAt(p.latest_updated_at, lang)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
