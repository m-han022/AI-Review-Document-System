import { useTranslation } from "../LanguageSelector";
import { DownloadIcon, PlusIcon, SearchIcon, TrashIcon } from "../ui/Icon";
import { Button, Input, Select } from "../ui";
import type { LanguageCode } from "../../types";

import "./TableToolbar.css";

interface TableToolbarProps {
  selectedCount: number;
  totalCount: number;
  onExport: () => void;
  onDeleteSelected: () => void;
  exporting: boolean;
  isActionPending: boolean;
  statusFilter: "all" | "completed" | "pending";
  languageFilter: LanguageCode | "all";
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
  statusFilter,
  languageFilter,
  onStatusFilterChange,
  onLanguageFilterChange,
  searchQuery,
  onSearchQueryChange,
  onCreateProject,
}: TableToolbarProps) {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;



  const statusOptions = [
    { value: "all", label: t("submissions.filterAllStatuses") },
    { value: "completed", label: t("project.completed") },
    { value: "pending", label: t("project.pending") },
  ];

  const languageOptions = [
    { value: "all", label: t("submissions.filterAllLanguages") },
    { value: "ja", label: "日本語" },
    { value: "vi", label: "Tiếng Việt" },
  ];

  return (
    <div className="toolbar-groups-v4">
      <div className="toolbar-search-container-v4">
        <Input
          placeholder={t("submissions.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          leftIcon={<SearchIcon size="sm" />}
          className="toolbar-search-v4"
        />
      </div>

      <div className="toolbar-filters-v4">
        <div style={{ minWidth: "160px" }}>
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as any)}
          />
        </div>
        <div style={{ minWidth: "160px" }}>
          <Select
            options={languageOptions}
            value={languageFilter}
            onChange={(e) => onLanguageFilterChange(e.target.value as any)}
            title={t("submissions.filterAllLanguages")}
          />
        </div>
      </div>

      <div className="toolbar-actions-v4">
        <Button 
          variant="primary" 
          onClick={onCreateProject} 
          disabled={isActionPending}
          size="md"
          className="toolbar-action-btn-v4"
        >
          <PlusIcon size="sm" />
          {t("submissions.createProjectNew")}
        </Button>
        <Button 
          variant="primary" 
          onClick={onExport} 
          disabled={totalCount === 0 || exporting || isActionPending}
          isLoading={exporting}
          size="md"
          className="toolbar-action-btn-v4"
        >
          <DownloadIcon size="sm" />
          {t("submissions.exportExcel") || "Xuất Excel"}
        </Button>
        <Button 
          variant="danger" 
          onClick={onDeleteSelected} 
          disabled={!hasSelection || isActionPending}
          size="md"
          className="toolbar-action-btn-v4"
        >
          <TrashIcon size="sm" />
          {t("submissions.deleteSelected") || "Xóa đã chọn"}
        </Button>
      </div>
    </div>

  );
}
