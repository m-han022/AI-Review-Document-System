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
      <header className="project-toolbar-v3">
        <h3>{t("project.scoreOverview")}</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="secondary" size="sm" disabled title={t("common.comingSoon") || "Coming soon"}>
            {t("project.exportReport")}
          </Button>
        </div>
      </header>
      <Card className="score-overview-card-v4">
        {gradingDetail ? (
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
                <h4 className="matrix-title-v4">{t("project.criteriaScores")}</h4>
                <Button variant="ghost" size="sm" disabled title={t("common.comingSoon") || "Coming soon"}>
                  Sort by Score
                </Button>
              </div>
              <KPIProgressList data={orderedScores} highlightedKey={hoveredCriterion} onHover={setHoveredCriterion} />
            </div>
          </div>
        ) : (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <LoadingState title={t("project.loadingGradingData")} />
          </div>
        )}
      </Card>
      <section className="action-center-v3">
        <header className="section-header-v3">
          <h2 className="section-title-v3">{t("project.criteriaInsights")}</h2>
          <span className="section-badge-v3">
            {orderedScores.filter((s) => s.value < s.max).length} {t("project.improvementPoints")}
          </span>
        </header>
        <div className="criteria-insight-grid-v4">
          {orderedScores.filter((s) => s.value < s.max).map((s, idx) => {
            const criterionResult = result?.criteria_results?.find((cr: CriteriaResult) => cr.key === s.key);
            const suggestion = criterionResult?.suggestion ? getLocalizedText(criterionResult.suggestion as Record<string, string>, lang) : null;
            return (
              <article key={idx} className="insight-card-v4">
                <div className={`insight-card-v4__score-tag ${s.value / s.max < 0.5 ? "is-critical" : "is-warning"}`}>
                  {s.value}/{s.max}
                </div>
                <div className="insight-card-v4__content">
                  <h4 className="insight-card-v4__title">{s.label}</h4>
                  <div className="insight-card-v4__body">{suggestion || t("project.noSpecificSuggestion")}</div>
                </div>
              </article>
            );
          })}
        </div>
        <header className="section-header-v3" style={{ marginTop: "32px" }}>
          <h2 className="section-title-v3">{t("project.executiveSummary")}</h2>
        </header>
        <div className="executive-summary-card-v4">
          <div className="summary-content-v4">
            {feedbackSections.map((section, idx) => (
              <div key={idx} className="summary-block-v4">
                {section.title && <h5>{section.title}</h5>}
                <ul>
                  {section.lines.map((line, lidx) => <li key={lidx}>{line}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
