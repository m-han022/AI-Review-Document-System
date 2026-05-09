const TECHNICAL_ERROR_PATTERNS = [
  /failed to fetch/i,
  /network ?error/i,
  /timeout/i,
  /status code/i,
  /traceback/i,
  /sql/i,
  /syntaxerror/i,
  /module not found/i,
  /cannot read propert/i,
  /undefined/i,
];

export function toHumanErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (error instanceof Error) {
    const raw = String(error.message || "").trim();
    if (!raw) return fallback;
    if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(raw))) {
      return fallback;
    }
    if (raw.length > 180) return fallback;
    return raw;
  }
  return fallback;
}
