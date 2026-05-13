import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  compareVersions,
  exportSubmissionsExcel,
  getGradingRun,
  gradeSubmission,
  listDocumentVersions,
  listProjectDocuments,
  listProjects,
  listVersionGradings,
} from "../../api/client";
import { projectsQueryKey } from "../../query";
import type {
  DocumentListOut,
  GradingListOut,
  GradingRunDetail,
  LanguageCode,
  VersionComparison as VersionComparisonData,
  VersionListOut,
} from "../../types";
import {
  buildSlideReviewItems,
  getCriterionIcon,
  getCriterionLabel,
  splitFeedbackLines,
  splitFeedbackSections,
  type OrderedScoreItem,
} from "./projectCard.helpers";

interface UseProjectReviewStateInput {
  projectId: string;
  lang: LanguageCode;
  t: (key: string) => string;
}

export function useProjectReviewState({ projectId, lang, t }: UseProjectReviewStateInput) {
  const queryClient = useQueryClient();
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedGradingId, setSelectedGradingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "criteria" | "slides">("overview");
  const [selectedSlideId, setSelectedSlideId] = useState<number | null>(null);
  const [filterNG, setFilterNG] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [promptUsedOpen, setPromptUsedOpen] = useState(false);
  const [promptUsedText] = useState("");
  const [, setActionMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [hoveredCriterion, setHoveredCriterion] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [baseVersionId] = useState<number | null>(null);
  const [compareVersionId] = useState<number | null>(null);

  const { data: documents = [], isLoading: loadingDocs, error: docsError, refetch: refetchDocuments } = useQuery<DocumentListOut[]>({
    queryKey: ["project-documents", projectId],
    queryFn: () => listProjectDocuments(projectId),
  });
  const { data: projectList = [] } = useQuery({ queryKey: projectsQueryKey, queryFn: () => listProjects() });
  const { data: versions = [], isLoading: loadingVersions } = useQuery<VersionListOut[]>({
    queryKey: ["document-versions", selectedDocumentId],
    queryFn: () => listDocumentVersions(selectedDocumentId!),
    enabled: selectedDocumentId !== null && selectedDocumentId !== undefined,
    staleTime: 0,
  });
  const { data: gradings = [], isLoading: loadingGradings, isFetching: fetchingGradings } = useQuery<GradingListOut[]>({
    queryKey: ["version-gradings", selectedVersionId],
    queryFn: () => listVersionGradings(selectedVersionId!),
    enabled: !!selectedVersionId,
    staleTime: 0,
    refetchInterval: (query) => {
      const list = Array.isArray(query.state.data) ? (query.state.data as GradingListOut[]) : [];
      const hasPending = list.some((g) => {
        const s = g.status?.toLowerCase();
        return s === "pending" || s === "extracting" || s === "grading";
      });
      return hasPending ? 3000 : false;
    },
  });
  const { data: gradingDetail } = useQuery<GradingRunDetail>({
    queryKey: ["grading-detail", selectedGradingId],
    queryFn: () => getGradingRun(selectedGradingId!),
    enabled: !!selectedGradingId,
    refetchInterval: (query) => {
      const detail = query.state.data as GradingRunDetail | undefined;
      const s = detail?.grading_run?.status?.toLowerCase();
      const isPending = s === "pending" || s === "extracting" || s === "grading";
      return isPending ? 3000 : false;
    },
  });
  useQuery<VersionComparisonData>({
    queryKey: ["version-comparison", selectedDocumentId, baseVersionId, compareVersionId],
    queryFn: () => compareVersions(selectedDocumentId!, baseVersionId!, compareVersionId!),
    enabled: !!(selectedDocumentId && baseVersionId && compareVersionId && comparisonMode),
  });

  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      const aCompleted = (a.latest_status || "").toLowerCase() === "completed" ? 1 : 0;
      const bCompleted = (b.latest_status || "").toLowerCase() === "completed" ? 1 : 0;
      if (aCompleted !== bCompleted) return bCompleted - aCompleted;
      const aTime = new Date(a.latest_uploaded_at || 0).getTime();
      const bTime = new Date(b.latest_uploaded_at || 0).getTime();
      return bTime - aTime;
    });
  }, [documents]);

  useEffect(() => {
    if (!sortedDocuments.length) {
      setSelectedDocumentId(null);
      return;
    }
    const currentExists = sortedDocuments.some((doc) => doc.document_id === selectedDocumentId);
    if (!currentExists) {
      setSelectedDocumentId(sortedDocuments[0].document_id);
      setSelectedVersionId(null);
      setSelectedGradingId(null);
    }
  }, [sortedDocuments, selectedDocumentId]);

  useEffect(() => {
    if (versions.length > 0) {
      const currentExists = versions.some((v) => v.document_version_id === selectedVersionId);
      if (!currentExists) {
        const latest = versions.find((v) => v.is_latest) || versions[0];
        setSelectedVersionId(latest.document_version_id);
      }
    } else if (!loadingVersions) {
      setSelectedVersionId(null);
    }
  }, [versions, selectedVersionId, loadingVersions]);

  useEffect(() => {
    if (fetchingGradings) return;
    if (gradings.length > 0) {
      const currentExists = gradings.some((g) => g.grading_run_id === selectedGradingId);
      if (!currentExists) {
        const completed = gradings.find((g) => g.status?.toLowerCase() === "completed") || gradings[0];
        setSelectedGradingId(completed.grading_run_id);
      }
    } else if (!loadingGradings) {
      setSelectedGradingId(null);
    }
  }, [gradings, selectedGradingId, loadingGradings, fetchingGradings]);

  const currentProject = (projectList || []).find((p: any) => p.project_id === projectId);
  const currentVersion = versions.find((v) => v.document_version_id === selectedVersionId);
  const rerunMutation = useMutation({
    mutationFn: () =>
      gradeSubmission({
        projectId,
        documentVersionId: selectedVersionId!,
        force: true,
        evaluationSetId: gradingDetail?.grading_run?.evaluation_set_id ?? undefined,
      }),
    onSuccess: async (data) => {
      if (data && data.run_id) {
        setSelectedGradingId(data.run_id);
      }
      setActionMessage({ tone: "success", text: t("project.rerunSuccess") });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["version-gradings", selectedVersionId!] }),
      ]);
    },
    onError: (error) => {
      setActionMessage({
        tone: "danger",
        text: error instanceof Error ? error.message : t("submissions.gradingFailed"),
      });
    },
  });
  const exportMutation = useMutation({
    mutationFn: exportSubmissionsExcel,
    onSuccess: ({ blob, filename }) => {
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      setActionMessage({ tone: "success", text: t("submissions.exportSuccess") });
    },
    onError: (error) => {
      setActionMessage({
        tone: "danger",
        text: error instanceof Error ? error.message : t("submissions.exportFailed"),
      });
    },
  });

  const result = gradingDetail?.grading_run;
  const criteriaResults = gradingDetail?.criteria_results ?? [];
  const slideReviewItems = useMemo(() => {
    const slideReviews =
      gradingDetail?.slide_reviews ??
      (gradingDetail as any)?.grading_run?.slide_reviews ??
      [];
    return buildSlideReviewItems(slideReviews, lang, t, gradingDetail?.document_version?.extracted_text);
  }, [gradingDetail, lang, t]);
  useEffect(() => {
    if (slideReviewItems.length > 0 && selectedSlideId === null) {
      const firstNg = slideReviewItems.find((s) => s.status === "NG");
      if (firstNg) setSelectedSlideId(firstNg.id);
      else if (slideReviewItems[0]) setSelectedSlideId(slideReviewItems[0].id);
    }
  }, [slideReviewItems, selectedSlideId]);

  const ngSlideCount = slideReviewItems.filter((s) => s.status === "NG").length;
  const orderedScores = useMemo<OrderedScoreItem[]>(
    () =>
      criteriaResults.map((item) => ({
        key: item.key,
        value: item.score,
        max: item.max_score,
        label: getCriterionLabel(item.key, t),
        Icon: getCriterionIcon(item.key),
      })),
    [criteriaResults, t],
  );
  const feedbackLines = useMemo(() => splitFeedbackLines(result?.draft_feedback ?? null, lang), [result, lang]);
  const feedbackSections = useMemo(() => splitFeedbackSections(feedbackLines), [feedbackLines]);
  const activeSlideId = useMemo(() => {
    if (selectedSlideId !== null) return selectedSlideId;
    const firstNg = slideReviewItems.find((s) => s.status === "NG");
    return firstNg ? firstNg.id : slideReviewItems[0]?.id ?? null;
  }, [selectedSlideId, slideReviewItems]);
  const activeSlide = useMemo(() => slideReviewItems.find((s) => s.id === activeSlideId) ?? null, [slideReviewItems, activeSlideId]);
  const isInitialLoading = loadingDocs || (selectedDocumentId && loadingVersions) || (selectedVersionId && loadingGradings);
  const riskLevel = useMemo(() => {
    const score = result?.total_score ?? 0;
    if (score >= 90) return { label: t("statusBiz.lowRisk"), tone: "success" as const };
    if (score >= 70) return { label: t("statusBiz.mediumRisk"), tone: "warning" as const };
    return { label: t("statusBiz.highRisk"), tone: "danger" as const };
  }, [result, t]);
  const topInsight = useMemo(() => {
    if (!result || orderedScores.length === 0) return null;
    const sorted = [...orderedScores].sort((a, b) => a.value / (a.max || 1) - b.value / (b.max || 1));
    const lowest = sorted.length > 0 ? sorted[0] : null;
    const firstNg = slideReviewItems.find((s) => s.status === "NG");
    if ((result.total_score ?? 0) >= 90 && !firstNg) {
      return {
        title: t("project.insight.excellentTitle"),
        message: t("project.insight.excellentDesc"),
        type: "success" as const,
      };
    }
    if (!lowest) return null;
    return {
      title: t("project.insight.priorityAction"),
      message: (t("project.insight.priorityDesc") || "")
        .replace("{criterion}", lowest.label)
        .replace("{slide}", firstNg ? String(firstNg.slide_number) : "-"),
      type: "warning" as const,
    };
  }, [result, orderedScores, slideReviewItems, t]);

  const scrollToSection = (tab: "overview" | "criteria" | "slides") => {
    setActiveTab(tab);
    
    // Give React a frame to update classes if needed, though sections are always rendered
    setTimeout(() => {
      const el = document.getElementById(`section-${tab}`);
      const scrollContainer = document.getElementById("main-scroll-container");
      
      if (el && scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        
        // Calculate position relative to container's current scroll position
        const targetScrollTop = scrollContainer.scrollTop + (elRect.top - containerRect.top) - 60;
        
        scrollContainer.scrollTo({ 
          top: targetScrollTop, 
          behavior: 'smooth' 
        });
      }
    }, 0);
  };

  return useMemo(() => ({
    uiState: {
      selectedDocumentId,
      setSelectedDocumentId,
      selectedVersionId,
      setSelectedVersionId,
      selectedGradingId,
      setSelectedGradingId,
      activeTab,
      setActiveTab,
      selectedSlideId,
      setSelectedSlideId,
      filterNG,
      setFilterNG,
      summaryDialogOpen,
      setSummaryDialogOpen,
      promptUsedOpen,
      setPromptUsedOpen,
      promptUsedText,
       hoveredCriterion,
       setHoveredCriterion,
       comparisonMode,
       setComparisonMode,
       scrollToSection,
    },
    dataState: {
      documents,
      sortedDocuments,
      loadingDocs,
      docsError,
      refetchDocuments,
      versions,
      loadingVersions,
      gradings,
      loadingGradings,
      gradingDetail,
      currentProject,
      currentVersion,
    },
    actions: {
      rerunMutation,
      exportMutation,
    },
    derived: {
      result,
      slideReviewItems,
      ngSlideCount,
      orderedScores,
      feedbackSections,
      activeSlide,
      isInitialLoading,
      riskLevel,
      topInsight,
    },
  }), [
    selectedDocumentId, selectedVersionId, selectedGradingId, activeTab, selectedSlideId,
    filterNG, summaryDialogOpen, promptUsedOpen, promptUsedText, hoveredCriterion, comparisonMode,
    scrollToSection,
    documents, sortedDocuments, loadingDocs, docsError, versions, loadingVersions, gradings,
    loadingGradings, gradingDetail, currentProject, currentVersion,
    result, slideReviewItems, ngSlideCount, orderedScores, feedbackSections, activeSlide,
    isInitialLoading, riskLevel, topInsight
  ]);
}
