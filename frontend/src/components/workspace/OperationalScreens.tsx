import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

import { exportSubmissionsExcel, getSubmission } from "../../api/client";
import { API_BASE_URL } from "../../config";
import type { Project, LanguageCode, Submission } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { formatUploadedAt } from "../submissions/utils";
import { getLocalizedText } from "../../locales/utils";
import {
  DownloadIcon,
  EyeIcon,
  FileReviewIcon,
  RefreshIcon,
  ShieldCheckIcon,
  TargetIcon,
  WorkflowIcon,
  CalendarIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  Icon,
} from "../ui/Icon";
import { Button, Card, StatusBadge, Dialog } from "../ui";
import { EmptyState, LoadingState } from "../ui/States";
import { emitUiAudit } from "../../auth/audit";
import { canPerform, defaultPermissionFlags, type AppRole } from "../../auth/permissions";

type OperationalRoute = "report" | "workflow" | "export" | "settings";

interface OperationalScreenProps {
  route: OperationalRoute;
  projects: Project[];
  onOpenReviews: () => void;
  onOpenUpload: () => void;
  onSelectProject?: (projectId: string) => void;
}

const SCREEN_COPY = {
  vi: {
    report: {
      title: "Báo cáo chất lượng",
      subtitle: "Tổng hợp chất lượng từ các dự án, gồm điểm trung bình và trạng thái review.",
    },
    workflow: {
      title: "Luồng phê duyệt",
      subtitle: "Theo dõi dự án đã hoàn thành và dự án đang chờ xử lý.",
    },
    export: {
      title: "Xuất dữ liệu",
      subtitle: "Xuất dữ liệu review hiện có sang Excel.",
    },
    settings: {
      title: "Cài đặt",
      subtitle: "Thông tin runtime và tùy chọn vận hành.",
    },
    noData: "Chưa có dữ liệu dự án.",
    avgScore: "Điểm trung bình",
    reviewed: "Đã hoàn thành",
    needsAction: "Cần xử lý",
    pending: "Chờ review",
    slideNg: "Tài liệu NG",
    weakCriteria: "Điểm yếu",
    openReviews: "Mở danh sách",
    uploadMore: "Tạo dự án",
    exportExcel: "Xuất Excel",
    exporting: "Đang xuất...",
    latest: "Dự án mới nhất",
    apiBase: "API base",
    dataSource: "Nguồn dữ liệu",
    realData: "Hệ thống Project-Document mới",
  },
  ja: {
    report: {
      title: "品質レポート",
      subtitle: "プロジェクト別の平均スコアとレビュー状態を集計します。",
    },
    workflow: {
      title: "承認ワークフロー",
      subtitle: "完了済みおよび対応が必要なプロジェクトを確認します。",
    },
    export: {
      title: "エクスポート",
      subtitle: "Excel 形式でデータをエクスポートします。",
    },
    settings: {
      title: "設定",
      subtitle: "実行設定と接続先を確認します。",
    },
    noData: "プロジェクトデータがありません。",
    avgScore: "平均スコア",
    reviewed: "完了済み",
    needsAction: "対応必要",
    pending: "未完了",
    slideNg: "NG ドキュメント",
    weakCriteria: "弱い点",
    openReviews: "一覧を開く",
    uploadMore: "新規作成",
    exportExcel: "Excel 出力",
    exporting: "出力中...",
    latest: "最新プロジェクト",
    apiBase: "API base",
    dataSource: "データソース",
    realData: "新プロジェクト・ドキュメント構成",
  },
  en: {
    report: {
      title: "Quality Report",
      subtitle: "Aggregate quality across projects, including average scores and review status.",
    },
    workflow: {
      title: "Approval Workflow",
      subtitle: "Track completed projects and those requiring action.",
    },
    export: {
      title: "Export Data",
      subtitle: "Export existing review data to Excel format.",
    },
    settings: {
      title: "Settings",
      subtitle: "Runtime information and operational options.",
    },
    noData: "No project data available.",
    avgScore: "Average Score",
    reviewed: "Completed",
    needsAction: "Needs Action",
    pending: "Pending Review",
    slideNg: "NG Documents",
    weakCriteria: "Weak Points",
    openReviews: "Open List",
    uploadMore: "Create Project",
    exportExcel: "Export Excel",
    exporting: "Exporting...",
    latest: "Latest Projects",
    apiBase: "API base",
    dataSource: "Data source",
    realData: "New Project-Document System",
  },
} as const;

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export default function OperationalScreen({
  route,
  projects,
  onOpenReviews,
  onOpenUpload,
  onSelectProject,
}: OperationalScreenProps) {
  const [activeRiskProject, setActiveRiskProject] = useState<Project | null>(null);
  const [riskContent, setRiskContent] = useState<string | null>(null);
  const [isFetchingRisk, setIsFetchingRisk] = useState(false);

  const { lang, t } = useTranslation();
  const copy = SCREEN_COPY[lang] ?? SCREEN_COPY.vi;
  const screen = copy[route];
  const [exportMessage, setExportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [includeAiDetails, setIncludeAiDetails] = useState(false);
  const [exportProjectId, setExportProjectId] = useState("");
  const [exportFromTime, setExportFromTime] = useState("");
  const [exportToTime, setExportToTime] = useState("");
  const exportModeLabel = lang === "ja" ? "出力モード" : lang === "en" ? "Export mode" : "Chế độ xuất";
  const exportModeFast = lang === "ja" ? "高速出力（AI詳細なし）" : lang === "en" ? "Fast export (no detailed AI output)" : "Xuất nhanh (không kết quả AI chi tiết)";
  const exportModeDetailed = lang === "ja" ? "詳細出力（AI結果を含む）" : lang === "en" ? "Detailed export (include AI output)" : "Xuất chi tiết (kèm kết quả AI)";
  const exportMutation = useMutation({
    mutationFn: exportSubmissionsExcel,
    onSuccess: ({ blob, filename }) => {
      downloadBlob(blob, filename);
      setExportMessage({ type: "success", text: t("submissions.exportSuccess") });
    },
    onError: (error) => {
      setExportMessage({
        type: "error",
        text: error instanceof Error ? error.message : t("submissions.exportFailed"),
      });
    },
  });
  const currentRole: AppRole = "admin";
  const canExport = canPerform("review.export", { role: currentRole }, defaultPermissionFlags);
  const metrics = useMemo(() => {
    const reviewed = projects.filter((p) => p.latest_score !== null);
    const pending = projects.length - reviewed.length;
    const needsAction = reviewed.filter((p) => (p.latest_score ?? 0) < 80);
    const avgScore = reviewed.length
      ? Math.round(reviewed.reduce((sum, p) => sum + (p.latest_score ?? 0), 0) / reviewed.length)
      : null;

    const trend = projects
      .filter(p => p.latest_score !== null)
      .sort((a, b) => new Date(a.latest_updated_at).getTime() - new Date(b.latest_updated_at).getTime())
      .slice(-10)
      .map(p => ({ value: p.latest_score }));

    return { reviewed, pending, needsAction, avgScore, trend };
  }, [projects]);

  const handleProcess = async (project: Project) => {
    const score = project.latest_score ?? 0;
    // Safety: Ensure we have a valid project ID
    if (!project.project_id) return;

    if (score > 0 && score < 70) {
      setActiveRiskProject(project);
      setIsFetchingRisk(true);
      try {
        const detail: Submission = await getSubmission(project.project_id);
        const feedback = detail.latest_run?.draft_feedback;
        const riskText = feedback ? getLocalizedText(feedback, lang) : null;
        setRiskContent(riskText);
      } catch (err) {
        console.error("Failed to fetch risk content:", err);
        setRiskContent(null);
      } finally {
        setIsFetchingRisk(false);
      }
    } else {
      const pid = String(project.project_id);
      if (onSelectProject) onSelectProject(pid);
      else window.dispatchEvent(new CustomEvent("open-project-detail", { detail: pid }));
    }
  };

  const latestRows = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.latest_updated_at).getTime() - new Date(a.latest_updated_at).getTime())
        .slice(0, 8),
    [projects],
  );
  return (
    <div className="workspace-stack">
      <div className="toolbar" style={{ justifyContent: 'flex-start', marginBottom: '24px', gap: '12px' }}>
        <Button 
          variant="primary" 
          onClick={onOpenReviews}
          className="toolbar-btn-primary"
          leftIcon={<EyeIcon size="sm" style={{ width: '15px', height: '15px' }} />}
          style={{ paddingLeft: '18px', paddingRight: '18px' }}
        >
          {copy.openReviews}
        </Button>
        <Button 
          variant="ghost" 
          onClick={onOpenUpload}
          className="toolbar-btn-secondary"
          leftIcon={<FileReviewIcon size="sm" style={{ width: '15px', height: '15px' }} />}
          style={{ paddingLeft: '10px', paddingRight: '10px', color: 'var(--ds-color-primary)' }}
        >
          {copy.uploadMore}
        </Button>
      </div>

      <div className="sticky-metrics-bar" style={{ 
        position: 'sticky', 
        top: '-24px', // Offset for workspace-stack padding
        zIndex: 30, 
        backgroundColor: 'var(--ds-color-bg-app)', 
        paddingTop: '24px',
        paddingBottom: '16px',
        margin: '0 -24px 24px -24px', // Bleed into container padding
        paddingLeft: '24px',
        paddingRight: '24px',
        borderBottom: '1px solid transparent',
        transition: 'all 0.3s ease'
      }}>
        <div className="operational-metrics-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', alignItems: 'stretch' }}>
          <MetricCard 
            title={copy.avgScore} 
            value={metrics.avgScore === null ? "—" : `${metrics.avgScore}/100`}
            icon={<TargetIcon size="md" color="var(--ds-color-primary)" />}
            chart={
              <div style={{ width: '60px', height: '32px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.trend}>
                    <Area type="monotone" dataKey="value" stroke="var(--ds-color-primary)" fill="var(--ds-color-primary-soft)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            }
          />
          <MetricCard 
            title={copy.reviewed} 
            value={metrics.reviewed.length}
            icon={<ShieldCheckIcon size="md" color="var(--ds-color-success)" />}
            chart={
              <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '20px' }}>
                {[0.4, 0.7, 0.5, 0.9, 0.6].map((h, i) => (
                  <div key={i} style={{ width: '4px', height: `${h * 100}%`, background: 'var(--ds-color-success)', borderRadius: '2px', opacity: 0.6 + (i * 0.1) }} />
                ))}
              </div>
            }
          />
          <MetricCard 
            title={copy.needsAction} 
            value={metrics.needsAction.length}
            icon={<WorkflowIcon size="md" color="var(--ds-color-warning)" />}
            chart={
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--ds-color-warning-soft)', borderTopColor: 'var(--ds-color-warning)', animation: 'spin 2s linear infinite' }} />
            }
          />
          <MetricCard 
            title={copy.pending} 
            value={metrics.pending}
            icon={<RefreshIcon size="md" color="var(--ds-color-danger)" />}
            chart={
              <div style={{ display: 'flex', gap: '3px' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ds-color-danger)', opacity: 0.4, animation: `pulse 1.5s infinite ${i * 0.3}s` }} />
                ))}
              </div>
            }
          />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } }
        .metric-value { font-size: 28px; font-weight: 800; color: var(--ds-color-text); line-height: 1; }
        .metric-title { font-size: 11px; font-weight: 700; color: var(--ds-color-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
        .metric-card-refined { transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: default; }
        .metric-card-refined:hover { transform: translateY(-2px); box-shadow: var(--ds-shadow-lg) !important; }
        .date-input-wrapper { position: relative; display: flex; align-items: center; }
        .date-input-wrapper .ds-icon { position: absolute; right: 12px; pointer-events: none; opacity: 0.5; }
        .export-action-btn { transition: all 0.2s ease; }
        .export-action-btn:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); transform: translateY(-1px); }
        .sticky-metrics-bar.is-stuck { border-bottom-color: var(--ds-color-border); box-shadow: var(--ds-shadow-md); }
        .toolbar-btn-primary { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .toolbar-btn-primary:active { transform: scale(0.96); opacity: 0.9; }
        .toolbar-btn-secondary { transition: all 0.2s ease; border-radius: 8px; }
        .toolbar-btn-secondary:hover { background-color: var(--ds-color-primary-soft) !important; }
        
        .workflow-item { 
          position: relative; 
          transition: all 0.2s ease; 
          background: var(--ds-color-bg-muted);
          border-radius: var(--ds-radius-md);
          overflow: hidden;
        }
        .workflow-item:hover { 
          background: white; 
          box-shadow: var(--ds-shadow-md);
          transform: translateX(4px);
        }
        .workflow-item:hover { 
          background: white; 
          box-shadow: var(--ds-shadow-md);
          transform: translateX(4px);
        }
        .risk-alert-box {
          background-color: #fef2f2;
          border-left: 4px solid var(--ds-color-danger);
          padding: 16px;
          border-radius: 8px;
          margin-top: 12px;
        }
        .risk-alert-title {
          color: #991b1b;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .risk-alert-content {
          color: #b91c1c;
          font-size: 14px;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .pulse-badge {
          display: inline-block;
          width: 8px;
          height: 8px;
          background: var(--ds-color-danger);
          border-radius: 50%;
          margin-right: 8px;
          box-shadow: 0 0 0 rgba(239, 68, 68, 0.4);
          animation: pulse-red 2s infinite;
        }
        @keyframes pulse-red {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>

      <style>{`
        /* Existing styles... */
      `}</style>

      {activeRiskProject && (
        <Dialog
          open={!!activeRiskProject}
          title={lang === 'ja' ? 'リスク警告' : lang === 'en' ? 'Risk Warning' : 'Cảnh báo rủi ro'}
          onConfirm={() => {
            const pid = activeRiskProject.project_id;
            setActiveRiskProject(null);
            setRiskContent(null);
            if (onSelectProject) onSelectProject(pid);
            else window.dispatchEvent(new CustomEvent("open-project-detail", { detail: pid }));
          }}
          onCancel={() => {
            setActiveRiskProject(null);
            setRiskContent(null);
          }}
          confirmLabel={lang === 'ja' ? '詳細を見る' : lang === 'en' ? 'View Details' : 'Xem chi tiết'}
          cancelLabel={lang === 'ja' ? '閉じる' : lang === 'en' ? 'Close' : 'Đóng'}
          isLoading={isFetchingRisk}
        >
          <div>
            <p style={{ marginBottom: '16px' }}>
              {lang === 'ja' ? `このプロジェクトはスコアが低いため (${activeRiskProject.latest_score})、リスクがあります：` : 
               lang === 'en' ? `This project has risks due to a low score (${activeRiskProject.latest_score}):` : 
               `Dự án này có rủi ro do điểm số thấp (${activeRiskProject.latest_score}/100):`}
            </p>
            
            {isFetchingRisk ? (
              <div style={{ padding: '24px 0' }}>
                <LoadingState title="" description={lang === 'ja' ? 'AIの分析を読み込み中...' : 'Đang tải phân tích AI...'} compact />
              </div>
            ) : riskContent ? (
              <div className="risk-alert-box">
                <div className="risk-alert-title">
                  <AlertTriangleIcon size="sm" />
                  <span>{lang === 'ja' ? 'AIによるリスク診断' : lang === 'en' ? 'AI Risk Assessment' : 'Chẩn đoán rủi ro từ AI'}</span>
                </div>
                <div className="risk-alert-content">{riskContent}</div>
              </div>
            ) : (
              <div className="risk-alert-box">
                <div className="risk-alert-content">
                  {lang === 'ja' ? '現在、詳細なリスク情報は利用できません。' : 'Không có thông tin rủi ro chi tiết.'}
                </div>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {route === "workflow" && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '24px', alignItems: 'stretch' }}>
          <WorkflowColumn title={copy.reviewed} tone="success" rows={metrics.reviewed} lang={lang} onProcess={handleProcess} />
          <WorkflowColumn title={copy.needsAction} tone="warning" rows={metrics.needsAction} lang={lang} onProcess={handleProcess} />
          <WorkflowColumn title={copy.pending} tone="danger" rows={projects.filter((p) => p.latest_score === null)} lang={lang} onProcess={handleProcess} />
        </div>
      )}

      {route === "export" && (
        <div style={{ marginBottom: '24px' }}>
          <Card 
            title={<span style={{ fontSize: '18px', fontWeight: 800 }}>{copy.exportExcel}</span>} 
            padding="0"
          >
            <div style={{ padding: '16px 24px 8px 24px' }}>
              <p style={{ color: 'var(--ds-color-text-muted)', fontSize: '14px', margin: 0 }}>{screen.subtitle}</p>
            </div>
            
            <div style={{ padding: '16px 24px 32px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', maxWidth: '900px' }}>
              {/* Column 1: Mode & Project ID */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: 'var(--ds-color-text)' }}>{exportModeLabel}</label>
                  <select
                    className="ds-input"
                    value={includeAiDetails ? "detailed" : "fast"}
                    onChange={(e) => setIncludeAiDetails(e.target.value === "detailed")}
                    disabled={exportMutation.isPending}
                    style={{ width: '100%' }}
                  >
                    <option value="fast">{exportModeFast}</option>
                    <option value="detailed">{exportModeDetailed}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: 'var(--ds-color-text)' }}>{t("submissions.projectId")}</label>
                  <input
                    className="ds-input"
                    placeholder="project_id (optional)"
                    value={exportProjectId}
                    onChange={(e) => setExportProjectId(e.target.value)}
                    disabled={exportMutation.isPending}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Column 2: Date Filters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: 'var(--ds-color-text)' }}>{lang === "ja" ? "開始日時" : lang === "en" ? "From Time" : "Từ ngày"}</label>
                  <div className="date-input-wrapper">
                    <input
                      className="ds-input"
                      type="datetime-local"
                      value={exportFromTime}
                      onChange={(e) => setExportFromTime(e.target.value)}
                      disabled={exportMutation.isPending}
                    />
                    <CalendarIcon size="sm" />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: 'var(--ds-color-text)' }}>{lang === "ja" ? "終了日時" : lang === "en" ? "To Time" : "Đến ngày"}</label>
                  <div className="date-input-wrapper">
                    <input
                      className="ds-input"
                      type="datetime-local"
                      value={exportToTime}
                      onChange={(e) => setExportToTime(e.target.value)}
                      disabled={exportMutation.isPending}
                    />
                    <CalendarIcon size="sm" />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--ds-color-border)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Button 
                variant="primary" 
                className="export-action-btn"
                onClick={() => {
                  if (!canExport) {
                    emitUiAudit({
                      action: "review.export",
                      outcome: "blocked",
                      detail: "soft-guard",
                      ts: new Date().toISOString(),
                    });
                    return;
                  }
                  emitUiAudit({
                    action: "review.export",
                    outcome: "allowed",
                    detail: "trigger-export",
                    ts: new Date().toISOString(),
                  });
                  exportMutation.mutate({
                    includeAiDetails,
                    projectId: exportProjectId.trim() || undefined,
                    fromTime: exportFromTime || undefined,
                    toTime: exportToTime || undefined,
                  });
                }}
                disabled={!canExport || exportMutation.isPending || projects.length === 0}
                isLoading={exportMutation.isPending}
                leftIcon={<DownloadIcon size="sm" />}
              >
                {copy.exportExcel}
              </Button>

              {exportMessage && (
                <StatusBadge tone={exportMessage.type === "success" ? "success" : "danger"}>
                  {exportMessage.text}
                </StatusBadge>
              )}
            </div>
          </Card>
        </div>
      )}

      {route === "settings" && (
        <div style={{ marginBottom: '24px' }}>
          <Card title={screen.title}>
            <div className="governance-grid">
              <div className="detail-section">
                <span className="detail-section__title">{copy.apiBase}</span>
                <div style={{ fontWeight: 600 }}>{API_BASE_URL}</div>
              </div>
              <div className="detail-section">
                <span className="detail-section__title">{copy.dataSource}</span>
                <div style={{ fontWeight: 600 }}>{copy.realData}</div>
              </div>
              <div className="detail-section">
                <span className="detail-section__title">{t("common.language")}</span>
                <div style={{ fontWeight: 600 }}>{lang.toUpperCase()}</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card title={copy.latest}>
        <div className="prod-table-wrap">
          <table className="prod-history-table">
            <thead>
              <tr>
                <th>{t("submissions.projectId")}</th>
                <th>{t("project.projectName")}</th>
                <th>{t("project.totalDocuments")}</th>
                <th>{t("project.totalScore")}</th>
                <th>{t("project.reviewedAt")}</th>
                <th>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {latestRows.length ? (
                latestRows.map((project) => {
                  const score = project.latest_score;
                  const reviewed = typeof score === "number";
                  return (
                    <tr 
                      key={project.project_id} 
                      onClick={() => {
                        if (onSelectProject) onSelectProject(project.project_id);
                        else window.dispatchEvent(new CustomEvent("open-project-detail", { detail: project.project_id }));
                      }}
                      style={{ cursor: 'pointer' }}
                      className="prod-history-row"
                    >
                      <td>{project.project_id}</td>
                      <td style={{ fontWeight: 600 }}>{getLocalizedText(project.project_name, lang)}</td>
                      <td>{project.total_documents}</td>
                      <td>{reviewed ? `${score}/100` : "—"}</td>
                      <td>{formatUploadedAt(project.latest_updated_at, lang)}</td>
                      <td>
                        <StatusBadge tone={reviewed ? "success" : "warning"}>
                          {reviewed ? copy.reviewed : copy.pending}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title={copy.noData} compact />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, icon, chart }: { title: string; value: string | number; icon: React.ReactNode; chart: React.ReactNode }) {
  return (
    <Card className="metric-card-refined" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="metric-title">{title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {icon}
          <div className="metric-value">{value}</div>
        </div>
        <div className="metric-visual">
          {chart}
        </div>
      </div>
    </Card>
  );
}
function WorkflowColumn({
  title,
  tone,
  rows,
  lang,
  onProcess,
}: {
  title: string;
  tone: "success" | "warning" | "danger";
  rows: Project[];
  lang: LanguageCode;
  onProcess: (project: Project) => void;
}) {
  return (
    <Card title={title} style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rows.length ? (
          rows.slice(0, 10).map((row) => (
            <div 
              key={row.project_id} 
              className="workflow-item"
              onClick={() => onProcess(row)}
              style={{ 
                padding: '12px 16px',
                borderLeft: `4px solid var(--ds-color-${tone})`,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                {tone === 'warning' && <span className="pulse-badge" title="Cần xử lý gấp" />}
                <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                  {getLocalizedText(row.project_name, lang)}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ds-color-text-muted)' }}>{formatUploadedAt(row.latest_updated_at, lang)}</div>
            </div>
          ))
        ) : (
          <EmptyState title={lang === "ja" ? "対象なし" : "Không có dự án"} compact />
        )}
      </div>
    </Card>
  );
}
