import vi from './vi.json';
import ja from './ja.json';
import en from './en.json';

export type Language = 'vi' | 'ja' | 'en';

export const translations = {
  vi,
  ja,
  en
} as const;

export const normalizeLanguage = (lang: string | undefined): Language => {
  if (!lang) return 'vi';
  const l = lang.toLowerCase();
  if (l.startsWith('vi')) return 'vi';
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('en')) return 'en';
  return 'vi';
};

export const getTranslation = (lang: Language, key: string, fallback?: string): string => {
  const parts = key.split('.');
  let current: any = translations[lang];

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      // Fallback to Vietnamese if key not found in current language
      if (lang !== 'vi') {
        return getTranslation('vi', key, fallback || key);
      }
      return fallback || key;
    }
  }

  return typeof current === 'string' ? current : (fallback || key);
};

export function getLocalizedText(obj: any, lang: string): string {
  if (!obj) return "";
  let targetObj = obj;
  if (typeof obj === "string") {
    try {
      const parsed = JSON.parse(obj);
      if (parsed && typeof parsed === "object") {
        targetObj = parsed;
      } else {
        return obj;
      }
    } catch {
      return obj;
    }
  }
  if (targetObj && typeof targetObj === "object") {
    const val = targetObj[lang] || targetObj["ja"] || targetObj["vi"] || Object.values(targetObj)[0] || "";
    return typeof val === "string" ? val : String(val);
  }
  return "";
}
