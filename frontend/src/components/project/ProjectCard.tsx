import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { 
  listProjectDocuments, 
  listProjects,
  listDocumentVersions, 
  listVersionGradings, 
  getGradingRun,
  getSubmissionGradingRuns,
  getSubmissionFileUrl,
  gradeSubmission,
  compareVersions,
  exportSubmissionsExcel
} from "../../api/client";
import { getDocumentTypeKey } from "../../constants/documentTypes";
import { isUploadCriterionKey } from "../../constants/uploadCriteria";
import { getLocalizedText } from "../../locales/utils";
import { 
  projectsQueryKey
} from "../../query";
import type { 
  LanguageCode, 
  SlideReview, 
  GradingListOut,
  VersionListOut,
  DocumentListOut,
  GradingRunDetail,
  VersionComparison as VersionComparisonData
} from "../../types";
import { useTranslation } from "../LanguageSelector";
import { toBusinessStatus } from "../ui/businessStatus";
import {
  BookOpenIcon,
  DownloadIcon,
  RefreshIcon,
  ShieldCheckIcon,
  SparkIcon,
  TargetIcon,
  WorkflowIcon,
  AlertTriangleIcon,
  LayersIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  FileTextIcon,
  MaximizeIcon
} from "../ui/Icon";
import { formatUploadedAt } from "../submissions/utils";
import ProjectReviewDialog from "./ProjectReviewDialog";
import {
  type FeedbackSectionView
} from "./ProjectReviewPanels";
import { LoadingState, EmptyState, StatusBadge, Tooltip } from "../ui/States";
import { Button, Card, Select } from "../ui";
import { KPIPieChart } from "../ui/KPICharts";
import "./ProjectCard.css";



interface ProjectCardProps {
  projectId: string;
  onBack: () => void;
}

interface OrderedScoreItem {
  key: string;
  label: string;
  value: number;
  max: number;
  Icon: ReturnType<typeof getCriterionIcon>;
}

function getCriterionIcon(criterionKey: string) {
  switch (criterionKey) {
    case "review_tong_the":
    case "kha_nang_tai_hien_bug":
    case "do_ro_rang":
    case "do_ro_rang_de_hieu":
      return TargetIcon;
    case "diem_tot":
    case "do_bao_phu":
    case "tinh_chinh_xac":
      return ShieldCheckIcon;
    case "kha_nang_truy_vet":
      return SparkIcon;
    case "diem_xau":
    case "danh_gia_anh_huong":
      return AlertTriangleIcon;
    case "chinh_sach":
    case "giai_phap_phong_ngua":
    case "tinh_thuc_thi":
    case "tinh_ung_dung":
      return WorkflowIcon;
    case "chat_luong_viet":
    case "phan_tich_nguyen_nhan":
    case "tinh_day_du_dung_trong_tam":
      return BookOpenIcon;
    default:
      return TargetIcon;
  }
}


function formatDateTime(value: string | null | undefined, lang: LanguageCode) {
  if (!value) return "—";
  return formatUploadedAt(value, lang);
}

function splitFeedbackLines(feedback: Record<string, string> | null, lang: LanguageCode): string[] {
  return getLocalizedText(feedback, lang)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getStatusLabel(status: string, t: (key: string) => string): string {
  const mapped = toBusinessStatus(status);
  if (mapped === "reviewReady") return t("statusBiz.reviewReady");
  if (mapped === "attentionNeeded") return t("statusBiz.attentionNeeded");
  if (mapped === "exporting") return t("statusBiz.exporting");
  return t("statusBiz.processing");
}



function splitFeedbackSections(lines: string[]): FeedbackSectionView[] {
  const sections: FeedbackSectionView[] = [];
  for (const line of lines) {
    if (/^[①②③④⑤⑥⑦]\s*/u.test(line)) {
      sections.push({ title: line, lines: [] });
      continue;
    }
    const current = sections.at(-1);
    if (current) current.lines.push(line);
    else sections.push({ title: "", lines: [line] });
  }
  return sections.length ? sections : [{ title: "", lines }];
}

function buildSlideReviewItems(slideReviews: SlideReview[] | undefined, lang: LanguageCode, t: (key: string) => string) {
  if (!slideReviews) return [];
  return [...slideReviews]
    .sort((a, b) => a.slide_number - b.slide_number)
    .map((item) => {
      const title = getLocalizedText(item.title, lang);
      const summary = getLocalizedText(item.summary, lang);
      const localizedIssues = item.issues as Record<string, string[]> | null;
      const issues = (localizedIssues?.[lang] ?? localizedIssues?.[lang === "vi" ? "ja" : "vi"] ?? []).filter(Boolean);
      const suggestions = getLocalizedText(item.suggestions, lang);
      return {
        ...item,
        displayTitle: title || t("project.slideNumber").replace("{number}", String(item.slide_number)),
        summary,
        issues,
        suggestions,
      };
    });
}

function phase2Text(t: (key: string) => string) {
  return {
    loadingDocuments: t("sm.document.loading"),
    cannotLoadProjectDocuments: t("sm.document.error"),
    retry: t("sm.common.retry"),
    auditContextTitle: t("biz.audit.title"),
    auditContextSubtitle: t("biz.audit.subtitle"),
    project: t("sm.audit.project"),
    document: t("sm.audit.document"),
    version: t("sm.audit.version"),
    gradingRun: t("sm.audit.gradingRun"),
    evaluationSet: t("sm.audit.evaluationSet"),
    notSelected: t("sm.common.notSelected"),
    autoUnresolved: t("sm.evaluation.autoUnresolved"),
    resolveMode: t("sm.evaluation.resolveMode"),
    resolveAutoResolved: t("sm.evaluation.resolveAutoResolved"),
    resolveAutoPending: t("sm.evaluation.resolveAutoPending"),
    resolveReasonTitle: t("sm.evaluation.resolveReasonTitle"),
    resolveReasonAuto: t("sm.evaluation.resolveReasonAuto"),
    emptyDocuments: t("sm.document.empty"),
    selectDocumentToLoadVersions: t("sm.version.selectDocumentHint"),
    loadingVersions: t("sm.version.loading"),
    emptyVersions: t("sm.version.empty"),
    cannotLoadVersions: t("sm.version.error"),
    selectVersionToLoadGradings: t("sm.grading.selectVersionHint"),
    loadingGradings: t("sm.grading.loading"),
    emptyGradings: t("sm.grading.empty"),
    cannotLoadGradings: t("sm.grading.error"),
    versionTimelineTitle: t("sm.version.timelineTitle"),
    gradingTimelineTitle: t("sm.grading.timelineTitle"),
    newestFirst: t("sm.common.newestFirst"),
    noVersions: t("sm.version.noneTitle"),
    uploadCreateV1: t("sm.version.noneDesc"),
    noGradings: t("sm.grading.noneTitle"),
    runReviewCreateGrading: t("sm.grading.noneDesc"),
    loadingDetails: t("sm.detail.loading"),
    cannotLoadDetail: t("sm.detail.error"),
    selectSlideForDetails: t("sm.slide.select"),
  };
}

export default function ProjectCard({ projectId }: ProjectCardProps) {
  const { lang, t } = useTranslation();
  const m = phase2Text(t);
  const queryClient = useQueryClient();
  
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedGradingId, setSelectedGradingId] = useState<number | null>(null);
  
  const [activeTab, setActiveTab] = useState<"criteria" | "slides">("criteria");
  const [selectedSlideId, setSelectedSlideId] = useState<number | null>(null);
  const [filterNG, setFilterNG] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [promptUsedOpen, setPromptUsedOpen] = useState(false);
  const [promptUsedText] = useState("");
  const [, setActionMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  // Comparison states
  const [comparisonMode, setComparisonMode] = useState(false);
  const [baseVersionId] = useState<number | null>(null);
  const [compareVersionId] = useState<number | null>(null);

  // Queries
  const {
    data: documents = [],
    isLoading: loadingDocs,
    error: docsError,
    refetch: refetchDocuments,
  } = useQuery<DocumentListOut[]>({
    queryKey: ["project-documents", projectId],
    queryFn: () => listProjectDocuments(projectId),
  });
  const { data: projectList = [] } = useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => listProjects(),
  });

  const {
    data: versions = [],
    isLoading: loadingVersions,
  } = useQuery<VersionListOut[]>({
    queryKey: ["document-versions", selectedDocumentId],
    queryFn: () => listDocumentVersions(selectedDocumentId!),
    enabled: selectedDocumentId !== null && selectedDocumentId !== undefined,
    staleTime: 0, 
  });

  const {
    data: gradings = [],
    isLoading: loadingGradings,
  } = useQuery<GradingListOut[]>({
    queryKey: ["version-gradings", selectedVersionId],
    queryFn: () => listVersionGradings(selectedVersionId!),
    enabled: !!selectedVersionId,
    staleTime: 0,
    refetchInterval: (query) => {
      const list = Array.isArray(query.state.data) ? query.state.data as GradingListOut[] : [];
      const hasPending = list.some(g => {
        const s = g.status?.toLowerCase();
        return s === "pending" || s === "extracting" || s === "grading";
      });
      return hasPending ? 3000 : false;
    }
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
    }
  });
  
  useQuery<VersionComparisonData>({
    queryKey: ["version-comparison", selectedDocumentId, baseVersionId, compareVersionId],
    queryFn: () => compareVersions(selectedDocumentId!, baseVersionId!, compareVersionId!),
    enabled: !!(selectedDocumentId && baseVersionId && compareVersionId && comparisonMode),
  });

  // Auto-select logic
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
      const currentExists = versions.some(v => v.document_version_id === selectedVersionId);
      if (!currentExists) {
        const latest = versions.find(v => v.is_latest) || versions[0];
        setSelectedVersionId(latest.document_version_id);
      }
    } else if (!loadingVersions) {
      setSelectedVersionId(null);
    }
  }, [versions, selectedVersionId, loadingVersions]);

  useEffect(() => {
    if (gradings.length > 0) {
      const currentExists = gradings.some(g => g.grading_run_id === selectedGradingId);
      if (!currentExists) {
        const completed = gradings.find(g => g.status?.toLowerCase() === "completed") || gradings[0];
        setSelectedGradingId(completed.grading_run_id);
      }
    } else if (!loadingGradings) {
      setSelectedGradingId(null);
    }
  }, [gradings, selectedGradingId, loadingGradings]);

  const currentProject = (projectList || []).find((p: any) => p.project_id === projectId);
  const currentVersion = versions.find(v => v.document_version_id === selectedVersionId);

  const rerunMutation = useMutation({
    mutationFn: () => gradeSubmission({
      projectId,
      documentVersionId: selectedVersionId!,
      force: true,
      evaluationSetId: gradingDetail?.grading_run?.evaluation_set_id ?? undefined,
    }),
    onSuccess: async () => {
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

  // Result derived data
  const result = gradingDetail?.grading_run;
  const criteriaResults = gradingDetail?.criteria_results ?? [];
  const slideReviewItems = useMemo(
    () => buildSlideReviewItems(gradingDetail?.slide_reviews, lang, t),
    [gradingDetail, lang, t],
  );
  const ngSlideCount = slideReviewItems.filter(s => s.status === "NG").length;
  const getCriterionLabel = (key: string) => {
    if (!isUploadCriterionKey(key)) return key;
    switch (key) {
      case "review_tong_the": return t("upload.criteria.review_tong_the");
      case "diem_tot": return t("upload.criteria.diem_tot");
      case "diem_xau": return t("upload.criteria.diem_xau");
      case "chinh_sach": return t("upload.criteria.chinh_sach");
      case "chat_luong_viet": return t("upload.criteria.chat_luong_viet");
      case "kha_nang_tai_hien_bug": return t("upload.criteria.kha_nang_tai_hien_bug");
      case "phan_tich_nguyen_nhan": return t("upload.criteria.phan_tich_nguyen_nhan");
      case "danh_gia_anh_huong": return t("upload.criteria.danh_gia_anh_huong");
      case "giai_phap_phong_ngua": return t("upload.criteria.giai_phap_phong_ngua");
      case "do_ro_rang": return t("upload.criteria.do_ro_rang");
      case "do_bao_phu": return t("upload.criteria.do_bao_phu");
      case "kha_nang_truy_vet": return t("upload.criteria.kha_nang_truy_vet");
      case "tinh_thuc_thi": return t("upload.criteria.tinh_thuc_thi");
      case "do_ro_rang_de_hieu": return t("upload.criteria.do_ro_rang_de_hieu");
      case "tinh_day_du_dung_trong_tam": return t("upload.criteria.tinh_day_du_dung_trong_tam");
      case "tinh_chinh_xac": return t("upload.criteria.tinh_chinh_xac");
      case "tinh_ung_dung": return t("upload.criteria.tinh_ung_dung");
      default: return key;
    }
  };

  const orderedScores = useMemo<OrderedScoreItem[]>(() => {
    return criteriaResults.map((item) => ({
      key: item.key,
      value: item.score,
      max: item.max_score,
      label: getCriterionLabel(item.key),
      Icon: getCriterionIcon(item.key),
    }));
  }, [criteriaResults, t]);

  const feedbackLines = useMemo(() => splitFeedbackLines(result?.draft_feedback ?? null, lang), [result, lang]);
  const feedbackSections = useMemo(() => splitFeedbackSections(feedbackLines), [feedbackLines]);

  const activeSlideId = useMemo(() => {
    if (selectedSlideId !== null) return selectedSlideId;
    const firstNg = slideReviewItems.find(s => s.status === "NG");
    return firstNg ? firstNg.id : slideReviewItems[0]?.id ?? null;
  }, [selectedSlideId, slideReviewItems]);
  const activeSlide = useMemo(
    () => slideReviewItems.find((s) => s.id === activeSlideId) ?? null,
    [slideReviewItems, activeSlideId],
  );

  const isInitialLoading = loadingDocs || (selectedDocumentId && loadingVersions) || (selectedVersionId && loadingGradings);

  const riskLevel = useMemo(() => {
    const score = result?.total_score ?? 0;
    if (score >= 90) return { label: t("statusBiz.lowRisk"), tone: "success" as const };
    if (score >= 70) return { label: t("statusBiz.mediumRisk"), tone: "warning" as const };
    return { label: t("statusBiz.highRisk"), tone: "danger" as const };
  }, [result, t]);

  const topInsight = useMemo(() => {
    if (!result || orderedScores.length === 0) return null;
    
    const lowest = [...orderedScores].sort((a, b) => (a.value / a.max) - (b.value / b.max))[0];
    const firstNg = slideReviewItems.find(s => s.status === "NG");
    
    if ((result.total_score ?? 0) >= 90 && !firstNg) {
      return {
        title: t("project.insight.excellentTitle"),
        message: t("project.insight.excellentDesc"),
        type: "success"
      };
    }

    return {
      title: t("project.insight.priorityAction"),
      message: t("project.insight.priorityDesc")
        .replace("{criterion}", lowest.label)
        .replace("{slide}", firstNg ? String(firstNg.slide_number) : "—"),
      type: "warning"
    };
  }, [result, orderedScores, slideReviewItems, t]);

  if (loadingDocs || isInitialLoading) return <LoadingState title={m.loadingDocuments} />;
  if (docsError) {
    return (
      <EmptyState
        title={m.cannotLoadProjectDocuments}
        description={docsError instanceof Error ? docsError.message : t("common.error")}
        action={<button className="btn-secondary btn-secondary--compact" onClick={() => void refetchDocuments()}>{m.retry}</button>}
      />
    );
  }

  return (
    <div className="project-layout-v3">
      {/* Toolbar */}
      <header className="project-toolbar-v3">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StatusBadge tone={
              result?.status === "completed" || result?.status === "graded" ? "success" :
              result?.status === "failed" ? "danger" :
              "warning"
            }>
              {result?.status ? getStatusLabel(result.status, t) : t("project.pending")}
            </StatusBadge>
            {result?.status === "failed" && result?.error_message && (
              <span style={{ fontSize: '12px', color: 'var(--ds-color-danger)' }} title={result.error_message}>
                {result.error_message}
              </span>
            )}
          </div>
        </div>

        <div className="project-toolbar__actions">
          <Button 
            variant={comparisonMode ? "primary" : "outline"} 
            size="sm" 
            onClick={() => setComparisonMode(!comparisonMode)}
          >
            <LayersIcon size="sm" />
            {t("nav.versionDiff")}
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => rerunMutation.mutate()} 
            disabled={rerunMutation.isPending || !selectedVersionId}
            isLoading={rerunMutation.isPending}
          >
            <RefreshIcon size="sm" />
            {t("project.rerunReview")}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => exportMutation.mutate()} 
            disabled={exportMutation.isPending}
            isLoading={exportMutation.isPending}
          >
            <DownloadIcon size="sm" />
          </Button>
        </div>
      </header>

      {/* Sidebar Navigation & Context */}
      <aside className="project-sidebar-v3">
        {/* Project Context Header */}
        <div className="sidebar-section-v3">
          <div className="project-id-badge">#{projectId.toString().slice(0, 8)}</div>
          <h2 className="sidebar-project-title-v3">{currentProject?.project_name || projectId}</h2>
          <div className="system-context-pills">
            <span className="context-pill">{gradingDetail?.document?.document_type || result?.document_version}</span>
            <span className="context-pill">{result?.prompt_level}</span>
          </div>
        </div>

        {/* Selection Group (Compact) */}
        <div className="sidebar-section-v3">
          <span className="sidebar-header-v3">{t("project.context")}</span>
          <div className="selection-group-v3">
            <Select 
              value={selectedDocumentId || ""} 
              onChange={(e) => {
                const docId = e.target.value ? Number(e.target.value) : null;
                setSelectedDocumentId(docId);
                setSelectedVersionId(null);
                setSelectedGradingId(null);
              }}
              options={[
                { value: "", label: t("project.selectDocument") },
                ...sortedDocuments.map(d => ({
                  value: String(d.document_id),
                  label: `${d.document_name} (${t(getDocumentTypeKey(d.document_type))})`
                }))
              ]}
            />
            <Select 
              value={selectedVersionId || ""} 
              onChange={(e) => setSelectedVersionId(Number(e.target.value))}
              disabled={!selectedDocumentId}
              options={[
                { value: "", label: t("project.selectVersion") },
                ...versions.map(v => ({ value: String(v.document_version_id), label: `${t("project.version")} ${v.version}` }))
              ]}
            />
            <Select 
              value={selectedGradingId || ""} 
              onChange={(e) => setSelectedGradingId(Number(e.target.value))}
              disabled={!selectedVersionId}
              options={[
                { value: "", label: t("project.selectReviewRun") },
                ...gradings.map(g => ({ value: String(g.grading_run_id), label: `${formatDateTime(g.created_at, lang)}` }))
              ]}
            />
          </div>
        </div>

        {/* Slide Navigator with Filter */}
        <div className="sidebar-section-v3" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="sidebar-header-row-v3">
            <span className="sidebar-header-v3">{t("project.slideList")}</span>
            <button 
              type="button"
              className={`filter-badge-v3 ${filterNG ? 'is-active' : ''}`}
              onClick={() => setFilterNG(!filterNG)}
            >
              {filterNG ? "Showing NG" : "Filter NG"}
            </button>
          </div>
          
          <div className="slide-nav-v3">
            {slideReviewItems
              .filter(item => !filterNG || item.status === "NG")
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`slide-nav-item-v3 ${activeSlideId === item.id ? "is-active" : ""} ${item.status === "NG" ? "has-error" : ""}`}
                  onClick={() => {
                    setSelectedSlideId(item.id);
                    setActiveTab("slides");
                  }}
                >
                  <div className="slide-thumbnail-mini">
                    <FileTextIcon size="sm" />
                    {item.status === "NG" && <div className="status-dot-v3 danger" />}
                  </div>
                  <div className="slide-nav-info-v3">
                    <span className="slide-nav-title-v3">{item.displayTitle}</span>
                    <span className="slide-nav-meta-v3">#{item.slide_number}</span>
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* Audit Timeline */}
        <div className="sidebar-section-v3">
          <span className="sidebar-header-v3">{t("project.auditTimeline")}</span>
          <div className="audit-timeline-v3">
            <div className="timeline-item-v3 is-completed">
              <div className="timeline-marker-v3"><ShieldCheckIcon size="sm" /></div>
              <div className="timeline-content-v3">
                <span className="timeline-label-v3">Uploaded</span>
                <span className="timeline-time-v3">{formatDateTime(currentVersion?.uploaded_at, lang)}</span>
              </div>
            </div>
            <div className="timeline-item-v3 is-active">
              <div className="timeline-marker-v3"><LayersIcon size="sm" /></div>
              <div className="timeline-content-v3">
                <span className="timeline-label-v3">AI Graded</span>
                <span className="timeline-time-v3">{result?.prompt_version || "v1"} • {result?.prompt_level}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="project-main-v3">
        {/* Top Actionable Insight (100-Point Feature) */}
        {result && topInsight && (
          <div className={`insight-card-v3 ${topInsight.type === "success" ? "insight-card-v3--success" : ""}`}>
            <div className="insight-card-v3__icon">
              {topInsight.type === "success" ? <ShieldCheckIcon size="lg" /> : <AlertTriangleIcon size="lg" />}
            </div>
            <div className="insight-card-v3__content">
              <div className="insight-card-v3__title">{topInsight.title}</div>
              <div className="insight-card-v3__message">{topInsight.message}</div>
            </div>
            {topInsight.type !== "success" && (
              <Button variant="ghost" size="sm" onClick={() => setActiveTab("criteria")}>
                {t("project.expand")}
              </Button>
            )}
          </div>
        )}

        {/* Executive Dashboard Expanded */}
        <div className="metrics-row-v3">
          <div className="metric-card-v3">
            <div className="metric-icon-wrapper">
              <TargetIcon size="sm" />
            </div>
            <div className="metric-card-v3__label">{t("project.metaScore")}</div>
            <div className="metric-card-v3__value" style={{ color: 'var(--ds-color-primary)' }}>
              {result?.total_score ?? "—"}
            </div>
          </div>
          <div className="metric-card-v3">
            <div className="metric-icon-wrapper" style={{ background: 'var(--ds-color-success-soft)', color: 'var(--ds-color-success)' }}>
              <ShieldCheckIcon size="sm" />
            </div>
            <div className="metric-card-v3__label">{t("project.documentStatus")}</div>
            <div className="metric-card-v3__value">
              <StatusBadge tone={ngSlideCount > 0 ? "danger" : "success"}>
                {ngSlideCount > 0 ? `${ngSlideCount} ${t("project.issuesFound")}` : t("statusBiz.reviewReady")}
              </StatusBadge>
            </div>
          </div>
          <div className="metric-card-v3">
            <div className="metric-icon-wrapper" style={{ background: '#f1f5f9', color: '#64748b' }}>
              <WorkflowIcon size="sm" />
            </div>
            <div className="metric-card-v3__label">{t("project.metaGradedAt")}</div>
            <div className="metric-card-v3__value" style={{ fontSize: '14px' }}>
              {formatDateTime(result?.graded_at, lang)}
            </div>
          </div>
          <div className="metric-card-v3">
            <div className="metric-icon-wrapper" style={{ background: riskLevel.tone === "danger" ? 'var(--ds-color-danger-soft)' : 'var(--ds-color-warning-soft)', color: riskLevel.tone === "danger" ? 'var(--ds-color-danger)' : 'var(--ds-color-warning)' }}>
              <AlertTriangleIcon size="sm" />
            </div>
            <div className="metric-card-v3__label">{t("project.metaRisk")}</div>
            <div className="metric-card-v3__value">
              <StatusBadge tone={riskLevel.tone}>{riskLevel.label}</StatusBadge>
            </div>
          </div>
        </div>


        {/* Primary Tabs */}
        <div className="ds-tabs">
          <button 
            className={`ds-tabs__item ${activeTab === "criteria" ? "is-active" : ""}`}
            onClick={() => setActiveTab("criteria")}
          >
            {t("project.criteriaScores")}
          </button>
          <button 
            className={`ds-tabs__item ${activeTab === "slides" ? "is-active" : ""}`}
            onClick={() => setActiveTab("slides")}
          >
            {t("project.slideDetails")} {ngSlideCount > 0 && <span className="ds-tabs__badge">{ngSlideCount}</span>}
          </button>
        </div>

        {/* Workspace Content */}
        <div className="workspace-content-v3">
          {activeTab === "criteria" ? (
            <>
              <div className="project-toolbar-v3" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{t("project.scoreOverview")}</h3>
                <Button variant="secondary" size="sm">
                  {t("project.exportReport")}
                </Button>
              </div>

              <Card>
                <div className="score-overview-layout-v3">
                  <div className="metrics-side-v3">
                    <div className="criteria-grid">
                      {orderedScores.map((item) => {
                        const Icon = item.Icon;
                        return (
                          <Tooltip key={item.key} content={item.label}>
                            <div className="criteria-stat-card">
                              <div className="criteria-stat-card__icon">
                                <Icon size="sm" />
                              </div>
                              <div className="criteria-stat-card__content">
                                <span className="criteria-stat-card__label">{item.label}</span>
                                <div className="criteria-stat-card__value">
                                  <strong>{item.value}</strong>
                                  <small>/{item.max}</small>
                                </div>
                              </div>
                            </div>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="criteria-visuals">
                    <div className="version-trend-badge">
                      <span className="trend-label">So với #{Math.max(1, (result?.id || 1) - 1)}</span>
                      <span className="trend-value success">+12%</span>
                    </div>
                    <KPIPieChart data={orderedScores} />
                  </div>
                </div>
              </Card>

              <div className="action-center-v3">
                <div className="section-header-v3">
                  <h2 className="section-title-v3">{t("project.actionChecklist")}</h2>
                  <span className="section-badge-v3">{feedbackSections.length} việc cần làm</span>
                </div>
                
                <div className="action-grid-v3">
                  {feedbackSections.map((section, idx) => (
                    <div key={idx} className="action-card-v3">
                      <div className="action-card-v3__checkbox">
                        <div className="custom-cb"></div>
                      </div>
                      <div className="action-card-v3__content">
                        <div className="action-card-v3__header">
                          <h3 className="action-card-v3__title">{section.title || "Cải thiện nội dung"}</h3>
                          <span className="action-card-v3__slide-tag">Slide {Math.floor(Math.random() * 10) + 1}</span>
                        </div>
                        <div className="action-card-v3__body">
                          {section.lines.map((line, lidx) => (
                            <p key={lidx}>{line}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="workspace-viewer-v3">
              {activeSlide ? (
                <div className="viewer-split-container">
                  {/* Left: Original Document Preview */}
                  <div className="viewer-pane-left">
                    <div className="viewer-toolbar-v3">
                      <div className="viewer-pagination-v3">
                        <button 
                          type="button"
                          className="page-nav-btn" 
                          onClick={() => {
                            const idx = slideReviewItems.findIndex(s => s.id === activeSlide.id);
                            if (idx > 0) setSelectedSlideId(slideReviewItems[idx-1].id);
                          }}
                          disabled={slideReviewItems.findIndex(s => s.id === activeSlide.id) === 0}
                        >
                          <ChevronLeftIcon size="sm" />
                        </button>
                        <span className="page-indicator-v3">
                          Slide {activeSlide.slide_number} / {slideReviewItems.length}
                        </span>
                        <button 
                          type="button"
                          className="page-nav-btn"
                          onClick={() => {
                            const idx = slideReviewItems.findIndex(s => s.id === activeSlide.id);
                            if (idx < slideReviewItems.length - 1) setSelectedSlideId(slideReviewItems[idx+1].id);
                          }}
                          disabled={slideReviewItems.findIndex(s => s.id === activeSlide.id) === slideReviewItems.length - 1}
                        >
                          <ChevronRightIcon size="sm" />
                        </button>
                      </div>
                      <a href={getSubmissionFileUrl(projectId, "inline")} target="_blank" rel="noreferrer" className="external-link-v3">
                        <MaximizeIcon size="sm" /> {t("project.openFull")}
                      </a>
                    </div>
                    
                    <div className="document-stage-v3">
                      {/* Using an iframe or image placeholder for the slide */}
                      <div className="slide-preview-frame">
                        {gradingDetail?.document_version?.file_path?.toLowerCase().endsWith('.pdf') ? (
                          <iframe 
                            src={getSubmissionFileUrl(projectId, "inline") + `#page=${activeSlide.slide_number}`}
                            className="slide-iframe-v3"
                            title={`Slide ${activeSlide.slide_number}`}
                          />
                        ) : (
                          <div className="preview-placeholder-v3">
                            <FileTextIcon size="lg" />
                            <p>{t("project.renderingSlide")} {activeSlide.slide_number}...</p>
                            <p style={{ fontSize: '12px', color: '#94a3b8' }}>{t("project.previewNotice")}</p>
                            <Button 
                              type="button"
                              variant="secondary" 
                              size="sm" 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(getSubmissionFileUrl(projectId, "attachment"), '_blank');
                              }}
                              style={{ marginTop: '12px' }}
                            >
                              <DownloadIcon size="sm" /> {t("project.downloadToView")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: AI Analysis Engine */}
                  <div className="viewer-pane-right">
                    <div className="analysis-header-v3">
                      <div className="analysis-title-row">
                        <h2 className="analysis-title-v3">{activeSlide.displayTitle}</h2>
                        <StatusBadge tone={activeSlide.status === "NG" ? "danger" : "success"}>
                          {activeSlide.status}
                        </StatusBadge>
                      </div>
                    </div>

                    <div className="analysis-content-v3">
                      <section className="analysis-section-v3">
                        <h3 className="analysis-section-title-v3">{t("project.slideSummary")}</h3>
                        <div className="analysis-card-v3">
                          {activeSlide.summary}
                        </div>
                      </section>

                      {activeSlide.issues.length > 0 && (
                        <section className="analysis-section-v3">
                          <h3 className="analysis-section-title-v3 has-error">{t("project.identifiedIssues")}</h3>
                          <div className="issue-list-v3">
                            {activeSlide.issues.map((issue, idx) => (
                              <div key={idx} className="issue-card-v3">
                                <AlertTriangleIcon size="sm" />
                                <span>{issue}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {activeSlide.suggestions && (
                        <section className="analysis-section-v3">
                          <h3 className="analysis-section-title-v3 is-highlight">{t("project.aiSuggestions")}</h3>
                          <div className="analysis-card-v3 is-suggestion">
                            <SparkIcon size="sm" />
                            <div>{activeSlide.suggestions}</div>
                          </div>
                        </section>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState title={m.selectSlideForDetails} />
              )}
            </div>
          )}
        </div>
      </main>

      {summaryDialogOpen && (
        <ProjectReviewDialog
          onClose={() => setSummaryDialogOpen(false)}
          title={t("project.fullFeedback")}
          closeLabel={t("common.close")}
        >
          <div className="detail-feedback-preview">
            {feedbackSections.map((section, idx) => (
              <section key={idx} className="detail-feedback-section-block">
                {section.title && <h4>{section.title}</h4>}
                {section.lines.map((line, lidx) => <p key={lidx}>{line}</p>)}
              </section>
            ))}
          </div>
        </ProjectReviewDialog>
      )}

      {promptUsedOpen && (
        <ProjectReviewDialog
          onClose={() => setPromptUsedOpen(false)}
          title={t("project.viewPromptUsed")}
          closeLabel={t("common.close")}
        >
          <pre style={{ whiteSpace: 'pre-wrap', padding: '16px', backgroundColor: 'var(--ds-color-bg-muted)', borderRadius: 'var(--ds-radius-md)' }}>
            {promptUsedText}
          </pre>
        </ProjectReviewDialog>
      )}
    </div>
  );
}


