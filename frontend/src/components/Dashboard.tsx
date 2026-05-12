import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listProjects } from "../api/client";
import { projectsQueryKey } from "../query";
import type { Project } from "../types";
import { useTranslation } from "./LanguageSelector";
import AppShell from "./layout/AppShell";
import Sidebar, { type WorkspaceView } from "./layout/Sidebar";
import Topbar from "./layout/Topbar";
import { EmptyState, ErrorState, LoadingState, SkeletonTable } from "./ui/States";
import { PlusIcon } from "./ui/Icon";
import { Button, Card, ErrorBoundary } from "./ui";
import { toHumanErrorMessage } from "../utils/humanizeError";

const DashboardOverview = lazy(() => import("./dashboard/DashboardOverview"));
const FileUpload = lazy(() => import("./FileUpload"));
import ProjectCard from "./project/ProjectCard";
const ReviewListOverview = lazy(() => import("./reviews/ReviewListOverview"));
const AIConfigurationConsole = lazy(() => import("./rubrics/AIConfigurationConsole"));
const AuditDashboard = lazy(() => import("./workspace/AuditDashboard"));
const VersionDiffDashboard = lazy(() => import("./workspace/VersionDiffDashboard"));
const OperationalScreen = lazy(() => import("./workspace/OperationalScreens"));

function ViewFallback({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <div className="workspace-stack">
      <Card title={title}>
        <LoadingState title={title} description={t("common.loading")} />
        <div style={{ marginTop: '24px' }}>
          <SkeletonTable rows={4} cols={4} />
        </div>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [topbarActions, setTopbarActions] = useState<React.ReactNode>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<string>;
      const projectId = custom.detail;
      if (!projectId) return;
      setSelectedProjectId(projectId);
      setActiveView("detail");
    };
    window.addEventListener("open-project-detail", handler as EventListener);
    return () => window.removeEventListener("open-project-detail", handler as EventListener);
  }, []);

  const { data: projectsData, isLoading, error } = useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => listProjects(),
    refetchInterval: (query) => {
      const projects = Array.isArray(query.state.data) ? query.state.data as Project[] : [];
      const hasPending = projects.some(p => {
        const s = p.latest_status?.toLowerCase();
        return s === "pending" || s === "extracting" || s === "grading";
      });
      return hasPending ? 3000 : false;
    }
  });

  const projects: Project[] = useMemo(() => (Array.isArray(projectsData) ? projectsData : []), [projectsData]);
  const selectedProject = useMemo(
    () => projects.find((item) => item.project_id === selectedProjectId) ?? projects[0] ?? null,
    [selectedProjectId, projects],
  );

  const topbarContent = useMemo(() => {
    switch (activeView) {
      case "upload":
        return {
          title: t("upload.pageTitle"),
          subtitle: t("upload.pageSubtitle"),
          breadcrumb: [t("sm.audit.project"), t("nav.upload")],
          rightBadge: null,
          hideMain: false,
        };
      case "reviews":
        return {
          title: t("submissions.title"),
          subtitle: t("submissions.subtitle"),
          breadcrumb: [t("sm.audit.project"), t("nav.allReviews")],
          rightBadge: t("submissions.count", { count: projects.length }),
          hideMain: false,
        };
      case "detail":
        return {
          title: selectedProject?.project_name ?? t("project.reviewResult"),
          subtitle: t("project.reviewDetailSubtitle"),
          breadcrumb: [t("sm.audit.project"), selectedProject?.project_name ?? "", t("project.reviewResult")],
          rightBadge: null,
          hideMain: false,
        };
      case "rubrics":
        return {
          title: t("rubric.pageTitle"),
          subtitle: t("rubric.pageSubtitle"),
          breadcrumb: [t("sm.audit.project"), t("nav.rubrics")],
          rightBadge: null,
          hideMain: false,
        };
      case "report":
        return {
          title: t("nav.qualityReport"),
          subtitle: undefined,
          breadcrumb: [t("sm.audit.project"), t("nav.qualityReport")],
          rightBadge: null,
          hideMain: false,
        };
      case "diff":
        return {
          title: t("nav.versionDiff"),
          subtitle: t("biz.versionDiff.subtitle"),
          breadcrumb: [t("sm.audit.project"), t("nav.versionDiff")],
          rightBadge: null,
          hideMain: false,
        };
      case "workflow":
        return {
          title: t("nav.approvalWorkflow"),
          subtitle: undefined,
          breadcrumb: [t("sm.audit.project"), t("nav.approvalWorkflow")],
          rightBadge: null,
          hideMain: false,
        };
      case "export":
        return {
          title: t("nav.export"),
          subtitle: undefined,
          breadcrumb: [t("sm.audit.project"), t("nav.export")],
          rightBadge: null,
          hideMain: false,
        };
      case "settings":
        return {
          title: t("nav.settings"),
          subtitle: undefined,
          breadcrumb: [t("sm.audit.project"), t("nav.settings")],
          rightBadge: null,
          hideMain: false,
        };
      case "dashboard":
      default:
        return {
          title: t("nav.dashboard"),
          subtitle: t("dashboard.subtitle"),
          breadcrumb: undefined,
          rightBadge: null,
          hideMain: false,
        };
    }
  }, [activeView, selectedProject, projects.length, t]);

  const content = (() => {
    if (error) {
      return (
        <div className="workspace-stack">
          <Card>
            <ErrorState 
              title={t("common.error")} 
              description={toHumanErrorMessage(error, t("api.project.fetchFailed"))} 
            />
          </Card>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="workspace-stack">
          <Card title={t("common.loading")}>
            <LoadingState 
              title={t("common.loading")} 
              description={t("nav.dashboard")} 
            />
            <div style={{ marginTop: '24px' }}>
              <SkeletonTable rows={5} cols={4} />
            </div>
          </Card>
        </div>
      );
    }

    switch (activeView) {
      case "upload":
        return (
          <Suspense fallback={<ViewFallback title={t("upload.pageTitle")} />}>
            <FileUpload
              onReviewComplete={(projectId) => {
                setSelectedProjectId(projectId);
                setActiveView("detail");
              }}
            />
          </Suspense>
        );
      case "reviews":
        return (
          <Suspense fallback={<ViewFallback title={t("submissions.title")} />}>
            <ReviewListOverview
              projects={projects}
              activeProjectId={selectedProject?.project_id ?? null}
              onSelectProject={(projectId) => {
                setSelectedProjectId(projectId);
                setActiveView("detail");
              }}

            />
          </Suspense>
        );
      case "detail":
        if (!selectedProjectId) {
          return (
            <Card title={t("project.reviewResult")}>
              <EmptyState 
                title={t("submissions.noSubmissions")} 
                action={
                  <Button variant="primary" onClick={() => setActiveView("upload")}>
                    <PlusIcon size="sm" /> {t("submissions.createProjectNew")}
                  </Button>
                }
              />
            </Card>
          );
        }

        return (
          <ErrorBoundary fallbackTitle={t("project.reviewResult")}>
            <ProjectCard
              key={selectedProjectId}
              projectId={selectedProjectId}
              setTopbarActions={setTopbarActions}
            />
          </ErrorBoundary>
        );
      case "rubrics":
        return (
          <Suspense fallback={<ViewFallback title={t("common.loading")} />}>
            <AIConfigurationConsole />
          </Suspense>
        );
      case "report":
        return (
          <Suspense fallback={<ViewFallback title={t("common.loading")} />}>
            <AuditDashboard />
          </Suspense>
        );
      case "diff":
        return (
          <Suspense fallback={<ViewFallback title={t("common.loading")} />}>
            <VersionDiffDashboard />
          </Suspense>
        );
      case "workflow":
      case "export":
      case "settings":
        return (
          <Suspense fallback={<ViewFallback title={t("common.loading")} />}>
            <ErrorBoundary>
              <OperationalScreen
                route={activeView as any}
                projects={projects}
                onOpenReviews={() => setActiveView("reviews")}
                onOpenUpload={() => setActiveView("upload")}
                onSelectProject={(projectId) => {
                  setSelectedProjectId(projectId);
                  setActiveView("detail");
                }}
              />
            </ErrorBoundary>
          </Suspense>
        );
      case "dashboard":
      default:
        return (
          <Suspense fallback={<ViewFallback title={t("nav.dashboard")} />}>
            <DashboardOverview
              projects={projects}
              onSelectProject={(projectId) => {
                setSelectedProjectId(projectId);
                setActiveView("detail");
              }}
              onOpenReviews={() => setActiveView("reviews")}
              onOpenExport={() => setActiveView("export")}
            />
          </Suspense>
        );
    }
  })();

  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) setActiveView("reviews");
    else if (index === 1 && activeView === "detail") setActiveView("reviews");
  };

  return (
    <AppShell
      isSidebarOpen={isMobileMenuOpen}
      isCollapsed={isSidebarCollapsed}
      fluid={false}
      onCloseSidebar={() => setIsMobileMenuOpen(false)}
      onToggleSidebar={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      sidebar={
        <Sidebar 
          activeView={activeView} 
          onChangeView={(view) => {
            setActiveView(view);
            setIsMobileMenuOpen(false);
            setTopbarActions(null);
          }} 
          isCollapsed={isSidebarCollapsed}
        />
      }
      topbar={
        <Topbar
          title={topbarContent.title}
          subtitle={topbarContent.subtitle}
          breadcrumb={topbarContent.breadcrumb}
          rightBadge={topbarContent.rightBadge}
          hideMain={topbarContent.hideMain}
          actions={topbarActions}
          dashboardChrome={activeView === "dashboard" || activeView === "reviews" || activeView === "upload" || activeView === "diff" || activeView === "workflow" || activeView === "export" || activeView === "settings" || activeView === "report" || activeView === "rubrics" || activeView === "detail"}
          onToggleSidebar={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onBreadcrumbClick={handleBreadcrumbClick}
        />
      }
    >
      {content}
    </AppShell>
  );
}
