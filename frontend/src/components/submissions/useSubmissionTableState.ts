import { useCallback, useState } from "react";

export function useSubmissionTableState() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const toggleSelect = useCallback((projectId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectIds = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const goPreviousPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goNextPage = useCallback((totalPages: number) => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    selectIds,
    clearSelection,
    currentPage,
    setCurrentPage,
    toggleSelect,
    goPreviousPage,
    goNextPage,
  };
}
