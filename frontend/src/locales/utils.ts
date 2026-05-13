import vi from './vi.json';
import ja from './ja.json';
import en from './en.json';

export type Language = 'vi' | 'ja' | 'en';

export const translations = {
  vi,
  ja,
  en
} as const;

function normalizeMojibake(value: string): string {
  return value;
}

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

  return typeof current === 'string' ? normalizeMojibake(current) : normalizeMojibake(fallback || key);
};

export function getLocalizedText(obj: any, lang: string): string {
  if (!obj) return "";
  const normalizedLang = normalizeLanguage(lang);
  const resolve = (value: any, preferredLang: string): string => {
    if (value == null) return "";
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") {
          return resolve(parsed, preferredLang);
        }
      } catch {
        // Plain string
      }
      return normalizeMojibake(trimmed);
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return normalizeMojibake(String(value));
    }
    if (Array.isArray(value)) {
      const parts = value.map((v) => resolve(v, preferredLang)).filter(Boolean);
      return parts.join("\n");
    }
    if (typeof value === "object") {
      const candidate =
        value[preferredLang] ??
        value[normalizeLanguage(preferredLang)] ??
        value.vi ??
        value.en ??
        value.ja ??
        Object.values(value)[0];
      return resolve(candidate, preferredLang);
    }
    return "";
  };
  return resolve(obj, normalizedLang);
}
