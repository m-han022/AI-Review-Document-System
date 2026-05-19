/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getLanguage, LANGUAGE_CHANGE_EVENT, setLanguage } from "../api/client";
import type { LanguageCode } from "../types";
import { getTranslation, normalizeLanguage } from "../locales/utils";
import { ChevronDownIcon } from "./ui/Icon";

const languages: { code: LanguageCode; label: string; flagUrl: string }[] = [
  { code: "vi", label: "Tiếng Việt", flagUrl: "https://flagcdn.com/w20/vn.png" },
  { code: "ja", label: "日本語", flagUrl: "https://flagcdn.com/w20/jp.png" },
  { code: "en", label: "English", flagUrl: "https://flagcdn.com/w20/us.png" },
];

interface LanguageContextValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(() => {
    return normalizeLanguage(getLanguage()) as LanguageCode;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setLangState(normalizeLanguage(getLanguage()) as LanguageCode);
    };
    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<LanguageCode>;
      setLangState(normalizeLanguage(customEvent.detail || getLanguage()) as LanguageCode);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange as EventListener);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.uiLanguage = lang;
  }, [lang]);

  const handleSetLang = (nextLang: LanguageCode) => {
    setLangState(nextLang);
    setLanguage(nextLang);
  };

  const value = useMemo<LanguageContextValue>(() => {
    const t = (key: string, params?: Record<string, string | number>) => {
      let value = getTranslation(lang, key);

      if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          value = value.replace(`{${paramKey}}`, String(paramValue));
        }
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
  const { lang, setLang, t } = useTranslation();
  const selectedLang = languages.find((l) => l.code === lang) || languages[0];

  return (
    <div className="language-selector" style={{ display: "inline-flex", alignItems: "center", position: "relative", gap: "6px" }}>
      <img
        src={selectedLang.flagUrl}
        alt={selectedLang.label}
        style={{ width: "20px", height: "auto", borderRadius: "2px", boxShadow: "0 1px 2px rgba(0,0,0,0.15)", objectFit: "cover" }}
      />
      <select
        value={lang}
        onChange={(event) => setLang(event.target.value as LanguageCode)}
        className="language-select"
        aria-label={t("common.language")}
        style={{ paddingLeft: "2px" }}
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


