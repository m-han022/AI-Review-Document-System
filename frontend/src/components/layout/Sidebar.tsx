import type { ComponentType } from "react";

import { useTranslation } from "../LanguageSelector";
import { FolderIcon, HomeIcon, SettingsIcon, TemplateIcon, UploadIcon } from "../ui/Icon";
import type { IconProps } from "../ui/Icon";

export type WorkspaceView = "dashboard" | "upload" | "reviews" | "rubrics" | "detail" | "settings";

interface SidebarProps {
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
}

type NavItemKey = "navDashboard" | "navUpload" | "navAllReviews" | "navRubrics" | "navSettings";

interface NavItem {
  key: NavItemKey;
  view: Exclude<WorkspaceView, "detail">;
  icon: ComponentType<IconProps>;
  disabled?: boolean;
}

const navKeyMap: Record<NavItemKey, string> = {
  navDashboard: "nav.dashboard",
  navUpload: "nav.upload",
  navAllReviews: "nav.allReviews",
  navRubrics: "nav.rubrics",
  navSettings: "nav.settings",
};

export default function Sidebar({ activeView, onChangeView }: SidebarProps) {
  const { t } = useTranslation();

  const navItems: NavItem[] = [
    { key: "navDashboard", view: "dashboard", icon: HomeIcon },
    { key: "navUpload", view: "upload", icon: UploadIcon },
    { key: "navAllReviews", view: "reviews", icon: FolderIcon },
    { key: "navRubrics", view: "rubrics", icon: TemplateIcon },
    { key: "navSettings", view: "settings", icon: SettingsIcon, disabled: true },
  ];

  const selectedView = activeView === "detail" ? "reviews" : activeView;

  return (
    <div className="workspace-sidebar workspace-sidebar--v2">
      <div className="workspace-brand workspace-brand--v2">
        <div className="workspace-brand__logo" aria-label="Brycen Vietnam">
          <img src="/brycen-logo.png" alt="Brycen Vietnam" />
        </div>
        <div className="workspace-brand__text">
          <span className="workspace-brand__eyebrow">Brycen Vietnam</span>
          <strong>{t("nav.brandTitle")}</strong>
        </div>
      </div>

      <nav className="workspace-nav workspace-nav--v2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const translatedLabel = t(navKeyMap[item.key]);
          return (
            <button
              key={item.view}
              type="button"
              className={`workspace-nav__item workspace-nav__item--v2 ${
                selectedView === item.view ? "is-active" : ""
              }`.trim()}
              onClick={() => onChangeView(item.view)}
              disabled={item.disabled}
            >
              <span className="workspace-nav__icon">
                <Icon size="md" />
              </span>
              <span className="workspace-nav__label">{translatedLabel}</span>
              {item.disabled ? <small>{t("common.comingSoon")}</small> : null}
            </button>
          );
        })}
      </nav>

      <div className="workspace-sidebar__footer workspace-sidebar__footer--v2">
        <div className="workspace-user-card">
          <div className="workspace-user-card__meta">
            <strong>PMO/QC</strong>
            <span>Admin</span>
          </div>
          <span className="workspace-user-card__status">{t("common.ready")}</span>
        </div>
      </div>
    </div>
  );
}
