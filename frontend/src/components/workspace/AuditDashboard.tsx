import { useEffect, useMemo, useReducer, useState } from "react";
import "./AuditDashboard.css";

import { exportAuditRunsCsv, getAuditRunDetail, listAuditRuns } from "../../api/client";
import type { GradingRunDetail, GradingRunHistory } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { Button, Card, Input, Select, StatusBadge } from "../ui";
import { EmptyState, LoadingState } from "../ui/States";

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
  | { type: "DETAIL_ERROR"; message: string };

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
        filters: { ...state.filters, [action.key]: action.value, offset: action.key === "offset" ? action.value as number : 0 },
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
      return { ...state, selectedRunId: action.runId, detailStatus: "idle", detailError: null };
    case "DETAIL_START":
      return { ...state, detailStatus: "loading", detailError: null };
    case "DETAIL_SUCCESS":
      return { ...state, detailStatus: "ready", selectedRunDetail: action.detail, detailError: null };
    case "DETAIL_ERROR":
      return { ...state, detailStatus: "error", detailError: action.message };
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

function mapStatusTone(status?: string): "success" | "warning" | "danger" | "muted" {
  const normalized = (status || "").toLowerCase();
  if (normalized === "completed") return "success";
  if (normalized === "failed") return "danger";
  if (normalized === "pending" || normalized === "extracting" || normalized === "grading") return "warning";
  return "muted";
}

function renderStatusLabel(status: string, t: (key: string) => string): string {
  const normalized = status.toLowerCase();
  if (normalized === "pending") return t("status.pending");
  if (normalized === "extracting") return t("status.extracting");
  if (normalized === "grading") return t("status.grading");
  if (normalized === "completed") return t("status.completed");
  if (normalized === "failed") return t("status.failed");
  return status;
}

export default function AuditDashboard() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [isExporting, setIsExporting] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const canGoPrev = state.filters.offset > 0;
  const canGoNext = state.rows.length >= state.filters.limit;
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

  return (
    <div className="audit-container">
      <section aria-label={t("sm.auditDashboard.filterTitle")}>
        <Card title={t("sm.auditDashboard.filterTitle")}>
          <div className="audit-filter-section">
            <Input 
              label={t("sm.audit.project")} 
              value={state.filters.projectId} 
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "projectId", value: e.target.value })}
              placeholder={t("sm.auditDashboard.projectPlaceholder")}
            />
            <Input 
              label={t("sm.audit.document")} 
              value={state.filters.documentId} 
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "documentId", value: e.target.value })}
              placeholder={t("sm.auditDashboard.documentPlaceholder")}
            />
            <Input 
              label={t("sm.audit.version")} 
              value={state.filters.versionId} 
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "versionId", value: e.target.value })}
              placeholder={t("sm.auditDashboard.versionPlaceholder")}
            />
            <Select 
              label={t("common.status")} 
              value={state.filters.status} 
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "status", value: e.target.value })}
              options={[
                { value: "", label: t("sm.auditDashboard.statusAll") },
                { value: "PENDING", label: t("status.pending") },
                { value: "EXTRACTING", label: t("status.extracting") },
                { value: "GRADING", label: t("status.grading") },
                { value: "COMPLETED", label: t("status.completed") },
                { value: "FAILED", label: t("status.failed") }
              ]}
            />
            <Input 
              label={t("sm.auditDashboard.fromTime")} 
              type="datetime-local"
              value={state.filters.fromTime} 
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "fromTime", value: e.target.value })}
            />
            <Input 
              label={t("sm.auditDashboard.toTime")} 
              type="datetime-local"
              value={state.filters.toTime} 
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "toTime", value: e.target.value })}
            />
          </div>

          <div className="audit-actions">
            <Button variant="outline" onClick={() => dispatch({ type: "RESET_FILTERS" })}>
              {t("sm.auditDashboard.reset")}
            </Button>
            <Button variant="outline" onClick={fetchRows}>
              {t("sm.common.retry")}
            </Button>
            <Button 
              variant="primary" 
              onClick={runExport} 
              disabled={!canExport || isExporting}
              isLoading={isExporting}
            >
              {t("submissions.exportExcel")}
            </Button>
          </div>
        </Card>
      </section>

      <section aria-label={t("sm.auditDashboard.tableTitle")}>
        <Card title={t("sm.auditDashboard.tableTitle")}>
          <div className="ds-table-container">
            <table className="ds-table ds-table--compact">
              <thead>
                <tr>
                  <th>{t("sm.audit.gradingRun")}</th>
                  <th>{t("sm.audit.document")}</th>
                  <th>{t("sm.audit.version")}</th>
                  <th>{t("project.totalScore")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("project.reviewedAt")}</th>
                </tr>
              </thead>
              <tbody>
                {state.status === "loading" ? (
                  <tr><td colSpan={6}><LoadingState title={t("common.loading")} /></td></tr>
                ) : state.status === "empty" ? (
                  <tr><td colSpan={6}><EmptyState title={t("sm.auditDashboard.empty")} compact /></td></tr>
                ) : (
                  state.rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => handleSelectRun(row.id)}
                      className={`audit-table-row ${state.selectedRunId === row.id ? 'is-active' : ''}`}
                    >
                      <td>#{row.id}</td>
                      <td className="ds-text-truncate" style={{ maxWidth: '160px' }}>{row.document_name || t("common.noValue")}</td>
                      <td>{row.document_version || t("common.noValue")}</td>
                      <td className="font-bold">{typeof row.total_score === "number" ? `${row.total_score}/100` : "—"}</td>
                      <td>
                        <StatusBadge tone={mapStatusTone(row.status)}>
                          {renderStatusLabel(row.status, t)}
                        </StatusBadge>
                      </td>
                      <td className="text-muted" style={{ fontSize: '11px' }}>
                        {row.graded_at ? new Date(row.graded_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="audit-pagination">
            <div className="audit-pagination-info">
              Showing {state.rows.length} results
            </div>
            <div className="audit-pagination-btns">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!canGoPrev}
                onClick={() => dispatch({ type: "SET_FILTER", key: "offset", value: Math.max(0, state.filters.offset - state.filters.limit) })}
              >
                {t("sm.auditDashboard.prevPage")}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!canGoNext}
                onClick={() => dispatch({ type: "SET_FILTER", key: "offset", value: state.filters.offset + state.filters.limit })}
              >
                {t("sm.auditDashboard.nextPage")}
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <section aria-label={t("sm.auditDashboard.detailTitle")}>
        <Card title={t("sm.auditDashboard.detailTitle")}>
          {state.detailStatus === "ready" && state.selectedRunDetail ? (
            <article className="audit-detail-grid">
              <DetailField label={t("sm.audit.project")} value={state.selectedRunDetail.submission.project_id} />
              <DetailField label={t("sm.audit.document")} value={state.selectedRunDetail.document?.document_name || t("common.noValue")} />
              <DetailField label={t("sm.audit.version")} value={state.selectedRunDetail.document_version?.document_version || t("common.noValue")} />
              <DetailField label={t("sm.audit.gradingRun")} value={`#${state.selectedRunDetail.grading_run.id}`} />
              <DetailField label={t("sm.audit.evaluationSet")} value={state.selectedRunDetail.grading_run.evaluation_set_id ?? t("common.noValue")} />
              <DetailField label={t("sm.auditDashboard.promptLevel")} value={state.selectedRunDetail.grading_run.prompt_level || t("common.noValue")} />
              <DetailField label={t("common.status")} value={renderStatusLabel(state.selectedRunDetail.grading_run.status, t)} />
              <DetailField label={t("project.totalScore")} value={state.selectedRunDetail.grading_run.total_score ?? state.selectedRunDetail.grading_run.score ?? t("common.noValue")} />
            </article>
          ) : (
            <EmptyState title={t("sm.auditDashboard.selectRun")} description={t("sm.auditDashboard.selectRunDesc")} compact />
          )}
        </Card>
      </section>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="audit-detail-item">
      <span className="audit-detail-label">{label}</span>
      <div className="audit-detail-value">{value}</div>
    </div>
  );
}
