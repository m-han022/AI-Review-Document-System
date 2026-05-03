import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkDeleteSubmissions, deleteSubmission, gradeSubmission } from "../api/client";
import { projectsQueryKey } from "../query";
import type { Project, LanguageCode } from "../types";
import type { DocumentType } from "../constants/documentTypes";
import { useTranslation } from "./LanguageSelector";
import ConfirmDialog from "./ui/ConfirmDialog";
import ToastStack, { type ToastItem } from "./ui/ToastStack";

import TableHeader from "./submissions/TableHeader";
import TableRow from "./submissions/TableRow";
import TableToolbar from "./submissions/TableToolbar";
import TableFooter from "./submissions/TableFooter";

interface SubmissionsTableProps {
  projects: Project[];
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
  variant?: "full" | "dashboard" | "reference";
}

type DeleteMode = "single" | "selected";
const PAGE_SIZE = {
  dashboard: 5,
  full: 10,
  reference: 20,
} as const;

interface PendingDelete {
  mode: DeleteMode;
  projectIds: string[];
  description: string;
  details: string[];
}

export default function SubmissionsTable({
  projects,
  activeProjectId: controlledActiveProjectId,
  onSelectProject,
  variant = "full",
}: SubmissionsTableProps) {
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [internalActiveProjectId, setInternalActiveProjectId] = useState<string | null>(projects[0]?.project_id ?? null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending">("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<DocumentType | "all">("all");
  const [languageFilter, setLanguageFilter] = useState<LanguageCode | "all">("all");
  
  const queryClient = useQueryClient();
  const { t, lang } = useTranslation();

  const activeProjectId = controlledActiveProjectId ?? internalActiveProjectId;
  const isDashboardVariant = variant === "dashboard";

  useEffect(() => {
    if (!projects.length) {
      setInternalActiveProjectId(null);
      return;
    }
    if (!activeProjectId || !projects.some((item) => item.project_id === activeProjectId)) {
      setInternalActiveProjectId(projects[0].project_id);
    }
  }, [activeProjectId, projects]);

  useEffect(() => {
    if (!toasts.length) return;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 3600),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts]);

  const pushToast = (tone: ToastItem["tone"], message: string) => {
    setToasts((current) => [...current, { id: Date.now() + Math.random(), tone, message }]);
  };

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const gradeMutation = useMutation({
    mutationFn: gradeSubmission,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubmission,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteSubmissions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.project_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.project_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const isCompleted = project.latest_score !== null;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" && isCompleted) ||
        (statusFilter === "pending" && !isCompleted);

      // Note: project level doesn't have document_type or language directly anymore in Project interface,
      // but we keep the filters for UI parity if possible or simplify.
      // For now, let's just use what we have.

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE[variant === "dashboard" ? "dashboard" : variant === "reference" ? "reference" : "full"]));
  const pagedProjects = useMemo(() => {
    const size = PAGE_SIZE[variant === "dashboard" ? "dashboard" : variant === "reference" ? "reference" : "full"];
    const start = (currentPage - 1) * size;
    return filteredProjects.slice(start, start + size);
  }, [filteredProjects, currentPage, variant]);

  const handleSelectProject = (projectId: string) => {
    setInternalActiveProjectId(projectId);
    onSelectProject?.(projectId);
  };

  const toggleSelect = (projectId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pagedProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedProjects.map((p) => p.project_id)));
    }
  };

  const handleGrade = async (projectId: string) => {
    setGradingId(projectId);
    try {
      await gradeMutation.mutateAsync({ projectId, force: true });
      pushToast("success", t("submissions.gradingSuccess"));
    } catch (error) {
      pushToast("danger", error instanceof Error ? error.message : t("submissions.gradingFailed"));
    } finally {
      setGradingId(null);
    }
  };

  const openDeleteDialog = (ids: string[], mode: DeleteMode) => {
    const targets = projects.filter((p) => ids.includes(p.project_id));
    setPendingDelete({
      mode,
      projectIds: ids,
      description: mode === "single" ? t("submissions.deleteConfirm") : t("submissions.deleteSelectedConfirm"),
      details: targets.map((p) => `${p.project_id}: ${p.project_name}`),
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { mode, projectIds } = pendingDelete;
    setDeletingId(projectIds[0]);

    try {
      if (mode === "single") {
        await deleteMutation.mutateAsync(projectIds[0]);
      } else {
        await bulkDeleteMutation.mutateAsync(projectIds);
        setSelectedIds(new Set());
      }
      pushToast("success", t("submissions.deleteSuccess"));
    } catch (error) {
      pushToast("danger", error instanceof Error ? error.message : t("submissions.deleteFailed"));
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  const isActionPending = gradeMutation.isPending || deleteMutation.isPending || bulkDeleteMutation.isPending;

  return (
    <div className="prod-table-workspace">
      <TableToolbar
        selectedCount={selectedIds.size}
        totalCount={filteredProjects.length}
        onExport={() => {}}
        onDeleteSelected={() => openDeleteDialog(Array.from(selectedIds), "selected")}
        exporting={false}
        isActionPending={isActionPending}
        documentTypeFilter={documentTypeFilter}
        statusFilter={statusFilter}
        languageFilter={languageFilter}
        onDocumentTypeFilterChange={setDocumentTypeFilter}
        onStatusFilterChange={setStatusFilter}
        onLanguageFilterChange={setLanguageFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        variant={variant === "reference" ? "reference" : "full"}
      />

      <div className="prod-table-wrap">
        <table className="review-table review-table--v3">
          <TableHeader
            allSelected={pagedProjects.length > 0 && selectedIds.size === pagedProjects.length}
            onToggleSelectAll={toggleSelectAll}
            showCheckbox={!isDashboardVariant}
          />
          <tbody>
            {pagedProjects.length ? (
              pagedProjects.map((project) => (
                <TableRow
                  key={project.project_id}
                  project={project}
                  isActive={project.project_id === activeProjectId}
                  isSelected={selectedIds.has(project.project_id)}
                  showCheckbox={!isDashboardVariant}
                  gradingId={gradingId}
                  deletingId={deletingId}
                  isActionPending={isActionPending}
                  onSelect={handleSelectProject}
                  onToggleSelect={toggleSelect}
                  onGrade={handleGrade}
                  onDelete={(id) => openDeleteDialog([id], "single")}
                />
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "48px 0" }}>
                  {t("submissions.noSubmissions")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TableFooter
        totalCount={filteredProjects.length}
        resultSummary={t("submissions.count", { count: filteredProjects.length })}
        currentPage={currentPage}
        canGoPrevious={currentPage > 1}
        canGoNext={currentPage < totalPages}
        previousLabel={lang === "ja" ? "前へ" : "Trước"}
        nextLabel={lang === "ja" ? "次へ" : "Tiếp"}
        onPrevious={() => setCurrentPage(p => Math.max(1, p - 1))}
        onNext={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
        variant={variant === "reference" ? "reference" : "default"}
      />

      {pendingDelete && (
        <ConfirmDialog
          open={!!pendingDelete}
          title={t("submissions.deleteConfirmTitle")}
          description={pendingDelete.description}
          details={pendingDelete.details}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          pending={deletingId !== null}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
