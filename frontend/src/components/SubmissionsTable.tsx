import { useCallback, useMemo, useState } from "react";
import type { Project } from "../types";

import { useTranslation } from "./LanguageSelector";
import ToastStack from "./ui/ToastStack";
import TableToolbar from "./submissions/TableToolbar";
import SubmissionsDialogs from "./submissions/SubmissionsDialogs";
import SubmissionsTableSection from "./submissions/SubmissionsTableSection";
import { useSubmissionsFilters } from "./submissions/useSubmissionsFilters";
import { filterProjects } from "./submissions/tableFilters";
import { paginateProjects, resolvePageSize } from "./submissions/tablePagination";
import { useSubmissionTableState } from "./submissions/useSubmissionTableState";
import { useSubmissionActions } from "./submissions/useSubmissionActions";
import { useActiveProjectSelection } from "./submissions/useActiveProjectSelection";

interface SubmissionsTableProps {
  projects: Project[];
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
  variant?: "full" | "dashboard" | "reference";
}

export default function SubmissionsTable({
  projects,
  activeProjectId: controlledActiveProjectId,
  onSelectProject,
  variant = "full",
}: SubmissionsTableProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    languageFilter,
    setLanguageFilter,
  } = useSubmissionsFilters();

  const { t } = useTranslation();

  const {
    selectedIds,
    selectIds,
    clearSelection,
    currentPage,
    toggleSelect,
    goPreviousPage,
    goNextPage,
  } = useSubmissionTableState();

  const { activeProjectId, setInternalActiveProjectId } = useActiveProjectSelection({
    projects,
    controlledActiveProjectId,
  });

  const {
    gradingId,
    deletingId,
    pendingDelete,
    setPendingDelete,
    toasts,
    dismissToast,
    handleGrade,
    openDeleteDialog,
    confirmDelete,
    isActionPending,
  } = useSubmissionActions({
    projects,
    t,
    onClearSelection: clearSelection,
  });

  const filteredProjects = useMemo(
    () => filterProjects(projects, searchQuery, statusFilter, languageFilter),
    [projects, searchQuery, statusFilter, languageFilter],
  );

  const pageSize = resolvePageSize(variant);
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const pagedProjects = useMemo(
    () => paginateProjects(filteredProjects, currentPage, pageSize),
    [filteredProjects, currentPage, pageSize],
  );

  const handleSelectProject = useCallback(
    (projectId: string) => {
      setInternalActiveProjectId(projectId);
      onSelectProject?.(projectId);
    },
    [onSelectProject, setInternalActiveProjectId],
  );

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === pagedProjects.length) {
      clearSelection();
    } else {
      selectIds(pagedProjects.map((p) => p.project_id));
    }
  }, [clearSelection, pagedProjects, selectIds, selectedIds.size]);

  return (
    <div className="submissions-table-wrap">
      {variant !== "dashboard" && (
        <TableToolbar
          selectedCount={selectedIds.size}
          totalCount={filteredProjects.length}
          onExport={() => {}}
          onDeleteSelected={() => openDeleteDialog(Array.from(selectedIds), "selected")}
          exporting={false}
          isActionPending={isActionPending}
          statusFilter={statusFilter}
          languageFilter={languageFilter}
          onStatusFilterChange={setStatusFilter}
          onLanguageFilterChange={setLanguageFilter}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onCreateProject={() => setShowCreateDialog(true)}
          variant={variant === "reference" ? "reference" : "full"}
        />
      )}

      <SubmissionsTableSection
        variant={variant}
        pagedProjects={pagedProjects}
        selectedIds={selectedIds}
        activeProjectId={activeProjectId}
        gradingId={gradingId}
        deletingId={deletingId}
        isActionPending={isActionPending}
        currentPage={currentPage}
        totalPages={totalPages}
        totalFilteredCount={filteredProjects.length}
        countLabel={t("submissions.count", { count: filteredProjects.length })}
        noSubmissionsLabel={t("submissions.noSubmissions")}
        noSubmissionsDesc={t("submissions.noSubmissionsDesc") || "Bắt đầu bằng cách tạo dự án đầu tiên của bạn."}
        createProjectLabel={t("submissions.createProjectNew")}
        onCreateProject={() => setShowCreateDialog(true)}
        onToggleSelectAll={toggleSelectAll}
        onSelectProject={handleSelectProject}
        onToggleSelect={toggleSelect}
        onGrade={handleGrade}
        onDelete={(id) => openDeleteDialog([id], "single")}
        onEdit={(p) => setEditingProject(p)}
        onPreviousPage={goPreviousPage}
        onNextPage={() => goNextPage(totalPages)}
      />

      <SubmissionsDialogs
        pendingDelete={pendingDelete}
        deletingId={deletingId}
        editingProject={editingProject}
        showCreateDialog={showCreateDialog}
        t={t}
        onConfirmDelete={confirmDelete}
        onCancelDelete={() => setPendingDelete(null)}
        onCloseCreate={() => setShowCreateDialog(false)}
        onCloseEdit={() => setEditingProject(null)}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
