import type { LanguageCode } from "../types";
import type { DocumentType } from "./documentTypes";

type Localized = { vi: string; ja: string };

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, Localized> = {
  "project-review": { vi: "Tài liệu nhìn nhận dự án", ja: "プロジェクト振り返り資料" },
  "bug-analysis": { vi: "Tài liệu phân tích bug", ja: "バグ分析資料" },
  "qa-review": { vi: "Tài liệu QA", ja: "QA資料" },
  "explanation-review": { vi: "Tài liệu giải thích", ja: "解説資料" },
};

export const LEVEL_LABELS: Record<"low" | "medium" | "high", Localized> = {
  low: { vi: "Thấp", ja: "低" },
  medium: { vi: "Vừa", ja: "中" },
  high: { vi: "Cao", ja: "高" },
};

export function getDocumentTypeLabel(documentType: string | null | undefined, lang: LanguageCode): string {
  if (!documentType) return "—";
  const value = (DOCUMENT_TYPE_LABELS as Record<string, Localized>)[documentType];
  return value ? value[lang] : documentType;
}

export function getLevelLabel(level: string | null | undefined, lang: LanguageCode): string {
  if (!level) return "—";
  const value = (LEVEL_LABELS as Record<string, Localized>)[level];
  return value ? `${value[lang]} (${level})` : level;
}

export function getLanguageLabel(code: LanguageCode, lang: LanguageCode): string {
  if (code === "ja") return lang === "ja" ? "日本語" : "Tiếng Nhật";
  return lang === "ja" ? "ベトナム語" : "Tiếng Việt";
}
