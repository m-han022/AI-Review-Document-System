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
      <header className="project-toolbar-v3">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
          <div className="ds-skeleton" style={{ width: '32px', height: '32px', borderRadius: '4px' }} />
          <div className="ds-skeleton" style={{ width: '100px', height: '20px', borderRadius: '4px' }} />
          <div className="ds-skeleton" style={{ width: '80px', height: '24px', borderRadius: '12px' }} />
        </div>
      </header>
      <div className="project-sidebar-v3">
        <div className="sidebar-section-v3">
          <div className="ds-skeleton" style={{ width: '40%', height: '12px', marginBottom: '8px' }} />
          <div className="ds-skeleton" style={{ width: '80%', height: '20px', marginBottom: '12px' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="ds-skeleton" style={{ width: '60px', height: '18px' }} />
            <div className="ds-skeleton" style={{ width: '60px', height: '18px' }} />
          </div>
        </div>
        <div className="sidebar-section-v3" style={{ height: '300px' }}>
          <div className="ds-skeleton" style={{ width: '100%', height: '36px', marginBottom: '12px' }} />
          <div className="ds-skeleton" style={{ width: '100%', height: '36px', marginBottom: '12px' }} />
          <div className="ds-skeleton" style={{ width: '100%', height: '36px', marginBottom: '12px' }} />
        </div>
      </div>
      <div className="project-main-v3">
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

  if (loadingDocs || isInitialLoading) return <ProjectCardSkeleton />;

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
      <header className="project-toolbar-v3">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-3)' }}>
          <Button variant="ghost" size="sm" onClick={onBack} style={{ padding: '4px' }}>
            <ArrowLeftIcon size="sm" />
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-2)' }}>
            <StatusBadge tone={
              result?.status === "completed" || result?.status === "graded" ? "success" :
              result?.status === "failed" ? "danger" :
              "warning"
            }>
              {result?.status ? getStatusLabel(result.status, t) : t("project.pending")}
            </StatusBadge>
            
            {result?.total_score != null && (
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                background: "var(--ds-color-bg-app)", 
                padding: "2px 10px", 
                borderRadius: "var(--ds-radius-pill)", 
                border: "1px solid var(--ds-color-border)",
                fontSize: "13px",
                fontWeight: 600
              }}>
                <span style={{ color: "var(--ds-color-text-muted)", marginRight: '4px' }}>{t("project.totalScore")}:</span>
                <span style={{ color: result.total_score < 60 ? "var(--ds-color-danger)" : result.total_score < 80 ? "var(--ds-color-warning)" : "var(--ds-color-success)" }}>
                  {result.total_score}
                </span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="ds-caption" style={{ fontWeight: 700, opacity: 0.5 }}>#{projectId.toString().slice(0, 8)}</div>
          </div>
          <h2 className="sidebar-project-title-v3" title={getLocalizedText(currentProject?.project_name, lang)}>
            {getLocalizedText(currentProject?.project_name, lang) || projectId}
          </h2>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <StatusBadge tone="muted">{getLocalizedText(gradingDetail?.document?.document_type, lang) || "—"}</StatusBadge>
            <StatusBadge tone="primary">{getLocalizedText(result?.prompt_level, lang) || "—"}</StatusBadge>
          </div>
          
          {currentProject?.project_description && (
            <div style={{ 
              padding: '10px', 
              background: 'var(--ds-color-bg-app)', 
              borderRadius: 'var(--ds-radius-md)', 
              fontSize: '12px', 
              borderLeft: '3px solid var(--ds-color-primary)',
              marginTop: 'var(--ds-space-2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: 'var(--ds-color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <TargetIcon size="xs" />
                <span>{lang === "ja" ? "コンテキスト" : "Bối cảnh"}</span>
              </div>
              <Tooltip content={currentProject.project_description}>
                <p style={{ margin: 0, color: 'var(--ds-color-text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.5' }}>
                  {currentProject.project_description}
                </p>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Selection Group */}
        <div className="sidebar-section-v3">
          <span className="ds-caption" style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-color-text-muted)' }}>
            {t("project.context")}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-2)' }}>
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

        {/* Slide Navigator */}
        <div className="sidebar-section-v3" style={{ flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="ds-caption" style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-color-text-muted)' }}>
              {t("project.slideList")}
            </span>
            <button 
              type="button"
              className={`filter-badge-v3 ${filterNG ? 'is-active' : ''}`}
              onClick={() => setFilterNG(!filterNG)}
              style={{ 
                fontSize: '10px', 
                padding: '2px 8px', 
                borderRadius: 'var(--ds-radius-pill)', 
                cursor: 'pointer',
                border: '1px solid var(--ds-color-border)',
                background: filterNG ? 'var(--ds-color-danger-soft)' : 'transparent',
                color: filterNG ? 'var(--ds-color-danger)' : 'var(--ds-color-text-muted)',
                fontWeight: 600
              }}
            >
              {filterNG ? "NG Only" : "Show All"}
            </button>
          </div>
          
          <div className="slide-grid-v3">
            {slideReviewItems
              .filter(item => !filterNG || item.status === "NG")
              .map((item) => {
                const isActive = selectedSlideId === item.id;
                const isNG = item.status === "NG";
                const tooltipText = item.issues?.length > 0 ? item.issues[0] : item.summary;
                
                return (
                  <div 
                    key={item.id}
                    className={`slide-grid-item-v3 ${isActive ? 'is-active' : ''} ${isNG ? 'is-ng' : ''}`}
                    onClick={() => {
                      setSelectedSlideId(item.id);
                      setActiveTab("slides");
                    }}
                  >
                    {item.slide_number}
                    {isNG && (
                      <div className="custom-slide-tooltip">
                        <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--ds-color-primary-soft)' }}>Slide {item.slide_number}</strong>
                        {tooltipText}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Timeline */}
        <div className="sidebar-section-v3">
          <span className="ds-caption" style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-color-text-muted)' }}>
            {t("project.auditTimeline")}
          </span>
          <div className="audit-timeline-v3">
            <div className="timeline-item-v3 is-completed">
              <div className="timeline-marker-v3"><ShieldCheckIcon size="xs" /></div>
              <div className="timeline-content-v3">
                <span className="timeline-label-v3">Upload</span>
                <span className="timeline-time-v3">{formatDateTime(currentVersion?.uploaded_at, lang)}</span>
              </div>
            </div>
            <div className="timeline-item-v3 is-active">
              <div className="timeline-marker-v3"><WorkflowIcon size="xs" /></div>
              <div className="timeline-content-v3">
                <span className="timeline-label-v3">Review</span>
                <span className="timeline-time-v3">{result?.prompt_version || "v1"} • {result?.prompt_level}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="project-main-v3">
        {/* Insight Card */}
        {result && topInsight && (
          <div className={`insight-card-v3 ${topInsight.type === "success" ? "insight-card-v3--success" : ""}`} 
               style={{ padding: 'var(--ds-space-4)', borderRadius: 'var(--ds-radius-card)', background: topInsight.type === "success" ? 'var(--ds-color-success-soft)' : 'var(--ds-color-danger-soft)', border: '1px solid var(--ds-color-border)', display: 'flex', gap: 'var(--ds-space-4)', alignItems: 'center' }}>
            <div style={{ color: topInsight.type === "success" ? 'var(--ds-color-success)' : 'var(--ds-color-danger)' }}>
              {topInsight.type === "success" ? <ShieldCheckIcon size="lg" /> : <AlertTriangleIcon size="lg" />}
            </div>
            <div style={{ flex: 1 }}>
              <div className="ds-section" style={{ fontSize: '15px', marginBottom: '2px' }}>{topInsight.title}</div>
              <div className="ds-body" style={{ fontSize: '13px' }}>{topInsight.message}</div>
            </div>
          </div>
        )}

        {/* Metrics Dashboard */}
        <div className="metrics-row-v3">
          <div className="metric-card-v3">
            <div className="ds-caption" style={{ fontWeight: 700 }}>{t("project.metaScore")}</div>
            <div className="ds-title" style={{ color: 'var(--ds-color-primary)', fontSize: '32px' }}>
              {result?.total_score ?? "—"}
            </div>
          </div>
          <div className="metric-card-v3">
            <div className="ds-caption" style={{ fontWeight: 700 }}>{t("project.documentStatus")}</div>
            <div style={{ marginTop: '4px' }}>
              <StatusBadge tone={ngSlideCount > 0 ? "danger" : "success"}>
                {ngSlideCount > 0 ? `${ngSlideCount} ${t("project.issuesFound")}` : t("statusBiz.reviewReady")}
              </StatusBadge>
            </div>
          </div>
          <div className="metric-card-v3">
            <div className="ds-caption" style={{ fontWeight: 700 }}>{t("project.metaGradedAt")}</div>
            <div className="ds-body" style={{ marginTop: '4px', fontWeight: 600 }}>
              {formatDateTime(result?.graded_at, lang)}
            </div>
          </div>
          <div className="metric-card-v3">
            <div className="ds-caption" style={{ fontWeight: 700 }}>{t("project.metaRisk")}</div>
            <div style={{ marginTop: '4px' }}>
              <StatusBadge tone={riskLevel.tone}>{riskLevel.label}</StatusBadge>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
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

        {/* Tab Content */}
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
          <pre style={{ whiteSpace: 'pre-wrap', padding: '16px', backgroundColor: 'var(--ds-color-bg-app)', borderRadius: 'var(--ds-radius-md)', fontSize: '13px', border: '1px solid var(--ds-color-border)' }}>
            {promptUsedText}
          </pre>
        </ProjectReviewDialog>
      )}
    </div>
  );
}
