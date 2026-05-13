import { useMemo } from "react";
import { getLocalizedText } from "../../locales/utils";
import { SparkIcon, TargetIcon, AlertTriangleIcon, AlertCircleIcon, CheckCircleIcon, TrendingUpIcon } from "../ui/Icon";
import { LoadingState } from "../ui/States";
import { Card } from "../ui";
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
    return orderedScores.map(score => {
      const detail = gradingDetail?.criteria_results.find(cr => cr.key === score.key);
      const suggestion = getLocalizedText(detail?.suggestion as any, lang);
      const normalize = (str: string) => str.toLowerCase().replace(/[0-9]+[.)]/g, "").replace(/\s+/g, "").trim();
      let evaluation = suggestion;
      if (!evaluation && (score.key === "review_tong_the" || score.key === "summary")) {
        const firstSection = feedbackSections.find(s => normalize(s.title).length < 3) || feedbackSections[0];
        if (firstSection) evaluation = `${t("project.derivedFromDraftFeedback")}: ${firstSection.lines.join(" ")}`;
      }

      return {
        ...score,
        evaluation: evaluation || t("project.noDetailedComment")
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
                    <tr key={idx} className="ds-table-row-v4">
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            width: '32px', height: '32px', borderRadius: '8px', 
                            background: item.value / item.max >= 0.8 ? 'rgba(16, 185, 129, 0.1)' : item.value / item.max >= 0.5 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: item.value / item.max >= 0.8 ? '#10B981' : item.value / item.max >= 0.5 ? '#F59E0B' : '#EF4444'
                          }}>
                            <TargetIcon size="sm" />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#1E293B' }}>{item.label}</span>
                            <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>{item.key}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: item.value / item.max >= 0.8 ? '#10B981' : item.value / item.max >= 0.5 ? '#F59E0B' : '#EF4444' }}>
                            {item.value}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>/ {item.max}</div>
                        </div>
                      </td>
                      <td>
                        <div style={{ 
                          fontSize: '13.5px', 
                          lineHeight: '1.6', 
                          color: '#334155', 
                          margin: 0,
                          whiteSpace: 'pre-wrap'
                        }}>
                          {item.evaluation.split('\n').map((para, pidx) => (
                            <p key={pidx} style={{ marginBottom: '8px' }}>
                              {para.startsWith('-') || para.startsWith('â€¢') 
                                ? <span style={{ display: 'block', paddingLeft: '12px', position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 0, color: 'var(--ds-color-primary)' }}>â€¢</span>
                                    {para.substring(1).trim()}
                                  </span>
                                : para
                              }
                            </p>
                          ))}
                        </div>
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


