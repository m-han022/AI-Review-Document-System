import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { 
  listProjectDocuments, 
  listProjects,
  listDocumentVersions, 
  listVersionGradings, 
  getGradingRun,
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
  ArrowLeftIcon,
  BookOpenIcon,
  DownloadIcon,
  RefreshIcon,
  ShieldCheckIcon,
  SparkIcon,
  TargetIcon,
  WorkflowIcon,
  AlertTriangleIcon,
  LayersIcon,
  ChevronRightIcon
} from "../ui/Icon";
import { formatUploadedAt } from "../submissions/utils";
import ProjectReviewDialog from "./ProjectReviewDialog";
import {
  type FeedbackSectionView
} from "./ProjectReviewPanels";
import { LoadingState, EmptyState, StatusBadge, Tooltip } from "../ui/States";
import { Button, Card, Select } from "../ui";
import { KPIBarChart } from "../ui/KPICharts";



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

export default function ProjectCard({ projectId, onBack }: ProjectCardProps) {
  const { lang, t } = useTranslation();
  const m = phase2Text(t);
  const queryClient = useQueryClient();
  
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedGradingId, setSelectedGradingId] = useState<number | null>(null);
  
  const [activeTab, setActiveTab] = useState<"criteria" | "slides">("criteria");
  const [selectedSlideId, setSelectedSlideId] = useState<number | null>(null);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [promptUsedOpen, setPromptUsedOpen] = useState(false);
  const [promptUsedText] = useState("");
  const [, setActionMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [showGovernanceDetails, setShowGovernanceDetails] = useState(false);

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
  const currentDocument = sortedDocuments.find(d => d.document_id === selectedDocumentId);
  const currentVersion = versions.find(v => v.document_version_id === selectedVersionId);
  const currentGrading = gradings.find((g) => g.grading_run_id === selectedGradingId) ?? null;

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

  if (loadingDocs) return <LoadingState title={m.loadingDocuments} />;
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
    <div className="project-workspace">
      {/* Toolbar */}
      <div className="project-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button variant="ghost" onClick={onBack} size="sm">
            <ArrowLeftIcon size="sm" />
          </Button>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGovernanceDetails((prev) => !prev)}
          >
            {showGovernanceDetails ? t("project.hideGovernanceDetails") : t("project.showGovernanceDetails")}
          </Button>
        </div>
      </div>

      {/* Governance Details (Collapsible) */}
      {showGovernanceDetails && (
        <>
          <Card title={t("project.governanceDetails")} subtitle={m.auditContextSubtitle}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: '16px' }}>
              <StatusBadge tone="primary">{m.project}: {currentProject?.project_id ?? projectId}</StatusBadge>
              <StatusBadge tone="muted">{m.document}: {currentDocument?.document_name ?? m.notSelected}</StatusBadge>
              <StatusBadge tone={currentVersion?.is_latest ? "success" : "muted"}>
                {m.version}: {currentVersion?.version ?? m.notSelected} {currentVersion?.is_latest ? "(latest)" : ""}
              </StatusBadge>
              <StatusBadge tone="muted">
                {m.gradingRun}: {currentGrading ? `#${currentGrading.grading_run_id}` : m.notSelected}
              </StatusBadge>
              <StatusBadge tone={result?.evaluation_set_id ? "success" : "warning"}>
                {m.evaluationSet}: {result?.evaluation_set_id ? `#${result.evaluation_set_id}` : m.autoUnresolved}
              </StatusBadge>
            </div>
            <div className="governance-grid">
              <Card title={t("project.documents")}>
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
              </Card>
              <Card title={t("project.versions")}>
                <Select 
                  value={selectedVersionId || ""} 
                  onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                  disabled={!selectedDocumentId}
                  options={[
                    { value: "", label: t("project.selectVersion") },
                    ...versions.map(v => ({ value: String(v.document_version_id), label: v.version }))
                  ]}
                />
              </Card>
              <Card title={t("project.reviewHistory")}>
                <Select 
                  value={selectedGradingId || ""} 
                  onChange={(e) => setSelectedGradingId(Number(e.target.value))}
                  disabled={!selectedVersionId}
                  options={[
                    { value: "", label: t("project.selectReviewRun") },
                    ...gradings.map(g => ({ value: String(g.grading_run_id), label: `${formatDateTime(g.created_at, lang)}` }))
                  ]}
                />
              </Card>
            </div>
          </Card>
        </>
      )}

      {/* Overview Grid */}
      <div className="governance-grid">
        <Card className="ds-card--metrics">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Tooltip content={t("project.explainability.totalScore")}>
              <div>
                <p className="criteria-stat-card__label" style={{ marginBottom: '4px', cursor: 'help' }}>
                  {t("project.metaScore")}
                </p>
                <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ds-color-primary)' }}>
                  {result?.total_score ?? "—"}
                </div>
              </div>
            </Tooltip>
            <div className="metrics-icon primary">
              <TargetIcon size="md" />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <StatusBadge tone={(result?.total_score ?? 0) >= 80 ? "success" : "warning"}>
              {(result?.total_score ?? 0) >= 80 ? t("statusBiz.reviewReady") : t("statusBiz.attentionNeeded")}
            </StatusBadge>
          </div>
        </Card>

        <Card className="ds-card--metrics">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p className="criteria-stat-card__label" style={{ marginBottom: '4px' }}>{t("project.metaDocument")}</p>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>
                {currentDocument?.document_name ?? t("common.noValue")}
              </div>
            </div>
            <div className="metrics-icon muted">
              <BookOpenIcon size="md" />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--ds-color-text-muted)' }}>
            {t("project.metaVersion")}: <strong>{currentVersion?.version || "—"}</strong>
          </div>
        </Card>

        <Card className="ds-card--metrics">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p className="criteria-stat-card__label" style={{ marginBottom: '4px' }}>{t("project.metaGradedAt")}</p>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>
                {formatDateTime(result?.graded_at, lang)}
              </div>
            </div>
            <div className="metrics-icon muted">
              <RefreshIcon size="md" />
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--ds-color-text-muted)' }}>
            {t("project.metaPrompt")}: <strong>v{result?.prompt_version || "—"}</strong>
          </div>
        </Card>
      </div>

      <div className="project-content-grid">
        {/* Left: Sidebar Navigation */}
        <div className="project-detail-sidebar">
          <Card>
            <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>{t("project.slideList")}</h3>
            <div className="slide-list">
              {slideReviewItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`slide-item ${activeSlideId === item.id ? "is-active" : ""}`}
                  onClick={() => setSelectedSlideId(item.id)}
                >
                  <div className="slide-item__status">
                    <span className={`status-dot status-dot--${item.status === "NG" ? "danger" : "success"}`} />
                  </div>
                  <span className="slide-item__number">#{item.slide_number}</span>
                  <span className="slide-item__title">{item.displayTitle}</span>
                  {activeSlideId === item.id && <ChevronRightIcon size="sm" />}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: Main Content */}
        <div className="project-detail-main">
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

          <div className="tab-content">
            {activeTab === "criteria" ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <Card title={t("project.scoreOverview")}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                    <div className="criteria-grid">
                      {orderedScores.map((item) => {
                        const Icon = item.Icon;
                        return (
                          <Tooltip key={item.key} content={t("project.explainability.criterion").replace("{name}", item.label)}>
                            <div className="criteria-stat-card" style={{ cursor: 'help' }}>
                              <div className="criteria-stat-card__icon">
                                <Icon size="md" />
                              </div>
                              <div className="criteria-stat-card__info">
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
                    
                    <div className="criteria-visuals">
                      <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-color-text-muted)', marginBottom: '16px' }}>
                        {t("project.visualDistribution")}
                      </h4>
                      <KPIBarChart data={orderedScores} />
                    </div>
                  </div>
                </Card>

                <div className="feedback-section">
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>{t("project.feedbackTitle")}</h2>
                  <div className="feedback-cards">
                    {feedbackSections.map((section, idx) => (
                      <div key={idx} className="feedback-card">
                        {section.title && <h3 className="feedback-card__title">{section.title}</h3>}
                        <div className="feedback-card__content">
                          {section.lines.map((line, lidx) => (
                            <p key={lidx}>{line}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="slide-detail-view">
                {activeSlide ? (
                  <div className="slide-detail">
                    <div className="slide-header">
                      <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{activeSlide.displayTitle}</h2>
                      <StatusBadge tone={activeSlide.status === "NG" ? "danger" : "success"}>
                        {activeSlide.status}
                      </StatusBadge>
                    </div>

                    <Card title={t("project.slideSummary")}>
                      <p style={{ lineHeight: 1.6 }}>{activeSlide.summary}</p>
                    </Card>

                    {activeSlide.issues.length > 0 && (
                      <div className="detail-section">
                        <h3 className="detail-section__title">
                          <AlertTriangleIcon size="sm" />
                          {t("project.identifiedIssues")}
                        </h3>
                        <div className="issue-list">
                          {activeSlide.issues.map((issue, idx) => (
                            <div key={idx} className="issue-item">
                              <span className="issue-item__bullet" />
                              {issue}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeSlide.suggestions && (
                      <div className="detail-section">
                        <h3 className="detail-section__title">
                          <SparkIcon size="sm" />
                          {t("project.aiSuggestions")}
                        </h3>
                        <div className="detail-card detail-card--suggestion">
                          {activeSlide.suggestions}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState title={m.selectSlideForDetails} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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


