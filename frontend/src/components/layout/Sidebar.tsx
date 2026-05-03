import { aiReviewAssets } from "../../assets/aiReviewAssets";
import brandHeaderImage from "../../assets/dashboard-reference/cropped/brand-header.png";
import statusCardImage from "../../assets/dashboard-reference/cropped/status-card-inner.png";
import { useTranslation } from "../LanguageSelector";
import { SparkIcon } from "../ui/Icon";

export type WorkspaceView =
  | "dashboard"
  | "upload"
  | "reviews"
  | "report"
  | "rubrics"
  | "workflow"
  | "export"
  | "detail"
  | "settings";

interface SidebarProps {
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
}

type NavItemKey =
  | "navDashboard"
  | "navUpload"
  | "navAllReviews"
  | "navReport"
  | "navRubrics"
  | "navWorkflow"
  | "navExport"
  | "navSettings";

interface NavItem {
  key: NavItemKey;
  view: Exclude<WorkspaceView, "detail">;
  iconSrc: string;
}

const navKeyMap: Record<NavItemKey, string> = {
  navDashboard: "nav.dashboard",
  navUpload: "nav.upload",
  navAllReviews: "nav.allReviews",
  navReport: "nav.qualityReport",
  navRubrics: "nav.rubrics",
  navWorkflow: "nav.approvalWorkflow",
  navExport: "nav.export",
  navSettings: "nav.settings",
};

export default function Sidebar({ activeView, onChangeView }: SidebarProps) {
  const { t } = useTranslation();
  const selectedView = activeView === "detail" ? "reviews" : activeView;

  const navItems: NavItem[] = [
    { key: "navDashboard", view: "dashboard", iconSrc: aiReviewAssets.sidebarIcons.dashboard },
    { key: "navUpload", view: "upload", iconSrc: aiReviewAssets.sidebarIcons.document },
    { key: "navAllReviews", view: "reviews", iconSrc: aiReviewAssets.sidebarIcons.reviewHistory },
    { key: "navReport", view: "report", iconSrc: aiReviewAssets.sidebarIcons.qualityReport },
    { key: "navRubrics", view: "rubrics", iconSrc: aiReviewAssets.sidebarIcons.compare },
    { key: "navWorkflow", view: "workflow", iconSrc: aiReviewAssets.sidebarIcons.workflow },
    { key: "navExport", view: "export", iconSrc: aiReviewAssets.sidebarIcons.export },
    { key: "navSettings", view: "settings", iconSrc: aiReviewAssets.sidebarIcons.settings },
  ];

  return (
    <div className="workspace-sidebar workspace-sidebar--v3">
      <div className="workspace-brand workspace-brand--v3">
        <img className="workspace-brand__image" src={brandHeaderImage} alt="AI Review" />
      </div>

      <nav className="workspace-nav workspace-nav--v3">
        {navItems.map((item) => {
          const isActive = selectedView === item.view;

          return (
            <button
              key={`${item.key}-${item.view}`}
              type="button"
              className={`workspace-nav__item workspace-nav__item--v3 ${isActive ? "is-active" : ""}`.trim()}
              onClick={() => onChangeView(item.view)}
            >
              <span className="workspace-nav__icon">
                <img src={item.iconSrc} alt="" aria-hidden="true" />
              </span>
              <span className="workspace-nav__label">{t(navKeyMap[item.key])}</span>
              {isActive ? (
                <span className="workspace-nav__spark" aria-hidden="true">
                  <SparkIcon size="sm" />
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="workspace-sidebar__footer workspace-sidebar__footer--v3">
        <div className="workspace-ai-card workspace-ai-card--v3">
          <img
            className="workspace-ai-card__robot-image"
            src={aiReviewAssets.aiRobotIllustration}
            alt=""
            aria-hidden="true"
          />
        </div>

        <div className="workspace-status-card workspace-status-card--image">
          <img className="workspace-status-card__image" src={statusCardImage} alt="" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
