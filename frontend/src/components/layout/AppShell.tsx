import { useState, type ReactNode, cloneElement, isValidElement } from "react";
import "./Layout.css";
import { MenuIcon, XIcon } from "../ui/Icon";

interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}

export default function AppShell({ sidebar, topbar, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  // Inject props into sidebar and topbar if they're valid elements
  const sidebarWithProps = isValidElement(sidebar)
    ? cloneElement(sidebar as any, { isCollapsed })
    : sidebar;

  const topbarWithToggle = isValidElement(topbar)
    ? cloneElement(topbar as any, { 
        onToggleSidebar: toggleSidebar,
        onToggleCollapse: toggleCollapse,
        isSidebarCollapsed: isCollapsed
      })
    : topbar;

  return (
    <div className="app-shell">
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'is-visible' : ''}`}
        onClick={closeSidebar}
      />

      <aside className={`app-sidebar ${isSidebarOpen ? 'is-open' : ''} ${isCollapsed ? 'app-sidebar--collapsed' : ''}`}>
        <div className="show-on-mobile" style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 60 }}>
          <button onClick={closeSidebar} className="mobile-toggle" style={{ color: 'white' }}>
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
