import type { DocumentType } from "../../constants/documentTypes";
import type { LanguageCode } from "../../types";
import { DownloadIcon, TrashIcon } from "../ui/Icon";
import { useTranslation } from "../LanguageSelector";

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
}: TableToolbarProps) {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;

  return (
    <div className="review-toolbar review-toolbar--table review-toolbar--reviews">
      <div className="review-toolbar__top">
        <div className="review-toolbar__selection">
          <span className={`review-toolbar__selection-count ${hasSelection ? "is-active" : ""}`.trim()}>
            {t("common.selected", { count: selectedCount })} / {totalCount}
          </span>
        </div>
        <div className="review-toolbar__actions">
          <button
            className="btn-primary btn-primary--compact"
            onClick={onExport}
            disabled={totalCount === 0 || exporting || isActionPending}
          >
            <DownloadIcon size="md" />
            {exporting ? t("submissions.exporting") : t("submissions.exportExcel")}
          </button>
          <button
            className="btn-danger-soft btn-danger-soft--compact"
            onClick={onDeleteSelected}
            disabled={!hasSelection || isActionPending}
          >
            <TrashIcon size="md" />
            {t("submissions.deleteSelected")} ({selectedCount})
          </button>
        </div>
      </div>

      <div className="review-toolbar__filters">
        <select
          value={documentTypeFilter}
          onChange={(event) => onDocumentTypeFilterChange(event.target.value as DocumentType | "all")}
        >
          <option value="all">{t("dashboard.filterAllDocumentTypes")}</option>
          <option value="project-review">{t("upload.types.projectReview.label")}</option>
          <option value="bug-analysis">{t("upload.types.bugAnalysis.label")}</option>
          <option value="qa-review">{t("upload.types.qaReview.label")}</option>
          <option value="explanation-review">{t("upload.types.explanationReview.label")}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as "all" | "completed" | "pending")}
        >
          <option value="all">{t("dashboard.filterAllStatuses")}</option>
          <option value="completed">{t("project.completed")}</option>
          <option value="pending">{t("project.pending")}</option>
        </select>

        <select
          value={languageFilter}
          onChange={(event) => onLanguageFilterChange(event.target.value as LanguageCode | "all")}
        >
          <option value="all">{t("dashboard.filterAllLanguages")}</option>
          <option value="vi">Tiếng Việt / ベトナム語</option>
          <option value="ja">Tiếng Nhật / 日本語</option>
        </select>
      </div>
    </div>
  );
}
