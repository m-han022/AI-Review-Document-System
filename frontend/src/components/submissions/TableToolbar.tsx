import type { DocumentType } from "../../constants/documentTypes";
import type { LanguageCode } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { DownloadIcon, PlusIcon, SearchIcon, TrashIcon } from "../ui/Icon";

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
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onCreateProject?: () => void;
  variant?: "full" | "reference";
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
  searchQuery,
  onSearchQueryChange,
  onCreateProject,
  variant = "full",
}: TableToolbarProps) {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;
  const isReferenceVariant = variant === "reference";

  if (!isReferenceVariant) {
    // Original full variant layout remains largely unchanged for business logic parity, 
    // but we can apply some minor styling tweaks if needed.
    return (
      <div className="review-toolbar review-toolbar--table review-toolbar--reviews">
        <div className="review-toolbar__top">
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

          <div className="review-toolbar__filters">
            <select
              value={documentTypeFilter}
              onChange={(event) => onDocumentTypeFilterChange(event.target.value as DocumentType | "all")}
            >
              <option value="all">{t("submissions.filterAllDocumentTypes")}</option>
              <option value="project-review">{t("upload.types.projectReview.label")}</option>
              <option value="bug-analysis">{t("upload.types.bugAnalysis.label")}</option>
              <option value="qa-review">{t("upload.types.qaReview.label")}</option>
              <option value="explanation-review">{t("upload.types.explanationReview.label")}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as "all" | "completed" | "pending")}
            >
              <option value="all">{t("submissions.filterAllStatuses")}</option>
              <option value="completed">{t("project.completed")}</option>
              <option value="pending">{t("project.pending")}</option>
            </select>

            <select
              value={languageFilter}
              onChange={(event) => onLanguageFilterChange(event.target.value as LanguageCode | "all")}
            >
              <option value="all">{t("submissions.filterAllLanguages")}</option>
              <option value="ja">日本語</option>
              <option value="vi">Tiếng Việt</option>
            </select>
          </div>

          <div className="review-toolbar__actions">
            <button
              className="btn-primary btn-primary--compact"
              onClick={onCreateProject}
              disabled={isActionPending}
            >
              <PlusIcon size="md" />
              {t("submissions.createProjectNew")}
            </button>
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
              {`${t("submissions.deleteSelected")} (${selectedCount})`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modern V3 layout for Document List
  return (
    <div className="review-toolbar--v3">
      <div className="review-toolbar__top--v3">
        <div className="review-toolbar__search-wrap">
          <SearchIcon size="sm" />
          <input 
            type="text" 
            className="review-toolbar__search-input"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={t("submissions.searchPlaceholder")}
            aria-label={t("submissions.searchPlaceholder")}
          />
        </div>

        <div className="review-toolbar__filters--v3">
          <select
            value={documentTypeFilter}
            onChange={(event) => onDocumentTypeFilterChange(event.target.value as DocumentType | "all")}
          >
            <option value="all">{t("submissions.filterAllDocumentTypes")}</option>
            <option value="project-review">{t("upload.types.projectReview.label")}</option>
            <option value="bug-analysis">{t("upload.types.bugAnalysis.label")}</option>
            <option value="qa-review">{t("upload.types.qaReview.label")}</option>
            <option value="explanation-review">{t("upload.types.explanationReview.label")}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as "all" | "completed" | "pending")}
          >
            <option value="all">{t("submissions.filterAllStatuses")}</option>
            <option value="completed">{t("project.completed")}</option>
            <option value="pending">{t("project.pending")}</option>
          </select>

          <select
            value={languageFilter}
            onChange={(event) => onLanguageFilterChange(event.target.value as LanguageCode | "all")}
          >
            <option value="all">{t("submissions.filterAllLanguages")}</option>
            <option value="ja">日本語</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </div>

        <div className="review-toolbar__actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {selectedCount > 0 && (
            <span className="review-badge-v3" style={{ background: '#e0e7ff', color: '#4338ca', height: '32px', padding: '0 12px' }}>
              {t("common.selected", { count: selectedCount })}
            </span>
          )}

          <button
            className="review-pagination-btn-v3"
            style={{ height: '40px', background: '#6366f1', color: '#ffffff', borderColor: '#6366f1' }}
            onClick={onCreateProject}
            disabled={isActionPending}
          >
            <PlusIcon size="sm" />
          </button>

          <button
            className="review-pagination-btn-v3"
            style={{ height: '40px', background: '#f8fafc', color: '#475569' }}
            onClick={onExport}
            disabled={totalCount === 0 || exporting || isActionPending}
          >
            <DownloadIcon size="sm" />
          </button>
          
          <button
            className="review-pagination-btn-v3"
            style={{ height: '40px', borderColor: hasSelection ? '#ef4444' : '#e2e8f0', color: hasSelection ? '#ef4444' : '#94a3b8' }}
            onClick={onDeleteSelected}
            disabled={!hasSelection || isActionPending}
          >
            <TrashIcon size="sm" />
          </button>
        </div>
      </div>
    </div>
  );
}
