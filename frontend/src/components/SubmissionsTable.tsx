import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkDeleteSubmissions, deleteSubmission, exportSubmissionsExcel, gradeSubmission } from "../api/client";
import type { DocumentType } from "../constants/documentTypes";
import { submissionsQueryKey } from "../query";
import type { Submission } from "../types";
import { useTranslation } from "./LanguageSelector";
import ConfirmDialog from "./ui/ConfirmDialog";
import { FileReviewIcon } from "./ui/Icon";
import SectionBlock from "./ui/SectionBlock";
import ToastStack, { type ToastItem } from "./ui/ToastStack";

import TableHeader from "./submissions/TableHeader";
import TableRow from "./submissions/TableRow";
import TableToolbar from "./submissions/TableToolbar";
import TableFooter from "./submissions/TableFooter";

interface SubmissionsTableProps {
  submissions: Submission[];
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
  variant?: "full" | "dashboard";
}

type DeleteMode = "single" | "selected";
const PAGE_SIZE = {
  dashboard: 5,
  full: 10,
} as const;

interface PendingDelete {
  mode: DeleteMode;
  projectIds: string[];
  description: string;
  details: string[];
}

export default function SubmissionsTable({
  submissions,
  activeProjectId: controlledActiveProjectId,
  onSelectProject,
  variant = "full",
}: SubmissionsTableProps) {
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [internalActiveProjectId, setInternalActiveProjectId] = useState<string | null>(submissions[0]?.project_id ?? null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [documentTypeFilter, setDocumentTypeFilter] = useState<DocumentType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending">("all");
  const [languageFilter, setLanguageFilter] = useState<"all" | "vi" | "ja">("all");
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const activeProjectId = controlledActiveProjectId ?? internalActiveProjectId;
  const isDashboardVariant = variant === "dashboard";

  useEffect(() => {
    if (!submissions.length) {
      setInternalActiveProjectId(null);
      return;
    }
    if (!activeProjectId || !submissions.some((item) => item.project_id === activeProjectId)) {
      setInternalActiveProjectId(submissions[0].project_id);
    }
  }, [activeProjectId, submissions]);

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
      await queryClient.invalidateQueries({ queryKey: submissionsQueryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubmission,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: submissionsQueryKey });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteSubmissions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: submissionsQueryKey });
    },
  });

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      if (documentTypeFilter !== "all" && submission.document_type !== documentTypeFilter) {
        return false;
      }

      if (statusFilter !== "all") {
        const isCompleted = submission.latest_run?.score !== null && submission.latest_run?.score !== undefined;
        if (statusFilter === "completed" && !isCompleted) {
          return false;
        }
        if (statusFilter === "pending" && isCompleted) {
          return false;
        }
      }

      if (languageFilter !== "all" && submission.language !== languageFilter) {
        return false;
      }

      return true;
    });
  }, [documentTypeFilter, languageFilter, statusFilter, submissions]);

  const pageSize = PAGE_SIZE[variant];
  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filteredSubmissions.length);
  const pagedSubmissions = filteredSubmissions.slice(pageStart, pageEnd);
  const currentPageProjectIds = useMemo(
    () => pagedSubmissions.map((item) => item.project_id),
    [pagedSubmissions],
  );
  const allSelected = currentPageProjectIds.length > 0 && currentPageProjectIds.every((id) => selectedIds.has(id));
  const isBulkDeleting = bulkDeleteMutation.isPending;
  const isDeletingSingle = deleteMutation.isPending;
  const isActionPending = isBulkDeleting || isDeletingSingle;

  const resultSummary = useMemo(() => {
    return t("submissions.displayResults", {
      start: pageEnd === 0 ? 0 : pageStart + 1,
      end: pageEnd,
      total: filteredSubmissions.length,
    });
  }, [filteredSubmissions.length, t, pageEnd, pageStart]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [documentTypeFilter, languageFilter, statusFilter]);

  const handleSelectProject = (projectId: string) => {
    if (!controlledActiveProjectId) {
      setInternalActiveProjectId(projectId);
    }
    onSelectProject?.(projectId);
  };

  const handleGrade = async (projectId: string) => {
    setGradingId(projectId);
    try {
      const submission = submissions.find((item) => item.project_id === projectId);
      await gradeMutation.mutateAsync({
        projectId,
        force: Boolean(submission?.latest_run?.score !== null && submission?.latest_run?.score !== undefined),
      });
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : t("submissions.gradingFailed"));
    } finally {
      setGradingId(null);
    }
  };

  const openDeleteDialog = (projectIds: string[], mode: DeleteMode) => {
    if (!projectIds.length) return;

    const preview = projectIds.slice(0, 8);
    const description =
      mode === "single"
        ? `${t("submissions.deleteConfirm")} ${t("submissions.projectId")}: ${projectIds[0]}`
        : t("submissions.bulkDeleteConfirm").replace("{count}", String(projectIds.length));

    setPendingDelete({
      mode,
      projectIds,
      description,
      details: preview,
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    if (pendingDelete.mode === "single") {
      const projectId = pendingDelete.projectIds[0];
      setDeletingId(projectId);
      try {
        await deleteMutation.mutateAsync(projectId);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
        pushToast("success", t("submissions.deleteSuccess"));
      } catch (err) {
        pushToast("danger", err instanceof Error ? err.message : t("submissions.deleteFailed"));
      } finally {
        setDeletingId(null);
        setPendingDelete(null);
      }
      return;
    }

    try {
      const result = await bulkDeleteMutation.mutateAsync(pendingDelete.projectIds);
      setSelectedIds(new Set(result.failed));

      if (result.failed.length > 0) {
        pushToast(
          "warning",
          t("submissions.deleteResult")
            .replace("{deleted}", String(result.deleted.length))
            .replace("{failed}", String(result.failed.length)),
        );
      } else {
        pushToast("success", t("submissions.bulkDeleteSuccess").replace("{count}", String(result.deleted.length)));
      }
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : t("submissions.deleteFailed"));
    } finally {
      setPendingDelete(null);
    }
  };

  const toggleSelect = (projectId: string) => {
    const nextSelected = new Set(selectedIds);
    if (nextSelected.has(projectId)) {
      nextSelected.delete(projectId);
    } else {
      nextSelected.add(projectId);
    }
    setSelectedIds(nextSelected);
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((current) => {
        const next = new Set(current);
        currentPageProjectIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    setSelectedIds((current) => new Set([...current, ...currentPageProjectIds]));
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await exportSubmissionsExcel();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      
      pushToast("success", t("submissions.exportSuccess"));
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : t("submissions.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  if (!submissions.length) {
    return (
      <div className="empty-projects-panel">
        <span className="empty-projects-panel__icon" aria-hidden="true">
          <FileReviewIcon size="lg" />
        </span>
        <h3>{t("submissions.emptyStateTitle")}</h3>
        <p>{t("submissions.noSubmissions")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="review-workspace">
        <div className={isDashboardVariant ? "dashboard-table-layout" : ""}>
          <SectionBlock className={`review-table-shell ${isDashboardVariant ? "review-table-shell--dashboard" : ""}`.trim()}>
            <SectionBlock.Body>
              {!isDashboardVariant && (
                <TableToolbar
                  selectedCount={selectedIds.size}
                  totalCount={filteredSubmissions.length}
                  onExport={() => void handleExportExcel()}
                  onDeleteSelected={() => openDeleteDialog(Array.from(selectedIds), "selected")}
                  exporting={exporting}
                  isActionPending={isActionPending}
                  documentTypeFilter={documentTypeFilter}
                  statusFilter={statusFilter}
                  languageFilter={languageFilter}
                  onDocumentTypeFilterChange={setDocumentTypeFilter}
                  onStatusFilterChange={setStatusFilter}
                  onLanguageFilterChange={setLanguageFilter}
                />
              )}

              <div className="review-table-wrap">
                <table className={`review-table ${isDashboardVariant ? "review-table--dashboard" : ""}`.trim()}>
                  <TableHeader
                    showCheckbox={!isDashboardVariant}
                    allSelected={allSelected}
                    onToggleSelectAll={toggleSelectAll}
                  />
                  <tbody>
                    {pagedSubmissions.map((submission) => (
                      <TableRow
                        key={submission.project_id}
                        submission={submission}
                        isActive={submission.project_id === activeProjectId}
                        isSelected={selectedIds.has(submission.project_id)}
                        showCheckbox={!isDashboardVariant}
                        isDashboardVariant={isDashboardVariant}
                        gradingId={gradingId}
                        deletingId={deletingId}
                        isActionPending={isActionPending}
                        onSelect={handleSelectProject}
                        onToggleSelect={toggleSelect}
                        onGrade={handleGrade}
                        onDelete={(id) => openDeleteDialog([id], "single")}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionBlock.Body>
          </SectionBlock>

          <TableFooter
            totalCount={filteredSubmissions.length}
            resultSummary={resultSummary}
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            canGoPrevious={safeCurrentPage > 1}
            canGoNext={safeCurrentPage < totalPages}
            previousLabel={t("submissions.previousPage")}
            nextLabel={t("submissions.nextPage")}
            pageLabel={t("submissions.pageStatus")}
            onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
            onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          />
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t("common.confirmDeleteTitle")}
        description={pendingDelete?.description ?? ""}
        details={pendingDelete?.details}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        pending={isActionPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
