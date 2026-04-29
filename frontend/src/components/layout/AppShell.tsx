import type { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}

export default function AppShell({ sidebar, topbar, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">{sidebar}</aside>
      <div className="app-shell__main">
        <div className="app-shell__topbar">{topbar}</div>
        <div className="app-shell__content">{children}</div>
      </div>
    </div>
  );
}
