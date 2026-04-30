import { useEffect, useState } from "react";

import { UI_THEME_STORAGE_KEY } from "../../config";
import { LanguageSelector, useTranslation } from "../LanguageSelector";
import Badge from "../ui/Badge";
import { BellIcon, MoonIcon, SunIcon } from "../ui/Icon";

interface TopbarProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  rightBadge?: string | null;
  hideActions?: boolean;
  hideMain?: boolean;
}

export default function Topbar({ title, subtitle, breadcrumb, rightBadge, hideActions = false, hideMain = false }: TopbarProps) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem(UI_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  });
  const isMinimal = !subtitle && !breadcrumb?.length && !rightBadge && hideActions;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  }, [theme]);

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
            <button type="button" className="workspace-icon-button" aria-label={t("common.notifications")}>
              <BellIcon size="md" />
              <span className="workspace-icon-button__dot" />
            </button>
            <LanguageSelector />
          </div>
        </div>
      ) : null}
    </header>
  );
}
