const BASE = "/assets/ai-review";

export const aiReviewAssets = {
  headerLightAi: `${BASE}/header_ai_light.svg`,
  aiRobotIllustration: `${BASE}/ai_robot.svg`,
  heroObject: `${BASE}/ai_cube_custom_cropped.png`,
  sidebarIcons: {
    dashboard: `${BASE}/dashboard.svg`,
    document: `${BASE}/document.svg`,
    reviewHistory: `${BASE}/review_history.svg`,
    qualityReport: `${BASE}/quality_report.svg`,
    compare: `${BASE}/compare.svg`,
    workflow: `${BASE}/workflow.svg`,
    export: `${BASE}/export.svg`,
    settings: `${BASE}/settings.svg`,
  },
} as const;
