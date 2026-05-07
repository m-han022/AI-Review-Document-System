import { Suspense, lazy, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listProjects } from "../api/client";
import { projectsQueryKey } from "../query";
import type { Project } from "../types";
import { useTranslation } from "./LanguageSelector";
import AppShell from "./layout/AppShell";
import Sidebar, { type WorkspaceView } from "./layout/Sidebar";
import Topbar from "./layout/Topbar";
import SectionBlock from "./ui/SectionBlock";
import { ErrorState, LoadingState, SkeletonTable } from "./ui/States";

const DashboardOverview = lazy(() => import("./dashboard/DashboardOverview"));
const FileUpload = lazy(() => import("./FileUpload"));
const ProjectCard = lazy(() => import("./project/ProjectCard"));
const ReviewListOverview = lazy(() => import("./reviews/ReviewListOverview"));
const AIConfigurationConsole = lazy(() => import("./rubrics/AIConfigurationConsole"));
const AuditDashboard = lazy(() => import("./workspace/AuditDashboard"));
const VersionDiffDashboard = lazy(() => import("./workspace/VersionDiffDashboard"));
const OperationalScreen = lazy(() => import("./workspace/OperationalScreens"));

function ViewFallback({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <SectionBlock>
      <SectionBlock.Body className="dashboard-view-fallback">
        <LoadingState title={title} description={t("common.loading")} />
        <div className="dashboard-loading-skeletons" aria-hidden="true">
          <div className="dashboard-loading-skeleton dashboard-loading-skeleton--kpi" />
          <div className="dashboard-loading-skeleton dashboard-loading-skeleton--kpi" />
          <div className="dashboard-loading-skeleton dashboard-loading-skeleton--kpi" />
        </div>
        <SkeletonTable rows={4} cols={4} />
      </SectionBlock.Body>
    </SectionBlock>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
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
          breadcrumb: undefined,
          rightBadge: null,
          hideMain: true,
        };
      case "reviews":
        return {
          title: t("submissions.title"),
          subtitle: t("submissions.subtitle"),
          breadcrumb: undefined,
          rightBadge: t("submissions.count", { count: projects.length }),
          hideMain: false,
        };
      case "detail":
        return {
          title: selectedProject?.project_name ?? t("project.reviewResult"),
          subtitle: t("project.reviewDetailSubtitle"),
          breadcrumb: [t("nav.dashboard"), t("nav.allReviews"), selectedProject?.project_name ?? ""],
          rightBadge: null,
          hideMain: true,
        };
      case "rubrics":
        return {
          title: t("rubric.pageTitle"),
          subtitle: t("rubric.pageSubtitle"),
          breadcrumb: [t("nav.dashboard"), t("nav.rubrics")],
          rightBadge: null,
          hideMain: true,
        };
      case "report":
        return {
          title: t("nav.qualityReport"),
          subtitle: undefined,
          breadcrumb: [t("nav.dashboard"), t("nav.qualityReport")],
          rightBadge: null,
          hideMain: true,
        };
      case "diff":
        return {
          title: t("nav.versionDiff"),
          subtitle: t("biz.versionDiff.subtitle"),
          breadcrumb: [t("nav.dashboard"), t("nav.versionDiff")],
          rightBadge: null,
          hideMain: true,
        };
      case "workflow":
        return {
          title: t("nav.approvalWorkflow"),
          subtitle: undefined,
          breadcrumb: [t("nav.dashboard"), t("nav.approvalWorkflow")],
          rightBadge: null,
          hideMain: true,
        };
      case "export":
        return {
          title: t("nav.export"),
          subtitle: undefined,
          breadcrumb: [t("nav.dashboard"), t("nav.export")],
          rightBadge: null,
          hideMain: true,
        };
      case "settings":
        return {
          title: t("nav.settings"),
          subtitle: undefined,
          breadcrumb: [t("nav.dashboard"), t("nav.settings")],
          rightBadge: null,
          hideMain: true,
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
        <SectionBlock>
          <SectionBlock.Body>
            <ErrorState title={t("common.error")} description={error instanceof Error ? error.message : t("rubric.loadFailed")} />
          </SectionBlock.Body>
        </SectionBlock>
      );
    }

    if (isLoading) {
      return (
        <SectionBlock>
          <SectionBlock.Body className="dashboard-view-fallback">
            <LoadingState title={t("common.loading")} description={t("nav.dashboard")} />
            <div className="dashboard-loading-skeletons" aria-hidden="true">
              <div className="dashboard-loading-skeleton dashboard-loading-skeleton--kpi" />
              <div className="dashboard-loading-skeleton dashboard-loading-skeleton--kpi" />
              <div className="dashboard-loading-skeleton dashboard-loading-skeleton--kpi" />
            </div>
            <SkeletonTable rows={4} cols={4} />
          </SectionBlock.Body>
        </SectionBlock>
      );
    }

    switch (activeView) {
      case "upload":
        return (
          <div className="workspace-stack">
            <Suspense fallback={<ViewFallback title={t("upload.pageTitle")} />}>
              <FileUpload
                onReviewComplete={(projectId) => {
                  setSelectedProjectId(projectId);
                  setActiveView("detail");
                }}
              />
            </Suspense>
          </div>
        );
      case "reviews":
        return (
          <div className="workspace-stack">
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
          </div>
        );
      case "detail":
        if (!selectedProjectId) {
          return (
            <div className="workspace-stack">
              <SectionBlock>
                <SectionBlock.Header title={t("project.reviewResult")} subtitle={t("submissions.noSubmissions")} />
              </SectionBlock>
            </div>
          );
        }
        return (
          <Suspense fallback={<ViewFallback title={t("project.reviewResult")} />}>
            <ProjectCard
              key={selectedProjectId}
              projectId={selectedProjectId}
              onBack={() => setActiveView("reviews")}
            />
          </Suspense>
        );
      case "rubrics":
        return (
          <div className="workspace-stack">
            <Suspense fallback={<ViewFallback title={t("common.loading")} />}>
              <AIConfigurationConsole />
            </Suspense>
          </div>
        );
      case "report":
        return (
          <div className="workspace-stack">
            <Suspense fallback={<ViewFallback title={t("common.loading")} />}>
              <AuditDashboard />
            </Suspense>
          </div>
        );
      case "diff":
        return (
          <div className="workspace-stack">
            <Suspense fallback={<ViewFallback title={t("common.loading")} />}>
              <VersionDiffDashboard />
            </Suspense>
          </div>
        );
      case "workflow":
      case "export":
      case "settings":
        return (
          <div className="workspace-stack">
            <Suspense fallback={<ViewFallback title={t("common.loading")} />}>
              <OperationalScreen
                route={activeView}
                projects={projects}
                onOpenReviews={() => setActiveView("reviews")}
                onOpenUpload={() => setActiveView("upload")}
              />
            </Suspense>
          </div>
        );
      case "dashboard":
      default:
        return (
          <div className="workspace-stack workspace-stack--dashboard-reference">
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
          </div>
        );
    }
  })();

  return (
    <AppShell
      sidebar={<Sidebar activeView={activeView} onChangeView={setActiveView} />}
      topbar={
        <Topbar
          title={topbarContent.title}
          subtitle={topbarContent.subtitle}
          breadcrumb={topbarContent.breadcrumb}
          rightBadge={topbarContent.rightBadge}
          hideMain={topbarContent.hideMain}
          dashboardChrome={activeView === "dashboard" || activeView === "reviews" || activeView === "upload" || activeView === "diff" || activeView === "workflow" || activeView === "export" || activeView === "settings" || activeView === "report" || activeView === "rubrics" || activeView === "detail"}
        />
      }
    >
      {content}
    </AppShell>
  );
}
