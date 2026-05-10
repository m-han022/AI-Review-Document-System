export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 18,
  6: 24,
} as const;

export const typography = {
  fontFamily: {
    base: 'Inter, "Noto Sans JP", "Yu Gothic", "Hiragino Sans", system-ui, sans-serif',
  },
  fontSize: {
    caption: 12,
    body: 14,
    section: 18,
    title: 24,
    metric: 28,
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 800,
  },
  lineHeight: {
    tight: 1.2,
    title: 1.4,
    heading: 1.3,
    body: 1.5,
  },
} as const;

export const radius = {
  sm: 4,
  md: 10,
  card: 16,
  control: 12,
  pill: 999,
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

export const color = {
  primary: "#2563EB",
  primaryText: "#1D4ED8",
  primarySoft: "#EFF6FF",
  success: "#10B981",
  successSoft: "#ECFDF5",
  warning: "#F59E0B",
  warningSoft: "#FFFBEB",
  danger: "#EF4444",
  dangerStrong: "#B91C1C",
  dangerSoft: "#FEF2F2",
  error: "#EF4444",
  errorSoft: "#FEF2F2",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  textOnDark: "#FFFFFF",
  bgApp: "#FBFCFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  border: "#E2E8F0",
  borderSubtle: "#F1F5F9",
  borderStrong: "#CBD5E1",
  rowHover: "#F8FAFC",
  rowSelected: "#EFF6FF",
  sidebar: "#111C32",
  sidebarActive: "#1E293B",
  white: "#FFFFFF",
} as const;

export const shadow = {
  card: "0 1px 2px rgba(15, 23, 42, 0.03)",
} as const;

export const cssVar = {
  color: {
    primary: "var(--ds-color-primary)",
    primaryText: "var(--ds-color-primary-text)",
    primarySoft: "var(--ds-color-primary-soft)",
    success: "var(--ds-color-success)",
    warning: "var(--ds-color-warning)",
    danger: "var(--ds-color-danger)",
    border: "var(--ds-color-border)",
    borderStrong: "var(--ds-color-border-strong)",
  },
  space: {
    1: "var(--ds-space-1)",
    2: "var(--ds-space-2)",
    3: "var(--ds-space-3)",
    4: "var(--ds-space-4)",
    5: "var(--ds-space-5)",
    6: "var(--ds-space-6)",
  },
} as const;

export type IconSize = keyof typeof iconSize;
