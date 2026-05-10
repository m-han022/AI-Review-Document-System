import { useEffect, useMemo, useState } from "react";
import { getDocumentTypeKey } from "../../constants/documentTypes";
import { useTranslation } from "../LanguageSelector";
import { getLocalizedText } from "../../locales/utils";
import {
  DownloadIcon,
  RefreshIcon,
  ShieldCheckIcon,
  TargetIcon,
  WorkflowIcon,
  AlertTriangleIcon,
  LayersIcon,
  ArrowLeftIcon,
  SparkIcon,
} from "../ui/Icon";
import ProjectReviewDialog from "./ProjectReviewDialog";
import ProjectCriteriaTab from "./ProjectCriteriaTab";
import ProjectSlidesTab from "./ProjectSlidesTab";
import ProjectOverviewTab from "./ProjectOverviewTab";
import type { ProjectCriteriaTabViewModel, ProjectSlidesTabViewModel } from "./projectCard.viewModels";
import { EmptyState, StatusBadge } from "../ui/States";
import { Button, Select } from "../ui";
import {
  formatDateTime,
  getStatusLabel,
} from "./projectCard.helpers";
import { useProjectReviewState } from "./useProjectReviewState";
import "./ProjectCard.css";
import { Tooltip } from "../ui/States";

interface ProjectCardProps {
  projectId: string;
  onBack: () => void;
  setTopbarActions?: (actions: React.ReactNode) => void;
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

export default function ProjectCard({ projectId, onBack, setTopbarActions }: ProjectCardProps) {
  const { lang, t } = useTranslation();
  const m = phase2Text(t);
  const [showTimeline, setShowTimeline] = useState(false);
  const { uiState, dataState, actions, derived } = useProjectReviewState({ projectId, lang, t });
  const {
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
  } = uiState;
  const { loadingDocs, docsError, refetchDocuments, versions, gradings, sortedDocuments, gradingDetail, currentProject, currentVersion } = dataState;
  const { rerunMutation, exportMutation } = actions;
  const { result, slideReviewItems, ngSlideCount, orderedScores, feedbackSections, activeSlide, isInitialLoading, riskLevel, topInsight } = derived;

  useEffect(() => {
    if (setTopbarActions) {
      setTopbarActions(
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
            onClick={() => exportMutation.mutate({})} 
            disabled={exportMutation.isPending}
            isLoading={exportMutation.isPending}
          >
            <DownloadIcon size="sm" />
          </Button>
        </div>
      );
    }
    return () => {
      if (setTopbarActions) setTopbarActions(null);
    };
  }, [setTopbarActions, comparisonMode, rerunMutation.isPending, selectedVersionId, t, exportMutation.isPending]);

  // Extract top 3 AI comments for the professional summary layout
  const topComments = feedbackSections
    .flatMap(s => s.lines)
    .filter(line => line.length > 20) 
    .slice(0, 3);

  // Categorize AI feedback into 3 specific buckets as requested
  const categorizedInsights = useMemo(() => {
    // 1. Tiêu chí cần cải thiện (Weakest Link)
    const sortedScores = [...orderedScores].sort((a, b) => (a.value / (a.max || 1)) - (b.value / (b.max || 1)));
    const lowest = sortedScores.length > 0 ? sortedScores[0] : null;
    const seriousSection = feedbackSections.find(s => 
      /xấu|vấn đề|cải thiện|hạn chế|lỗi|nghiêm trọng|ng/i.test(s.title)
    );
    
    // 2. Nhận xét quan trọng (Important Comments) - Chắt lọc nội dung chiến lược
    const generalSection = feedbackSections.find(s => 
      /kết luận|tổng quan|nhận xét|tóm tắt|executive/i.test(s.title)
    ) || feedbackSections[0];

    const distilledSummary = generalSection?.lines.find(line => 
      line.length > 30 && !/slide|trang|trường hợp/i.test(line)
    ) || generalSection?.lines[0];

    // 3. Điểm tích cực (Positive Points) - Chắt lọc nội dung từ văn bản AI
    const positiveSection = feedbackSections.find(s => 
      /tốt|tích cực|ưu điểm|đạt|excellent|success/i.test(s.title)
    );
    const distilledPositive = positiveSection?.lines.find(line => 
      line.length > 25 && !/slide|trang/i.test(line)
    ) || positiveSection?.lines[0];

    const highest = [...orderedScores].sort((a, b) => (b.value / (a.max || 1)) - (a.value / (b.max || 1)))[0];



    return [
      {
        title: t("project.insight.weakestCriterion") || "Tiêu chí cần cải thiện",
        content: (() => {
          const parts = [];
          if (lowest) parts.push(`${lowest.label} (${lowest.value}/${lowest.max})`);
          
          const ngSlides = slideReviewItems.filter(s => s.status === "NG");
          if (ngSlides.length > 0) {
            parts.push(`${t("project.ngSlideCount") || "Slide NG"}: ${ngSlides.map(s => s.slide_number).slice(0, 5).join(", ")}`);
          }

          // Try to find a dedicated section for issues, or fallback to first NG slide summary
          const issuesSection = feedbackSections.find(s => 
            /xấu|vấn đề|cải thiện|hạn chế|lỗi|nghiêm trọng|ng|thất bại|không đạt/i.test(s.title)
          );

          if (issuesSection?.lines[0]) {
            parts.push(issuesSection.lines[0]);
          } else if (ngSlides.length > 0 && ngSlides[0].summary) {
            parts.push(ngSlides[0].summary);
          }

          return parts.length > 0 ? parts.join(". ") : t("project.noSeriousIssues") || "Không phát hiện vấn đề nghiêm trọng.";
        })(),

        type: (lowest && lowest.value / lowest.max < 0.7) || ngSlideCount > 0 ? "danger" : "neutral",
        Icon: AlertTriangleIcon
      },

      {
        title: t("project.insight.importantComments") || "Nhận xét quan trọng",
        content: (() => {
          const scoreText = `${t("project.totalScore") || "Tổng điểm"}: ${result?.total_score || 0}/100`;
          return `${scoreText}. ${distilledSummary || ""}`;
        })(),


        type: "primary",
        Icon: TargetIcon
      },
      {
        title: t("project.insight.positivePoints") || "Điểm tích cực",
        content: distilledPositive || (highest && highest.value / highest.max >= 0.8 ? `${highest.label} là điểm sáng của tài liệu.` : t("project.positivePointPlaceholder") || "Tài liệu trình bày chuyên nghiệp và tuân thủ các quy định cơ bản."),
        type: "success",
        Icon: ShieldCheckIcon
      }


    ];

  }, [feedbackSections, ngSlideCount, t, orderedScores, result, slideReviewItems]);

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
    slideReviewItems,
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


      {/* Sidebar - Minimal fixed icons for tabs */}
      {/* Main Content Workspace */}
      <main className="project-main-v3" style={{ width: '100%' }}>
        {/* Tầng 2.5 + Tầng 3: Unified Analytical Header */}
        <div className="analytical-header-v4">
          <div className="analytical-header-v4__selectors">
            <Select 
              size="sm"
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
                  label: t(getDocumentTypeKey(d.document_type))
                }))
              ]}
              style={{ height: '32px', fontSize: '13px' }}
            />
            <Select 
              size="sm"
              value={selectedVersionId || ""} 
              onChange={(e) => setSelectedVersionId(Number(e.target.value))}
              disabled={!selectedDocumentId}
              options={[
                { value: "", label: t("project.selectVersion") },
                ...versions.map(v => ({ value: String(v.document_version_id), label: `${t("project.version")} ${v.version}` }))
              ]}
              style={{ height: '32px', fontSize: '13px' }}
            />
            <Select 
              size="sm"
              value={selectedGradingId || ""} 
              onChange={(e) => setSelectedGradingId(Number(e.target.value))}
              disabled={!selectedVersionId}
              options={[
                { value: "", label: t("project.selectReviewRun") },
                ...gradings.map(g => ({ value: String(g.grading_run_id), label: `${formatDateTime(g.created_at, lang)}` }))
              ]}
              style={{ height: '32px', fontSize: '13px' }}
            />
          </div>

          <div className="analytical-header-v4__metrics">
            {/* Score Badge */}
            <div className={`score-badge-v4 ${result?.total_score && result.total_score >= 80 ? 'success' : result?.total_score && result.total_score >= 60 ? 'warning' : 'danger'}`}>
              <span className="metric-item-v4__label" style={{ color: 'inherit' }}>{t("project.metaScore")}</span>
              <span style={{ fontSize: '18px' }}>{result?.total_score ?? "—"}</span>
            </div>

            {/* Issue Count */}
            <div className="metric-item-v4">
              <span className="metric-item-v4__label">{t("project.documentStatus")}</span>
              <div className={`metric-item-v4__value ${ngSlideCount > 0 ? "ds-text-danger" : "ds-text-success"}`} style={{ color: ngSlideCount > 0 ? 'var(--ds-color-danger)' : 'var(--ds-color-success)' }}>
                {ngSlideCount > 0 ? <AlertTriangleIcon size="xs" /> : <ShieldCheckIcon size="xs" />}
                {ngSlideCount > 0 ? `${ngSlideCount} Issues` : "Clean"}
              </div>
            </div>

            {/* Risk Level */}
            <div className="metric-item-v4">
              <span className="metric-item-v4__label">{t("project.metaRisk")}</span>
              <div className="metric-item-v4__value">
                <span className={`risk-tag-v3 risk-tag-v3--${riskLevel.tone}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                  {riskLevel.label}
                </span>
              </div>
            </div>

            {/* Graded At */}
            <div className="metric-item-v4">
              <span className="metric-item-v4__label">{t("project.metaGradedAt")}</span>
              <div className="metric-item-v4__value" style={{ fontWeight: 500, color: 'var(--ds-color-text-muted)' }}>
                {result?.graded_at ? formatDateTime(result.graded_at, lang).split(' ')[0] : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* AI Insight Panel - Unified 3-Block Categorized Layout */}
        <div className="insights-panel-v4">
          {categorizedInsights.map((insight, idx) => (
            <div key={idx} className={`insight-card-v4 priority-${insight.type}`}>
              <div className="insight-card-v4__header">
                <insight.Icon size="xs" />
                <span>{insight.title}</span>
              </div>
              <div className="insight-card-v4__content">
                {insight.content}
              </div>
            </div>
          ))}
        </div>



        {/* Tab Selection */}
        <div className="ds-tabs">
          <button 
            className={`ds-tabs__item ${activeTab === "criteria" ? "is-active" : ""}`}
            onClick={() => setActiveTab("criteria")}
          >
            {t("project.tabOverview")}
          </button>
          <button 
            className={`ds-tabs__item ${activeTab === "analysis" ? "is-active" : ""}`}
            onClick={() => setActiveTab("analysis")}
          >
            {t("project.tabAnalysis")}
          </button>
          <button 
            className={`ds-tabs__item ${activeTab === "slides" ? "is-active" : ""}`}
            onClick={() => setActiveTab("slides")}
          >
            {t("project.tabSlidesResult")} {ngSlideCount > 0 && <span className="ds-tabs__badge">{ngSlideCount}</span>}
          </button>
        </div>

        {/* Tab Content */}
        <section className="workspace-content-v3">
          {activeTab === "criteria" ? (
            <ProjectOverviewTab 
              t={t} 
              feedbackSections={criteriaViewModel.feedbackSections} 
              ngSlideCount={ngSlideCount}
              orderedScores={criteriaViewModel.orderedScores}
              slideReviewItems={slidesViewModel.slideReviewItems}
            />
          ) : activeTab === "analysis" ? (
            <ProjectCriteriaTab
              t={t}
              viewModel={criteriaViewModel}
              setHoveredCriterion={setHoveredCriterion}
            />
          ) : (
            <ProjectSlidesTab
              t={t}
              projectId={projectId}
              viewModel={slidesViewModel}
              setSelectedSlideId={setSelectedSlideId}
              lang={lang}
              filterNG={filterNG}
              setFilterNG={setFilterNG}
            />
          )}
        </section>
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
          <pre style={{ whiteSpace: 'pre-wrap', padding: '16px', backgroundColor: 'var(--ds-color-bg-app)', borderRadius: 'var(--ds-radius-md)', fontSize: '13px', border: '1px solid var(--ds-color-border)' }}>
            {promptUsedText}
          </pre>
        </ProjectReviewDialog>
      )}
    </div>
  );
}
