import { DownloadIcon, TrashIcon } from "../ui/Icon";
import { useTranslation } from "../LanguageSelector";

interface TableToolbarProps {
  selectedCount: number;
  totalCount: number;
  onExport: () => void;
  onDeleteSelected: () => void;
  exporting: boolean;
  isActionPending: boolean;
}

export default function TableToolbar({
  selectedCount,
  totalCount,
  onExport,
  onDeleteSelected,
  exporting,
  isActionPending,
}: TableToolbarProps) {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;

  return (
    <div className="review-toolbar review-toolbar--table review-toolbar--reviews">
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
  );
}
