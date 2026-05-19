import { useEffect, useMemo, useReducer, useState } from "react";
import "./AuditDashboard.css";
import {
  auditReviewedAtLabel,
  auditStatusLabel,
  auditStatusTone,
  isFailedAuditStatus,
} from "./auditDashboard.helpers";
import {
  AuditFiltersSection,
  AuditRunsTableSection,
} from "./AuditDashboard.sections";
import { 
  RefreshIcon, AlertCircleIcon, SparkIcon, AlertTriangleIcon, 
  CheckCircleIcon, LayersIcon 
} from "../ui/Icon";

import { 
  getAuditRunDetail, listProjects, listProjectDocuments, listDocumentVersions, 
  listAuditRuns, exportAuditRunsCsv, getLanguage, gradeSubmission 
} from "../../api/client";
import type { GradingRunDetail, GradingRunHistory, Project, DocumentListOut, VersionListOut } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { Button, Card, StatusBadge } from "../ui";
import { EmptyState, LoadingState, ErrorState } from "../ui/States";

type UiStatus = "idle" | "loading" | "ready" | "empty" | "error";
type DetailStatus = "idle" | "loading" | "ready" | "error";

interface AuditFilterState {
  projectId: string;
  documentId: string;
  versionId: string;
  status: string;
  fromTime: string;
  toTime: string;
  limit: number;
  offset: number;
}

interface AuditState {
  status: UiStatus;
  detailStatus: DetailStatus;
  filters: AuditFilterState;
  rows: GradingRunHistory[];
  error: string | null;
  selectedRunId: number | null;
  selectedRunDetail: GradingRunDetail | null;
  detailError: string | null;
}

type Action =
  | { type: "SET_FILTER"; key: keyof AuditFilterState; value: string | number }
  | { type: "RESET_FILTERS" }
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; rows: GradingRunHistory[] }
  | { type: "FETCH_ERROR"; message: string }
  | { type: "SELECT_RUN"; runId: number }
  | { type: "DETAIL_START" }
  | { type: "DETAIL_SUCCESS"; detail: GradingRunDetail }
  | { type: "DETAIL_ERROR"; message: string }
  | { type: "DETAIL_RETRY" };

const DEFAULT_FILTERS: AuditFilterState = {
  projectId: "",
  documentId: "",
  versionId: "",
  status: "",
  fromTime: "",
  toTime: "",
  limit: 20,
  offset: 0,
};

const INITIAL_STATE: AuditState = {
  status: "idle",
  detailStatus: "idle",
  filters: DEFAULT_FILTERS,
  rows: [],
  error: null,
  selectedRunId: null,
  selectedRunDetail: null,
  detailError: null,
};

function reducer(state: AuditState, action: Action): AuditState {
  switch (action.type) {
    case "SET_FILTER":
      return {
        ...state,
        filters: { ...state.filters, [action.key]: action.value, offset: action.key === "offset" ? (action.value as number) : 0 },
      };
    case "RESET_FILTERS":
      return {
        ...state,
        filters: DEFAULT_FILTERS,
        selectedRunId: null,
        selectedRunDetail: null,
        detailStatus: "idle",
        detailError: null,
      };
    case "FETCH_START":
      return { ...state, status: "loading", error: null };
    case "FETCH_SUCCESS":
      return {
        ...state,
        rows: action.rows,
        status: action.rows.length ? "ready" : "empty",
        error: null,
      };
    case "FETCH_ERROR":
      return { ...state, status: "error", error: action.message };
    case "SELECT_RUN":
      return { 
        ...state, 
        selectedRunId: action.runId, 
        detailStatus: "loading", 
        detailError: null,
        selectedRunDetail: null 
      };
    case "DETAIL_START":
      return { ...state, detailStatus: "loading", detailError: null };
    case "DETAIL_SUCCESS":
      return { ...state, detailStatus: "ready", selectedRunDetail: action.detail, detailError: null };
    case "DETAIL_ERROR":
      return { ...state, detailStatus: "error", detailError: action.message };
    case "DETAIL_RETRY":
      return { ...state, detailStatus: "loading", detailError: null };
    default:
      return state;
  }
}

function normalizeDateTimeLocal(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function getLocalizedText(obj: any, lang: string): string {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  if (typeof obj === "object" && !Array.isArray(obj)) {
    const val = obj[lang] || obj["vi"] || obj["ja"] || obj["en"];
    if (val && typeof val === "object") return getLocalizedText(val, lang);
    return val ? String(val) : "";
  }
  return String(obj);
}

export default function AuditDashboard() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [isExporting, setIsExporting] = useState(false);

  // Cascading lists
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [documentsList, setDocumentsList] = useState<DocumentListOut[]>([]);
  const [versionsList, setVersionsList] = useState<VersionListOut[]>([]);

  // Initial load: projects
  useEffect(() => {
    listProjects(200, 0)
      .then(setProjectsList)
      .catch(console.error);
  }, []);

  // Fetch documents when project changes
  useEffect(() => {
    if (state.filters.projectId) {
      listProjectDocuments(state.filters.projectId)
        .then(setDocumentsList)
        .catch(() => setDocumentsList([]));
    } else {
      setDocumentsList([]);
    }
    // Clear child selections
    if (state.filters.documentId) dispatch({ type: "SET_FILTER", key: "documentId", value: "" });
    if (state.filters.versionId) dispatch({ type: "SET_FILTER", key: "versionId", value: "" });
  }, [state.filters.projectId]);

  // Fetch versions when document changes
  useEffect(() => {
    if (state.filters.documentId) {
      listDocumentVersions(Number(state.filters.documentId))
        .then(setVersionsList)
        .catch(() => setVersionsList([]));
    } else {
      setVersionsList([]);
    }
    // Clear child selection
    if (state.filters.versionId) dispatch({ type: "SET_FILTER", key: "versionId", value: "" });
  }, [state.filters.documentId]);

  const filtersKey = useMemo(() => JSON.stringify(state.filters), [state.filters]);

  const fetchRows = () => {
    dispatch({ type: "FETCH_START" });
    listAuditRuns({
      project_id: state.filters.projectId || undefined,
      document_id: state.filters.documentId ? Number(state.filters.documentId) : undefined,
      document_version_id: state.filters.versionId ? Number(state.filters.versionId) : undefined,
      status: state.filters.status || undefined,
      from_time: normalizeDateTimeLocal(state.filters.fromTime),
      to_time: normalizeDateTimeLocal(state.filters.toTime),
      limit: state.filters.limit,
      offset: state.filters.offset,
    })
      .then((rows) => dispatch({ type: "FETCH_SUCCESS", rows }))
      .catch((error: unknown) => {
        dispatch({
          type: "FETCH_ERROR",
          message: error instanceof Error ? error.message : t("api.grading.fetchFailed"),
        });
      });
  };

  useEffect(() => {
    fetchRows();
  }, [filtersKey]);

  useEffect(() => {
    if (!state.selectedRunId) return;
    dispatch({ type: "DETAIL_START" });
    getAuditRunDetail(state.selectedRunId)
      .then((detail) => dispatch({ type: "DETAIL_SUCCESS", detail }))
      .catch((error: unknown) => {
        dispatch({
          type: "DETAIL_ERROR",
          message: error instanceof Error ? error.message : t("api.grading.fetchFailed"),
        });
      });
  }, [state.selectedRunId, t]);

  const canExport = !!state.filters.projectId.trim();

  const runExport = async () => {
    if (!canExport || isExporting) return;
    setIsExporting(true);
    try {
      const payload = await exportAuditRunsCsv({
        project_id: state.filters.projectId.trim(),
        document_id: state.filters.documentId ? Number(state.filters.documentId) : undefined,
        version_id: state.filters.versionId ? Number(state.filters.versionId) : undefined,
        status: state.filters.status || undefined,
        from_time: normalizeDateTimeLocal(state.filters.fromTime),
        to_time: normalizeDateTimeLocal(state.filters.toTime),
      });
      const url = URL.createObjectURL(payload.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = payload.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      dispatch({
        type: "FETCH_ERROR",
        message: error instanceof Error ? error.message : t("submissions.exportFailed"),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSelectRun = (runId: number) => dispatch({ type: "SELECT_RUN", runId });

  const handleReGrade = async () => {
    if (!state.selectedRunDetail) return;
    const { grading_run, submission, document_version } = state.selectedRunDetail;
    
    try {
      dispatch({ type: "DETAIL_START" });
      await gradeSubmission({
        projectId: submission.project_id,
        documentVersionId: document_version?.id,
        evaluationSetId: grading_run.evaluation_set_id ?? undefined,
        promptLevel: grading_run.prompt_level ?? undefined,
        force: true
      });
      fetchRows();
    } catch (err) {
      dispatch({
        type: "DETAIL_ERROR",
        message: err instanceof Error ? err.message : t("api.grading.failed")
      });
    }
  };

  const handleRefreshDetail = () => {
    if (!state.selectedRunId) return;
    dispatch({ type: "DETAIL_RETRY" });
    getAuditRunDetail(state.selectedRunId)
      .then((detail) => dispatch({ type: "DETAIL_SUCCESS", detail }))
      .catch((err: unknown) => {
        dispatch({
          type: "DETAIL_ERROR",
          message: err instanceof Error ? err.message : t("api.grading.fetchFailed"),
        });
      });
  };


  return (
    <div className="audit-container">
      <AuditFiltersSection
        t={t}
        filters={state.filters}
        projectsList={projectsList}
        documentsList={documentsList}
        versionsList={versionsList}
        canExport={canExport}
        isExporting={isExporting}
        onSetFilter={(key, value) => dispatch({ type: "SET_FILTER", key, value })}
        onReset={() => dispatch({ type: "RESET_FILTERS" })}
        onRefresh={fetchRows}
        onExport={runExport}
      />

      <AuditRunsTableSection
        t={t}
        status={state.status}
        rows={state.rows}
        selectedRunId={state.selectedRunId}
        offset={state.filters.offset}
        limit={state.filters.limit}
        onSelectRun={handleSelectRun}
        onPreviousPage={() =>
          dispatch({ type: "SET_FILTER", key: "offset", value: Math.max(0, state.filters.offset - state.filters.limit) })
        }
        onNextPage={() => dispatch({ type: "SET_FILTER", key: "offset", value: state.filters.offset + state.filters.limit })}
      />

      <section aria-label={t("sm.auditDashboard.detailTitle")}>
        <Card title={t("sm.auditDashboard.detailTitle")}>
          {state.detailStatus === "loading" ? (
            <LoadingState title={String(t("common.loading"))} description={String(t("sm.audit.gradingRun")) + " #" + state.selectedRunId} />
          ) : state.detailStatus === "error" ? (
            <ErrorState 
              title={String(t("common.error"))} 
              description={state.detailError || String(t("api.grading.fetchFailed"))}
              action={
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={handleRefreshDetail}
                >
                  <RefreshIcon size="sm" /> {String(t("sm.common.retry"))}
                </Button>
              }
            />
          ) : state.detailStatus === "ready" && state.selectedRunDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Metadata Grid */}
              <article className="audit-detail-grid">
                <DetailField label={String(t("project.projectName"))} value={String(state.selectedRunDetail.submission.project_name || t("common.noValue"))} />
                <DetailField label={String(t("project.documentType"))} value={String(state.selectedRunDetail.document?.document_type || t("common.noValue"))} />
                <DetailField label={String(t("project.documentName"))} value={String(state.selectedRunDetail.document?.document_name || t("common.noValue"))} />
                <DetailField label={String(t("project.totalScore"))} value={state.selectedRunDetail.grading_run.total_score ?? state.selectedRunDetail.grading_run.score ?? String(t("common.noValue"))} />
                <DetailField label={String(t("project.documentVersion"))} value={String(state.selectedRunDetail.grading_run.document_version || t("common.noValue"))} />
                <DetailField label={String(t("project.rubricVersion"))} value={String(state.selectedRunDetail.grading_run.rubric_version || t("common.noValue"))} />
                <DetailField label={String(t("project.promptVersion"))} value={String(state.selectedRunDetail.grading_run.prompt_version || t("common.noValue"))} />
                <DetailField label={String(t("project.promptLevel"))} value={String(state.selectedRunDetail.grading_run.prompt_level || t("common.noValue"))} />
                <DetailField label={String(t("project.geminiModel"))} value={String(state.selectedRunDetail.grading_run.gemini_model || t("common.noValue"))} />
                <div className="audit-detail-item">
                  <span className="audit-detail-label">{String(t("common.status"))}</span>
                  <div className="audit-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <StatusBadge tone={auditStatusTone(state.selectedRunDetail.grading_run.status)}>
                      {auditStatusLabel(state.selectedRunDetail.grading_run.status, t)}
                    </StatusBadge>
                    {isFailedAuditStatus(state.selectedRunDetail.grading_run.status) && (
                      <Button variant="ghost" size="sm" onClick={handleReGrade} title={String(t("sm.common.retry"))}>
                        <RefreshIcon size="sm" />
                      </Button>
                    )}
                  </div>
                </div>
                <DetailField label={String(t("project.reviewedAt"))} value={auditReviewedAtLabel(state.selectedRunDetail.grading_run.graded_at)} />
                {isFailedAuditStatus(state.selectedRunDetail.grading_run.status) && (
                  <div className="audit-detail-item" style={{ gridColumn: '1 / -1', borderLeft: '4px solid var(--ds-color-danger)' }}>
                    <span className="audit-detail-label" style={{ color: 'var(--ds-color-danger)' }}>
                      <AlertCircleIcon size="sm" /> {String(t("common.error"))}
                    </span>
                    <div className="audit-detail-value" style={{ color: 'var(--ds-color-danger)', fontSize: '13px' }}>
                      {String(state.selectedRunDetail.grading_run.error_message || t("common.unknownError"))}
                    </div>
                  </div>
                )}
              </article>

              {/* Criteria Analysis Table */}
              <section className="audit-detail-section">
                <header className="audit-section-header">
                  <h3 className="ds-title-h3" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SparkIcon size="sm" /> {String(t("project.criteriaDetailTitle") || "PhÃ¢n tÃ­ch chi tiáº¿t tá»«ng tiÃªu chÃ­")}
                  </h3>
                </header>
                <div className="ds-table-container">
                  <table className="ds-table ds-table--compact">
                    <thead>
                      <tr>
                        <th style={{ width: '25%' }}>{t("project.criteria") || "TiÃªu chÃ­"}</th>
                        <th style={{ width: '10%', textAlign: 'center' }}>{t("project.metaScore") || "Äiá»ƒm"}</th>
                        <th>{t("project.feedbackTitle") || "Nháº­n xÃ©t tá»« AI"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(state.selectedRunDetail.criteria_results) && state.selectedRunDetail.criteria_results.map((result, idx) => {
                        if (!result) return null;
                        const rubricCriteria = state.selectedRunDetail?.rubric?.criteria;
                        const rubricItem = Array.isArray(rubricCriteria) ? rubricCriteria.find(c => c.key === result.key) : null;
                        const label = rubricItem ? getLocalizedText(rubricItem.labels, getLanguage()) : result.key;
                        const scorePercent = result.max_score > 0 ? (result.score / result.max_score) : 0;
                        const tone = scorePercent >= 0.8 ? "success" : scorePercent >= 0.5 ? "warning" : "danger";
                        
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{String(label)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <div className={`ds-badge ds-badge--${tone}`} style={{ fontSize: '11px' }}>
                                {String(result.score)}/{String(result.max_score)}
                              </div>
                            </td>
                            <td style={{ fontSize: '13px', color: 'var(--ds-color-text-body)', lineHeight: 1.5 }}>
                              {getLocalizedText(result.suggestion, getLanguage()) || String(t("project.noDetailedComment"))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Page Feedback Section */}
              {((state.selectedRunDetail.page_reviews && state.selectedRunDetail.page_reviews.length > 0) || (state.selectedRunDetail.slide_reviews && state.selectedRunDetail.slide_reviews.length > 0)) && (
                <section className="audit-detail-section">
                  <header className="audit-section-header" style={{ marginBottom: '16px' }}>
                    <h3 className="ds-title-h3" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <LayersIcon size="sm" /> {String(t("project.slideDetailTitle") || "Nháº­n xÃ©t chi tiáº¿t tá»«ng trang")}
                    </h3>
                  </header>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Array.isArray((state.selectedRunDetail.page_reviews ?? state.selectedRunDetail.slide_reviews)) && (state.selectedRunDetail.page_reviews ?? state.selectedRunDetail.slide_reviews)!.map((slide, idx) => {
                      if (!slide) return null;
                      return (
                        <div key={idx} style={{ 
                          border: '1px solid var(--ds-color-border)', 
                          borderRadius: '12px', 
                          padding: '20px',
                          backgroundColor: slide.status === "NG" ? 'var(--ds-color-danger-soft)' : 'white'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ 
                                width: '32px', 
                                height: '32px', 
                                borderRadius: '8px', 
                                backgroundColor: 'var(--ds-color-bg-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '14px'
                              }}>
                                {String((slide.page_number ?? slide.slide_number))}
                              </div>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                                {getLocalizedText(slide.title, getLanguage()) || String(t("project.noTitle"))}
                              </h4>
                            </div>
                            <StatusBadge tone={slide.status === "OK" ? "success" : "danger"}>
                              {slide.status === "OK" ? <CheckCircleIcon size="sm" /> : <AlertTriangleIcon size="sm" />}
                              {String(slide.status)}
                            </StatusBadge>
                          </div>
                          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--ds-color-text-body)', lineHeight: 1.5 }}>
                              <strong>{String(t("project.slideSummary"))}:</strong> {getLocalizedText(slide.summary, getLanguage())}
                            </div>
                            {slide.status === "NG" && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {Object.values(slide.issues || {}).flat().map((issue: any, i: number) => (
                                    <div key={i} style={{ 
                                      padding: '6px 12px', 
                                      background: 'rgba(239, 68, 68, 0.1)', 
                                      color: 'var(--ds-color-danger)', 
                                      borderRadius: '8px', 
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}>
                                      <AlertTriangleIcon size="sm" /> {String(issue)}
                                    </div>
                                  ))}
                                </div>
                                <div style={{ 
                                  padding: '12px', 
                                  background: 'rgba(16, 185, 129, 0.05)', 
                                  border: '1px solid rgba(16, 185, 129, 0.2)', 
                                  borderRadius: '8px',
                                  fontSize: '13px',
                                  color: 'var(--ds-color-success-dark)',
                                  display: 'flex',
                                  gap: '10px'
                                }}>
                                  <SparkIcon size="sm" style={{ marginTop: '2px' }} />
                                  <div>
                                    <strong>{String(t("project.aiSuggestionLabel"))}:</strong> {getLocalizedText(slide.suggestions, getLanguage())}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

            </div>
          ) : (
            <EmptyState title={String(t("sm.auditDashboard.selectRun"))} description={String(t("sm.auditDashboard.selectRunDesc"))} compact />
          )}
        </Card>
      </section>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="audit-detail-item">
      <span className="audit-detail-label">{String(label)}</span>
      <div className="audit-detail-value">{String(value)}</div>
    </div>
  );
}

