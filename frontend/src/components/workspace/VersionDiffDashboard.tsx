import { useEffect, useMemo, useReducer, useState } from "react";

import { exportVersionDiffCsv, getVersionDiff, listDocumentVersions, listProjectDocuments, listProjects } from "../../api/client";
import type { DocumentListOut, Project, VersionDiffOut, VersionListOut } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { Button, Card, PageHeader, Select, StatusBadge } from "../ui";
import { LoadingState } from "../ui/States";

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
    <div className="workspace-stack">
      <Card title={t("sm.versionDiff.compare")}>
        <div className="governance-grid" style={{ marginBottom: '20px' }}>
          <Select 
            label={t("sm.audit.project")} 
            value={state.selectedProjectId} 
            onChange={(e) => dispatch({ type: "SET_PROJECT", projectId: e.target.value })}
            options={[
              { value: "", label: t("sm.versionDiff.selectProject") },
              ...state.projects.map(item => ({ value: item.project_id, label: item.project_name }))
            ]}
          />
          <Select 
            label={t("sm.audit.document")} 
            value={state.selectedDocumentId ?? ""} 
            onChange={(e) => dispatch({ type: "SET_DOCUMENT", documentId: e.target.value ? Number(e.target.value) : null })}
            disabled={!state.selectedProjectId}
            options={[
              { value: "", label: t("sm.versionDiff.selectDocument") },
              ...state.documents.map(item => ({ value: String(item.document_id), label: item.document_name }))
            ]}
          />
          <Select 
            label={t("sm.versionDiff.versionA")} 
            value={state.versionAId ?? ""} 
            onChange={(e) => dispatch({ type: "SET_VERSION_A", versionId: e.target.value ? Number(e.target.value) : null })}
            disabled={!state.selectedDocumentId}
            options={[
              { value: "", label: t("sm.versionDiff.selectVersionA") },
              ...state.versions.map(item => ({ value: String(item.document_version_id), label: item.version }))
            ]}
          />
          <Select 
            label={t("sm.versionDiff.versionB")} 
            value={state.versionBId ?? ""} 
            onChange={(e) => dispatch({ type: "SET_VERSION_B", versionId: e.target.value ? Number(e.target.value) : null })}
            disabled={!state.selectedDocumentId}
            options={[
              { value: "", label: t("sm.versionDiff.selectVersionB") },
              ...state.versions.map(item => ({ value: String(item.document_version_id), label: item.version }))
            ]}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={runCompare} disabled={!canCompare}>
            {t("sm.versionDiff.compare")}
          </Button>
        </div>
      </Card>

      {state.status === "loading" && (
        <Card>
          <LoadingState title={t("common.loading")} description={t("sm.versionDiff.loadingDesc")} />
        </Card>
      )}

      {state.diff && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card title={t("sm.versionDiff.scoreTitle")}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '40px' }}>
                <div className="detail-section">
                  <span className="detail-section__title">{state.diff.version_a.label}</span>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>{state.diff.score_diff.a_score ?? "—"}</div>
                </div>
                <div className="detail-section">
                  <span className="detail-section__title">{state.diff.version_b.label}</span>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>{state.diff.score_diff.b_score ?? "—"}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--ds-color-text-muted)', marginBottom: '4px' }}>Delta</div>
                <StatusBadge tone={tone(state.diff.score_diff.direction)}>
                  {formatDelta(state.diff.score_diff.delta, t)}
                </StatusBadge>
              </div>
            </div>
            
            <Button variant="outline" size="sm" onClick={runExport} isLoading={isExporting}>
              {t("submissions.exportExcel")}
            </Button>
          </Card>

          <Card title={t("sm.versionDiff.criteriaTitle")}>
            <div className="prod-table-wrap">
              <table className="prod-history-table">
                <thead>
                  <tr>
                    <th>{t("sm.versionDiff.criterion")}</th>
                    <th>{t("sm.versionDiff.before")}</th>
                    <th>{t("sm.versionDiff.after")}</th>
                    <th style={{ textAlign: 'right' }}>{t("sm.versionDiff.delta")}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.diff.criteria_diff.map((row) => (
                    <tr key={row.criterion_key}>
                      <td style={{ fontWeight: 600 }}>{row.criterion_key}</td>
                      <td>{row.a ?? t("common.noValue")}</td>
                      <td>{row.b ?? t("common.noValue")}</td>
                      <td style={{ textAlign: 'right' }}>
                        <StatusBadge tone={tone(row.direction)}>
                          {formatDelta(row.delta, t)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={t("sm.versionDiff.metaTitle")}>
            <div className="governance-grid">
              <div className="detail-section">
                <span className="detail-section__title">{t("sm.versionDiff.promptLevelChanged")}</span>
                <div style={{ fontWeight: 600 }}>{getPromptLevelChangedLabel(state.diff.meta_diff.prompt_level_changed, t)}</div>
              </div>
              <div className="detail-section">
                <span className="detail-section__title">{t("sm.versionDiff.evaluationSetChanged")}</span>
                <div style={{ fontWeight: 600 }}>{getEvaluationSetChangedLabel(state.diff.meta_diff.evaluation_set_changed, t)}</div>
              </div>
              <div className="detail-section">
                <span className="detail-section__title">{t("sm.versionDiff.sameContext")}</span>
                <div style={{ fontWeight: 600 }}>{getContextLabel(state.diff.comparison_validity.same_evaluation_context, t)}</div>
              </div>
            </div>
            {state.diff.comparison_validity.warnings.length > 0 && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--ds-color-warning-light)', borderRadius: 'var(--ds-radius-md)' }}>
                <strong style={{ fontSize: '12px', color: 'var(--ds-color-warning)' }}>{t("sm.versionDiff.warnings")}</strong>
                <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '13px', color: 'var(--ds-color-text)' }}>
                  {state.diff.comparison_validity.warnings.map((item) => (
                    <li key={item}>{getWarningLabel(item, t)}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
