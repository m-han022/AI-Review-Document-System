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
} from "../ui/Icon";
import ProjectReviewDialog from "./ProjectReviewDialog";
import ProjectCriteriaTab from "./ProjectCriteriaTab";
import ProjectSlidesTab from "./ProjectSlidesTab";
import type { ProjectCriteriaTabViewModel, ProjectSlidesTabViewModel } from "./projectCard.viewModels";
import { LoadingState, EmptyState, StatusBadge } from "../ui/States";
import { Button, Select } from "../ui";
import {
  formatDateTime,
  getStatusLabel,
} from "./projectCard.helpers";
import { useProjectReviewState } from "./useProjectReviewState";
import "./ProjectCard.css";



interface ProjectCardProps {
  projectId: string;
  onBack: () => void;
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

  if (loadingDocs || isInitialLoading) return <LoadingState title={m.loadingDocuments} />;
  const criteriaViewModel: ProjectCriteriaTabViewModel = {
    lang,
    gradingDetail,
    orderedScores,
    hoveredCriterion,
    result,
    feedbackSections,
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
      {/* Toolbar */}
      <header className="project-toolbar-v3" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--ds-color-border)" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button variant="ghost" size="sm" onClick={onBack} className="back-button-v3">
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
            {result?.total_score != null && (
              <div style={{ display: "flex", alignItems: "center", background: "var(--ds-color-surface)", padding: "2px 10px", borderRadius: "16px", border: "1px solid var(--ds-color-border)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", marginLeft: "8px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ds-color-text-title)" }}>{t("project.totalScore")}: <span style={{ color: result.total_score < 60 ? "var(--ds-color-danger)" : result.total_score < 80 ? "var(--ds-color-warning-dark)" : "var(--ds-color-success-dark)" }}>{result.total_score}</span></span>
              </div>
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
            onClick={() => exportMutation.mutate({})} 
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
          <h2 className="sidebar-project-title-v3">{getLocalizedText(currentProject?.project_name, lang) || projectId}</h2>
          <div className="system-context-pills">
            <span className="context-pill">{getLocalizedText(gradingDetail?.document?.document_type, lang) || getLocalizedText(result?.document_version, lang)}</span>
            <span className="context-pill">{getLocalizedText(result?.prompt_level, lang)}</span>
          </div>
          
          {currentProject?.project_description && (
            <div className="project-context-brief mt-3" style={{ padding: '8px 12px', background: 'var(--ds-color-bg-muted)', borderRadius: '8px', fontSize: '12px', borderLeft: '3px solid var(--ds-color-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: 'var(--ds-color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <TargetIcon size="xs" />
                <span>{lang === "ja" ? "プロジェクトの背景" : "Bối cảnh dự án"}</span>
              </div>
              <Tooltip content={currentProject.project_description}>
                <p style={{ margin: 0, color: 'var(--ds-color-text-main)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                  {currentProject.project_description}
                </p>
              </Tooltip>
            </div>
          )}
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
          <div className="sidebar-header-row-v3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="sidebar-header-v3" style={{ margin: 0 }}>{t("project.slideList")} ({slideReviewItems.length})</span>
            <button 
              type="button"
              className={`filter-badge-v3 ${filterNG ? 'is-active' : ''}`}
              onClick={() => setFilterNG(!filterNG)}
              style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', cursor: 'pointer' }}
            >
              {filterNG ? "Showing NG" : "Filter NG"}
            </button>
          </div>
          
          <div className="slide-grid-v3">
            <style>{`
              .slide-grid-item-v3.has-custom-tooltip {
                position: relative;
                overflow: visible !important;
              }
              .custom-slide-tooltip {
                visibility: hidden;
                opacity: 0;
                position: absolute;
                bottom: calc(100% + 8px);
                left: 50%;
                transform: translateX(-50%) translateY(4px);
                background: var(--ds-color-surface-overlay, #1e293b);
                color: #fff;
                padding: 10px 14px;
                border-radius: 8px;
                font-size: 13px;
                width: max-content;
                max-width: 240px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                pointer-events: none;
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                z-index: 1000;
                text-align: left;
                line-height: 1.5;
                font-weight: normal;
              }
              .custom-slide-tooltip::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                margin-left: -6px;
                border-width: 6px;
                border-style: solid;
                border-color: var(--ds-color-surface-overlay, #1e293b) transparent transparent transparent;
              }
              .slide-grid-item-v3.has-custom-tooltip:hover .custom-slide-tooltip {
                visibility: visible;
                opacity: 1;
                transform: translateX(-50%) translateY(0);
              }
              .slide-grid-item-v3.is-active {
                border: 2px solid var(--ds-color-primary-dark) !important;
                background-color: var(--ds-color-primary-soft) !important;
                font-weight: bold;
                box-shadow: 0 0 0 2px var(--ds-color-primary-light);
              }
            `}</style>
            {slideReviewItems
              .filter(item => !filterNG || item.status === "NG")
              .map((item) => {
                const tooltipText = item.issues?.length > 0 ? item.issues[0] : item.summary;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`slide-grid-item-v3 ${selectedSlideId === item.id ? "is-active" : ""} is-${item.status.toLowerCase()} ${item.status === "NG" ? "has-custom-tooltip" : ""}`}
                    onClick={() => {
                      setSelectedSlideId(item.id);
                      setActiveTab("slides");
                    }}
                    title={item.status !== "NG" ? `Slide ${item.slide_number}: ${item.status}` : undefined}
                  >
                    <span className="slide-number-v3">{item.slide_number}</span>
                    {item.status === "NG" && (
                      <>
                        <div className="ng-indicator-v3" />
                        <div className="custom-slide-tooltip">
                          <strong style={{ display: 'block', marginBottom: '4px', color: '#94a3b8' }}>Slide {item.slide_number}</strong>
                          <span style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tooltipText}</span>
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
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
            <div className={`metric-icon-wrapper ${ngSlideCount > 0 ? 'pulse-danger' : ''}`} style={{ background: ngSlideCount > 0 ? 'var(--ds-color-danger-soft)' : 'var(--ds-color-success-soft)', color: ngSlideCount > 0 ? 'var(--ds-color-danger)' : 'var(--ds-color-success)' }}>
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
        <section className="workspace-content-v3">
          {activeTab === "criteria" ? (
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
          <pre style={{ whiteSpace: 'pre-wrap', padding: '16px', backgroundColor: 'var(--ds-color-bg-muted)', borderRadius: 'var(--ds-radius-md)' }}>
            {promptUsedText}
          </pre>
        </ProjectReviewDialog>
      )}
    </div>
  );
}


