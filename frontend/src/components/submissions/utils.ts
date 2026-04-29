import type { LanguageCode, Submission } from "../../types";

export function getLanguageLabel(submission: Submission, uiLanguage: LanguageCode) {
  if (uiLanguage === "ja") {
    return submission.language === "vi" ? "ベトナム語" : "日本語";
  }

  return submission.language === "vi" ? "Tiếng Việt" : "Tiếng Nhật";
}

export function formatUploadedAt(uploadedAt: string, lang: string) {
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) {
    return uploadedAt;
  }

  return new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
