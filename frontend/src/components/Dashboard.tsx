import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getSubmission, getSubmissions } from "../api/client";
import { submissionDetailQueryKey, submissionsQueryKey } from "../query";
import type { Submission } from "../types";
import DashboardOverview from "./dashboard/DashboardOverview";
import FileUpload from "./FileUpload";
import { useTranslation } from "./LanguageSelector";
import AppShell from "./layout/AppShell";
import Sidebar, { type WorkspaceView } from "./layout/Sidebar";
import Topbar from "./layout/Topbar";
import ProjectCard from "./project/ProjectCard";
import ReviewListOverview from "./reviews/ReviewListOverview";
import RubricManagement from "./rubrics/RubricManagement";
import Badge from "./ui/Badge";
import SectionBlock from "./ui/SectionBlock";

function PlaceholderPanel({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <SectionBlock className="placeholder-panel">
      <SectionBlock.Header title={title} subtitle={description} aside={badge ? <Badge>{badge}</Badge> : null} />
      <SectionBlock.Body>
        <div className="placeholder-panel__body">
          <div className="placeholder-panel__grid">
            <div className="placeholder-card" />
            <div className="placeholder-card" />
            <div className="placeholder-card" />
          </div>
          <p className="placeholder-panel__note">{description}</p>
        </div>
      </SectionBlock.Body>
    </SectionBlock>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: submissionsQueryKey,
    queryFn: () => getSubmissions(),
  });
  const { data: detailedSubmission } = useQuery({
    queryKey: selectedProjectId ? submissionDetailQueryKey(selectedProjectId) : ["submission", "empty"],
    queryFn: () => getSubmission(selectedProjectId as string),
    enabled: activeView === "detail" && Boolean(selectedProjectId),
  });

  const submissions: Submission[] = useMemo(() => data?.submissions ?? [], [data?.submissions]);
  const selectedSubmission = useMemo(
    () => submissions.find((item) => item.project_id === selectedProjectId) ?? submissions[0] ?? null,
    [selectedProjectId, submissions],
  );
  const detailSubmission = detailedSubmission ?? selectedSubmission;

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
          rightBadge: t("submissions.count", { count: submissions.length }),
          hideMain: false,
        };
      case "detail":
        return {
          title: detailSubmission?.filename ?? t("project.reviewResult"),
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
      case "settings":
        return {
          title: t("nav.settings"),
          subtitle: undefined,
          breadcrumb: [t("nav.dashboard"), t("nav.settings")],
          rightBadge: t("common.comingSoon"),
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
  }, [activeView, detailSubmission, submissions.length, t]);

  const content = (() => {
    if (error) {
      return (
        <SectionBlock>
          <SectionBlock.Header title={t("common.error")} subtitle={t("rubric.loadFailed")} />
          <SectionBlock.Body>
            <div className="error-banner">{error instanceof Error ? error.message : t("rubric.loadFailed")}</div>
          </SectionBlock.Body>
        </SectionBlock>
      );
    }

    if (isLoading) {
      return (
        <SectionBlock>
          <SectionBlock.Header title={t("submissions.title")} subtitle={t("common.loading")} />
          <SectionBlock.Body>
            <div className="loading-panel">{t("common.loading")}</div>
          </SectionBlock.Body>
        </SectionBlock>
      );
    }

    switch (activeView) {
      case "upload":
        return (
          <div className="workspace-stack">
            <FileUpload />
          </div>
        );
      case "reviews":
        return (
          <div className="workspace-stack">
            <ReviewListOverview
              submissions={submissions}
              activeProjectId={selectedSubmission?.project_id ?? null}
              onSelectProject={(projectId) => {
                setSelectedProjectId(projectId);
                setActiveView("detail");
              }}
            />
          </div>
        );
      case "detail":
        if (!detailSubmission) {
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
            submission={detailSubmission} 
            allSubmissions={submissions}
            onNavigate={(projectId) => setSelectedProjectId(projectId)}
            onBack={() => setActiveView("reviews")}
          />
        );
      case "rubrics":
        return (
          <div className="workspace-stack">
            <RubricManagement />
          </div>
        );
      case "settings":
        return (
          <PlaceholderPanel
            title={t("nav.settings")}
            description={t("common.comingSoon")}
            badge={t("common.comingSoon")}
          />
        );
      case "dashboard":
      default:
        return (
          <div className="workspace-stack workspace-stack--dashboard-reference">
            <DashboardOverview submissions={submissions} />
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
