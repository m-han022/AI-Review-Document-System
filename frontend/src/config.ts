function getApiBaseUrl() {
  let baseUrl = import.meta.env.VITE_API_BASE_URL;

  if (!baseUrl) {
    if (typeof window === "undefined") {
      baseUrl = "http://127.0.0.1:8000/api";
    } else {
      const hostname = window.location.hostname;
      const apiHost = !hostname || hostname === "localhost" ? "127.0.0.1" : hostname;
      baseUrl = `http://${apiHost}:8000/api`;
    }
  }

  // Ensure it doesn't end with a slash
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  // Ensure it ends with /api
  if (!baseUrl.endsWith("/api")) {
    baseUrl = `${baseUrl}/api`;
  }

  return baseUrl;
}

export const API_BASE_URL = getApiBaseUrl();

export const UI_LANGUAGE_STORAGE_KEY = "ui_language";
export const UI_THEME_STORAGE_KEY = "ui_theme";
export const DEFAULT_UI_LANGUAGE = "ja";
