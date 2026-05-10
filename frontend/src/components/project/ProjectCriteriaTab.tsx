import { useMemo } from "react";
import { getLocalizedText } from "../../locales/utils";
import { SparkIcon, TargetIcon, AlertTriangleIcon, ShieldCheckIcon, AlertCircleIcon, CheckCircleIcon, TrendingUpIcon } from "../ui/Icon";
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
  const { lang, gradingDetail, orderedScores, result, feedbackSections, gradings } = viewModel;

  // Calculate dynamic trend
  const trend = useMemo(() => {
    if (!gradings || gradings.length < 2 || !result) return null;
    const currentScore = result.total_score || 0;
    const previousGrading = gradings.find(g => g.grading_run_id !== result.id && g.status?.toLowerCase() === 'completed');
    if (!previousGrading || previousGrading.total_score === undefined) return null;
    
    const prevScore = previousGrading.total_score || 0;
    const diff = currentScore - prevScore;
    return {
      value: Math.abs(diff).toFixed(1),
      isUp: diff >= 0,
    };
  }, [gradings, result]);

  // Derive evaluations
  const criteriaWithEvaluations = useMemo(() => {
    return orderedScores.map(score => {
      const detail = gradingDetail?.criteria_results.find(cr => cr.key === score.key);
      const suggestion = getLocalizedText(detail?.suggestion as any, lang);
      const normalize = (str: string) => str.toLowerCase().replace(/[0-9]+[.)]/g, "").replace(/\s+/g, "").trim();
      const scoreNorm = normalize(score.label);
      
      const synonyms: Record<string, string[]> = {
        "diem_tot": ["điểm tốt", "điểm mạnh", "ưu điểm", "tốt"],
        "diem_xau": ["điểm cần cải thiện", "điểm yếu", "hạn chế", "điểm chưa tốt", "nhược điểm", "xấu"],
        "chinh_sach": ["chính sách cải thiện", "giải pháp cải thiện", "hành động khắc phục", "chính sách"]
      };
      const scoreSynonyms = (synonyms[score.key] || []).map(s => normalize(s));

      const matchedSection = feedbackSections.find(section => {
        const sectionNorm = normalize(section.title);
        if (sectionNorm.length < 3) return false;
        return sectionNorm.includes(scoreNorm) || scoreNorm.includes(sectionNorm) ||
               scoreSynonyms.some(syn => sectionNorm.includes(syn) || syn.includes(sectionNorm));
      });

      let evaluation = suggestion || matchedSection?.lines.join(" ");
      if (!evaluation && (score.key === "review_tong_the" || score.key === "summary")) {
        const firstSection = feedbackSections.find(s => normalize(s.title).length < 3) || feedbackSections[0];
        if (firstSection) evaluation = firstSection.lines.join(" ");
      }

      return {
        ...score,
        evaluation: evaluation || t("project.noDetailedComment") || "Không có nhận xét chi tiết cho tiêu chí này."
      };
    });
  }, [orderedScores, gradingDetail, feedbackSections, lang, t]);

  const stats = useMemo(() => {
    const total = orderedScores.length;
    // Đạt: >= 80%
    const passed = orderedScores.filter(s => s.value / s.max >= 0.8).length;
    // Cần cải thiện: 50% - 80%
    const improvement = orderedScores.filter(s => s.value / s.max >= 0.5 && s.value / s.max < 0.8).length;
    // Chưa đạt: < 50%
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

  const scoreLevel = useMemo(() => {
    const score = result?.total_score || 0;
    if (score >= 90) return { label: "Xuất sắc", color: "var(--ds-color-success)" };
    if (score >= 80) return { label: "Tốt", color: "var(--ds-color-primary)" };
    if (score >= 65) return { label: "Trung bình", color: "var(--ds-color-warning)" };
    return { label: "Yếu", color: "var(--ds-color-danger)" };
  }, [result]);

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
              {/* 1. Tổng số tiêu chí */}
              <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                  <TargetIcon size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', fontWeight: 600 }}>{t("project.totalCriteria") || "Tổng số tiêu chí"}</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#1E293B' }}>{stats.total}</span>
                </div>
              </Card>

              {/* 2. Cần cải thiện */}
              <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                  <AlertTriangleIcon size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', fontWeight: 600 }}>{t("project.needsImprovement") || "Cần cải thiện"}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#F59E0B' }}>{stats.improvement}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>({stats.improvementPercent}%)</span>
                  </div>
                </div>
              </Card>

              {/* 3. Chưa đạt */}
              <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                  <AlertCircleIcon size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', fontWeight: 600 }}>{t("project.failed") || "Chưa đạt"}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#EF4444' }}>{stats.failed}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>({stats.failedPercent}%)</span>
                  </div>
                </div>
              </Card>

              {/* 4. Đạt */}
              <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <CheckCircleIcon size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', fontWeight: 600 }}>{t("project.passed") || "Đạt"}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#10B981' }}>{stats.passed}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>({stats.passedPercent}%)</span>
                  </div>
                </div>
              </Card>

              {/* 5. Điểm trung bình */}
              <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1' }}>
                  <TrendingUpIcon size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', fontWeight: 600 }}>{t("project.averageScore") || "Điểm trung bình"}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#1E293B' }}>{result?.total_score || 0}</span>
                    <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>/ 100</span>
                  </div>
                </div>
              </Card>
            </div>
          </section>


          {/* Block 2: Detailed Evaluation Table */}
          <section className="analysis-table-v4">
            <Card style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--ds-color-border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--ds-color-border)' }}>
                    <th style={{ padding: '16px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', width: '25%' }}>
                      {t("project.criteria") || "Tiêu chí"}
                    </th>
                    <th style={{ padding: '16px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', width: '15%', textAlign: 'center' }}>
                      {t("project.metaScore") || "Điểm"}
                    </th>
                    <th style={{ padding: '16px', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                      {t("project.detailedBreakdown") || "Đánh giá chi tiết từ AI"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {criteriaWithEvaluations.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < criteriaWithEvaluations.length - 1 ? '1px solid var(--ds-color-border)' : 'none' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            width: '32px', height: '32px', borderRadius: '8px', 
                            background: '#F1F5F9', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--ds-color-primary)'
                          }}>
                            <item.Icon size="xs" />
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '14px', color: '#334155' }}>{item.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '16px', color: item.value / item.max >= 0.8 ? '#10B981' : item.value / item.max >= 0.5 ? '#F59E0B' : '#EF4444' }}>
                            {item.value}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>/ {item.max}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <p style={{ fontSize: '13.5px', lineHeight: '1.6', color: '#475569', margin: 0 }}>
                          {item.evaluation}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
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
