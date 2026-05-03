import type { Project } from "../../types";
import { useTranslation } from "../LanguageSelector";
import SubmissionsTable from "../SubmissionsTable";
import { PageHeader } from "../ui/PageHeader";
import { FileReviewIcon, ShieldCheckIcon, TargetIcon } from "../ui/Icon";

interface ReviewListOverviewProps {
  projects: Project[];
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
}

export default function ReviewListOverview({
  projects,
  activeProjectId,
  onSelectProject,
}: ReviewListOverviewProps) {
  const { lang } = useTranslation();
  const isJa = lang === "ja";

  const stats = {
    total: projects.length,
    completed: projects.filter(p => p.latest_score !== null).length,
    pending: projects.filter(p => p.latest_score === null).length,
    avgScore: projects.length > 0 
      ? Math.round(projects.reduce((acc, p) => acc + (p.latest_score ?? 0), 0) / projects.length)
      : 0
  };

  return (
    <section className="dashboard-reference" aria-label={isJa ? "レビュー一覧" : "Danh sách review"}>
      <PageHeader 
        title={isJa
          ? "こんにちは！AI があなたのドキュメント品質向上をサポートします"
          : "Xin chào! AI hỗ trợ nâng cao chất lượng tài liệu của bạn"}
        subtitle={isJa
          ? "AI が全てのドキュメントを分析し、改善点や良い事例を提案します"
          : "AI phân tích toàn bộ tài liệu, tổng hợp điểm mạnh và gợi ý các điểm cần cải thiện."}
      />

      <div className="review-stats-grid-v3">
        <div className="review-stat-card-v3">
          <div className="review-stat-icon-v3" style={{ background: '#eff6ff', color: '#3b82f6' }}>
            <FileReviewIcon size="md" />
          </div>
          <div className="review-stat-info-v3">
            <span className="review-stat-value-v3">{stats.total}</span>
            <span className="review-stat-label-v3">{isJa ? "総ドキュメント" : "Tổng tài liệu"}</span>
          </div>
        </div>
        
        <div className="review-stat-card-v3">
          <div className="review-stat-icon-v3" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <ShieldCheckIcon size="md" />
          </div>
          <div className="review-stat-info-v3">
            <span className="review-stat-value-v3">{stats.completed}</span>
            <span className="review-stat-label-v3">{isJa ? "レビュー完了" : "Đã hoàn thành"}</span>
          </div>
        </div>

        <div className="review-stat-card-v3">
          <div className="review-stat-icon-v3" style={{ background: '#fff7ed', color: '#ea580c' }}>
            <TargetIcon size="md" />
          </div>
          <div className="review-stat-info-v3">
            <span className="review-stat-value-v3">{stats.avgScore}</span>
            <span className="review-stat-label-v3">{isJa ? "平均スコア" : "Điểm trung bình"}</span>
          </div>
        </div>
      </div>

      <section className="review-reference-panel">
        <header className="review-reference-panel__head" style={{ marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>
              {isJa ? "ドキュメント一覧" : "Danh sách tài liệu"}
            </h2>
            <p style={{ color: '#64748b', marginTop: '4px' }}>
              {isJa
                ? "アップロードされたドキュメントの一覧とレビュー結果"
                : "Danh sách tài liệu đã tải lên và kết quả review chi tiết"}
            </p>
          </div>
        </header>

        <SubmissionsTable
          projects={projects}
          activeProjectId={activeProjectId ?? null}
          onSelectProject={onSelectProject}
          variant="reference"
        />
      </section>
    </section>
  );
}
