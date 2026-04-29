import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getRubrics } from "../api/client";
import { getActiveRubricConfig } from "../constants/gradingCriteria";
import { rubricsQueryKey } from "../query";
import type { LanguageCode, RubricVersion } from "../types";

export function useRubrics() {
  return useQuery({
    queryKey: rubricsQueryKey,
    queryFn: getRubrics,
  });
}

export function useRubricList(): RubricVersion[] {
  const { data } = useRubrics();
  return data?.rubrics ?? [];
}

export function useActiveRubricConfig(
  documentType: string | null | undefined,
  language: LanguageCode,
) {
  const rubrics = useRubricList();

  return useMemo(
    () => getActiveRubricConfig(rubrics, documentType, language),
    [documentType, language, rubrics],
  );
}

export function useActiveRubric(documentType: string | null | undefined): RubricVersion | null {
  const rubrics = useRubricList();
  return rubrics.find((rubric) => rubric.document_type === documentType && rubric.active) ?? null;
}
