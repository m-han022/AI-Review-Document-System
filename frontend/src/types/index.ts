export const SUPPORTED_LANGUAGES = ["vi", "ja"] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export interface CriteriaResult {
  key: string;
  score: number;
  max_score: number;
  suggestion?: Record<string, unknown> | null;
}

export interface SlideReview {
  id: number;
  slide_number: number;
  status: "OK" | "NG";
  title?: Record<string, string> | null;
  summary?: Record<string, string> | null;
  issues?: Record<string, string[]> | null;
  suggestions?: Record<string, string> | null;
}

export interface GradingRun {
  id: number;
  score: number | null;
  total_score?: number | null;
  document_version_id?: number | null;
  document_version?: string | null;
  rubric_version?: string | null;
  rubric_hash?: string | null;
  gemini_model?: string | null;
  prompt_version?: string | null;
  prompt_level?: PromptLevel | string | null;
  policy_version?: string | null;
  policy_hash?: string | null;
  required_rule_hash?: string | null;
  prompt_hash?: string | null;
  criteria_hash?: string | null;
  grading_schema_version?: string | null;
  criteria_results: CriteriaResult[];
  slide_reviews?: SlideReview[];
  issue_breakdown?: Record<string, number>;
  draft_feedback: Record<string, string> | null;
  status: string;
  error_message?: string | null;
  graded_at?: string | null;
}

export interface GradingRunHistory {
  id: number;
  score: number | null;
  total_score?: number | null;
  document_id?: number | null;
  document_type?: string | null;
  document_name?: string | null;
  document_version_id?: number | null;
  document_version?: string | null;
  rubric_version?: string | null;
  rubric_hash?: string | null;
  gemini_model?: string | null;
  prompt_version?: string | null;
  prompt_level?: PromptLevel | string | null;
  policy_version?: string | null;
  policy_hash?: string | null;
  required_rule_hash?: string | null;
  prompt_hash?: string | null;
  criteria_hash?: string | null;
  grading_schema_version?: string | null;
  status: string;
  error_message?: string | null;
  graded_at?: string | null;
  criteria_result_count: number;
  slide_review_count: number;
  ng_slide_count: number;
  issue_count: number;
}

export interface Project {
  project_id: string;
  project_name: string;
  total_documents: number;
  latest_score: number | null;
  latest_status: string;
  latest_error_message?: string | null;
  latest_updated_at: string;
  project_description?: string | null;
}

export interface DocumentListOut {
  document_id: number;
  document_type: string;
  document_name: string;
  latest_version: string;
  latest_uploaded_at?: string | null;
  latest_score: number | null;
  latest_status: string;
  latest_error_message?: string | null;
}

export interface VersionListOut {
  document_version_id: number;
  version: string;
  filename: string;
  uploaded_at: string;
  is_latest: boolean;
  content_hash: string;
  latest_grading_score: number | null;
  latest_status: string;
  latest_error_message?: string | null;
}

export interface GradingListOut {
  grading_run_id: number;
  total_score: number;
  status: string;
  error_message?: string | null;
  prompt_level: string;
  rubric_version: string;
  prompt_version: string;
  gemini_model: string;
  created_at: string;
}

export interface Submission {
  project_id: string;
  project_name: string;
  filename: string;
  document_type?: string | null;
  uploaded_at: string;
  language: LanguageCode;
  status: string;
  project_description?: string | null;
  latest_document_id?: number | null;
  latest_document_name?: string | null;
  latest_document_version_id?: number | null;
  latest_document_version?: string | null;
  latest_score?: number | null;
  latest_prompt_level?: PromptLevel | string | null;
  latest_graded_at?: string | null;
  latest_run?: GradingRun | null;
  run_history?: GradingRunHistory[];
}

export type PromptLevel = "low" | "medium" | "high";

export interface SubmissionDocument {
  id: number;
  submission_id: number;
  document_type: string;
  document_name: string;
  created_at: string;
  updated_at: string;
  is_latest: boolean;
}

export interface DocumentVersion {
  id: number;
  submission_id: number;
  document_id?: number | null;
  document_type?: string | null;
  document_name?: string | null;
  document_version: string;
  filename: string;
  original_filename: string;
  file_path?: string | null;
  content_hash: string;
  language: LanguageCode;
  uploaded_at: string;
  is_latest: boolean;
}

export interface GradingRunDetail {
  submission: Submission;
  document?: SubmissionDocument | null;
  document_version?: DocumentVersion | null;
  grading_run: GradingRun;
  rubric?: RubricVersion | null;
  criteria_results: CriteriaResult[];
  slide_reviews: SlideReview[];
}

export interface CriteriaDelta {
  key: string;
  base_score: number | null;
  compare_score: number | null;
  delta: number;
  status: "improved" | "regressed" | "unchanged" | "new" | "retired";
}

export interface VersionComparison {
  document: DocumentListOut;
  base_version: VersionListOut;
  compare_version: VersionListOut;
  base_run?: GradingRun | null;
  compare_run?: GradingRun | null;
  score_delta?: number | null;
  criteria_deltas: CriteriaDelta[];
  ok_slide_delta: number;
  ng_slide_delta: number;
  insights: string[];
}

export interface UploadResponse {
  project_id: string;
  project_name: string;
  filename: string;
  document_type?: string | null;
  document_id?: number | null;
  document_name?: string | null;
  document_version_id?: number | null;
  document_version?: string | null;
  message: string;
  language: LanguageCode;
  project_description?: string | null;
}

export interface GradeResponse {
  project_id: string;
  project_name: string;
  run_id: number;
  score: number;
  document_version_id?: number | null;
  document_version?: string | null;
  rubric_version?: string | null;
  rubric_hash?: string | null;
  gemini_model?: string | null;
  prompt_version?: string | null;
  prompt_level?: PromptLevel | string | null;
  policy_version?: string | null;
  policy_hash?: string | null;
  required_rule_hash?: string | null;
  prompt_hash?: string | null;
  criteria_hash?: string | null;
  grading_schema_version?: string | null;
  criteria_scores?: Record<string, number>;
  criteria_suggestions?: Record<string, unknown>;
  draft_feedback: Record<string, string>;
  slide_reviews?: SlideReview[];
  graded_at: string;
  language: LanguageCode;
}

export interface GradeAllResult {
  project_id: string;
  project_name: string;
  score: number | null;
  run_id?: number | null;
  document_version_id?: number | null;
  document_version?: string | null;
  rubric_version?: string | null;
  rubric_hash?: string | null;
  gemini_model?: string | null;
  prompt_version?: string | null;
  prompt_level?: PromptLevel | string | null;
  policy_version?: string | null;
  policy_hash?: string | null;
  required_rule_hash?: string | null;
  prompt_hash?: string | null;
  criteria_hash?: string | null;
  grading_schema_version?: string | null;
  criteria_scores?: Record<string, number>;
  criteria_suggestions?: Record<string, unknown>;
  success: boolean;
  error?: string;
}

export interface GradeAllResponse {
  graded_count: number;
  failed_count: number;
  results: GradeAllResult[];
}

export type GradeJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface GradeJobResponse {
  job_id: string;
  status: GradeJobStatus;
  total_count: number;
  processed_count: number;
  graded_count: number;
  failed_count: number;
  results: GradeAllResult[];
  started_at: string;
  finished_at?: string | null;
  error?: string;
}

export interface SubmissionListResponse {
  submissions: Submission[];
  total: number;
  ungraded_count: number;
}

export interface RubricCriterion {
  key: string;
  max_score: number;
  labels: Record<LanguageCode, string>;
}

export type RubricStatus = "draft" | "active" | "archived";

export interface RubricVersion {
  document_type: string;
  version: string;
  active: boolean;
  criteria: RubricCriterion[];
  prompt: Partial<Record<LanguageCode, string>>;
}

export interface RubricListResponse {
  rubrics: RubricVersion[];
}

export interface RubricVersionPayload {
  version: string;
  criteria: RubricCriterion[];
  prompt: Partial<Record<LanguageCode, string>>;
}
