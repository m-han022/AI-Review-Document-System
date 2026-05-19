import { useCallback, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkDeleteSubmissions, deleteSubmission, gradeSubmission } from "../../api/client";
import { projectsQueryKey } from "../../query";
import type { Project } from "../../types";
import { toHumanErrorMessage } from "../../utils/humanizeError";
import type { ToastItem } from "../ui/ToastStack";

type DeleteMode = "single" | "selected";

interface PendingDelete {
  mode: DeleteMode;
  projectIds: string[];
  description: string;
  details: string[];
}

interface UseSubmissionActionsParams {
  projects: Project[];
  t: (key: string) => string;
  onClearSelection: () => void;
}

export function useSubmissionActions({ projects, t, onClearSelection }: UseSubmissionActionsParams) {
  const queryClient = useQueryClient();
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 3600),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts]);

  const pushToast = useCallback((tone: ToastItem["tone"], message: string) => {
    setToasts((current) => [...current, { id: Date.now() + Math.random(), tone, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

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

  const handleGrade = useCallback(
    async (projectId: string) => {
      setGradingId(projectId);
      try {
        await gradeMutation.mutateAsync({ projectId, force: true });
        pushToast("success", t("submissions.gradingSuccess"));
      } catch (error) {
        pushToast("danger", toHumanErrorMessage(error, t("submissions.gradingFailed")));
      } finally {
        setGradingId(null);
      }
    },
    [gradeMutation, pushToast, t],
  );

  const openDeleteDialog = useCallback(
    (ids: string[], mode: DeleteMode) => {
      const targets = projects.filter((p) => ids.includes(p.project_id));
      setPendingDelete({
        mode,
        projectIds: ids,
        description: mode === "single" ? t("submissions.deleteConfirm") : t("submissions.deleteSelectedConfirm"),
        details: targets.map((p) => `${p.project_id}: ${p.project_name}`),
      });
    },
    [projects, t],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const { mode, projectIds } = pendingDelete;
    setDeletingId(projectIds[0]);

    try {
      if (mode === "single") {
        await deleteMutation.mutateAsync(projectIds[0]);
      } else {
        await bulkDeleteMutation.mutateAsync(projectIds);
        onClearSelection();
      }
      pushToast("success", t("submissions.deleteSuccess"));
    } catch (error) {
      pushToast("danger", toHumanErrorMessage(error, t("submissions.deleteFailed")));
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }, [pendingDelete, deleteMutation, bulkDeleteMutation, onClearSelection, pushToast, t]);

  return {
    gradingId,
    deletingId,
    pendingDelete,
    setPendingDelete,
    toasts,
    dismissToast,
    handleGrade,
    openDeleteDialog,
    confirmDelete,
    isActionPending: gradeMutation.isPending || deleteMutation.isPending || bulkDeleteMutation.isPending,
  };
}
