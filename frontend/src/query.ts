import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const projectsQueryKey = ["projects"];
export const projectDocumentsQueryKey = (projectId: string) => ["project", projectId, "documents"];
export const documentVersionsQueryKey = (documentId: number) => ["document", documentId, "versions"];
export const versionGradingsQueryKey = (versionId: number) => ["version", versionId, "gradings"];
export const gradingRunDetailQueryKey = (runId: number) => ["grading-run", runId];
export const versionComparisonQueryKey = (docId: number, baseId: number, compareId: number) => ["comparison", docId, baseId, compareId];

export const submissionsQueryKey = ["submissions"];
export const submissionDetailQueryKey = (projectId: string) => ["submission", projectId];
export const submissionDocumentsQueryKey = (projectId: string) => ["submission", projectId, "documents"];
export const submissionVersionsQueryKey = (projectId: string) => ["submission", projectId, "versions"];
export const submissionGradingRunsQueryKey = (projectId: string) => ["submission", projectId, "grading-runs"];
export const rubricsQueryKey = ["rubrics"];
