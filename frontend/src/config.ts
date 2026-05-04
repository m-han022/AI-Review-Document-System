function getApiBaseUrl() {
  let baseUrl = import.meta.env.VITE_API_BASE_URL;

  if (!baseUrl) {
    if (typeof window === "undefined") {
      baseUrl = "http://localhost:8000/api";
    } else {
      const hostname = window.location.hostname;
      const resolvedHost = resolveApiHost(hostname || "localhost");
      baseUrl = `http://${resolvedHost}:8000/api`;
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

function formatHostForUrl(hostname: string): string {
  if (hostname.includes(":") && !hostname.startsWith("[")) {
    return `[${hostname}]`;
  }
  return hostname;
}

function resolveApiHost(hostname: string): string {
  const normalized = hostname.trim().toLowerCase();
  if (
    normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1"
    || normalized === "[::1]"
  ) {
    return "localhost";
  }
  return formatHostForUrl(hostname);
}

export const API_BASE_URL = getApiBaseUrl();

export const UI_LANGUAGE_STORAGE_KEY = "ui_language";
export const UI_THEME_STORAGE_KEY = "ui_theme";
export const DEFAULT_UI_LANGUAGE = "ja";
