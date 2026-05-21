import { useEffect, useMemo, useState } from "react";
import { getDocumentTypeKey } from "../../constants/documentTypes";
import { useTranslation } from "../LanguageSelector";
import {
  RefreshIcon,
  ShieldCheckIcon,
  TargetIcon,
  AlertTriangleIcon,
  LayersIcon,
  SparkIcon,
  AlertCircleIcon,
} from "../ui/Icon";
import ProjectReviewDialog from "./ProjectReviewDialog";
import ProjectCriteriaTab from "./ProjectCriteriaTab";
import ProjectSlidesTab from "./ProjectSlidesTab";
import ProjectOverviewTab from "./ProjectOverviewTab";
import ProjectReportView from "./ProjectReportView";
import type { ProjectCriteriaTabViewModel, ProjectSlidesTabViewModel } from "./projectCard.viewModels";
import { EmptyState } from "../ui/States";
import { Button, SearchableSelect } from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import { formatDateTime } from "./projectCard.helpers";
import { buildActionChecklist } from "./projectCard.helpers";
import { useProjectReviewState } from "./useProjectReviewState";
import { evaluateRunDataHealth } from "./runDataHealth";
import "./ProjectCard.css";

interface ProjectCardProps {
  projectId: string;

  setTopbarActions?: (actions: React.ReactNode) => void;
}

function resolveRunErrorMessage(status: string | undefined | null, errorMessage: string | null | undefined, t: (key: string) => string): string {
  if (errorMessage && errorMessage.trim()) return errorMessage.trim();
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("invalid_ai_response")) {
    return "Phan hoi AI khong dung dinh dang mong doi. Vui long thu review lai hoac kiem tra cau hinh prompt/rubric.";
  }
  if (normalized.startsWith("failed")) {
    return "Run da that bai nhung backend khong tra ve chi tiet loi.";
  }
  return t("common.unknownError");
}

function isSoftInvalidAiResponse(status: string | undefined | null, hasUsableData: boolean): boolean {
  const normalized = String(status || "").toLowerCase();
  return hasUsableData && normalized.includes("invalid_ai_response");
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

function renderInlineMarkdownBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`b-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`t-${index}`}>{part}</span>;
  });
}

function ProjectCardSkeleton() {
  return (
    <div className="project-layout-v3 ds-skeleton-wrapper">
      <div className="project-main-v3" style={{ width: '100%' }}>
        <div className="metrics-row-v3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="metric-card-v3">
              <div className="ds-skeleton" style={{ width: '40%', height: '12px', marginBottom: '8px' }} />
              <div className="ds-skeleton" style={{ width: '60%', height: '24px' }} />
            </div>
          ))}
        </div>
        <div className="ds-card" style={{ height: '400px', padding: '24px' }}>
          <div className="ds-skeleton" style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}

export default function ProjectCard({ projectId, setTopbarActions }: ProjectCardProps) {
  const { lang, t } = useTranslation();
  const m = phase2Text(t);

  const { uiState, dataState, actions, derived } = useProjectReviewState({ projectId, lang, t });
  const {
    selectedDocumentId,
    setSelectedDocumentId,
    selectedVersionId,
    setSelectedVersionId,
    selectedGradingId,
    setSelectedGradingId,
    activeTab,
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
    scrollToSection,
  } = uiState;
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const { loadingDocs, docsError, refetchDocuments, versions, gradings, sortedDocuments, gradingDetail, currentProject, currentVersion } = dataState;
  const { rerunMutation } = actions;
  const { result, pageReviewItems, ngPageCount, orderedScores, feedbackSections, activeSlide, isInitialLoading } = derived;
  const displayScore = result?.total_score ?? result?.score ?? null;
  const displayModel = result?.gemini_model ?? "Gemini (chưa lưu model cụ thể)";
  const hasActiveRunOnVersion = gradings.some((g) => {
    const s = (g.status || "").toLowerCase();
    return s === "pending" || s === "extracting" || s === "grading";
  });
  const resultStatusUpper = (result?.status || "").toUpperCase();
  const isFailedStatus = resultStatusUpper.startsWith("FAILED");
  const isProcessingStatus =
    resultStatusUpper === "PENDING" ||
    resultStatusUpper === "EXTRACTING" ||
    resultStatusUpper === "GRADING";
  const runHealth = evaluateRunDataHealth(result as any, gradingDetail as any);
  const hasUsableRunData = runHealth.hasUsableData;
  const isSoftFail = isSoftInvalidAiResponse(result?.status, hasUsableRunData);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Filter 1: Document Types (Unique from all documents in project)
  const docTypes = useMemo(() => {
    const types = Array.from(new Set(sortedDocuments.map(d => d.document_type)));
    return types.map(tKey => ({ value: tKey, label: t(getDocumentTypeKey(tKey)) }));
  }, [sortedDocuments, t]);

  // Sync selectedType with current selectedDocument
  const currentDoc = useMemo(() => sortedDocuments.find(d => d.document_id === selectedDocumentId), [sortedDocuments, selectedDocumentId]);
  useEffect(() => {
    if (currentDoc) {
      setSelectedType(currentDoc.document_type);
    }
  }, [currentDoc]);

  // Filter 2: Document Names (Filtered by Type)
  const filteredDocs = useMemo(() => {
    if (!selectedType) return sortedDocuments;
    return sortedDocuments.filter(d => d.document_type === selectedType);
  }, [sortedDocuments, selectedType]);

  const handleTypeChange = (type: string) => {
    if (!type) return;
    setSelectedType(type);
    const firstOfType = sortedDocuments.find(d => d.document_type === type);
    if (firstOfType) {
      setSelectedDocumentId(firstOfType.document_id);
      setSelectedVersionId(null);
      setSelectedGradingId(null);
    }
  };

  useEffect(() => {
    if (!setTopbarActions) return;
    setTopbarActions(null);
    return () => {
      setTopbarActions(null);
    };
  }, [setTopbarActions]);



  // Categorize AI feedback into 3 specific buckets as requested
  const categorizedInsights = useMemo(() => {
    // 1. Tiêu chí cần cải thiện (from structured criteria/page signals first)
    const sortedScores = [...orderedScores].sort((a, b) => (a.value / (a.max || 1)) - (b.value / (b.max || 1)));
    const lowest = sortedScores.length > 0 ? sortedScores[0] : null;
    const ngSlides = pageReviewItems.filter((s) => s.status === "NG");
    const topNgSlide = ngSlides[0];

    // 2. Nhận xét quan trọng (prefer page-level evidence, fallback draft feedback)
    const generalSection = feedbackSections.find(s => 
      /kết luận|tổng quan|nhận xét|tóm tắt|executive|総評|要約/i.test(s.title)
    ) || feedbackSections[0];

    const distilledSummary = generalSection?.lines.find(line => 
      line.length > 30 && !/slide|trang|trường hợp|ページ/i.test(line)
    ) || generalSection?.lines[0];

    // 3. Điểm tích cực (prefer structured strongest criterion, fallback feedback)
    const positiveSection = feedbackSections.find(s => 
      /tốt|tích cực|ưu điểm|đạt|excellent|success|良い|強み/i.test(s.title)
    );
    const distilledPositive = positiveSection?.lines.find(line => 
      line.length > 25 && !/slide|trang/i.test(line)
    ) || positiveSection?.lines[0];
    const highest = [...orderedScores].sort((a, b) => (b.value / (b.max || 1)) - (a.value / (a.max || 1)))[0];

    return [
      {
        title: t("project.insight.weakestCriterion"),
        content: (() => {
          const parts = [];
          if (lowest) parts.push(`**${lowest.label}** (${lowest.value}/${lowest.max})`);

          if (ngSlides.length > 0) {
            parts.push(`${t("project.ngSlideCount")}: **${ngSlides.length}** (${ngSlides.map(s => s.page_number ?? s.slide_number).slice(0, 3).join(", ")}...)`);
          }

          const issuesSection = feedbackSections.find(s => 
            /xấu|vấn đề|cải thiện|hạn chế|lỗi|nghiêm trọng|thất bại|không đạt|課題|問題|改善/i.test(s.title)
          );

          if (issuesSection?.lines[0]) {
            parts.push(issuesSection.lines[0]);
          } else if (topNgSlide?.summary) {
            parts.push(topNgSlide.summary);
          }

          return parts.length > 0 ? parts.join(". ") : t("project.noSeriousIssues");
        })(),
        type: (lowest && lowest.value / lowest.max < 0.7) || ngPageCount > 0 ? "danger" : "neutral",
        Icon: AlertTriangleIcon
      },
      {
        title: t("project.insight.importantComments"),
        content: topNgSlide?.summary || distilledSummary || t("project.executiveSummarySubtitle"),
        type: "primary",
        Icon: TargetIcon
      },
      {
        title: t("project.insight.positivePoints"),
        content:
          distilledPositive ||
          (highest && highest.value / highest.max >= 0.8
            ? `**${highest.label}** (${highest.value}/${highest.max})`
            : t("project.positivePointPlaceholder")),
        type: "success",
        Icon: ShieldCheckIcon
      }
    ];

  }, [feedbackSections, ngPageCount, t, orderedScores, pageReviewItems]);

  const verdictText = useMemo(() => {
    if (typeof displayScore !== "number") return t("project.executiveSummarySubtitle");
    const sortedScores = [...orderedScores].sort(
      (a, b) => (a.value / (a.max || 1)) - (b.value / (b.max || 1)),
    );
    const weakest = sortedScores[0];
    const ngSlides = pageReviewItems.filter((s) => s.status === "NG");

    if (weakest && ngSlides.length > 0) {
      return `Tài liệu đang ở mức ${displayScore}/100; mất điểm nhiều ở "${weakest.label}" (${weakest.value}/${weakest.max}) và còn ${ngSlides.length} trang cần xử lý trước khi chốt.`;
    }
    if (weakest) {
      return `Tài liệu đang ở mức ${displayScore}/100; nên ưu tiên cải thiện tiêu chí "${weakest.label}" (${weakest.value}/${weakest.max}) trước khi chốt.`;
    }
    if (displayScore >= 80) return t("project.summaryScoreHealthy", { score: displayScore });
    if (displayScore >= 60) return t("project.summaryScoreWatch", { score: displayScore });
    return t("project.summaryScoreCritical", { score: displayScore });
  }, [displayScore, orderedScores, pageReviewItems, t]);

  const actionItems = useMemo(
    () => buildActionChecklist(gradingDetail?.criteria_results || [], pageReviewItems, lang, 10),
    [gradingDetail, pageReviewItems, lang],
  );

  if (loadingDocs || isInitialLoading) return <ProjectCardSkeleton />;

  const criteriaViewModel: ProjectCriteriaTabViewModel = {
    lang,
    gradingDetail,
    orderedScores,
    hoveredCriterion,
    result,
    feedbackSections,
    gradings,
  };


  const slidesViewModel: ProjectSlidesTabViewModel = {
    gradingDetail,
    pageReviewItems,
    activeSlide,
  };

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
      {/* Main Content Workspace */}
      <div className="project-main-v3">
        {/* Táº§ng 2.5 + Táº§ng 3: Unified Analytical Header */}
        <div className="analytical-header-v4__selectors">
          <SearchableSelect 
            placeholder={t("project.selectDocumentType")}
            value={selectedType || ""} 
            onChange={handleTypeChange}
            options={docTypes}
            style={{ width: '100%' }}
          />
          <SearchableSelect 
            placeholder={t("project.selectDocument")}
            value={selectedDocumentId ? String(selectedDocumentId) : ""} 
            onChange={(val) => {
              setSelectedDocumentId(Number(val));
              setSelectedVersionId(null);
              setSelectedGradingId(null);
              setSelectedSlideId(null);
            }}
            options={filteredDocs.map(d => ({
              value: String(d.document_id),
              label: d.document_name || t(getDocumentTypeKey(d.document_type))
            }))}
            disabled={!selectedType}
            style={{ width: '100%' }}
          />
          <SearchableSelect 
            placeholder={t("project.selectVersion")}
            value={selectedVersionId ? String(selectedVersionId) : ""} 
            onChange={(val) => {
              setSelectedVersionId(Number(val));
              setSelectedGradingId(null);
              setSelectedSlideId(null);
            }}
            disabled={!selectedDocumentId}
            options={versions.map(v => ({ 
              value: String(v.document_version_id), 
              label: `${t("project.version")} ${v.version}` 
            }))}
            style={{ width: '100%' }}
          />
          <SearchableSelect 
            placeholder={t("project.selectReviewRun")}
            value={selectedGradingId ? String(selectedGradingId) : ""} 
            onChange={(val) => {
              setSelectedGradingId(Number(val));
              setSelectedSlideId(null);
            }}
            disabled={!selectedVersionId}
            options={gradings.map(g => ({ 
              value: String(g.grading_run_id), 
              label: `${formatDateTime(g.created_at, lang)}` 
            }))}
            style={{ width: '100%' }}
          />
        </div>

        <div className="analytical-header-v4__metrics">
          {/* Score Badge */}
          <div className={`score-badge-v4 ${typeof displayScore === "number" && displayScore >= 80 ? 'success' : typeof displayScore === "number" && displayScore >= 60 ? 'warning' : 'danger'}`}>
            <span className="metric-item-v4__label" style={{ color: 'inherit' }}>{t("project.metaScore")}</span>
            <span style={{ fontSize: '18px' }}>{displayScore ?? "—"}</span>
          </div>

          {/* Audit Metadata */}
          <div className="metric-item-v4" style={{ gap: '4px' }}>
            <span className="meta-tag-v4" style={{ opacity: 0.7 }}>
              <ShieldCheckIcon size="sm" /> {displayModel}
            </span>
          </div>
          <div className="header-actions-inline-v4">
            <Button 
              variant="primary" 
              size="md" 
              onClick={() => setConfirmReviewOpen(true)} 
              disabled={rerunMutation.isPending || !selectedVersionId || hasActiveRunOnVersion}
              isLoading={rerunMutation.isPending}
            >
              <RefreshIcon size="sm" />
              {hasActiveRunOnVersion ? t("project.gradingProcessing") : t("project.rerunReview")}
            </Button>
            <Button 
              variant="outline" 
              size="md" 
              onClick={() => window.print()} 
              disabled={!selectedGradingId || !gradingDetail}
            >
              <ShieldCheckIcon size="sm" /> {t("project.exportPdfReport")}
            </Button>
          </div>
        </div>

        {/* Status Notification Banner for non-completed runs */}
        {result && (resultStatusUpper !== "COMPLETED" || runHealth.isCompletedButMissingCriteria) && (
          <div className={`status-banner-v4 is-${result.status?.toLowerCase()}`} style={{ 
            padding: '12px 20px', 
            borderRadius: '10px', 
            marginBottom: '20px',
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            background: isFailedStatus && !isSoftFail ? 'var(--ds-color-danger-soft)' : 'var(--ds-color-bg-app)',
            border: `1px solid ${isFailedStatus && !isSoftFail ? 'var(--ds-color-danger-light)' : 'var(--ds-color-border)'}`,
            color: isFailedStatus && !isSoftFail ? 'var(--ds-color-danger-dark)' : 'var(--ds-color-text-body)'
          }}>
            {isFailedStatus && !isSoftFail ? <AlertCircleIcon size="sm" /> : <RefreshIcon size="sm" className={isProcessingStatus ? "spin" : ""} />}
            <div style={{ flex: 1, fontSize: '13.5px', fontWeight: 600 }}>
              {isSoftFail
                ? "Canh bao chat luong AI: He thong da tu chuan hoa phan hoi, ket qua chi tiet van co the su dung."
                : isFailedStatus 
                ? `${t("project.gradingFailedLabel")}: ${resolveRunErrorMessage(result.status, result.error_message, t)}`
                : isProcessingStatus
                ? `${t("project.gradingProcessing")} (${result.status})`
                : `${result.status}`
              }
            </div>
          </div>
        )}

        {/* AI Final Verdict Banner */}
        {result && (
          <div className="ai-verdict-banner">
            <div className="ai-verdict-banner__icon">
              <SparkIcon />
            </div>
            <div className="ai-verdict-banner__content">
              <div className="ai-verdict-banner__title">{t("project.executiveSummary")}</div>
              <div className="ai-verdict-banner__text">
                {verdictText}
              </div>
            </div>
          </div>
        )}

        {/* AI Insight Panel - Unified 3-Block Categorized Layout */}
        <div className="insights-panel-v4">
          {categorizedInsights.map((insight, idx) => (
            <div key={idx} className={`insight-card-v4 priority-${insight.type}`}>
              <div className="insight-card-v4__header">
                <insight.Icon size="sm" />
                <span>{insight.title}</span>
              </div>
              <div className="insight-card-v4__content">
                {renderInlineMarkdownBold(insight.content)}
              </div>
            </div>
          ))}
        </div>

        {/* Tab Selection as Scroll Anchors */}
        <div className="ds-tabs sticky-tabs">
          <button 
            className={`ds-tabs__item ${activeTab === "overview" ? "is-active" : ""}`}
            onClick={() => scrollToSection("overview")}
          >
            {t("project.tabOverview")}
          </button>
          <button 
            className={`ds-tabs__item ${activeTab === "criteria" ? "is-active" : ""}`}
            onClick={() => scrollToSection("criteria")}
          >
            {t("project.tabAnalysis")}
          </button>
          <button 
            className={`ds-tabs__item ${activeTab === "slides" ? "is-active" : ""}`}
            onClick={() => scrollToSection("slides")}
          >
            {t("project.tabSlidesResult")} {ngPageCount > 0 && <span className="ds-tabs__badge">{ngPageCount}</span>}
          </button>
        </div>

        {/* Unified Scroll Content */}
        <div className="workspace-single-scroll">
          <section id="section-overview" className="scroll-section">
            <ProjectOverviewTab 
              t={t} 
              feedbackSections={criteriaViewModel.feedbackSections} 
              ngPageCount={ngPageCount}
              pageReviewItems={slidesViewModel.pageReviewItems}
              actionItems={actionItems}
            />
          </section>

          <div className="section-divider" />

          <section id="section-criteria" className="scroll-section">
            <header className="section-header-v3" style={{ marginTop: '14px', marginBottom: '16px' }}>
              <h2 className="section-title-v3">
                <TargetIcon size="sm" /> {t("project.tabAnalysis")}
              </h2>
            </header>
            <ProjectCriteriaTab
              t={t}
              viewModel={criteriaViewModel}
              setHoveredCriterion={setHoveredCriterion}
            />
          </section>

          <div className="section-divider" />

          <section id="section-slides" className="scroll-section">
            <header className="section-header-v3" style={{ marginBottom: '16px' }}>
              <h2 className="section-title-v3">
                <LayersIcon size="sm" /> {t("project.tabSlidesResult")}
              </h2>
            </header>
            <ProjectSlidesTab
              t={t}
              projectId={projectId}
              viewModel={slidesViewModel}
              setSelectedSlideId={setSelectedSlideId}
              lang={lang}
              filterNG={filterNG}
              setFilterNG={setFilterNG}
            />
          </section>
        </div>
        
        {/* Extra spacer for scroll comfort on small screens */}
        <div style={{ height: '20vh' }} />
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
          <pre style={{ whiteSpace: 'pre-wrap', padding: '16px', backgroundColor: 'var(--ds-color-bg-app)', borderRadius: 'var(--ds-radius-md)', fontSize: '13px', border: '1px solid var(--ds-color-border)' }}>
            {promptUsedText}
          </pre>
        </ProjectReviewDialog>
      )}

      <ConfirmDialog
        open={confirmReviewOpen}
        title={t("project.confirmReviewTitle")}
        description={t("project.confirmReviewDesc")}
        details={[
          currentVersion ? `${t("project.version")}: ${currentVersion.version}` : "",
          result?.prompt_level ? `${t("project.metaLevel")}: ${result.prompt_level}` : "",
        ].filter(Boolean)}
        confirmLabel={t("project.confirmReviewStart")}
        cancelLabel={t("common.cancel")}
        tone="primary"
        isLoading={rerunMutation.isPending}
        onConfirm={() => {
          setConfirmReviewOpen(false);
          rerunMutation.mutate();
        }}
        onCancel={() => setConfirmReviewOpen(false)}
      />

      {/* Hidden Print View */}
      {gradingDetail && (
        <ProjectReportView 
          t={t}
          projectTitle={currentProject?.project_name || projectId}
          versionInfo={currentVersion?.version ? `${t("project.version")} ${currentVersion.version}` : "â€”"}
          gradingDate={result?.graded_at ? formatDateTime(result.graded_at, lang) : "â€”"}
          totalScore={displayScore || 0}
          geminiModel={displayModel}
          feedbackSections={feedbackSections}
          orderedScores={orderedScores}
          slidesViewModel={slidesViewModel}
          lang={lang}
          extractedText={gradingDetail?.document_version?.extracted_text || undefined}
          promptLevel={result?.prompt_level || undefined}
          categorizedInsights={categorizedInsights}
          gradingDetail={gradingDetail}
          verdictText={
            typeof displayScore === "number" && displayScore >= 80 
              ? t("project.summaryScoreHealthy", { score: displayScore })
              : typeof displayScore === "number" && displayScore >= 60
              ? t("project.summaryScoreWatch", { score: displayScore })
              : t("project.summaryScoreCritical", { score: displayScore || 0 })
          }
        />
      )}
    </div>
  );
}



