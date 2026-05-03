import { useMemo, useState, type ReactNode } from "react";
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
import { EmptyState, ErrorState, StatusBadge, SuccessState } from "../ui/States";

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
    <section className="ops-screen" aria-label={screen.title}>
      <header className="ops-screen__header">
        <div>
          <h1>{screen.title}</h1>
          <p>{screen.subtitle}</p>
        </div>
        <div className="ops-screen__actions">
          <button type="button" className="prod-button" onClick={onOpenUpload}>
            <FileReviewIcon size="sm" />
            {copy.uploadMore}
          </button>
          <button type="button" className="prod-button prod-button--primary" onClick={onOpenReviews}>
            <EyeIcon size="sm" />
            {copy.openReviews}
          </button>
        </div>
      </header>

      <div className="ops-metric-grid">
        <MetricCard icon={<TargetIcon size="md" />} label={copy.avgScore} value={metrics.avgScore === null ? "—" : `${metrics.avgScore}/100`} tone="primary" />
        <MetricCard icon={<ShieldCheckIcon size="md" />} label={copy.reviewed} value={metrics.reviewed.length} tone="success" />
        <MetricCard icon={<WorkflowIcon size="md" />} label={copy.needsAction} value={metrics.needsAction.length} tone="warning" />
        <MetricCard icon={<RefreshIcon size="md" />} label={copy.pending} value={metrics.pending} tone="danger" />
      </div>

      {route === "workflow" ? (
        <div className="ops-grid ops-grid--three">
          <WorkflowColumn title={copy.reviewed} tone="success" rows={metrics.reviewed} lang={lang} />
          <WorkflowColumn title={copy.needsAction} tone="warning" rows={metrics.needsAction} lang={lang} />
          <WorkflowColumn title={copy.pending} tone="danger" rows={projects.filter((p) => p.latest_score === null)} lang={lang} />
        </div>
      ) : null}

      {route === "export" ? (
        <section className="ops-card">
          <h2>{copy.exportExcel}</h2>
          <p>{screen.subtitle}</p>
          <button
            type="button"
            className="prod-button prod-button--primary"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending || projects.length === 0}
          >
            <DownloadIcon size="sm" />
            {exportMutation.isPending ? copy.exporting : copy.exportExcel}
          </button>
          {exportMessage?.type === "success" ? <SuccessState title={exportMessage.text} compact /> : null}
          {exportMessage?.type === "error" ? <ErrorState title={exportMessage.text} compact /> : null}
        </section>
      ) : null}

      {route === "settings" ? (
        <section className="ops-card">
          <h2>{screen.title}</h2>
          <div className="ops-settings-list">
            <div>
              <span>{copy.apiBase}</span>
              <strong>{API_BASE_URL}</strong>
            </div>
            <div>
              <span>{copy.dataSource}</span>
              <strong>{copy.realData}</strong>
            </div>
            <div>
              <span>{t("common.language")}</span>
              <strong>{lang.toUpperCase()}</strong>
            </div>
          </div>
        </section>
      ) : null}

      <section className="ops-card">
        <h2>{copy.latest}</h2>
        <div className="prod-table-wrap">
          <table className="prod-history-table">
            <thead>
              <tr>
                <th>{t("submissions.projectId")}</th>
                <th>{t("project.projectName") || "Tên dự án"}</th>
                <th>{t("project.totalDocuments") || "Số tài liệu"}</th>
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
                      <td>{project.project_name}</td>
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
      </section>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: "primary" | "success" | "warning" | "danger";
}) {
  return (
    <article className={`ops-metric ops-metric--${tone}`}>
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
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
    <section className="ops-card ops-workflow-column">
      <h2>
        {title}
        <StatusBadge tone={tone}>{rows.length}</StatusBadge>
      </h2>
      <div className="ops-workflow-list">
        {rows.length ? (
          rows.slice(0, 8).map((row) => (
            <article key={row.project_id}>
              <strong title={row.project_name}>{row.project_name}</strong>
              <span>{formatUploadedAt(row.latest_updated_at, lang)}</span>
            </article>
          ))
        ) : (
          <EmptyState title={lang === "ja" ? "対象なし" : "Không có dự án"} compact />
        )}
      </div>
    </section>
  );
}
