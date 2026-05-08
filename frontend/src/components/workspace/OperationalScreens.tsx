import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { exportSubmissionsExcel } from "../../api/client";
import { API_BASE_URL } from "../../config";
import type { Project } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { formatUploadedAt } from "../submissions/utils";
import {
  DownloadIcon,
  EyeIcon,
  FileReviewIcon,
  RefreshIcon,
  ShieldCheckIcon,
  TargetIcon,
  WorkflowIcon,
} from "../ui/Icon";
import { Button, Card, PageHeader, StatusBadge } from "../ui";
import { EmptyState } from "../ui/States";

type OperationalRoute = "report" | "workflow" | "export" | "settings";

interface OperationalScreenProps {
  route: OperationalRoute;
  projects: Project[];
  onOpenReviews: () => void;
  onOpenUpload: () => void;
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
}: OperationalScreenProps) {
  const { lang, t } = useTranslation();
  const copy = SCREEN_COPY[lang] ?? SCREEN_COPY.vi;
  const screen = copy[route];
  const [exportMessage, setExportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
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

  const metrics = useMemo(() => {
    const reviewed = projects.filter((p) => p.latest_score !== null);
    const pending = projects.length - reviewed.length;
    const needsAction = reviewed.filter((p) => (p.latest_score ?? 0) < 80);
    const avgScore = reviewed.length
      ? Math.round(reviewed.reduce((sum, p) => sum + (p.latest_score ?? 0), 0) / reviewed.length)
      : null;

    return { reviewed, pending, needsAction, avgScore };
  }, [projects]);

  const latestRows = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.latest_updated_at).getTime() - new Date(a.latest_updated_at).getTime())
        .slice(0, 8),
    [projects],
  );
  return (
    <div className="workspace-stack">
      <div className="toolbar" style={{ justifyContent: 'flex-end', marginBottom: '24px' }}>
        <Button variant="outline" onClick={onOpenUpload}>
          <FileReviewIcon size="sm" />
          {copy.uploadMore}
        </Button>
        <Button variant="primary" onClick={onOpenReviews}>
          <EyeIcon size="sm" />
          {copy.openReviews}
        </Button>
      </div>

      <div className="governance-grid" style={{ marginBottom: '24px' }}>
        <Card title={copy.avgScore}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TargetIcon size="md" color="var(--ds-color-primary)" />
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{metrics.avgScore === null ? "—" : `${metrics.avgScore}/100`}</div>
          </div>
        </Card>
        <Card title={copy.reviewed}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldCheckIcon size="md" color="var(--ds-color-success)" />
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{metrics.reviewed.length}</div>
          </div>
        </Card>
        <Card title={copy.needsAction}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <WorkflowIcon size="md" color="var(--ds-color-warning)" />
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{metrics.needsAction.length}</div>
          </div>
        </Card>
        <Card title={copy.pending}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RefreshIcon size="md" color="var(--ds-color-danger)" />
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{metrics.pending}</div>
          </div>
        </Card>
      </div>

      {route === "workflow" && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <WorkflowColumn title={copy.reviewed} tone="success" rows={metrics.reviewed} lang={lang} />
          <WorkflowColumn title={copy.needsAction} tone="warning" rows={metrics.needsAction} lang={lang} />
          <WorkflowColumn title={copy.pending} tone="danger" rows={projects.filter((p) => p.latest_score === null)} lang={lang} />
        </div>
      )}

      {route === "export" && (
        <div style={{ marginBottom: '24px' }}>
          <Card title={copy.exportExcel}>
            <p style={{ color: 'var(--ds-color-text-muted)', marginBottom: '16px' }}>{screen.subtitle}</p>
            <Button 
              variant="primary" 
              onClick={() => exportMutation.mutate()} 
              disabled={exportMutation.isPending || projects.length === 0}
              isLoading={exportMutation.isPending}
              leftIcon={<DownloadIcon size="sm" />}
            >
              {copy.exportExcel}
            </Button>
            {exportMessage && (
              <div style={{ marginTop: '12px' }}>
                <StatusBadge tone={exportMessage.type === "success" ? "success" : "danger"}>
                  {exportMessage.text}
                </StatusBadge>
              </div>
            )}
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
                    <tr key={project.project_id}>
                      <td>{project.project_id}</td>
                      <td style={{ fontWeight: 600 }}>{project.project_name}</td>
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

function WorkflowColumn({
  title,
  tone,
  rows,
  lang,
}: {
  title: string;
  tone: "success" | "warning" | "danger";
  rows: Project[];
  lang: "vi" | "ja";
}) {
  return (
    <Card title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rows.length ? (
          rows.slice(0, 8).map((row) => (
            <div key={row.project_id} style={{ 
              padding: '12px', borderRadius: 'var(--ds-radius-md)', 
              backgroundColor: 'var(--ds-color-bg-muted)', borderLeft: `4px solid var(--ds-color-${tone})`
            }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{row.project_name}</div>
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
