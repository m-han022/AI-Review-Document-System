import { type ReactNode, cloneElement, isValidElement, useEffect } from "react";
import "./Layout.css";
import { XIcon } from "../ui/Icon";

interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  isSidebarOpen?: boolean;
  isCollapsed?: boolean;
  fluid?: boolean;
  onCloseSidebar?: () => void;
  onToggleSidebar?: () => void;
  onToggleCollapse?: () => void;
}

export default function AppShell({ 
  sidebar, 
  topbar, 
  children,
  isSidebarOpen = false,
  isCollapsed = false,
  fluid = false,
  onCloseSidebar,
  onToggleSidebar,
  onToggleCollapse
}: AppShellProps) {
  // Lock scroll when mobile sidebar is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.classList.add("is-sidebar-open");
    } else {
      document.body.classList.remove("is-sidebar-open");
    }
    return () => document.body.classList.remove("is-sidebar-open");
  }, [isSidebarOpen]);

  // Inject props into sidebar and topbar if they're valid elements
  const sidebarWithProps = isValidElement(sidebar)
    ? cloneElement(sidebar as any, { isCollapsed })
    : sidebar;

  const topbarWithToggle = isValidElement(topbar)
    ? cloneElement(topbar as any, { 
        onToggleSidebar,
        onToggleCollapse,
        isSidebarCollapsed: isCollapsed
      })
    : topbar;

  return (
    <div className="app-shell">
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'is-visible' : ''}`}
        onClick={onCloseSidebar}
      />

      <aside className={`app-sidebar ${isSidebarOpen ? 'is-open' : ''} ${isCollapsed ? 'app-sidebar--collapsed' : ''}`}>
        <div className="show-on-mobile" style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 60 }}>
          <button 
            type="button"
            onClick={onCloseSidebar} 
            className="mobile-toggle" 
            style={{ color: 'white' }}
            aria-label="Close Sidebar"
          >
            <XIcon />
          </button>
        </div>
        {sidebarWithProps}
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className={fluid ? "ds-container-fluid" : "ds-container"}>
            {topbarWithToggle}
          </div>
        </header>
        <main id="main-scroll-container" className="app-content">
          <div className={fluid ? "ds-container-fluid" : "ds-container"}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
