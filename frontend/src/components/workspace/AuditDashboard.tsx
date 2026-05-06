import { useEffect, useMemo, useReducer, useState } from "react";

import { exportAuditRunsCsv, getAuditRunDetail, listAuditRuns } from "../../api/client";
import type { GradingRunDetail, GradingRunHistory } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { EmptyState, ErrorState, LoadingState, SkeletonTable, StatusBadge } from "../ui/States";

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
  const { t, lang } = useTranslation();
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

  return (
    <section className="ops-screen" aria-label={t("biz.auditDashboard.title")}>
      <header className="ops-screen__header">
        <div>
          <h1>{t("biz.auditDashboard.title")}</h1>
          <p>{t("biz.auditDashboard.subtitle")}</p>
        </div>
      </header>

      <section className="ops-card">
        <h2>{t("sm.auditDashboard.filterTitle")}</h2>
        <div className="prod-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <label className="prod-field">
            <span>{t("sm.audit.project")}</span>
            <input
              value={state.filters.projectId}
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "projectId", value: e.target.value })}
              placeholder={t("sm.auditDashboard.projectPlaceholder")}
            />
          </label>
          <label className="prod-field">
            <span>{t("sm.audit.document")}</span>
            <input
              value={state.filters.documentId}
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "documentId", value: e.target.value })}
              placeholder={t("sm.auditDashboard.documentPlaceholder")}
            />
          </label>
          <label className="prod-field">
            <span>{t("sm.audit.version")}</span>
            <input
              value={state.filters.versionId}
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "versionId", value: e.target.value })}
              placeholder={t("sm.auditDashboard.versionPlaceholder")}
            />
          </label>
          <label className="prod-field">
            <span>{t("common.status")}</span>
            <select
              value={state.filters.status}
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "status", value: e.target.value })}
            >
              <option value="">{t("sm.auditDashboard.statusAll")}</option>
              <option value="PENDING">{t("status.pending")}</option>
              <option value="EXTRACTING">{t("status.extracting")}</option>
              <option value="GRADING">{t("status.grading")}</option>
              <option value="COMPLETED">{t("status.completed")}</option>
              <option value="FAILED">{t("status.failed")}</option>
            </select>
          </label>
          <label className="prod-field">
            <span>{t("sm.auditDashboard.fromTime")}</span>
            <input
              type="datetime-local"
              value={state.filters.fromTime}
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "fromTime", value: e.target.value })}
            />
          </label>
          <label className="prod-field">
            <span>{t("sm.auditDashboard.toTime")}</span>
            <input
              type="datetime-local"
              value={state.filters.toTime}
              onChange={(e) => dispatch({ type: "SET_FILTER", key: "toTime", value: e.target.value })}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button type="button" className="prod-button" onClick={() => dispatch({ type: "RESET_FILTERS" })}>
            {t("sm.auditDashboard.reset")}
          </button>
          <button type="button" className="prod-button prod-button--primary" onClick={fetchRows}>
            {t("sm.common.retry")}
          </button>
          <button type="button" className="prod-button" onClick={runExport} disabled={!canExport || isExporting}>
            {isExporting ? t("submissions.exporting") : t("submissions.exportExcel")}
          </button>
        </div>
      </section>

      <section className="ops-card">
        <h2>{t("sm.auditDashboard.tableTitle")}</h2>
        {state.status === "loading" || state.status === "idle" ? (
          <>
            <LoadingState title={t("common.loading")} description={t("sm.auditDashboard.loadingDesc")} />
            <SkeletonTable rows={5} cols={6} />
          </>
        ) : null}
        {state.status === "error" ? (
          <ErrorState
            title={t("sm.grading.error")}
            description={state.error || t("api.unknown")}
            compact
            action={(
              <button type="button" className="prod-button" onClick={fetchRows}>
                {t("sm.common.retry")}
              </button>
            )}
          />
        ) : null}
        {state.status === "empty" ? <EmptyState title={t("sm.auditDashboard.empty")} description={t("sm.auditDashboard.emptyDesc")} compact /> : null}
        {state.status === "ready" ? (
          <>
            <div className="prod-table-wrap">
              <table className="prod-history-table">
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
                  {state.rows.map((row) => (
                    <tr key={row.id} onClick={() => dispatch({ type: "SELECT_RUN", runId: row.id })} style={{ cursor: "pointer" }}>
                      <td>#{row.id}</td>
                      <td>{row.document_name || (row.document_id ? `D-${row.document_id}` : row.document_type) || "—"}</td>
                      <td>{row.document_version || "—"}</td>
                      <td>{typeof row.total_score === "number" ? `${row.total_score}/100` : "—"}</td>
                      <td>
                        <StatusBadge tone={mapStatusTone(row.status)}>
                          {renderStatusLabel(row.status, t)}
                        </StatusBadge>
                      </td>
                      <td>{row.graded_at ? new Date(row.graded_at).toLocaleString(lang === "ja" ? "ja-JP" : "vi-VN") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <button
                type="button"
                className="prod-button"
                disabled={!canGoPrev}
                onClick={() => dispatch({ type: "SET_FILTER", key: "offset", value: Math.max(0, state.filters.offset - state.filters.limit) })}
              >
                {t("sm.auditDashboard.prevPage")}
              </button>
              <button
                type="button"
                className="prod-button"
                disabled={!canGoNext}
                onClick={() => dispatch({ type: "SET_FILTER", key: "offset", value: state.filters.offset + state.filters.limit })}
              >
                {t("sm.auditDashboard.nextPage")}
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="ops-card">
        <h2>{t("sm.auditDashboard.detailTitle")}</h2>
        {state.detailStatus === "idle" ? <EmptyState title={t("sm.auditDashboard.selectRun")} description={t("sm.auditDashboard.selectRunDesc")} compact /> : null}
        {state.detailStatus === "loading" ? <LoadingState title={t("sm.detail.loading")} /> : null}
        {state.detailStatus === "error" ? (
          <ErrorState
            title={t("sm.detail.error")}
            description={state.detailError || t("api.unknown")}
            compact
            action={(
              <button
                type="button"
                className="prod-button"
                onClick={() => state.selectedRunId && dispatch({ type: "SELECT_RUN", runId: state.selectedRunId })}
              >
                {t("sm.common.retry")}
              </button>
            )}
          />
        ) : null}
        {state.detailStatus === "ready" && state.selectedRunDetail ? (
          <div className="prod-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <DetailField label={t("sm.audit.project")} value={state.selectedRunDetail.submission.project_id} />
            <DetailField label={t("sm.audit.document")} value={state.selectedRunDetail.document?.document_name || "—"} />
            <DetailField label={t("sm.audit.version")} value={state.selectedRunDetail.document_version?.document_version || "—"} />
            <DetailField label={t("sm.audit.gradingRun")} value={`#${state.selectedRunDetail.grading_run.id}`} />
            <DetailField label={t("sm.audit.evaluationSet")} value={state.selectedRunDetail.grading_run.evaluation_set_id ?? "—"} />
            <DetailField label={t("sm.auditDashboard.promptLevel")} value={state.selectedRunDetail.grading_run.prompt_level || "—"} />
            <DetailField label={t("common.status")} value={renderStatusLabel(state.selectedRunDetail.grading_run.status, t)} />
            <DetailField label={t("project.totalScore")} value={state.selectedRunDetail.grading_run.total_score ?? state.selectedRunDetail.grading_run.score ?? "—"} />
            <DetailField label={t("project.reviewedAt")} value={state.selectedRunDetail.grading_run.graded_at || "—"} />
          </div>
        ) : null}
      </section>
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="prod-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
