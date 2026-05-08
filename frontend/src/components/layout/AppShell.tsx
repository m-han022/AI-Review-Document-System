import { useState, type ReactNode, cloneElement, isValidElement } from "react";
import "./Layout.css";
import { MenuIcon, XIcon } from "../ui/Icon";

interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  isSidebarOpen?: boolean;
  isCollapsed?: boolean;
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
  onCloseSidebar,
  onToggleSidebar,
  onToggleCollapse
}: AppShellProps) {
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
          <button onClick={onCloseSidebar} className="mobile-toggle" style={{ color: 'white' }}>
            <XIcon />
          </button>
        </div>
        {sidebarWithProps}
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          {topbarWithToggle}
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
