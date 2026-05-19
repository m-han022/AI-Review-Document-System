import { useEffect, useMemo, useReducer, useState } from "react";

import { exportVersionDiffCsv, getVersionDiff, listDocumentVersions, listProjectDocuments, listProjects } from "../../api/client";
import type { DocumentListOut, Project, VersionDiffOut, VersionListOut } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { Button, Card, Select, StatusBadge } from "../ui";
import { LoadingState } from "../ui/States";
import { ArrowRightIcon } from "../ui/Icon";
import "./VersionDiffDashboard.css";

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

  const versionAData = useMemo(() => state.versions.find(v => v.document_version_id === state.versionAId), [state.versions, state.versionAId]);
  const versionBData = useMemo(() => state.versions.find(v => v.document_version_id === state.versionBId), [state.versions, state.versionBId]);

  const canCompare = useMemo(
    () => 
      !!state.selectedDocumentId && 
      !!state.versionAId && 
      !!state.versionBId && 
      state.versionAId !== state.versionBId &&
      versionAData?.latest_grading_score !== null &&
      versionBData?.latest_grading_score !== null,
    [state.selectedDocumentId, state.versionAId, state.versionBId, versionAData, versionBData],
  );

  const formatKey = (key: string) => {
    const translated = t(`upload.criteria.${key}`);
    if (translated !== `upload.criteria.${key}`) return translated;

    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

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
        <div className="version-diff-layout">
          <div className="version-diff-col">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            </div>
          </div>

          <div className="version-diff-col">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="version-select-group">
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
                {versionAData && (
                  <div className="version-mini-summary">
                    <span>{t("common.uploadedAt")}: <strong>{new Date(versionAData.uploaded_at).toLocaleDateString()}</strong></span>
                    <span>{t("project.metaScore")}: <strong>{versionAData.latest_grading_score ?? "—"}</strong></span>
                  </div>
                )}
              </div>

              <div className="version-select-group">
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
                {versionBData && (
                  <div className="version-mini-summary">
                    <span>{t("common.uploadedAt")}: <strong>{new Date(versionBData.uploaded_at).toLocaleDateString()}</strong></span>
                    <span>{t("project.metaScore")}: <strong>{versionBData.latest_grading_score ?? "—"}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--ds-color-border-subtle)' }}>
          <Button variant="primary" onClick={runCompare} disabled={!canCompare} size="lg">
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
                <div className="version-diff-total-summary">
                  <div className="version-diff-total-scores">
                    <div className="score-item">
                      <span className="label">{state.diff.version_a.label}</span>
                      <span className="value">{state.diff.score_diff.a_score}</span>
                    </div>
                    <div className="score-arrow"><ArrowRightIcon size="lg" /></div>
                    <div className="score-item">
                      <span className="label">{state.diff.version_b.label}</span>
                      <span className="value">{state.diff.score_diff.b_score}</span>
                    </div>
                  </div>
                  <div className="version-diff-total-delta">
                    <span className="label">Delta</span>
                    <div className={`delta-badge-lg ${state.diff.score_diff.direction}`}>
                      {state.diff.score_diff.delta > 0 ? "+" : ""}{state.diff.score_diff.delta}
                    </div>
                  </div>
                </div>
            </div>
            
            <Button variant="outline" size="md" onClick={runExport} isLoading={isExporting}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D6F42" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <path d="M8 13h2v7l-2-1v-6z"/>
                  <path d="M12 15h2l-2 2h2"/>
                </svg>
                {t("submissions.exportExcel")}
              </div>
            </Button>
          </Card>

          <Card title={t("sm.versionDiff.criteriaTitle")}>
            <div className="ds-table-container" style={{ marginTop: 'var(--ds-space-4)' }}>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>{t("sm.versionDiff.criterion")}</th>
                    <th style={{ textAlign: 'center' }}>{t("sm.versionDiff.before")}</th>
                    <th style={{ textAlign: 'center' }}>{t("sm.versionDiff.after")}</th>
                    <th style={{ textAlign: 'right' }}>{t("sm.versionDiff.delta")}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.diff.criteria_diff.map((row) => (
                    <tr key={row.criterion_key} className="ds-table-row-v4">
                      <td className="font-medium">{formatKey(row.criterion_key)}</td>
                      <td style={{ textAlign: 'center' }}>{row.a}</td>
                      <td style={{ textAlign: 'center' }}>{row.b}</td>
                      <td style={{ textAlign: 'right' }}>
                        <StatusBadge tone={row.direction === "up" ? "success" : row.direction === "down" ? "danger" : "muted"}>
                          {row.delta > 0 ? "+" : ""}{row.delta}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={t("sm.versionDiff.metaTitle")}>
            <div className="ds-table-container">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>{t("sm.versionDiff.contextFactor")}</th>
                    <th style={{ textAlign: 'center' }}>{t("sm.versionDiff.before")}</th>
                    <th style={{ textAlign: 'center' }}>{t("sm.versionDiff.after")}</th>
                    <th style={{ textAlign: 'right' }}>{t("sm.versionDiff.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-medium">{t("sm.versionDiff.promptLevel")}</td>
                    <td style={{ textAlign: 'center' }}>{state.diff.meta_diff.prompt_level_a || "—"}</td>
                    <td style={{ textAlign: 'center' }}>{state.diff.meta_diff.prompt_level_b || "—"}</td>
                    <td style={{ textAlign: 'right' }}>
                      <StatusBadge tone={state.diff.meta_diff.prompt_level_changed ? "warning" : "muted"}>
                        {state.diff.meta_diff.prompt_level_changed ? t("sm.versionDiff.changed") : t("sm.versionDiff.notChanged")}
                      </StatusBadge>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium">{t("sm.versionDiff.evaluationSet")}</td>
                    <td style={{ textAlign: 'center' }}>
                      {state.diff.meta_diff.evaluation_set_name_a || (state.diff.meta_diff.evaluation_set_id_a ? `#${state.diff.meta_diff.evaluation_set_id_a}` : "—")}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {state.diff.meta_diff.evaluation_set_name_b || (state.diff.meta_diff.evaluation_set_id_b ? `#${state.diff.meta_diff.evaluation_set_id_b}` : "—")}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <StatusBadge tone={state.diff.meta_diff.evaluation_set_changed ? "warning" : "muted"}>
                        {state.diff.meta_diff.evaluation_set_changed ? t("sm.versionDiff.changed") : t("sm.versionDiff.notChanged")}
                      </StatusBadge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {state.diff.comparison_validity.warnings.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div className="ds-alert ds-alert--warning">
                  <div className="ds-alert__title">{t("sm.versionDiff.warnings")}</div>
                  <div className="ds-alert__content">
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {state.diff.comparison_validity.warnings.map((item, idx) => (
                        <li key={idx}>{getWarningLabel(item, t)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
