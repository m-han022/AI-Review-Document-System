import { useEffect, useRef, useState, type CSSProperties } from "react";

import { aiReviewAssets } from "../../assets/aiReviewAssets";
import { getLanguageLabel } from "../../constants/uiLabels";
import { UI_THEME_STORAGE_KEY } from "../../config";
import type { LanguageCode } from "../../types";
import { LanguageSelector, useTranslation } from "../LanguageSelector";
import Badge from "../ui/Badge";
import { ChevronDownIcon, DownloadIcon, GlobeIcon, MoonIcon, SunIcon } from "../ui/Icon";

interface TopbarProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  rightBadge?: string | null;
  hideActions?: boolean;
  hideMain?: boolean;
  dashboardChrome?: boolean;
}

export default function Topbar({
  title,
  subtitle,
  breadcrumb,
  rightBadge,
  hideActions = false,
  hideMain = false,
  dashboardChrome = false,
}: TopbarProps) {
  const { lang, setLang, t } = useTranslation();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem(UI_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  });
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const isMinimal = !subtitle && !breadcrumb?.length && !rightBadge && hideActions;

  const languageOptions: { code: LanguageCode; label: string }[] =
    (["ja", "vi"] as LanguageCode[]).map((code) => ({ code, label: getLanguageLabel(code, lang) }));

  const currentLanguageLabel = languageOptions.find((item) => item.code === lang)?.label ?? "日本語";

  const reportLabel = lang === "ja" ? "レポート出力" : "Xuất báo cáo";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!isLanguageMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLanguageMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isLanguageMenuOpen]);

  if (dashboardChrome) {
    const showGlobalExport = !hideMain; // Using hideMain as a proxy to hide the redundant global export

    return (
      <header
        className="workspace-topbar workspace-topbar--v3"
        style={{ "--ai-review-header-bg": `url(${aiReviewAssets.headerLightAi})` } as CSSProperties}
      >
        <div className="workspace-topbar__left">
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="workspace-topbar__breadcrumb" aria-label="Breadcrumb">
              {breadcrumb.map((item, index) => (
                <span key={item}>
                  {item}
                  {index < breadcrumb.length - 1 && <span className="workspace-topbar__breadcrumb-sep">/</span>}
                </span>
              ))}
            </nav>
          )}
        </div>

        <div className="workspace-topbar-reference-actions workspace-topbar-reference-actions--v3">
          <div
            className={`workspace-topbar-language ${isLanguageMenuOpen ? "is-open" : ""}`.trim()}
            ref={languageMenuRef}
          >
            <button
              type="button"
              className="workspace-topbar-pill workspace-topbar-pill--language"
              aria-label={t("common.language")}
              aria-expanded={isLanguageMenuOpen}
              aria-haspopup="menu"
              onClick={() => setIsLanguageMenuOpen((current) => !current)}
            >
              <GlobeIcon size="sm" />
              <span className="workspace-topbar-pill__label">{currentLanguageLabel}</span>
              <ChevronDownIcon size="sm" />
            </button>

            {isLanguageMenuOpen ? (
              <div className="workspace-topbar-language__menu" role="menu" aria-label={t("common.language")}>
                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={lang === option.code}
                    className={`workspace-topbar-language__option ${lang === option.code ? "is-active" : ""}`.trim()}
                    onClick={() => {
                      setLang(option.code);
                      setIsLanguageMenuOpen(false);
                    }}
                  >
                    <span className="workspace-topbar-language__option-label">{option.label}</span>
                    {lang === option.code ? <span className="workspace-topbar-language__check">✓</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="workspace-icon-button workspace-icon-button--theme"
            aria-label={t("common.theme")}
            title={t("common.theme")}
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <SunIcon size="md" /> : <MoonIcon size="md" />}
          </button>

          {showGlobalExport && (
            <button type="button" className="workspace-report-button workspace-report-button--v3">
              <DownloadIcon size="sm" />
              <span className="workspace-report-button__label">{reportLabel}</span>
            </button>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className={`workspace-topbar workspace-topbar--v2 ${isMinimal ? "workspace-topbar--minimal" : ""}`.trim()}>
      {!hideMain ? (
        <div className="workspace-topbar__main">
          {breadcrumb?.length ? (
            <div className="workspace-breadcrumbs">
              {breadcrumb.map((item, index) => (
                <span key={`${item}-${index}`} className="workspace-breadcrumbs__item">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
          <div
            className={`workspace-topbar__title-group ${
              !subtitle ? "workspace-topbar__title-group--single" : ""
            }`.trim()}
          >
            <h1 className="workspace-topbar__page-title">{title}</h1>
            {subtitle ? <p className="workspace-topbar__page-subtitle">{subtitle}</p> : null}
          </div>
        </div>
      ) : null}

      {!hideActions ? (
        <div className="workspace-topbar__actions workspace-topbar__actions--v2">
          {rightBadge ? <Badge tone="primary">{rightBadge}</Badge> : null}
          <div className="workspace-topbar__tools">
            <button
              type="button"
              className="workspace-icon-button"
              aria-label={t("common.theme")}
              title={t("common.theme")}
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <SunIcon size="md" /> : <MoonIcon size="md" />}
            </button>
            <LanguageSelector />
          </div>
        </div>
      ) : null}
    </header>
  );
}

