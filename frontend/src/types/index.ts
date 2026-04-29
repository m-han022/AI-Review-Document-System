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
  rubric_version?: string | null;
  gemini_model?: string | null;
  prompt_hash?: string | null;
  criteria_hash?: string | null;
  grading_schema_version?: string | null;
  criteria_results: CriteriaResult[];
  slide_reviews?: SlideReview[];
  draft_feedback: Record<string, string> | null;
  status: string;
  error_message?: string | null;
  graded_at?: string | null;
}

export interface Submission {
  project_id: string;
  project_name: string;
  filename: string;
  document_type?: string | null;
  uploaded_at: string;
  language: LanguageCode;
  status: string;
  latest_run?: GradingRun | null;
}

export interface UploadResponse {
  project_id: string;
  project_name: string;
  filename: string;
  document_type?: string | null;
  message: string;
  language: LanguageCode;
}

export interface GradeResponse {
  project_id: string;
  project_name: string;
  run_id: number;
  score: number;
  rubric_version?: string | null;
  gemini_model?: string | null;
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
  rubric_version?: string | null;
  gemini_model?: string | null;
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
