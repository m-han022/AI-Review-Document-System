import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listProjects } from "../api/client";
import { projectsQueryKey } from "../query";
import type { Project } from "../types";
import DashboardOverview from "./dashboard/DashboardOverview";
import FileUpload from "./FileUpload";
import { useTranslation } from "./LanguageSelector";
import AppShell from "./layout/AppShell";
import Sidebar, { type WorkspaceView } from "./layout/Sidebar";
import Topbar from "./layout/Topbar";
import ProjectCard from "./project/ProjectCard";
import ReviewListOverview from "./reviews/ReviewListOverview";
import RubricManagement from "./rubrics/RubricManagement";
import OperationalScreen from "./workspace/OperationalScreens";
import SectionBlock from "./ui/SectionBlock";
import { ErrorState, LoadingState } from "./ui/States";

export default function Dashboard() {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  const { data: projectsData, isLoading, error } = useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => listProjects(),
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
          hideMain: false,
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
          breadcrumb: undefined,
          rightBadge: null,
          hideMain: false,
        };
      case "rubrics":
        return {
          title: t("rubric.pageTitle"),
          subtitle: t("rubric.pageSubtitle"),
          breadcrumb: undefined,
          rightBadge: null,
          hideMain: false,
        };
      case "report":
        return {
          title: t("nav.qualityReport"),
          subtitle: undefined,
          breadcrumb: [t("nav.dashboard"), t("nav.qualityReport")],
          rightBadge: null,
          hideMain: false,
        };
      case "workflow":
        return {
          title: t("nav.approvalWorkflow"),
          subtitle: undefined,
          breadcrumb: [t("nav.dashboard"), t("nav.approvalWorkflow")],
          rightBadge: null,
          hideMain: false,
        };
      case "export":
        return {
          title: t("nav.export"),
          subtitle: undefined,
          breadcrumb: [t("nav.dashboard"), t("nav.export")],
          rightBadge: null,
          hideMain: false,
        };
      case "settings":
        return {
          title: t("nav.settings"),
          subtitle: undefined,
          breadcrumb: [t("nav.dashboard"), t("nav.settings")],
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
          <SectionBlock.Body>
            <LoadingState title={t("common.loading")} description={t("nav.dashboard")} />
          </SectionBlock.Body>
        </SectionBlock>
      );
    }

    switch (activeView) {
      case "upload":
        return (
          <div className="workspace-stack">
            <FileUpload
              onReviewComplete={(projectId) => {
                setSelectedProjectId(projectId);
                setActiveView("detail");
              }}
            />
          </div>
        );
      case "reviews":
        return (
          <div className="workspace-stack">
            <ReviewListOverview
              projects={projects}
              activeProjectId={selectedProject?.project_id ?? null}
              onSelectProject={(projectId) => {
                setSelectedProjectId(projectId);
                setActiveView("detail");
              }}
            />
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
          <ProjectCard 
            key={selectedProjectId}
            projectId={selectedProjectId}
            onBack={() => setActiveView("reviews")}
          />
        );
      case "rubrics":
        return (
          <div className="workspace-stack">
            <RubricManagement />
          </div>
        );
      case "report":
      case "workflow":
      case "export":
      case "settings":
        return (
          <OperationalScreen
            route={activeView}
            projects={projects}
            onOpenReviews={() => setActiveView("reviews")}
            onOpenUpload={() => setActiveView("upload")}
          />
        );
      case "dashboard":
      default:
        return (
          <div className="workspace-stack workspace-stack--dashboard-reference">
            <DashboardOverview
              projects={projects}
              onSelectProject={(projectId) => {
                setSelectedProjectId(projectId);
                setActiveView("detail");
              }}
              onOpenReviews={() => setActiveView("reviews")}
              onOpenExport={() => setActiveView("export")}
            />
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
          dashboardChrome={activeView === "dashboard" || activeView === "reviews" || activeView === "upload"}
        />
      }
    >
      {content}
    </AppShell>
  );
}
