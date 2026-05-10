import { useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import {
  ShieldCheckIcon,
  TargetIcon,
  HistoryIcon,
  FileTextIcon,
  ActivityIcon,
} from "../ui/Icon";
import { useTranslation } from "../LanguageSelector";
import type { Project } from "../../types";
import { formatUploadedAt } from "../submissions/utils";
import "./DashboardOverview.css";

interface DashboardOverviewProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  onOpenReviews?: () => void;
  onOpenExport?: () => void;
}

const PROCESSING_STATUSES = new Set(["PENDING", "EXTRACTING", "GRADING"]);

function toStatusKey(status: string) {
  const normalized = (status || "").toLowerCase();
  if (["pending", "extracting", "grading", "completed", "failed"].includes(normalized)) {
    return normalized as "pending" | "extracting" | "grading" | "completed" | "failed";
  }
  return "pending";
}

function formatDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildLast7DaysKeys(): string[] {
  const today = new Date();
  const keys: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    keys.push(formatDayKey(d));
  }
  return keys;
}

export default function DashboardOverview({
  projects,
  onSelectProject,
  onOpenReviews,
  onOpenExport,
}: DashboardOverviewProps) {
  const { t, lang } = useTranslation();

  const analytics = useMemo(() => {
    const total = projects.length;
    const reviewed = projects.filter((p) => p.latest_score !== null).length;
    const criticalCount = projects.filter((p) => p.latest_score !== null && p.latest_score < 60).length;
    const coverage = total > 0 ? Math.round((reviewed / total) * 100) : 0;
    const scores = projects.map((p) => p.latest_score).filter((s): s is number => s !== null);
    const healthIndex = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    let nextStep = t("dashboardV6.nextStepUpload");
    if (byStatus.failed > 0) nextStep = t("dashboard.attention.failed");
    else if (coverage < 100 && total > 0) nextStep = t("dashboardV6.nextStepReview", { count: total - reviewed });
    else if (criticalCount > 0) nextStep = t("dashboardV6.nextStepCritical", { count: criticalCount });
    else if (total > 0) nextStep = t("dashboardV6.nextStepStable");

    const byStatus = {
      pending: projects.filter((p) => (p.latest_status || "").toUpperCase() === "PENDING").length,
      extracting: projects.filter((p) => (p.latest_status || "").toUpperCase() === "EXTRACTING").length,
      grading: projects.filter((p) => (p.latest_status || "").toUpperCase() === "GRADING").length,
      completed: projects.filter((p) => (p.latest_status || "").toUpperCase() === "COMPLETED").length,
      failed: projects.filter((p) => (p.latest_status || "").toUpperCase() === "FAILED").length,
    };

    return { total, reviewed, criticalCount, coverage, healthIndex, nextStep, byStatus };
  }, [projects, t]);

  const highRiskProjects = useMemo(
    () => projects.filter((p) => p.latest_score !== null && p.latest_score < 70).slice(0, 5),
    [projects],
  );

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.latest_updated_at).getTime() - new Date(a.latest_updated_at).getTime())
        .slice(0, 6),
    [projects],
  );

  const processingProjects = useMemo(
    () => projects.filter((p) => PROCESSING_STATUSES.has((p.latest_status || "").toUpperCase())),
    [projects],
  );
  const qualityTrend = useMemo(() => {
    return [...projects]
      .filter((p) => p.latest_score !== null)
      .sort((a, b) => new Date(a.latest_updated_at).getTime() - new Date(b.latest_updated_at).getTime())
      .slice(-8)
      .map((p) => ({
        name: p.project_id,
        score: p.latest_score as number,
      }));
  }, [projects]);
  const sparklineSeries = useMemo(() => {
    const days = buildLast7DaysKeys();
    const byDay = new Map(
      days.map((day) => [
        day,
        { day, coverageCount: 0, completedCount: 0, failedCount: 0, scoreSum: 0, scoreCount: 0 },
      ]),
    );

    projects.forEach((p) => {
      const d = new Date(p.latest_updated_at);
      if (Number.isNaN(d.getTime())) return;
      const key = formatDayKey(d);
      const bucket = byDay.get(key);
      if (!bucket) return;
      if (p.latest_score !== null) {
        bucket.coverageCount += 1;
        bucket.scoreSum += p.latest_score;
        bucket.scoreCount += 1;
      }
      if ((p.latest_status || "").toUpperCase() === "COMPLETED") bucket.completedCount += 1;
      if ((p.latest_status || "").toUpperCase() === "FAILED") bucket.failedCount += 1;
    });

    const coverage = days.map((day) => ({
      day,
      value: Math.round((byDay.get(day)?.coverageCount ?? 0) / Math.max(projects.length, 1) * 100),
    }));
    const health = days.map((day) => {
      const bucket = byDay.get(day);
      const avg = bucket && bucket.scoreCount > 0 ? bucket.scoreSum / bucket.scoreCount : 0;
      return { day, value: Math.round(avg) };
    });
    const risk = days.map((day) => ({ day, value: byDay.get(day)?.failedCount ?? 0 }));

    return { coverage, health, risk };
  }, [projects]);

  const healthLabel = analytics.healthIndex > 80 ? t("dashboardV6.stabilityOptimal") : t("dashboardV6.stabilityMonitoring");
  const urgentLabel = analytics.criticalCount > 0 ? t("dashboardV6.actionRequired") : t("dashboardV6.noUrgentRisks");

  return (
    <div className="dashboard-overview-v6">
      <section className="dashboard-hero-v6">
        <div className="hero-stat">
          <div className="hero-stat__label">{t("dashboardV6.governanceCoverage")}</div>
          <div className="hero-stat__headline">
            <div className="hero-stat__value">{analytics.coverage}%</div>
            <div className="hero-sparkline" aria-hidden="true">
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={sparklineSeries.coverage}>
                  <Line type="monotone" dataKey="value" stroke="var(--ds-color-primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="hero-stat__meta">
            <span className="hero-pill-badge hero-pill-badge--neutral">{t("dashboardV6.totalDocuments", { count: analytics.total })}</span>
            <span className="hero-pill-badge hero-pill-badge--positive">▲ {analytics.reviewed}</span>
          </div>
        </div>
        <div className="hero-stat">
          <div className="hero-stat__label">{t("dashboardV6.operationalHealth")}</div>
          <div className="hero-stat__headline">
            <div className="hero-stat__value">{analytics.healthIndex}%</div>
            <div className="hero-sparkline" aria-hidden="true">
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={sparklineSeries.health}>
                  <Line type="monotone" dataKey="value" stroke="var(--ds-color-success)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="hero-stat__meta">
            <span className="hero-pill-badge hero-pill-badge--neutral">{healthLabel}</span>
            <span className="hero-pill-badge hero-pill-badge--positive">▲ {analytics.byStatus.completed}</span>
          </div>
        </div>
        <div className="hero-stat critical">
          <div className="hero-stat__label">{t("dashboardV6.urgentIntervention")}</div>
          <div className="hero-stat__headline">
            <div className="hero-stat__value">{analytics.criticalCount}</div>
            <div className="hero-sparkline" aria-hidden="true">
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={sparklineSeries.risk}>
                  <Line type="monotone" dataKey="value" stroke="var(--ds-color-danger)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="hero-stat__meta">
            <span className="hero-pill-badge hero-pill-badge--negative">{urgentLabel}</span>
            <span className="hero-pill-badge hero-pill-badge--negative">▲ {analytics.byStatus.failed}</span>
          </div>
        </div>
      </section>

      <section className="dashboard-section-v6">
        <div className="section-header-v6">
          <ShieldCheckIcon size="sm" />
          <h3>{t("dashboardV6.executiveRiskOversight")}</h3>
          <span className="next-step-pill">{analytics.nextStep}</span>
        </div>
        <div className="risk-grid-v6">
          {highRiskProjects.length > 0 ? (
            highRiskProjects.map((p) => (
              <button key={p.project_id} className="risk-card-v6" type="button" onClick={() => onSelectProject(p.project_id)}>
                <div className="risk-card-v6__main">
                  <span className="id">{p.project_id}</span>
                  <span className="name">{p.project_name}</span>
                </div>
                <div className={`risk-card-v6__score ${(p.latest_score ?? 0) < 20 ? "critical" : "neutral"}`}>
                  {p.latest_score}%
                </div>
                <div className="risk-card-v6__action">
                  <span className="pill">{t("dashboardV6.investigate")}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="empty-state-v6">{t("dashboardV6.noRiskIdentified")}</div>
          )}
        </div>
      </section>

      <div className="dashboard-grid-v6">
        <section className="dashboard-section-v6">
          <div className="section-header-v6">
            <TargetIcon size="sm" />
            <h3>{t("dashboardV6.strategicQualityBenchmarking")}</h3>
          </div>
          <div className="bench-matrix-v6">
            {projects.length > 0 ? (
              projects.slice(0, 4).map((p) => (
                <button key={p.project_id} className="bench-item-v6" type="button" onClick={() => onSelectProject(p.project_id)}>
                  <div className="label">{p.project_name}</div>
                  <div className="bar-container">
                    <div className="bar-fill" style={{ width: `${p.latest_score || 0}%` }} />
                  </div>
                  <div className="val">{p.latest_score ?? 0}%</div>
                </button>
              ))
            ) : (
              <div className="empty-state-v6">{t("dashboardV6.baselinePending")}</div>
            )}
          </div>
        </section>

        <section className="dashboard-section-v6">
          <div className="section-header-v6">
            <HistoryIcon size="sm" />
            <h3>{t("dashboardV6.verifiedAuditHistory")}</h3>
          </div>
          <div className="recent-list-v6">
            {recentProjects.length > 0 ? (
              recentProjects.map((p) => (
                <button key={p.project_id} className="recent-item-v6" type="button" onClick={() => onSelectProject(p.project_id)}>
                  <FileTextIcon size="sm" />
                  <span className="name">{p.project_name}</span>
                  <div className="status-group">
                    <span className="status-text">{t(`status.${toStatusKey(p.latest_status)}`)}</span>
                    <span className="score">{p.latest_score ?? "-"}</span>
                    <span className="time">{formatUploadedAt(p.latest_updated_at, lang)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="empty-state-v6">{t("common.noData")}</div>
            )}
          </div>
        </section>
      </div>
      <section className="dashboard-section-v6">
        <div className="section-header-v6">
          <ActivityIcon size="sm" />
          <h3>{lang === "vi" ? "Xu hướng chất lượng theo thời gian" : "Quality Trend"}</h3>
        </div>
        <div className="trend-chart-v6">
          {qualityTrend.length >= 2 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={qualityTrend} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                <CartesianGrid stroke="var(--ds-color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--ds-color-text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--ds-color-text-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--ds-color-border)",
                    background: "var(--ds-color-surface)",
                    color: "var(--ds-color-text)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--ds-color-primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--ds-color-primary)" }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state-v6">
              {lang === "vi" ? "Cần ít nhất 2 điểm dữ liệu để hiển thị xu hướng." : "Need at least two points to show trend."}
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-section-v6">
        <div className="section-header-v6">
          <ActivityIcon size="sm" />
          <h3>{t("dashboardV6.aiThroughput")}</h3>
        </div>
        <div className="status-summary-v6">
          <div className="status-pill">{t("status.pending")}: {analytics.byStatus.pending}</div>
          <div className="status-pill">{t("status.extracting")}: {analytics.byStatus.extracting}</div>
          <div className="status-pill">{t("status.grading")}: {analytics.byStatus.grading}</div>
          <div className="status-pill">{t("status.completed")}: {analytics.byStatus.completed}</div>
          <div className="status-pill">{t("status.failed")}: {analytics.byStatus.failed}</div>
        </div>
        <div className="queue-status-v6">
          {processingProjects.length > 0 ? (
            processingProjects.map((p) => (
              <div key={p.project_id} className="queue-item-v6">
                <span className="id">{p.project_name}</span>
                <span className="status">{(p.latest_status || "").toUpperCase()}</span>
                <div className="progress-mini"><div className="fill" /></div>
              </div>
            ))
          ) : (
            <div className="queue-empty queue-empty--rich">
              <div className="queue-empty__icon" aria-hidden="true">
                <ActivityIcon size="sm" />
              </div>
              <div className="queue-empty__title">
                {lang === "vi" ? "Hệ thống đang sẵn sàng" : t("common.ready")}
              </div>
              <div className="queue-empty__text">
                {lang === "vi"
                  ? "Hệ thống đang sẵn sàng, chưa có dữ liệu cần xử lý."
                  : t("dashboardV6.aiCapacityAvailable")}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="dashboard-actions-v6">
        <button type="button" className="ds-action-btn" onClick={onOpenReviews}>
          {t("submissions.title")}
        </button>
        <button type="button" className="ds-action-btn secondary" onClick={onOpenExport}>
          {t("nav.export")}
        </button>
      </div>
    </div>
  );
}
