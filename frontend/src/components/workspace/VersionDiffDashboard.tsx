import { useEffect, useMemo, useReducer, useState } from "react";

import { exportVersionDiffCsv, getVersionDiff, listDocumentVersions, listProjectDocuments, listProjects } from "../../api/client";
import type { DocumentListOut, Project, VersionDiffOut, VersionListOut } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState, ErrorState, LoadingState, SkeletonTable, StatusBadge } from "../ui/States";

type UiState = "idle" | "loading" | "ready" | "empty" | "error";

interface State {
  status: UiState;
  projects: Project[];
  documents: DocumentListOut[];
  versions: VersionListOut[];
  diff: VersionDiffOut | null;
  selectedProjectId: string;
  selectedDocumentId: number | null;
  versionAId: number | null;
  versionBId: number | null;
  error: string | null;
}

type Action =
  | { type: "LOAD_START" }
  | { type: "LOAD_ERROR"; message: string }
  | { type: "SET_PROJECTS"; projects: Project[] }
  | { type: "SET_PROJECT"; projectId: string }
  | { type: "SET_DOCUMENTS"; documents: DocumentListOut[] }
  | { type: "SET_DOCUMENT"; documentId: number | null }
  | { type: "SET_VERSIONS"; versions: VersionListOut[] }
  | { type: "SET_VERSION_A"; versionId: number | null }
  | { type: "SET_VERSION_B"; versionId: number | null }
  | { type: "SET_DIFF"; diff: VersionDiffOut }
  | { type: "SET_EMPTY" };

const INITIAL: State = {
  status: "idle",
  projects: [],
  documents: [],
  versions: [],
  diff: null,
  selectedProjectId: "",
  selectedDocumentId: null,
  versionAId: null,
  versionBId: null,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, status: "loading", error: null };
    case "LOAD_ERROR":
      return { ...state, status: "error", error: action.message };
    case "SET_PROJECTS":
      return { ...state, projects: action.projects, status: action.projects.length ? "ready" : "empty" };
    case "SET_PROJECT":
      return {
        ...state,
        selectedProjectId: action.projectId,
        selectedDocumentId: null,
        documents: [],
        versions: [],
        versionAId: null,
        versionBId: null,
        diff: null,
      };
    case "SET_DOCUMENTS":
      return { ...state, documents: action.documents };
    case "SET_DOCUMENT":
      return { ...state, selectedDocumentId: action.documentId, versions: [], versionAId: null, versionBId: null, diff: null };
    case "SET_VERSIONS":
      return { ...state, versions: action.versions };
    case "SET_VERSION_A":
      return { ...state, versionAId: action.versionId, diff: null };
    case "SET_VERSION_B":
      return { ...state, versionBId: action.versionId, diff: null };
    case "SET_DIFF":
      return { ...state, diff: action.diff, status: "ready" };
    case "SET_EMPTY":
      return { ...state, diff: null, status: "empty" };
    default:
      return state;
  }
}

function tone(direction: "up" | "down" | "same"): "success" | "danger" | "muted" {
  if (direction === "up") return "success";
  if (direction === "down") return "danger";
  return "muted";
}

function formatDelta(delta: number, t: (key: string) => string): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return String(delta);
  return t("sm.versionDiff.noChangeLabel");
}

function deltaToneClass(direction: "up" | "down" | "same"): string {
  if (direction === "up") return "diff-delta--up";
  if (direction === "down") return "diff-delta--down";
  return "diff-delta--same";
}

function getPromptLevelChangedLabel(changed: boolean, t: (key: string) => string): string {
  return changed ? t("sm.versionDiff.promptLevelChangedLabel") : t("sm.versionDiff.promptLevelNotChangedLabel");
}

function getEvaluationSetChangedLabel(changed: boolean, t: (key: string) => string): string {
  return changed ? t("sm.versionDiff.evaluationSetChangedLabel") : t("sm.versionDiff.evaluationSetNotChangedLabel");
}

function getContextLabel(same: boolean, t: (key: string) => string): string {
  return same ? t("sm.versionDiff.sameContextLabel") : t("sm.versionDiff.differentContextLabel");
}

function getWarningLabel(item: string, t: (key: string) => string): string {
  switch (item) {
    case "evaluation_set_changed":
      return t("sm.versionDiff.warning.evaluation_set_changed");
    case "prompt_level_changed":
      return t("sm.versionDiff.warning.prompt_level_changed");
    default:
      return item;
  }
}



export default function VersionDiffDashboard() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [isExporting, setIsExporting] = useState(false);

  const loadProjects = () => {
    dispatch({ type: "LOAD_START" });
    listProjects()
      .then((projects) => {
        dispatch({ type: "SET_PROJECTS", projects });
      })
      .catch((error) => {
        dispatch({ type: "LOAD_ERROR", message: error instanceof Error ? error.message : t("api.project.fetchFailed") });
      });
  };

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state.selectedProjectId) return;
    listProjectDocuments(state.selectedProjectId)
      .then((documents) => dispatch({ type: "SET_DOCUMENTS", documents }))
      .catch((error) => dispatch({ type: "LOAD_ERROR", message: error instanceof Error ? error.message : t("api.document.fetchFailed") }));
  }, [state.selectedProjectId, t]);

  useEffect(() => {
    if (!state.selectedDocumentId) return;
    listDocumentVersions(state.selectedDocumentId)
      .then((versions) => dispatch({ type: "SET_VERSIONS", versions }))
      .catch((error) => dispatch({ type: "LOAD_ERROR", message: error instanceof Error ? error.message : t("api.version.fetchFailed") }));
  }, [state.selectedDocumentId, t]);

  const canCompare = useMemo(
    () => !!state.selectedDocumentId && !!state.versionAId && !!state.versionBId && state.versionAId !== state.versionBId,
    [state.selectedDocumentId, state.versionAId, state.versionBId],
  );

  const runCompare = () => {
    if (!canCompare || !state.selectedDocumentId || !state.versionAId || !state.versionBId) return;
    dispatch({ type: "LOAD_START" });
    getVersionDiff({
      document_id: state.selectedDocumentId,
      version_id_a: state.versionAId,
      version_id_b: state.versionBId,
    })
      .then((diff) => dispatch({ type: "SET_DIFF", diff }))
      .catch((error) => dispatch({ type: "LOAD_ERROR", message: error instanceof Error ? error.message : t("api.grading.fetchFailed") }));
  };

  const runExport = async () => {
    if (!state.diff || !state.selectedDocumentId || isExporting) return;
    setIsExporting(true);
    try {
      const payload = await exportVersionDiffCsv({
        document_id: state.selectedDocumentId,
        version_id_a: state.versionAId || state.diff.version_a.id,
        version_id_b: state.versionBId || state.diff.version_b.id,
      });
      const url = URL.createObjectURL(payload.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = payload.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      dispatch({ type: "LOAD_ERROR", message: error instanceof Error ? error.message : t("submissions.exportFailed") });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="ops-screen" aria-label={t("biz.versionDiff.title")}>
      <div className="versiondiff-toolbar">
        <div className="versiondiff-toolbar-grid">
            <label className="prod-field">
              <span>{t("sm.audit.project")}</span>
              <select value={state.selectedProjectId} onChange={(e) => dispatch({ type: "SET_PROJECT", projectId: e.target.value })}>
                <option value="">{t("sm.versionDiff.selectProject")}</option>
                {state.projects.map((item) => (
                  <option key={item.project_id} value={item.project_id}>{item.project_name}</option>
                ))}
              </select>
            </label>
            <label className="prod-field">
              <span>{t("sm.audit.document")}</span>
              <select
                value={state.selectedDocumentId ?? ""}
                onChange={(e) => dispatch({ type: "SET_DOCUMENT", documentId: e.target.value ? Number(e.target.value) : null })}
                disabled={!state.selectedProjectId}
              >
                <option value="">{t("sm.versionDiff.selectDocument")}</option>
                {state.documents.map((item) => (
                  <option key={item.document_id} value={item.document_id}>{item.document_name}</option>
                ))}
              </select>
            </label>
            <label className="prod-field">
              <span>{t("sm.versionDiff.versionA")}</span>
              <select
                value={state.versionAId ?? ""}
                onChange={(e) => dispatch({ type: "SET_VERSION_A", versionId: e.target.value ? Number(e.target.value) : null })}
                disabled={!state.selectedDocumentId}
              >
                <option value="">{t("sm.versionDiff.selectVersionA")}</option>
                {state.versions.map((item) => (
                  <option key={item.document_version_id} value={item.document_version_id}>{item.version}</option>
                ))}
              </select>
            </label>
            <label className="prod-field">
              <span>{t("sm.versionDiff.versionB")}</span>
              <select
                value={state.versionBId ?? ""}
                onChange={(e) => dispatch({ type: "SET_VERSION_B", versionId: e.target.value ? Number(e.target.value) : null })}
                disabled={!state.selectedDocumentId}
              >
                <option value="">{t("sm.versionDiff.selectVersionB")}</option>
                {state.versions.map((item) => (
                  <option key={item.document_version_id} value={item.document_version_id}>{item.version}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="versiondiff-header-actions">
            <button type="button" className="prod-button prod-button--primary" onClick={runCompare} disabled={!canCompare}>
              {t("sm.versionDiff.compare")}
            </button>
            {!canCompare && state.selectedDocumentId ? (
              <span className="ops-inline-hint">{t("sm.versionDiff.emptyDesc")}</span>
            ) : null}
          </div>
        </div>
      </div>

      {state.status === "loading" ? (
        <section className="ops-card versiondiff-loading-card">
          <LoadingState title={t("common.loading")} description={t("sm.versionDiff.loadingDesc")} />
          <SkeletonTable rows={4} cols={4} />
        </section>
      ) : null}
      {state.status === "error" ? (
        <ErrorState
          title={t("sm.grading.error")}
          description={state.error || t("api.unknown")}
          action={<button className="prod-button" type="button" onClick={loadProjects}>{t("sm.common.retry")}</button>}
        />
      ) : null}
      {state.status === "empty" ? <EmptyState title={t("sm.versionDiff.empty")} description={t("sm.versionDiff.emptyDesc")} /> : null}

      {state.diff ? (
        <>
          <section className="ops-card">
            <div className="versiondiff-score-head">
              <h2>{t("sm.versionDiff.scoreTitle")}</h2>
              <button type="button" className="prod-button" onClick={runExport} disabled={isExporting}>
                {isExporting ? t("submissions.exporting") : t("submissions.exportExcel")}
              </button>
            </div>
            <div className="diff-score-strip">
              <div className="diff-score-strip__item">
                <span>{state.diff.version_a.label}</span>
                <strong>{state.diff.score_diff.a_score ?? t("common.noValue")}</strong>
              </div>
              <div className="diff-score-strip__item">
                <span>{state.diff.version_b.label}</span>
                <strong>{state.diff.score_diff.b_score ?? t("common.noValue")}</strong>
              </div>
              <div className="diff-score-strip__delta">
                <StatusBadge tone={tone(state.diff.score_diff.direction)}>
                  {formatDelta(state.diff.score_diff.delta, t)}
                </StatusBadge>
              </div>
            </div>
          </section>

          <section className="ops-card">
            <h2>{t("sm.versionDiff.criteriaTitle")}</h2>
            <div className="prod-table-wrap">
              <table className="prod-history-table">
                <thead>
                  <tr>
                    <th className="versiondiff-col-criterion">{t("sm.versionDiff.criterion")}</th>
                    <th className="versiondiff-col-before">{t("sm.versionDiff.before")}</th>
                    <th className="versiondiff-col-after">{t("sm.versionDiff.after")}</th>
                    <th className="versiondiff-col-delta">{t("sm.versionDiff.delta")}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.diff.criteria_diff.map((row) => (
                    <tr key={row.criterion_key}>
                      <td className="versiondiff-col-criterion">{row.criterion_key}</td>
                      <td className="versiondiff-col-before">{row.a ?? t("common.noValue")}</td>
                      <td className="versiondiff-col-after">{row.b ?? t("common.noValue")}</td>
                      <td className={`versiondiff-col-delta ${deltaToneClass(row.direction)}`}>
                        <StatusBadge tone={tone(row.direction)}>{formatDelta(row.delta, t)}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ops-card">
            <h2>{t("sm.versionDiff.metaTitle")}</h2>
            <div className="prod-form-grid versiondiff-meta-grid">
              <div className="prod-field">
                <span>{t("sm.versionDiff.promptLevelChanged")}</span>
                <strong>{getPromptLevelChangedLabel(state.diff.meta_diff.prompt_level_changed, t)}</strong>
              </div>
              <div className="prod-field">
                <span>{t("sm.versionDiff.evaluationSetChanged")}</span>
                <strong>{getEvaluationSetChangedLabel(state.diff.meta_diff.evaluation_set_changed, t)}</strong>
              </div>
              <div className="prod-field">
                <span>{t("sm.versionDiff.sameContext")}</span>
                <strong>{getContextLabel(state.diff.comparison_validity.same_evaluation_context, t)}</strong>
              </div>
            </div>
            {state.diff.comparison_validity.warnings.length ? (
              <div className="versiondiff-meta-warnings">
                <strong>{t("sm.versionDiff.warnings")}</strong>
                <ul>
                  {state.diff.comparison_validity.warnings.map((item) => (
                    <li key={item}>{getWarningLabel(item, t)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  );
}
