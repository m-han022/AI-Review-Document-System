import type { LanguageCode, RubricVersion } from "../types";

export interface CriteriaConfig {
  order: string[];
  maxScores: Record<string, number>;
  labels: Record<string, string>;
}

export function criteriaConfigFromRubric(
  rubric: RubricVersion | null | undefined,
  language: LanguageCode,
): CriteriaConfig | null {
  if (!rubric) {
    return null;
  }

  return {
    order: rubric.criteria.map((criterion) => criterion.key),
    maxScores: Object.fromEntries(rubric.criteria.map((criterion) => [criterion.key, criterion.max_score])),
    labels: Object.fromEntries(
      rubric.criteria.map((criterion) => [criterion.key, criterion.labels[language] ?? criterion.labels.ja ?? criterion.key]),
    ),
  };
}

export function getCriteriaConfig(
  rubric: RubricVersion | null | undefined,
  language: LanguageCode,
): CriteriaConfig {
  return (
    criteriaConfigFromRubric(rubric, language) ?? {
      order: [],
      maxScores: {},
      labels: {},
    }
  );
}

export function getActiveRubricConfig(
  rubrics: RubricVersion[] | undefined,
  documentType: string | null | undefined,
  language: LanguageCode,
): CriteriaConfig {
  const activeRubric = rubrics?.find((rubric) => rubric.document_type === documentType && rubric.active);
  return getCriteriaConfig(activeRubric, language);
}
