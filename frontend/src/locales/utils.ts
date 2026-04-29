import { DEFAULT_UI_LANGUAGE } from "../config";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "../types";

export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return SUPPORTED_LANGUAGES.includes(value as LanguageCode);
}

export function normalizeLanguage(value: string | null | undefined): LanguageCode {
  return isLanguageCode(value) ? value : DEFAULT_UI_LANGUAGE;
}

export function getLocalizedText(
  value: unknown,
  language: LanguageCode,
  fallbackLanguage: LanguageCode = DEFAULT_UI_LANGUAGE,
): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const record = value as Partial<Record<LanguageCode, unknown>>;
  const localized =
    record[language] ??
    record[fallbackLanguage] ??
    record.vi ??
    record.ja ??
    (value as Record<string, unknown>).text;
  return typeof localized === "string" ? localized : "";
}
