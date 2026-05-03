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

import type { LanguageCode, Project } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { formatUploadedAt } from "../submissions/utils";
import {
  FileReviewIcon,
  ShieldCheckIcon,
  TargetIcon,
} from "../ui/Icon";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState, StatusBadge } from "../ui/States";

interface DashboardOverviewProps {
  projects: Project[];
  onSelectProject?: (projectId: string) => void;
  onOpenReviews?: () => void;
  onOpenExport?: () => void;
}

type ScoreStatus = "NO DATA" | "GOOD" | "WARNING" | "CRITICAL";

const DASHBOARD_COPY = {
  vi: {
    title: "Dashboard chất lượng dự án",
    subtitle: "Theo dõi điểm số, trạng thái và tiến độ review từ các dự án mới nhất.",
    noData: "Chưa có dự án được phân tích",
    noDataStatus: "NO DATA",
    latestReviews: "Lịch sử dự án gần nhất",
    scoreBars: "Điểm theo dự án",
    score: "Điểm",
    projectName: "Tên dự án",
    reviewedAt: "Ngày cập nhật",
    status: "Trạng thái",
    action: "Hành động",
    completed: "Hoàn tất",
    pending: "Chờ review",
    warningStatus: "WARNING",
    goodStatus: "GOOD",
    criticalStatus: "CRITICAL",
    viewDetail: "Xem chi tiết",
  },
  ja: {
    title: "プロジェクト品質ダッシュボード",
    subtitle: "最新のプロジェクトからスコアとレビュー状態を確認します。",
    noData: "分析済みプロジェクトがありません",
    noDataStatus: "NO DATA",
    latestReviews: "最新プロジェクト履歴",
    scoreBars: "プロジェクト別スコア",
    score: "スコア",
    projectName: "プロジェクト名",
    reviewedAt: "更新日",
    status: "状態",
    action: "操作",
    completed: "完了",
    pending: "未完了",
    warningStatus: "WARNING",
    goodStatus: "GOOD",
    criticalStatus: "CRITICAL",
    viewDetail: "詳細を見る",
  },
} as const;

function getCopy(lang: LanguageCode) {
  return DASHBOARD_COPY[lang] ?? DASHBOARD_COPY.vi;
}

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

export default function DashboardOverview({
  projects,
  onSelectProject,
}: DashboardOverviewProps) {
  const { lang, t } = useTranslation();
  const copy = getCopy(lang);

  const graded = useMemo(
    () => projects.filter((item) => typeof item.latest_score === "number"),
    [projects],
  );

  const documentScoreBars = useMemo(
    () =>
      graded
        .map((p) => ({
          id: p.project_id,
          label: shortName(p.project_name, 18),
          score: Math.round(p.latest_score ?? 0),
          projectName: p.project_name,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
    [graded],
  );

  const stats = useMemo(() => {
    const total = projects.length;
    const completed = graded.length;
    const avgScore = completed > 0 
      ? Math.round(graded.reduce((acc, p) => acc + (p.latest_score ?? 0), 0) / completed)
      : 0;
    
    return { total, completed, avgScore };
  }, [projects, graded]);

  const latestProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => new Date(b.latest_updated_at).getTime() - new Date(a.latest_updated_at).getTime())
      .slice(0, 8);
  }, [projects]);

  return (
    <section className="prod-dashboard" aria-label={copy.title}>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <div className="prod-dashboard__kpis">
        <div className="prod-kpi-card">
          <div className="prod-kpi-card__head">
            <span className="prod-kpi-card__icon">
              <TargetIcon size="md" />
            </span>
            <StatusBadge tone="primary">{copy.score}</StatusBadge>
          </div>
          <strong className="prod-kpi-card__title">{copy.title}</strong>
          <div className="prod-kpi-card__value">
            {stats.avgScore} <span>/ 100</span>
          </div>
          <p>{t("dashboard.avgScore") || "Điểm trung bình hệ thống"}</p>
        </div>

        <div className="prod-kpi-card">
          <div className="prod-kpi-card__head">
            <span className="prod-kpi-card__icon">
              <FileReviewIcon size="md" />
            </span>
            <StatusBadge tone="success">{copy.completed}</StatusBadge>
          </div>
          <strong className="prod-kpi-card__title">{t("project.totalDocuments") || "Tổng dự án"}</strong>
          <div className="prod-kpi-card__value">
            {stats.total}
          </div>
          <p>{stats.completed} {copy.completed}</p>
        </div>

        <div className="prod-kpi-card">
          <div className="prod-kpi-card__head">
            <span className="prod-kpi-card__icon">
              <ShieldCheckIcon size="md" />
            </span>
            <StatusBadge tone="warning">{t("common.status") || "Trạng thái"}</StatusBadge>
          </div>
          <strong className="prod-kpi-card__title">{t("dashboard.activeProjects") || "Đang hoạt động"}</strong>
          <div className="prod-kpi-card__value">
            {projects.length}
          </div>
          <p>{t("dashboard.realtimeData") || "Dữ liệu thời gian thực"}</p>
        </div>
      </div>

      <div className="prod-dashboard__grid">
        <section className="prod-card">
          <header className="prod-card__head">
            <div>
              <h2>{copy.scoreBars}</h2>
              <p>{t("dashboard.topProjects") || "Top 10 dự án có điểm cao nhất"}</p>
            </div>
          </header>
          <div className="prod-chart" style={{ minHeight: '300px' }}>
            {documentScoreBars.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={documentScoreBars} margin={{ top: 20, right: 18, bottom: 40, left: 0 }}>
                  <CartesianGrid stroke="#EEF2F7" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fill: "#64748B", fontSize: 11 }} 
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 12 }} width={36} />
                  <RechartsTooltip formatter={(value) => [`${value}/100`, copy.score]} />
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
              <EmptyState title={copy.noData} description={t("dashboard.noDataDescription") || "Hãy tải tài liệu và chấm điểm để xem phân tích."} compact />
            )}
          </div>
        </section>

        <section className="prod-card">
          <header className="prod-card__head">
            <div>
              <h2>{copy.latestReviews}</h2>
              <p>{t("dashboard.latestActivity") || "Các dự án được cập nhật gần đây"}</p>
            </div>
          </header>
          <div className="prod-table-wrap">
            <table className="prod-history-table">
              <thead>
                <tr>
                  <th>{copy.projectName}</th>
                  <th>{copy.score}</th>
                  <th>{copy.reviewedAt}</th>
                  <th>{copy.status}</th>
                </tr>
              </thead>
              <tbody>
                {latestProjects.length ? (
                  latestProjects.map((p) => {
                    const status = scoreStatus(p.latest_score);
                    return (
                      <tr key={p.project_id} onClick={() => onSelectProject?.(p.project_id)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 500 }}>{shortName(p.project_name, 30)}</td>
                        <td>{p.latest_score !== null ? `${Math.round(p.latest_score)}/100` : "—"}</td>
                        <td style={{ fontSize: '13px', color: '#64748B' }}>{formatUploadedAt(p.latest_updated_at, lang)}</td>
                        <td>
                          <StatusBadge tone={statusTone(status)}>
                            {status === "NO DATA" ? copy.pending : status === "GOOD" ? copy.completed : status}
                          </StatusBadge>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState title={copy.noData} compact />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
