/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getLanguage, LANGUAGE_CHANGE_EVENT, setLanguage } from "../api/client";
import type { LanguageCode } from "../types";
import { normalizeLanguage } from "../locales/utils";
import { ChevronDownIcon } from "./ui/Icon";

const languages: { code: LanguageCode; label: string }[] = [
  { code: "vi", label: "Ti\u1ebfng Vi\u1ec7t" },
  { code: "ja", label: "\u65e5\u672c\u8a9e" },
];

import { translations } from "../locales/dictionary";

interface LanguageContextValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(() => {
    return normalizeLanguage(getLanguage());
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setLangState(normalizeLanguage(getLanguage()));
    };
    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<LanguageCode>;
      setLangState(normalizeLanguage(customEvent.detail || getLanguage()));
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange as EventListener);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "ja" ? "ja" : "vi";
    document.documentElement.dataset.uiLanguage = lang;
  }, [lang]);

  const handleSetLang = (nextLang: LanguageCode) => {
    setLangState(nextLang);
    setLanguage(nextLang);
  };

  const value = useMemo<LanguageContextValue>(() => {
    const t = (key: string, params?: Record<string, string | number>) => {
      const keys = key.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = translations[lang];

      for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
          value = value[k];
        } else {
          // Fallback to Vietnamese if key not found in current language
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let fallback: any = translations.vi;
          for (const fk of keys) {
            if (fallback && typeof fallback === "object" && fk in fallback) {
              fallback = fallback[fk];
            } else {
              return key;
            }
          }
          value = fallback;
          break;
        }
      }

      if (typeof value !== "string") {
        return key;
      }

      if (params) {
        let result = value;
        for (const [paramKey, paramValue] of Object.entries(params)) {
          result = result.replace(`{${paramKey}}`, String(paramValue));
        }
        return result;
      }

      return value;
    };

    return {
      lang,
      setLang: handleSetLang,
      t,
    };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function LanguageSelector() {
  const { lang, setLang } = useTranslation();

  return (
    <div className="language-selector">
      <select
        value={lang}
        onChange={(event) => setLang(event.target.value as LanguageCode)}
        className="language-select"
        aria-label="Language"
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
      <span className="language-selector__icon" aria-hidden="true">
        <ChevronDownIcon size="sm" />
      </span>
    </div>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within LanguageProvider");
  }
  return context;
}
