import type { DocumentType } from "../../constants/documentTypes";
import type { LanguageCode } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { DownloadIcon, PlusIcon, TrashIcon } from "../ui/Icon";
import { Button, Input, Select } from "../ui";

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
}: TableToolbarProps) {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;

  const docTypeOptions = [
    { value: "all", label: t("submissions.filterAllDocumentTypes") },
    { value: "project-review", label: t("upload.types.projectReview.label") },
    { value: "bug-analysis", label: t("upload.types.bugAnalysis.label") },
    { value: "qa-review", label: t("upload.types.qaReview.label") },
    { value: "explanation-review", label: t("upload.types.explanationReview.label") },
  ];

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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
      <div style={{ flex: '1', minWidth: '240px' }}>
        <Input
          placeholder={t("submissions.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ width: '160px' }}>
          <Select
            options={docTypeOptions}
            value={documentTypeFilter}
            onChange={(e) => onDocumentTypeFilterChange(e.target.value as any)}
            disabled
            label={`${t("submissions.filterAllDocumentTypes")} (${t("common.comingSoon") || "Coming soon"})`}
          />
        </div>
        <div style={{ width: '160px' }}>
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as any)}
          />
        </div>
        <div style={{ width: '160px' }}>
          <Select
            options={languageOptions}
            value={languageFilter}
            onChange={(e) => onLanguageFilterChange(e.target.value as any)}
            disabled
            label={`${t("submissions.filterAllLanguages")} (${t("common.comingSoon") || "Coming soon"})`}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <Button 
          variant="primary" 
          onClick={onCreateProject} 
          disabled={isActionPending}
        >
          <PlusIcon size="sm" />
          {t("submissions.createProjectNew")}
        </Button>
        <Button 
          variant="outline" 
          onClick={onExport} 
          disabled={totalCount === 0 || exporting || isActionPending}
          isLoading={exporting}
        >
          <DownloadIcon size="sm" />
        </Button>
        <Button 
          variant="danger" 
          onClick={onDeleteSelected} 
          disabled={!hasSelection || isActionPending}
        >
          <TrashIcon size="sm" />
          {hasSelection && <span>{selectedCount}</span>}
        </Button>
      </div>
    </div>
  );
}
