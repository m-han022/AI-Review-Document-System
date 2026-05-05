import { API_BASE_URL, DEFAULT_UI_LANGUAGE, UI_LANGUAGE_STORAGE_KEY } from "../config";
import { normalizeLanguage } from "../locales/utils";
import type {
  SubmissionDocument,
  DocumentVersion,
  GradingRunDetail,
  GradingRunHistory,
  PromptLevel,
  RubricListResponse,
  RubricVersion,
  RubricVersionPayload,
  Submission,
  SubmissionListResponse,
  Project,
  DocumentListOut,
  VersionListOut,
  GradingListOut,
  VersionComparison,
  MgmtRubric,
  MgmtPrompt,
  MgmtPolicy,
  RequiredRulesResponse,
  FinalPromptPreviewResponse,
  EvaluationSet,
  EvaluationSetDetail,
} from "../types";

// Language setting
let currentLanguage = normalizeLanguage(localStorage.getItem(UI_LANGUAGE_STORAGE_KEY) || DEFAULT_UI_LANGUAGE);
export const LANGUAGE_CHANGE_EVENT = "app-language-change";

type ApiMessageKey =
  | "activateRubricFailed"
  | "cannotConnect"
  | "connectionTimeout"
  | "deleteSubmissionFailed"
  | "deleteSubmissionsFailed"
  | "exportSubmissionsFailed"
  | "fetchGradeJobFailed"
  | "fetchRubricsFailed"
  | "fetchSubmissionsFailed"
  | "gradeAllFailed"
  | "gradingFailed"
  | "saveRubricFailed"
  | "uploadFailed";

const apiMessages: Record<"vi" | "ja", Record<ApiMessageKey, string>> = {
  vi: {
    activateRubricFailed: "Áp dụng tiêu chuẩn thất bại.",
    cannotConnect: "Không thể kết nối backend. Vui lòng kiểm tra máy chủ.",
    connectionTimeout: "Kết nối quá thời gian. Vui lòng kiểm tra backend.",
    deleteSubmissionFailed: "Xóa dự án thất bại.",
    deleteSubmissionsFailed: "Xóa các dự án thất bại.",
    exportSubmissionsFailed: "Xuất danh sách dự án thất bại.",
    fetchGradeJobFailed: "Không thể tải trạng thái review.",
    fetchRubricsFailed: "Không thể tải tiêu chuẩn đánh giá.",
    fetchSubmissionsFailed: "Không thể tải danh sách dự án.",
    gradeAllFailed: "Review hàng loạt thất bại.",
    gradingFailed: "Review thất bại.",
    saveRubricFailed: "Lưu tiêu chuẩn thất bại.",
    uploadFailed: "Tải file thất bại.",
  },
  ja: {
    activateRubricFailed: "評価基準の適用に失敗しました。",
    cannotConnect: "バックエンドに接続できません。サーバーを確認してください。",
    connectionTimeout: "接続がタイムアウトしました。バックエンドを確認してください。",
    deleteSubmissionFailed: "プロジェクトの削除に失敗しました。",
    deleteSubmissionsFailed: "プロジェクトの一括削除に失敗しました。",
    exportSubmissionsFailed: "プロジェクト一覧の出力に失敗しました。",
    fetchGradeJobFailed: "レビュー状況を読み込めませんでした。",
    fetchRubricsFailed: "評価基準を読み込めませんでした。",
    fetchSubmissionsFailed: "プロジェクト一覧を読み込めませんでした。",
    gradeAllFailed: "一括レビューに失敗しました。",
    gradingFailed: "レビューに失敗しました。",
    saveRubricFailed: "評価基準の保存に失敗しました。",
    uploadFailed: "ファイルのアップロードに失敗しました。",
  },
};

function apiMessage(key: ApiMessageKey): string {
  const language = currentLanguage === "ja" ? "ja" : "vi";
  return apiMessages[language][key];
}

export function getLanguage(): string {
  return currentLanguage;
}

export function setLanguage(lang: string): void {
  currentLanguage = normalizeLanguage(lang);
  localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, currentLanguage);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: lang }));
  }
}

// API functions
export async function getSubmissions(limit: number = 100, offset: number = 0): Promise<SubmissionListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(`${API_BASE_URL}/submissions?${params.toString()}`);
  if (!res.ok) throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  return res.json();
}

export async function getSubmission(projectId: string): Promise<Submission> {
  const res = await fetch(`${API_BASE_URL}/submissions/${encodeURIComponent(projectId)}`);
  if (!res.ok) throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  return res.json();
}

export async function getSubmissionVersions(projectId: string): Promise<DocumentVersion[]> {
  const res = await fetch(`${API_BASE_URL}/submissions/${encodeURIComponent(projectId)}/versions`);
  if (!res.ok) throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  return res.json();
}

export async function getSubmissionDocuments(projectId: string): Promise<SubmissionDocument[]> {
  const res = await fetch(`${API_BASE_URL}/submissions/${encodeURIComponent(projectId)}/documents`);
  if (!res.ok) throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  return res.json();
}

export async function getSubmissionGradingRuns(projectId: string): Promise<GradingRunHistory[]> {
  const res = await fetch(`${API_BASE_URL}/submissions/${encodeURIComponent(projectId)}/grading-runs`);
  if (!res.ok) throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  return res.json();
}

export async function getGradingRunDetail(runId: number): Promise<GradingRunDetail> {
  const res = await fetch(`${API_BASE_URL}/grading-runs/${runId}`);
  if (!res.ok) throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  return res.json();
}

// New Hierarchical API methods
export async function listProjects(limit: number = 100, offset: number = 0): Promise<Project[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const url = `${API_BASE_URL}/projects?${params.toString()}`;
  console.log(`[API] Fetching projects: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[API] Fetch projects failed: ${res.status} ${res.statusText} at ${url}`);
    throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  }
  const data = await res.json();
  // Handle wrapper objects from backend (SubmissionListResponse has 'submissions' key)
  const list = data.submissions || data.projects || data.items || (Array.isArray(data) ? data : []);
  return list as Project[];
}

export async function listProjectDocuments(projectId: string): Promise<DocumentListOut[]> {
  const url = `${API_BASE_URL}/projects/${encodeURIComponent(projectId)}/documents-summary`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[API] Fetch project documents failed: ${res.status} at ${url}`);
    throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  }
  return res.json();
}

export async function listDocumentVersions(documentId: number): Promise<VersionListOut[]> {
  const url = `${API_BASE_URL}/documents/${documentId}/versions`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[API] Fetch versions failed: ${res.status} at ${url}`);
    throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  }
  return res.json();
}

export async function listVersionGradings(documentVersionId: number): Promise<GradingListOut[]> {
  const url = `${API_BASE_URL}/versions/${documentVersionId}/gradings`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[API] Fetch gradings failed: ${res.status} at ${url}`);
    throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  }
  return res.json();
}

export async function getGradingRun(gradingRunId: number): Promise<GradingRunDetail> {
  return getGradingRunDetail(gradingRunId);
}

export async function compareGradingRuns(projectId: string, runA: number, runB: number): Promise<any> {
  const params = new URLSearchParams({ run_a: String(runA), run_b: String(runB) });
  const res = await fetch(`${API_BASE_URL}/submissions/${encodeURIComponent(projectId)}/compare?${params.toString()}`);
  if (!res.ok) throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  return res.json();
}

export async function compareVersions(documentId: number, baseId: number, compareId: number): Promise<VersionComparison> {
  const params = new URLSearchParams({ base_version_id: String(baseId), compare_version_id: String(compareId) });
  const res = await fetch(`${API_BASE_URL}/documents/${documentId}/compare?${params.toString()}`);
  if (!res.ok) throw new Error(`${apiMessage("fetchSubmissionsFailed")} ${res.statusText}`);
  return res.json();
}

export function getSubmissionFileUrl(projectId: string, disposition: "inline" | "attachment" = "inline") {
  const params = new URLSearchParams({ disposition });
  return `${API_BASE_URL}/submissions/${encodeURIComponent(projectId)}/file?${params.toString()}`;
}

export async function uploadFile(formData: FormData) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
  
  try {
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || apiMessage("uploadFailed"));
    }
    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(apiMessage("connectionTimeout"));
    }
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      throw new Error(apiMessage("cannotConnect"));
    }
    throw error;
  }
}

interface GradeSubmissionParams {
  projectId: string;
  force?: boolean;
  rubricVersion?: string | null;
  documentVersionId?: number | null;
  promptLevel?: PromptLevel | string | null;
  evaluationSetId?: number | null;
}

interface GradeAllParams {
  force?: boolean;
  rubricVersion?: string | null;
  promptLevel?: PromptLevel | string | null;
}

export async function gradeSubmission({
  projectId,
  force = false,
  rubricVersion = null,
  documentVersionId = null,
  promptLevel = null,
  evaluationSetId = null,
}: GradeSubmissionParams) {
  const params = new URLSearchParams({
    language: currentLanguage,
  });
  if (force) {
    params.set("force", "true");
  }
  if (rubricVersion) {
    params.set("rubric_version", rubricVersion);
  }
  if (typeof documentVersionId === "number") {
    params.set("document_version_id", String(documentVersionId));
  }
  if (promptLevel) {
    params.set("prompt_level", promptLevel);
  }
  if (typeof evaluationSetId === "number") {
    params.set("evaluation_set_id", String(evaluationSetId));
  }

  const res = await fetch(`${API_BASE_URL}/grade/${projectId}?${params.toString()}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || apiMessage("gradingFailed"));
  }
  return res.json();
}

export async function gradeAll({ force = false, rubricVersion = null, promptLevel = null }: GradeAllParams = {}) {
  const params = new URLSearchParams({
    language: currentLanguage,
  });
  if (force) {
    params.set("force", "true");
  }
  if (rubricVersion) {
    params.set("rubric_version", rubricVersion);
  }
  if (promptLevel) {
    params.set("prompt_level", promptLevel);
  }

  const res = await fetch(`${API_BASE_URL}/grade-all?${params.toString()}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || apiMessage("gradeAllFailed"));
  }
  return res.json();
}

export async function getGradeJob(jobId: string) {
  const res = await fetch(`${API_BASE_URL}/grade-jobs/${jobId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || apiMessage("fetchGradeJobFailed"));
  }
  return res.json();
}

export async function deleteSubmission(projectId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/submissions/${projectId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || apiMessage("deleteSubmissionFailed"));
  }
}

export async function bulkDeleteSubmissions(projectIds: string[]): Promise<{ deleted: string[], failed: string[] }> {
  const response = await fetch(`${API_BASE_URL}/submissions/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_ids: projectIds }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || apiMessage("deleteSubmissionsFailed"));
  }
  
  return response.json();
}

export async function exportSubmissionsExcel(): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_BASE_URL}/exports/submissions.xlsx`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || apiMessage("exportSubmissionsFailed"));
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const match = contentDisposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || "submissions_export.xlsx";

  return { blob, filename };
}

export async function getRubrics(): Promise<RubricListResponse> {
  const response = await fetch(`${API_BASE_URL}/rubrics`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || apiMessage("fetchRubricsFailed"));
  }
  return response.json();
}

export async function saveRubricVersion(
  documentType: string,
  version: string,
  payload: RubricVersionPayload,
): Promise<RubricVersion> {
  const response = await fetch(`${API_BASE_URL}/rubrics/${documentType}/${version}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || apiMessage("saveRubricFailed"));
  }

  return response.json();
}

export async function activateRubricVersion(documentType: string, version: string): Promise<RubricVersion> {
  const response = await fetch(`${API_BASE_URL}/rubrics/${documentType}/${version}/activate`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || apiMessage("activateRubricFailed"));
  }

  return response.json();
}

export async function listMgmtRubrics(documentType?: string): Promise<MgmtRubric[]> {
  const params = new URLSearchParams();
  if (documentType) params.set("document_type", documentType);
  const mgmtRes = await fetch(`${API_BASE_URL}/mgmt/rubrics?${params.toString()}`);
  if (mgmtRes.ok) {
    return mgmtRes.json();
  }

  // Backward-compatible fallback for older backend instances that only expose /rubrics
  const legacyRes = await fetch(`${API_BASE_URL}/rubrics`);
  if (!legacyRes.ok) {
    throw new Error(`Failed to fetch mgmt rubrics: ${mgmtRes.status} ${mgmtRes.statusText}`);
  }

  const legacyPayload = await legacyRes.json();
  const legacyRubrics = Array.isArray(legacyPayload?.rubrics) ? legacyPayload.rubrics : [];
  return legacyRubrics
    .filter((item: any) => !documentType || item.document_type === documentType)
    .map((item: any, index: number) => ({
      id: Number(index + 1),
      document_type: item.document_type,
      version: item.version,
      status: item.active ? "active" : "archived",
      active: Boolean(item.active),
      prompt: item.prompt || {},
      created_at: "",
      updated_at: "",
      hash: "",
      summary: `${Array.isArray(item.criteria) ? item.criteria.length : 0} criteria`,
    }));
}

export async function createMgmtRubric(payload: {
  document_type: string;
  version: string;
  prompt: Record<string, string>;
  criteria: Array<{ key: string; max_score: number; labels?: Record<string, string> }>;
  summary?: string;
  activate?: boolean;
}): Promise<MgmtRubric> {
  const res = await fetch(`${API_BASE_URL}/mgmt/rubrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) return res.json();

  if (res.status === 404) {
    const legacyRes = await fetch(`${API_BASE_URL}/rubrics/${payload.document_type}/${payload.version}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: payload.version,
        criteria: payload.criteria,
        prompt: payload.prompt,
      }),
    });
    if (!legacyRes.ok) {
      const legacyErr = await legacyRes.json().catch(() => ({ detail: legacyRes.statusText }));
      throw new Error(legacyErr.detail || "Failed to create rubric");
    }
    const legacyBody = await legacyRes.json();
    if (payload.activate) {
      await fetch(`${API_BASE_URL}/rubrics/${payload.document_type}/${payload.version}/activate`, { method: "POST" });
    }
    return {
      id: 0,
      document_type: legacyBody.document_type,
      version: legacyBody.version,
      status: legacyBody.active ? "active" : "archived",
      active: Boolean(legacyBody.active),
      prompt: legacyBody.prompt || {},
      created_at: "",
      updated_at: "",
      hash: "",
      summary: `${Array.isArray(legacyBody.criteria) ? legacyBody.criteria.length : 0} criteria`,
    };
  }
  const err = await res.json().catch(() => ({ detail: res.statusText }));
  throw new Error(err.detail || "Failed to create rubric");
}

export async function activateMgmtRubric(id: number): Promise<MgmtRubric> {
  const res = await fetch(`${API_BASE_URL}/mgmt/rubrics/${id}/activate`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to activate rubric: ${res.statusText}`);
  return res.json();
}

export async function listMgmtPrompts(documentType?: string, level?: string): Promise<MgmtPrompt[]> {
  const params = new URLSearchParams();
  if (documentType) params.set("document_type", documentType);
  if (level) params.set("level", level);
  const res = await fetch(`${API_BASE_URL}/mgmt/prompts?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch prompts: ${res.statusText}`);
  return res.json();
}

export async function createMgmtPrompt(payload: {
  document_type: string;
  level: string;
  version: string;
  content: string;
  activate?: boolean;
}): Promise<MgmtPrompt> {
  const res = await fetch(`${API_BASE_URL}/mgmt/prompts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) return res.json();

  if (res.status === 404) {
    const fallbackRes = await fetch(`${API_BASE_URL}/prompts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!fallbackRes.ok) {
      const err = await fallbackRes.json().catch(() => ({ detail: fallbackRes.statusText }));
      throw new Error(err.detail || "Failed to create prompt");
    }
    return fallbackRes.json();
  }
  const err = await res.json().catch(() => ({ detail: res.statusText }));
  throw new Error(err.detail || "Failed to create prompt");
}

export async function activateMgmtPrompt(id: number): Promise<MgmtPrompt> {
  const res = await fetch(`${API_BASE_URL}/mgmt/prompts/${id}/activate`, { method: "POST" });
  if (res.ok) return res.json();
  if (res.status === 404) {
    const fallbackRes = await fetch(`${API_BASE_URL}/prompts/${id}/activate`, { method: "POST" });
    if (!fallbackRes.ok) throw new Error(`Failed to activate prompt: ${fallbackRes.statusText}`);
    return fallbackRes.json();
  }
  throw new Error(`Failed to activate prompt: ${res.statusText}`);
}

export async function listMgmtPolicies(level?: string): Promise<MgmtPolicy[]> {
  const params = new URLSearchParams();
  if (level) params.set("level", level);
  const res = await fetch(`${API_BASE_URL}/mgmt/policies?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch policies: ${res.statusText}`);
  return res.json();
}

export async function createMgmtPolicy(payload: {
  level: string;
  version: string;
  content: string;
  activate?: boolean;
}): Promise<MgmtPolicy> {
  const res = await fetch(`${API_BASE_URL}/mgmt/policies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) return res.json();
  if (res.status === 404) {
    const fallbackRes = await fetch(`${API_BASE_URL}/policies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!fallbackRes.ok) {
      const err = await fallbackRes.json().catch(() => ({ detail: fallbackRes.statusText }));
      throw new Error(err.detail || "Failed to create policy");
    }
    return fallbackRes.json();
  }
  const err = await res.json().catch(() => ({ detail: res.statusText }));
  throw new Error(err.detail || "Failed to create policy");
}

export async function activateMgmtPolicy(id: number): Promise<MgmtPolicy> {
  const res = await fetch(`${API_BASE_URL}/mgmt/policies/${id}/activate`, { method: "POST" });
  if (res.ok) return res.json();
  if (res.status === 404) {
    const fallbackRes = await fetch(`${API_BASE_URL}/policies/${id}/activate`, { method: "POST" });
    if (!fallbackRes.ok) throw new Error(`Failed to activate policy: ${fallbackRes.statusText}`);
    return fallbackRes.json();
  }
  throw new Error(`Failed to activate policy: ${res.statusText}`);
}

export async function getRequiredRules(): Promise<RequiredRulesResponse> {
  const res = await fetch(`${API_BASE_URL}/mgmt/required-rules`);
  if (!res.ok) throw new Error(`Failed to fetch required rules: ${res.statusText}`);
  return res.json();
}

export async function previewFinalPrompt(documentType: string, level: string): Promise<FinalPromptPreviewResponse> {
  const params = new URLSearchParams({ document_type: documentType, level });
  const res = await fetch(`${API_BASE_URL}/mgmt/final-prompt/preview?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to preview final prompt");
  }
  return res.json();
}

export async function listEvaluationSets(documentType?: string, level?: string): Promise<EvaluationSet[]> {
  const params = new URLSearchParams();
  if (documentType) params.set("document_type", documentType);
  if (level) params.set("level", level);
  const res = await fetch(`${API_BASE_URL}/mgmt/evaluation-sets?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch evaluation sets: ${res.statusText}`);
  return res.json();
}

export async function getActiveEvaluationSet(documentType: string, level: string): Promise<EvaluationSet> {
  const params = new URLSearchParams({ document_type: documentType, level });
  const res = await fetch(`${API_BASE_URL}/mgmt/evaluation-sets/active?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch active evaluation set: ${res.statusText}`);
  return res.json();
}

export async function getEvaluationSetDetail(id: number): Promise<EvaluationSetDetail> {
  const res = await fetch(`${API_BASE_URL}/mgmt/evaluation-sets/by-id/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch evaluation set detail: ${res.statusText}`);
  return res.json();
}

export async function createEvaluationSet(payload: {
  base_set_id: number;
  name: string;
  changes: { rubric_content?: string | null; prompt_content?: string | null; policy_content?: string | null; required_rules_content?: string | null };
  activate: boolean;
}): Promise<EvaluationSet> {
  const res = await fetch(`${API_BASE_URL}/mgmt/evaluation-sets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to create evaluation set");
  }
  return res.json();
}

export async function activateEvaluationSet(id: number): Promise<EvaluationSet> {
  const res = await fetch(`${API_BASE_URL}/mgmt/evaluation-sets/${id}/activate`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to activate evaluation set: ${res.statusText}`);
  return res.json();
}

export async function bootstrapEvaluationSet(payload: {
  document_type: string;
  level: string;
  name?: string;
}): Promise<EvaluationSet> {
  const res = await fetch(`${API_BASE_URL}/mgmt/evaluation-sets/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to bootstrap evaluation set");
  }
  return res.json();
}
