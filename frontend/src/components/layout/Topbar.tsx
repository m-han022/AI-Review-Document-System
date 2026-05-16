import { useEffect, useState, type ReactNode } from "react";
import { UI_THEME_STORAGE_KEY } from "../../config";
import { LanguageSelector } from "../LanguageSelector";
import { MenuIcon, MoonIcon, SunIcon } from "../ui/Icon";
import "./Layout.css";

interface TopbarProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  rightBadge?: string | null;
  hideActions?: boolean;
  hideMain?: boolean;
  dashboardChrome?: boolean;
  onToggleSidebar?: () => void;
  onToggleCollapse?: () => void;
  onBreadcrumbClick?: (index: number) => void;
  actions?: ReactNode;
  mode?: "default" | "detail" | "minimal";
}

export default function Topbar({
  title,
  subtitle,
  breadcrumb,
  rightBadge,
  hideActions = false,
  hideMain = false,
  onToggleSidebar,
  onBreadcrumbClick,
  actions,
  mode = "default",
}: TopbarProps) {
  const isDetailMode = mode === "detail";
  const isMinimalMode = mode === "minimal";
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem(UI_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <>
      <div className="app-topbar__left">
        <button className="mobile-toggle" onClick={onToggleSidebar} aria-label="Toggle Menu">
          <MenuIcon />
        </button>
        {!hideMain && !isMinimalMode && (
          <div className="app-topbar__page-info">
            {isDetailMode && breadcrumb && breadcrumb.length > 0 && (
              <nav className="app-breadcrumb app-breadcrumb--top" aria-label="Breadcrumb">
                {breadcrumb.map((item, index) => (
                  <span key={item} className="app-breadcrumb__item">
                    <button
                      type="button"
                      className={`app-breadcrumb__btn ${index === breadcrumb.length - 1 ? "is-active" : ""}`}
                      onClick={() => onBreadcrumbClick?.(index)}
                      disabled={index === breadcrumb.length - 1}
                    >
                      {item}
                    </button>
                    {index < breadcrumb.length - 1 && <span className="app-breadcrumb__sep">/</span>}
                  </span>
                ))}
              </nav>
            )}
            <div className="app-topbar__title-row">
              <h1 className="app-topbar__title">
                {isDetailMode && subtitle ? `${title} - ${subtitle}` : title}
              </h1>
              {rightBadge && <span className="app-topbar__badge">{rightBadge}</span>}
            </div>
            {!isDetailMode && subtitle && <p className="app-topbar__subtitle">{subtitle}</p>}
          </div>
        )}

        {!isDetailMode && !isMinimalMode && breadcrumb && breadcrumb.length > 0 && (
          <nav className="app-breadcrumb" aria-label="Breadcrumb">
            {breadcrumb.map((item, index) => (
              <span key={item} className="app-breadcrumb__item">
                <button
                  type="button"
                  className={`app-breadcrumb__btn ${index === breadcrumb.length - 1 ? "is-active" : ""}`}
                  onClick={() => onBreadcrumbClick?.(index)}
                  disabled={index === breadcrumb.length - 1}
                >
                  {item}
                </button>
                {index < breadcrumb.length - 1 && <span className="app-breadcrumb__sep">/</span>}
              </span>
            ))}
          </nav>
        )}
      </div>

      {!hideActions && (
        <div className="app-topbar__actions">
          {actions}
          <div className="app-topbar__divider" />
          <button
            type="button"
            className="ds-button ds-button--ghost ds-button--sm"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
            title={theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
          >
            {theme === "dark" ? <SunIcon size="md" /> : <MoonIcon size="md" />}
          </button>
          <div className="app-topbar__divider" />
          <LanguageSelector />
        </div>
      )}
    </>
  );
}
