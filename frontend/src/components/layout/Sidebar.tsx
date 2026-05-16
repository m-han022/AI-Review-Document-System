import { useTranslation } from "../LanguageSelector";
import { 
  HomeIcon, 
  HistoryIcon, 
  UploadIcon, 
  LayersIcon, 
  DownloadIcon, 
  BookOpenIcon, 
  SettingsIcon, 
  ShieldCheckIcon, 
  WorkflowIcon 
} from "../ui/Icon";
import "./Layout.css";

export type WorkspaceView =
  | "dashboard"
  | "upload"
  | "reviews"
  | "diff"
  | "report"
  | "rubrics"
  | "workflow"
  | "export"
  | "detail"
  | "settings";

interface SidebarProps {
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  isCollapsed?: boolean;
}

interface NavItem {
  labelKey: string;
  view: Exclude<WorkspaceView, "detail">;
  icon: React.ElementType;
}

interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

export default function Sidebar({ activeView, onChangeView, isCollapsed = false }: SidebarProps) {
  const { t } = useTranslation();
  const selectedView: Exclude<WorkspaceView, "detail"> = activeView === "detail" ? "reviews" : activeView;

  const navGroups: NavGroup[] = [
    {
      titleKey: "nav.groupMonitor",
      items: [
        { labelKey: "nav.dashboard", view: "dashboard", icon: HomeIcon },
        { labelKey: "nav.allReviews", view: "reviews", icon: HistoryIcon },
      ],
    },
    {
      titleKey: "nav.groupOperate",
      items: [
        { labelKey: "nav.upload", view: "upload", icon: UploadIcon },
        { labelKey: "nav.versionDiff", view: "diff", icon: LayersIcon },
        { labelKey: "nav.export", view: "export", icon: DownloadIcon },
      ],
    },
    {
      titleKey: "nav.groupGovern",
      items: [
        { labelKey: "nav.qualityReport", view: "report", icon: BookOpenIcon },
        { labelKey: "nav.rubrics", view: "rubrics", icon: ShieldCheckIcon },
        { labelKey: "nav.approvalWorkflow", view: "workflow", icon: WorkflowIcon },
      ],
    },
    {
      titleKey: "nav.groupConfigure",
      items: [{ labelKey: "nav.settings", view: "settings", icon: SettingsIcon }],
    },
  ];

  return (
    <>
      <div className="app-sidebar__brand">
        <div style={{ color: 'var(--ds-color-accent)', fontWeight: 800, fontSize: '20px' }}>
          {isCollapsed ? t("common.appName").charAt(0) : t("common.appName")}
        </div>
      </div>

      <nav className="app-sidebar__nav">
        {navGroups.map((group) => (
          <div key={group.titleKey} className="nav-group">
            <p className="nav-group__title">{t(group.titleKey)}</p>
            {group.items.map((item) => {
              const isActive = selectedView === item.view;
              const Icon = item.icon;
              return (
                <button
                  key={item.view}
                  type="button"
                  className={`nav-item ${isActive ? "is-active" : ""}`}
                  onClick={() => onChangeView(item.view)}
                >
                  <Icon size="md" />
                  <span>{t(item.labelKey)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
