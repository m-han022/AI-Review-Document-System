import type { Submission } from "../../types";
import { useTranslation } from "../LanguageSelector";
import SubmissionsTable from "../SubmissionsTable";
import { PageHeader } from "../ui/PageHeader";

interface ReviewListOverviewProps {
  submissions: Submission[];
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
}

export default function ReviewListOverview({
  submissions,
  activeProjectId,
  onSelectProject,
}: ReviewListOverviewProps) {
  const { lang } = useTranslation();
  const isJa = lang === "ja";

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

      <section className="dashboard-reference-panel">
        <header className="dashboard-reference-panel__head">
          <div>
            <h2>{isJa ? "ドキュメント一覧" : "Danh sách tài liệu"}</h2>
            <p>
              {isJa
                ? "アップロードされたドキュメントの一覧 và レビュー kết quả"
                : "Danh sách tài liệu đã tải lên và kết quả review"}
            </p>
          </div>
        </header>

        <SubmissionsTable
          submissions={submissions}
          activeProjectId={activeProjectId ?? null}
          onSelectProject={onSelectProject}
          variant="reference"
        />
      </section>
    </section>
  );
}
