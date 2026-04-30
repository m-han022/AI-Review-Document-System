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

export const submissionsQueryKey = ["submissions"];
export const submissionDetailQueryKey = (projectId: string) => ["submission", projectId];
export const rubricsQueryKey = ["rubrics"];
