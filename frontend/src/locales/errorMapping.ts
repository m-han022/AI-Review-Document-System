import type { ApiErrorCode } from "../api/client";

export function mapErrorCodeToI18nKey(code?: ApiErrorCode | null): string {
  switch (code) {
    case "NETWORK_UNREACHABLE":
      return "api.network.unreachable";
    case "REQUEST_TIMEOUT":
      return "api.request.timeout";
    case "UPLOAD_FAILED":
      return "api.upload.failed";
    case "GRADING_FAILED":
      return "api.grading.failed";
    case "EVALUATION_SET_REQUIRED":
      return "api.evaluationSet.required";
    case "EVALUATION_SET_INVALID":
      return "api.evaluationSet.invalid";
    case "EVALUATION_SET_INACTIVE":
      return "api.evaluationSet.inactive";
    case "EVALUATION_SET_SCOPE_MISMATCH":
      return "api.evaluationSet.scopeMismatch";
    case "PROJECT_FETCH_FAILED":
      return "api.project.fetchFailed";
    case "DOCUMENT_FETCH_FAILED":
      return "api.document.fetchFailed";
    case "VERSION_FETCH_FAILED":
      return "api.version.fetchFailed";
    case "GRADING_FETCH_FAILED":
      return "api.grading.fetchFailed";
    case "EVALUATION_SET_FETCH_FAILED":
      return "api.evaluationSet.fetchFailed";
    case "EVALUATION_SET_CREATE_FAILED":
      return "api.evaluationSet.createFailed";
    case "EVALUATION_SET_BOOTSTRAP_FAILED":
      return "api.evaluationSet.bootstrapFailed";
    default:
      return "api.unknown";
  }
}

