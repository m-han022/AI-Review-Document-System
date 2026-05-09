import { getLocalizedText } from "../../locales/utils";
import { Button, Card } from "../ui";
import { LoadingState } from "../ui/States";
import { AlertTriangleIcon, ShieldCheckIcon, SparkIcon } from "../ui/Icon";
import { KPIProgressList, KPIPieChart } from "../ui/KPICharts";
import type { CriteriaResult } from "../../types";
import type { ProjectCriteriaTabViewModel } from "./projectCard.viewModels";

interface Props {
  t: (key: string) => string;
  viewModel: ProjectCriteriaTabViewModel;
  setHoveredCriterion: (v: string | null) => void;
}

export default function ProjectCriteriaTab({
  t,
  viewModel,
  setHoveredCriterion,
}: Props) {
  const { lang, gradingDetail, orderedScores, hoveredCriterion, result, feedbackSections } = viewModel;
  return (
    <>
      {gradingDetail ? (
        <>
          <section className="action-center-v3" style={{ marginBottom: "32px" }}>
            <header className="section-header-v3">
              <h2 className="section-title-v3" style={{ fontSize: "1.25rem", color: "var(--ds-color-primary-dark)" }}>
                <SparkIcon size="sm" /> {t("project.executiveSummary")}
              </h2>
            </header>
            <div className="executive-summary-card-v4" style={{ marginBottom: "24px", background: "var(--ds-color-primary-soft)", border: "1px solid var(--ds-color-primary-light)", padding: "24px", borderRadius: "12px" }}>
              <div className="summary-content-v4">
                {feedbackSections.map((section, idx) => (
                  <div key={idx} className="summary-block-v4">
                    {section.title && <h5 style={{ color: "var(--ds-color-primary-dark)", fontSize: "1rem", marginBottom: "12px" }}>{section.title}</h5>}
                    <ul style={{ paddingLeft: "20px", color: "var(--ds-color-text-body)", lineHeight: "1.6" }}>
                      {section.lines.map((line, lidx) => <li key={lidx} style={{ marginBottom: "8px" }}>{line}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <header className="section-header-v3">
              <h2 className="section-title-v3" style={{ fontSize: "1.125rem" }}>{t("project.criteriaInsights")}</h2>
              <span className="section-badge-v3">
                {orderedScores.filter((s) => s.value < s.max).length} {t("project.improvementPoints")}
              </span>
            </header>
            <div className="criteria-insight-grid-v4">
              {orderedScores.filter((s) => s.value < s.max).map((s, idx) => {
                const criterionResult = result?.criteria_results?.find((cr: CriteriaResult) => cr.key === s.key);
                const suggestion = criterionResult?.suggestion ? getLocalizedText(criterionResult.suggestion as Record<string, string>, lang) : null;
                return (
                  <article key={idx} className="insight-card-v4" style={{ background: "var(--ds-color-warning-soft)", borderColor: "var(--ds-color-warning-light)" }}>
                    <div style={{ position: "relative", width: "48px", height: "48px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} title={`${s.value}/${s.max}`}>
                      <svg width="48" height="48" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--ds-color-background)" strokeWidth="4" />
                        <circle 
                          cx="24" cy="24" r="20" fill="none" 
                          stroke={s.value / (s.max || 1) < 0.5 ? "var(--ds-color-danger)" : s.value / (s.max || 1) < 0.8 ? "var(--ds-color-warning)" : "var(--ds-color-success)"} 
                          strokeWidth="4" 
                          strokeDasharray="125.6" 
                          strokeDashoffset={125.6 - (s.value / (s.max || 1)) * 125.6} 
                          strokeLinecap="round" 
                          transform="rotate(-90 24 24)" 
                          style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }}
                        />
                      </svg>
                      <span style={{ position: "absolute", fontSize: "0.85rem", fontWeight: 700, color: "var(--ds-color-text-title)" }}>{s.value}</span>
                    </div>
                    <div className="insight-card-v4__content">
                      <h4 className="insight-card-v4__title">{s.label}</h4>
                      <div className="insight-card-v4__body" style={{ color: "var(--ds-color-text-body)", fontSize: "0.95rem", lineHeight: "1.5" }}>{suggestion || t("project.noSpecificSuggestion")}</div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <header className="project-toolbar-v3">
            <h3>{t("project.scoreOverview")}</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button variant="secondary" size="sm" disabled title={t("common.comingSoon") || "Coming soon"}>
                {t("project.exportReport")}
              </Button>
            </div>
          </header>
          <Card className="score-overview-card-v4">
            <div className="overview-split-v4">
              <div className="overview-visual-pane">
                <div className="visual-header-v4">
                  <h4 className="visual-title-v4">{t("project.totalScore")}</h4>
                  <div className="trend-indicator-v4 success">
                    <SparkIcon size="sm" />
                    <span>+12% vs v1</span>
                  </div>
                </div>
                <div className="pie-wrapper-v4">
                  <KPIPieChart data={orderedScores} highlightedKey={hoveredCriterion} />
                </div>
                <div className="quick-insight-v4">
                  {orderedScores.length > 0 && (
                    <>
                      <div className="insight-item-v4 success">
                        <ShieldCheckIcon size="sm" />
                        <span>{t("project.bestCriterion")} {[...orderedScores].sort((a, b) => b.value / (b.max || 1) - a.value / (a.max || 1))[0]?.label}</span>
                      </div>
                      <div className="insight-item-v4 danger">
                        <AlertTriangleIcon size="sm" />
                        <span>{t("project.worstCriterion")} {[...orderedScores].sort((a, b) => a.value / (a.max || 1) - b.value / (b.max || 1))[0]?.label}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="overview-matrix-pane">
                <div className="matrix-header-v4">
                  <h4 className="matrix-title-v4">{t("project.scoreOverview")}</h4>
                  <Button variant="ghost" size="sm" disabled title={t("common.comingSoon") || "Coming soon"}>
                    Sort by Score
                  </Button>
                </div>
                <KPIProgressList data={orderedScores} highlightedKey={hoveredCriterion} onHover={setHoveredCriterion} />
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card className="score-overview-card-v4" style={{ padding: "60px", textAlign: "center" }}>
          <LoadingState title={t("project.loadingGradingData")} />
        </Card>
      )}
    </>
  );
}
