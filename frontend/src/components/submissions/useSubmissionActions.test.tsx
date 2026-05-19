import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "../../types";
import { useSubmissionActions } from "./useSubmissionActions";

vi.mock("../../api/client", () => ({
  gradeSubmission: vi.fn(),
  deleteSubmission: vi.fn(),
  bulkDeleteSubmissions: vi.fn(),
}));

import { bulkDeleteSubmissions, deleteSubmission, gradeSubmission } from "../../api/client";

const sampleProjects: Project[] = [
  { project_id: "P001", project_name: "Alpha", total_documents: 1, latest_score: 90 } as Project,
  { project_id: "P002", project_name: "Beta", total_documents: 2, latest_score: null } as Project,
];

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useSubmissionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grades successfully and pushes success toast", async () => {
    vi.mocked(gradeSubmission).mockResolvedValue({} as never);
    const onClearSelection = vi.fn();
    const { result } = renderHook(
      () => useSubmissionActions({ projects: sampleProjects, t: (k) => k, onClearSelection }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleGrade("P001");
    });

    expect(vi.mocked(gradeSubmission).mock.calls[0]?.[0]).toEqual({ projectId: "P001", force: true });
    expect(result.current.toasts.at(-1)?.tone).toBe("success");
  });

  it("opens and confirms bulk delete then clears selection", async () => {
    vi.mocked(bulkDeleteSubmissions).mockResolvedValue({} as never);
    const onClearSelection = vi.fn();
    const { result } = renderHook(
      () => useSubmissionActions({ projects: sampleProjects, t: (k) => k, onClearSelection }),
      { wrapper },
    );

    act(() => {
      result.current.openDeleteDialog(["P001", "P002"], "selected");
    });
    expect(result.current.pendingDelete?.projectIds).toEqual(["P001", "P002"]);

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(vi.mocked(bulkDeleteSubmissions).mock.calls[0]?.[0]).toEqual(["P001", "P002"]);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.pendingDelete).toBeNull());
  });

  it("confirms single delete path", async () => {
    vi.mocked(deleteSubmission).mockResolvedValue({} as never);
    const onClearSelection = vi.fn();
    const { result } = renderHook(
      () => useSubmissionActions({ projects: sampleProjects, t: (k) => k, onClearSelection }),
      { wrapper },
    );

    act(() => {
      result.current.openDeleteDialog(["P001"], "single");
    });
    await act(async () => {
      await result.current.confirmDelete();
    });
    expect(vi.mocked(deleteSubmission).mock.calls[0]?.[0]).toBe("P001");
  });
});
