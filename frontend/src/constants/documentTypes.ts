import type { LanguageCode } from "../types";
import { getCriteriaConfig } from "./gradingCriteria";

export type DocumentType = "project-review" | "bug-analysis" | "qa-review" | "explanation-review";

export interface DocumentTypeOption {
  id: DocumentType;
  labelKey: string;
  descKey: string;
}

export const DOCUMENT_TYPE_OPTIONS: DocumentTypeOption[] = [
  {
    id: "project-review",
    labelKey: "upload.types.projectReview.label",
    descKey: "upload.types.projectReview.desc",
  },
  {
    id: "bug-analysis",
    labelKey: "upload.types.bugAnalysis.label",
    descKey: "upload.types.bugAnalysis.desc",
  },
  {
    id: "qa-review",
    labelKey: "upload.types.qaReview.label",
    descKey: "upload.types.qaReview.desc",
  },
  {
    id: "explanation-review",
    labelKey: "upload.types.explanationReview.label",
    descKey: "upload.types.explanationReview.desc",
  },
];

export function getDocumentTypeKey(documentType: string | null | undefined): string {
  const matched = DOCUMENT_TYPE_OPTIONS.find((option) => option.id === documentType) ?? DOCUMENT_TYPE_OPTIONS[0];
  return matched.labelKey;
}

export function getDocumentTypeCriteriaPreview(
  documentType: string | null | undefined,
  language: LanguageCode,
): string[] {
  const config = getCriteriaConfig(documentType, language);

  return config.order.map((criterionKey) => {
    const label = config.labels[criterionKey] ?? criterionKey;
    const maxScore = config.maxScores[criterionKey];
    return maxScore ? `${label} /${maxScore}` : label;
  });
}
