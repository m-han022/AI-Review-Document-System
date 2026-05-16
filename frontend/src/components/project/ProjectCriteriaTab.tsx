import { useMemo } from "react";
import { getLocalizedText } from "../../locales/utils";
import { SparkIcon, TargetIcon, AlertTriangleIcon, AlertCircleIcon, CheckCircleIcon, TrendingUpIcon } from "../ui/Icon";
import { LoadingState } from "../ui/States";
import { Card } from "../ui";
import "../ui/KPICharts.css";
import type { ProjectCriteriaTabViewModel } from "./projectCard.viewModels";

interface Props {
  t: (key: string) => string;
  viewModel: ProjectCriteriaTabViewModel;
  setHoveredCriterion: (v: string | null) => void;
}

export default function ProjectCriteriaTab({
  t,
  viewModel,
}: Props) {
  const { lang, gradingDetail, orderedScores, result, feedbackSections } = viewModel;

  // Derive evaluations
  const criteriaWithEvaluations = useMemo(() => {
    const normalize = (str: string) =>
      (str || "")
        .toLowerCase()
        .replace(/[0-9]+[.)]/g, "")
        .replace(/[*#:\-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const fallbackByKey: Record<string, string> = {};
    const genericFallback = feedbackSections
      .flatMap((section) => section.lines || [])
      .filter(Boolean)
      .slice(0, 2)
      .join("\n")
      .trim();

    return orderedScores.map(score => {
      const detail = gradingDetail?.criteria_results.find(cr => cr.key === score.key);
      const localized = (detail?.suggestion as any)?.[lang] ?? (detail?.suggestion as any)?.[lang === "vi" ? "ja" : "vi"] ?? null;
      const evaluationText = typeof localized?.evaluation === "string" ? localized.evaluation.trim() : "";
      const improvementText = typeof localized?.improvement === "string" ? localized.improvement.trim() : "";
      const legacySuggestion = getLocalizedText(detail?.suggestion as any, lang);
      let evaluation = evaluationText || legacySuggestion || fallbackByKey[score.key] || "";
      const improvement = improvementText;
      if (!evaluation) {
        const firstSection = feedbackSections.find(s => normalize(s.title).length < 3) || feedbackSections[0];
        if (firstSection) evaluation = firstSection.lines.join("\n");
      }
      if (!evaluation) {
        evaluation = genericFallback;
      }

      return {
        ...score,
        evaluation: evaluation || t("project.noDetailedComment"),
        improvement,
      };
    });
  }, [orderedScores, gradingDetail, feedbackSections, lang, t]);

  const stats = useMemo(() => {
    const total = orderedScores.length;
    // Äáº¡t: >= 80%
    const passed = orderedScores.filter(s => s.value / s.max >= 0.8).length;
    // Cáº§n cáº£i thiá»‡n: 50% - 80%
    const improvement = orderedScores.filter(s => s.value / s.max >= 0.5 && s.value / s.max < 0.8).length;
    // ChÆ°a Ä‘áº¡t: < 50%
    const failed = orderedScores.filter(s => s.value / s.max < 0.5).length;
    
    return {
      total,
      passed,
      improvement,
      failed,
      passedPercent: total > 0 ? Math.round((passed / total) * 100) : 0,
      improvementPercent: total > 0 ? Math.round((improvement / total) * 100) : 0,
      failedPercent: total > 0 ? Math.round((failed / total) * 100) : 0
    };
  }, [orderedScores]);


  return (
    <div className="project-criteria-tab-v4" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {gradingDetail ? (
        <>
          {/* Block 1: Professional Header Row as per reference image */}
          <section className="analysis-header-v4">
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(5, 1fr)', 
              gap: '16px' 
            }}>
              {/* 1. Tá»•ng sá»‘ tiÃªu chÃ­ */}
              <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                  <TargetIcon size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', fontWeight: 600 }}>{t("project.totalCriteria")}</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#1E293B' }}>{stats.total}</span>
                </div>
              </Card>

              {/* 2. Cáº§n cáº£i thiá»‡n */}
              <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                  <AlertTriangleIcon size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', fontWeight: 600 }}>{t("project.needsImprovement")}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#F59E0B' }}>{stats.improvement}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>({stats.improvementPercent}%)</span>
                  </div>
                </div>
              </Card>

              {/* 3. ChÆ°a Ä‘áº¡t */}
              <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                  <AlertCircleIcon size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', fontWeight: 600 }}>{t("project.failed")}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#EF4444' }}>{stats.failed}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>({stats.failedPercent}%)</span>
                  </div>
                </div>
              </Card>

              {/* 4. Äáº¡t */}
              <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <CheckCircleIcon size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', fontWeight: 600 }}>{t("project.passed")}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#10B981' }}>{stats.passed}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>({stats.passedPercent}%)</span>
                  </div>
                </div>
              </Card>

              {/* 5. Äiá»ƒm trung bÃ¬nh */}
              <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1' }}>
                  <TrendingUpIcon size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', fontWeight: 600 }}>{t("project.averageScore")}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#1E293B' }}>{typeof result?.total_score === "number" ? result.total_score : 0}</span>
                    <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>/ 100</span>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          <section className="analysis-table-v4">
            <header className="section-header-v3" style={{ marginBottom: 'var(--ds-space-6)' }}>
              <h2 className="section-title-v3">
                <SparkIcon size="sm" /> {t("project.criteriaDetailTitle")}
              </h2>
            </header>
            <div className="ds-table-container">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>{t("project.criteria")}</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>{t("project.metaScore")}</th>
                    <th>{t("project.feedbackTitle")}</th>
                  </tr>
                </thead>
                <tbody>
                  {criteriaWithEvaluations.map((item, idx) => (
                    <tr key={idx} className="ds-table-row-v4" style={{ height: '96px' }}>
                      <td style={{ verticalAlign: 'top', paddingTop: '12px' }}>
                        {(() => {
                          const percent = Math.max(0, Math.min(100, Math.round((item.value / item.max) * 100)));
                          const status = percent >= 80 ? "success" : percent >= 60 ? "warning" : "danger";
                          return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            width: '32px', height: '32px', borderRadius: '8px', 
                            background: item.value / item.max >= 0.8 ? 'rgba(16, 185, 129, 0.1)' : item.value / item.max >= 0.5 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: item.value / item.max >= 0.8 ? '#10B981' : item.value / item.max >= 0.5 ? '#F59E0B' : '#EF4444'
                          }}>
                            <TargetIcon size="sm" />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', minHeight: '72px' }}>
                            <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#1E293B' }}>{item.label}</span>
                            <div style={{ marginTop: '8px', width: '240px', maxWidth: '100%' }}>
                              <div className="kpi-progress-track-v4">
                                <div
                                  className={`kpi-progress-fill-v4 kpi-progress-fill-v4--${status}`}
                                  style={{ width: `${percent}%` }}
                                >
                                  {percent > 15 && <span className="kpi-progress-percent-tag-v4">{percent}%</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                          );
                        })()}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px', minHeight: '28px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1, color: item.value / item.max >= 0.8 ? '#10B981' : item.value / item.max >= 0.5 ? '#F59E0B' : '#EF4444' }}>
                            {item.value}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, lineHeight: 1 }}>/ {item.max}</span>
                        </div>
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: '12px' }}>
                        <div style={{
                          fontSize: '13.5px', 
                          lineHeight: '1.7', 
                          color: '#334155', 
                          margin: 0,
                          whiteSpace: 'pre-wrap'
                        }}>
                          <p style={{ marginBottom: '8px', fontWeight: 700 }}>{t("project.feedbackTitle")}:</p>
                          {item.evaluation.split('\n').filter(Boolean).map((para: string, pidx: number) => (
                            <p key={pidx} style={{ marginBottom: '8px' }}>
                              {para.startsWith("-") || para.startsWith("•")
                                ? <span style={{ display: 'block', paddingLeft: '12px', position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 0, color: 'var(--ds-color-primary)' }}>•</span>
                                    {para.replace(/^[-•]\s*/, "").trim()}
                                  </span>
                                : para
                              }
                            </p>
                          ))}
                        </div>
                        {item.improvement && (
                          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed #dbe4ee', whiteSpace: 'pre-wrap', color: '#0f766e', fontSize: '13px', lineHeight: '1.6' }}>
                            <strong>{t("project.suggestions")}:</strong> {item.improvement}
                          </div>
                        )}
                        {item.value / item.max < 0.7 && (
                          <div style={{ 
                            marginTop: '12px', 
                            padding: '8px 12px', 
                            background: 'var(--ds-color-primary-soft)', 
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: 'var(--ds-color-primary-dark)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <SparkIcon size="sm" /> {t("project.improveScoreBlock")}: {t("project.suggestionImprovementHint")}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <Card style={{ padding: "60px", textAlign: "center" }}>
          <LoadingState title={t("project.loadingGradingData")} />
        </Card>
      )}
    </div>
  );
}


