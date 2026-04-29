import { API_BASE_URL, DEFAULT_UI_LANGUAGE, UI_LANGUAGE_STORAGE_KEY } from "../config";
import { normalizeLanguage } from "../locales/utils";
import type { RubricListResponse, RubricVersion, RubricVersionPayload, SubmissionListResponse } from "../types";

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
    deleteSubmissionFailed: "Xóa bài nộp thất bại.",
    deleteSubmissionsFailed: "Xóa các bài nộp thất bại.",
    exportSubmissionsFailed: "Xuất danh sách bài nộp thất bại.",
    fetchGradeJobFailed: "Không thể tải trạng thái review.",
    fetchRubricsFailed: "Không thể tải tiêu chuẩn đánh giá.",
    fetchSubmissionsFailed: "Không thể tải danh sách bài nộp.",
    gradeAllFailed: "Review hàng loạt thất bại.",
    gradingFailed: "Review thất bại.",
    saveRubricFailed: "Lưu tiêu chuẩn thất bại.",
    uploadFailed: "Tải file thất bại.",
  },
  ja: {
    activateRubricFailed: "評価基準の適用に失敗しました。",
    cannotConnect: "バックエンドに接続できません。サーバーを確認してください。",
    connectionTimeout: "接続がタイムアウトしました。バックエンドを確認してください。",
    deleteSubmissionFailed: "提出データの削除に失敗しました。",
    deleteSubmissionsFailed: "提出データの一括削除に失敗しました。",
    exportSubmissionsFailed: "提出データ一覧の出力に失敗しました。",
    fetchGradeJobFailed: "レビュー状況を読み込めませんでした。",
    fetchRubricsFailed: "評価基準を読み込めませんでした。",
    fetchSubmissionsFailed: "提出データ一覧を読み込めませんでした。",
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
}

export async function gradeSubmission({ projectId, force = false, rubricVersion = null }: GradeSubmissionParams) {
  const params = new URLSearchParams({
    language: currentLanguage,
  });
  if (force) {
    params.set("force", "true");
  }
  if (rubricVersion) {
    params.set("rubric_version", rubricVersion);
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

export async function gradeAll() {
  const res = await fetch(`${API_BASE_URL}/grade-all?language=${currentLanguage}`, {
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
