import type { DocumentType } from "../../constants/documentTypes";
import type { LanguageCode } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { DownloadIcon, TrashIcon } from "../ui/Icon";

interface TableToolbarProps {
  selectedCount: number;
  totalCount: number;
  onExport: () => void;
  onDeleteSelected: () => void;
  exporting: boolean;
  isActionPending: boolean;
  documentTypeFilter: DocumentType | "all";
  statusFilter: "all" | "completed" | "pending";
  languageFilter: LanguageCode | "all";
  onDocumentTypeFilterChange: (value: DocumentType | "all") => void;
  onStatusFilterChange: (value: "all" | "completed" | "pending") => void;
  onLanguageFilterChange: (value: LanguageCode | "all") => void;
  variant?: "full" | "reference";
  selectionSummary?: string;
}

export default function TableToolbar({
  selectedCount,
  totalCount,
  onExport,
  onDeleteSelected,
  exporting,
  isActionPending,
  documentTypeFilter,
  statusFilter,
  languageFilter,
  onDocumentTypeFilterChange,
  onStatusFilterChange,
  onLanguageFilterChange,
  variant = "full",
  selectionSummary,
}: TableToolbarProps) {
  const { lang, t } = useTranslation();
  const hasSelection = selectedCount > 0;
  const isReferenceVariant = variant === "reference";

  return (
    <div className={`review-toolbar review-toolbar--table review-toolbar--reviews ${isReferenceVariant ? "review-toolbar--reference" : ""}`.trim()}>
      <div className="review-toolbar__top">
        {isReferenceVariant ? (
          <div className="review-toolbar__selection">
            <span className="review-toolbar__selection-count is-active">
              {selectionSummary ?? t("common.selected", { count: selectedCount })}
            </span>
          </div>
        ) : (
          <>
            <div className="review-toolbar__heading">
              <div className="review-toolbar__heading-copy">
                <strong>{t("submissions.title")}</strong>
                <span>{t("submissions.subtitle")}</span>
              </div>
              <span className="review-toolbar__total">{t("submissions.count", { count: totalCount })}</span>
            </div>

            <div className="review-toolbar__selection">
              <span className={`review-toolbar__selection-count ${hasSelection ? "is-active" : ""}`.trim()}>
                {t("common.selected", { count: selectedCount })}
              </span>
            </div>
          </>
        )}

        <div className="review-toolbar__filters">
          <select
            value={documentTypeFilter}
            onChange={(event) => onDocumentTypeFilterChange(event.target.value as DocumentType | "all")}
          >
            <option value="all">{lang === "ja" ? "すべてのファイルタイプ" : t("dashboard.filterAllDocumentTypes")}</option>
            <option value="project-review">{t("upload.types.projectReview.label")}</option>
            <option value="bug-analysis">{t("upload.types.bugAnalysis.label")}</option>
            <option value="qa-review">{t("upload.types.qaReview.label")}</option>
            <option value="explanation-review">{t("upload.types.explanationReview.label")}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as "all" | "completed" | "pending")}
          >
            <option value="all">{lang === "ja" ? "すべてのステータス" : t("dashboard.filterAllStatuses")}</option>
            <option value="completed">{t("project.completed")}</option>
            <option value="pending">{t("project.pending")}</option>
          </select>

          <select
            value={languageFilter}
            onChange={(event) => onLanguageFilterChange(event.target.value as LanguageCode | "all")}
          >
            <option value="all">{lang === "ja" ? "すべての言語" : t("dashboard.filterAllLanguages")}</option>
            <option value="ja">{lang === "ja" ? "日本語" : "Tiếng Nhật"}</option>
            <option value="vi">{lang === "ja" ? "ベトナム語" : "Tiếng Việt"}</option>
          </select>
        </div>

        <div className="review-toolbar__actions">
          <button
            className={isReferenceVariant ? "review-reference-button review-reference-button--primary" : "btn-primary btn-primary--compact"}
            onClick={onExport}
            disabled={totalCount === 0 || exporting || isActionPending}
          >
            <DownloadIcon size="md" />
            {exporting ? t("submissions.exporting") : lang === "ja" ? "Excel出力" : t("submissions.exportExcel")}
          </button>
          <button
            className={isReferenceVariant ? "review-reference-button review-reference-button--danger" : "btn-danger-soft btn-danger-soft--compact"}
            onClick={onDeleteSelected}
            disabled={!hasSelection || isActionPending}
          >
            <TrashIcon size="md" />
            {lang === "ja" ? `選択削除 (${selectedCount})` : `${t("submissions.deleteSelected")} (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
