import { useEffect, useState } from "react";
import { UI_THEME_STORAGE_KEY } from "../../config";
import { LanguageSelector } from "../LanguageSelector";
import { LayoutIcon, MenuIcon, MoonIcon, SunIcon } from "../ui/Icon";
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
  isSidebarCollapsed?: boolean;
}

export default function Topbar({
  title,
  subtitle,
  breadcrumb,
  rightBadge,
  hideActions = false,
  hideMain = false,
  onToggleSidebar,
  onToggleCollapse,
}: TopbarProps) {
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
        <button 
          className="ds-button ds-button--ghost ds-button--sm hide-on-mobile" 
          onClick={onToggleCollapse} 
          style={{ marginRight: 'var(--ds-space-2)' }}
          title="Toggle Sidebar"
        >
          <LayoutIcon size="sm" />
        </button>
        {!hideMain && (
          <div className="app-topbar__page-info">
            <div className="app-topbar__title-row">
              <h1 className="app-topbar__title">{title}</h1>
              {rightBadge && <span className="app-topbar__badge">{rightBadge}</span>}
            </div>
            {subtitle && <p className="app-topbar__subtitle">{subtitle}</p>}
          </div>
        )}

        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="app-breadcrumb" aria-label="Breadcrumb">
            {breadcrumb.map((item, index) => (
              <span key={item} className="app-breadcrumb__item">
                <span className={index === breadcrumb.length - 1 ? "is-active" : ""}>
                  {item}
                </span>
                {index < breadcrumb.length - 1 && <span className="app-breadcrumb__sep">/</span>}
              </span>
            ))}
          </nav>
        )}
      </div>

      {!hideActions && (
        <div className="app-topbar__actions">
          <button
            type="button"
            className="ds-button ds-button--ghost ds-button--sm"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
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
