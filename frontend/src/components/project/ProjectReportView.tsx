import { useMemo } from "react";
import { StatusBadge } from "../ui/States";
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, TargetIcon, SparkIcon, LayersIcon, WorkflowIcon } from "../ui/Icon";
import { getLocalizedText } from "../../locales/utils";
import type { FeedbackSectionView } from "./ProjectReviewPanels";
import type { KPIBarChartProps } from "../ui/KPICharts";
import type { ProjectSlidesTabViewModel } from "./projectCard.viewModels";

interface Props {
  t: (key: string) => string;
  projectTitle: string;
  versionInfo: string;
  gradingDate: string;
  totalScore: number;
  geminiModel: string;
  feedbackSections: FeedbackSectionView[];
  orderedScores: KPIBarChartProps["data"];
  slidesViewModel: ProjectSlidesTabViewModel;
  lang: string;
  extractedText?: string;
  promptLevel?: string;
  evaluationSetName?: string;
  categorizedInsights?: any[];
  gradingDetail?: any;
  verdictText?: string;
}

export default function ProjectReportView({
  t,
  projectTitle,
  versionInfo,
  gradingDate,
  totalScore,
  geminiModel,
  feedbackSections,
  orderedScores,
  slidesViewModel,
  lang,
  extractedText,
  promptLevel,
  evaluationSetName,
  categorizedInsights,
  gradingDetail,
  verdictText
}: Props) {
  const { pageReviewItems } = slidesViewModel;



  // Logic to extract page-specific evidence (same as ProjectSlidesTab)
  const getSlideEvidence = (slideNum: number) => {
    if (!extractedText) return null;
    const startMarkerPage = `[Page ${slideNum}]`;
    const nextMarkerPage = `[Page ${slideNum + 1}]`;
    const startMarkerSlide = `[Slide ${slideNum}]`;
    const nextMarkerSlide = `[Slide ${slideNum + 1}]`;
    let startIdx = extractedText.indexOf(startMarkerPage);
    let endIdx = -1;
    let markerLen = startMarkerPage.length;
    if (startIdx !== -1) {
      endIdx = extractedText.indexOf(nextMarkerPage, startIdx + markerLen);
    } else {
      startIdx = extractedText.indexOf(startMarkerSlide);
      markerLen = startMarkerSlide.length;
      if (startIdx !== -1) {
        endIdx = extractedText.indexOf(nextMarkerSlide, startIdx + markerLen);
      }
    }
    if (startIdx === -1) return null;
    return extractedText.substring(startIdx + markerLen, endIdx === -1 ? extractedText.length : endIdx).trim();
  };

  // Extract NG pages for priority section
  const ngSlides = pageReviewItems.filter(s => s.status === "NG").slice(0, 4);

  const checklistItems = useMemo(() => {
    const fromCriteria = (gradingDetail?.criteria_results || [])
      .map((item: any) => getLocalizedText(item?.suggestion as any, lang))
      .filter(Boolean);
    const fromSlides = pageReviewItems
      .map((item) => (item?.suggestions || "").toString().trim())
      .filter(Boolean);
    return Array.from(new Set([...fromCriteria, ...fromSlides])).slice(0, 8);
  }, [gradingDetail, pageReviewItems, lang]);

  // Calculate detailed evaluations (replicated from ProjectCriteriaTab)
  const criteriaWithEvaluations = useMemo(() => {
    return orderedScores.map(score => {
      const detail = gradingDetail?.criteria_results.find((cr: any) => cr.key === score.key);
      const suggestion = getLocalizedText(detail?.suggestion as any, lang as any);
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

  return (
    <div className="project-report-print-view">
      {/* 1. Report Header */}
      <header className="report-print-header">
        <div className="report-print-header__brand">
          <div className="report-print-logo">{t("common.appName")}</div>
          <div className="report-print-type">{t("project.reportTitle")}</div>
        </div>
        <div className="report-print-header__meta">
          <div className="report-print-meta-item"><strong>{t("project.projectLabel")}:</strong> {projectTitle}</div>
          <div className="report-print-meta-item"><strong>{t("project.versionLabel")}:</strong> {versionInfo}</div>
          <div className="report-print-meta-item"><strong>{t("project.gradingDateLabel")}:</strong> {gradingDate}</div>
        </div>
      </header>

      {/* 2. Project Context / Metadata */}
      <section className="report-print-section report-print-context">
        <div className="report-context-grid" style={{ display: 'flex', gap: '40px', fontSize: '11px', color: '#64748b', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          {promptLevel && (
            <div><strong>{t("project.metaLevel")}:</strong> <span style={{ textTransform: 'uppercase' }}>{promptLevel}</span></div>
          )}
          {evaluationSetName && (
            <div><strong>{t("project.metaEvaluationSet")}:</strong> {evaluationSetName}</div>
          )}
          <div><strong>{t("project.metaModel")}:</strong> {geminiModel}</div>
        </div>
      </section>

      {/* AI Final Verdict Banner */}
      {verdictText && (
        <section className="report-print-section">
          <div className="report-print-verdict-banner" style={{ 
            background: 'var(--ds-color-primary-soft)', 
            border: '1px solid var(--ds-color-primary-light)', 
            padding: '16px 20px', 
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            <SparkIcon size="sm" color="var(--ds-color-primary)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '11px', color: 'var(--ds-color-primary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                {t("project.executiveSummary")}
              </div>
              <div style={{ fontSize: '13.5px', color: '#1e293b', fontWeight: 600 }}>{verdictText}</div>
            </div>
          </div>
        </section>
      )}

      {/* 3. Executive Insights (Top Highlights) */}
      {categorizedInsights && (
        <section className="report-print-section">
          <div className="report-print-insights-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
            {categorizedInsights.map((insight, idx) => (
              <div key={idx} className={`report-print-insight-card priority-${insight.type}`} style={{ 
                padding: '15px', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                background: insight.type === 'danger' ? '#fef2f2' : insight.type === 'success' ? '#f0fdf4' : '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: insight.type === 'danger' ? '#ef4444' : insight.type === 'success' ? '#10b981' : '#2563eb' }}>
                  <insight.Icon size="xs" />
                  <strong style={{ fontSize: '11px', textTransform: 'uppercase' }}>{insight.title}</strong>
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#1e293b' }}>{insight.content}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Summary & Score Section */}
      <section className="report-print-section">
        <h2 className="report-print-section__title">
          <SparkIcon size="sm" /> {t("project.executiveSummary")}
        </h2>
        <div className="report-print-summary-grid">
          <div className="report-print-score-card">
            <div className="report-print-score-card__label">{t("project.metaScore")}</div>
            <div className={`report-print-score-card__value ${totalScore >= 80 ? 'success' : totalScore >= 60 ? 'warning' : 'danger'}`}>
              {totalScore}
            </div>
          </div>
          <div className="report-print-feedback-list">
            {feedbackSections.map((section, idx) => (
              <div key={idx} className="report-print-feedback-item">
                <h4 className="report-print-feedback-item__title" style={{ color: "#2563eb" }}>{section.title}</h4>
                <ul>
                  {section.lines.map((line, lidx) => (
                    <li key={lidx}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Action Checklist Section */}
      {checklistItems.length > 0 && (
        <section className="report-print-section">
          <h2 className="report-print-section__title">
            <WorkflowIcon size="sm" /> {t("project.actionChecklist")}
          </h2>
          <div className="report-print-checklist" style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            {checklistItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px', fontSize: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '14px', height: '14px', border: '1px solid #cbd5e1', borderRadius: '3px', marginTop: '2px' }} />
                <div style={{ flex: 1, color: '#334155' }}>{item}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Criteria Detail Analysis Section (Table) */}
      <section className="report-print-section">
        <h2 className="report-print-section__title">
          <TargetIcon size="sm" /> {t("project.tabAnalysis")}
        </h2>
        <div className="report-print-table-container">
          <table className="report-print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px', textAlign: 'left', width: '25%' }}>{t("project.criteria")}</th>
                <th style={{ padding: '12px', textAlign: 'center', width: '10%' }}>{t("project.metaScore")}</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>{t("project.feedbackTitle")}</th>
              </tr>
            </thead>
            <tbody>
              {criteriaWithEvaluations.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px', fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ color: item.value / item.max >= 0.8 ? '#10b981' : item.value / item.max >= 0.5 ? '#f59e0b' : '#ef4444' }}>
                        <TargetIcon size="sm" />
                      </div>
                      {item.label}
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: item.value / item.max >= 0.8 ? '#10b981' : item.value / item.max >= 0.5 ? '#f59e0b' : '#ef4444' }}>
                      {item.value}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '9px' }}>/ {item.max}</div>
                  </td>
                  <td style={{ padding: '12px', color: '#334155', lineHeight: '1.5' }}>
                    {item.evaluation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Priority Issues (NG Slides Summary) */}
      {ngSlides.length > 0 && (
        <section className="report-print-section">
          <h2 className="report-print-section__title" style={{ color: '#ef4444' }}>
            <AlertTriangleIcon size="sm" /> {t("project.prioritySlides")}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
            {ngSlides.map((slide, idx) => (
              <div key={idx} style={{ padding: '15px', border: '1px solid #fee2e2', background: '#fef2f2', borderRadius: '8px' }}>
                <div style={{ fontWeight: 800, fontSize: '12px', color: '#b91c1c', marginBottom: '5px' }}>
                  Page {slide.page_number ?? slide.slide_number}
                </div>
                <div style={{ fontSize: '13px', color: '#450a0a', lineHeight: '1.4' }}>{slide.summary}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. Pages Detail Section */}
      <section className="report-print-section" style={{ pageBreakBefore: 'always' }}>
        <h2 className="report-print-section__title">
          <LayersIcon size="sm" /> {t("project.tabSlidesResult")}
        </h2>
        <div className="report-print-slides-list">
          {pageReviewItems.map((slide) => {
            const pageNum = slide.page_number ?? slide.slide_number;
            const evidence = getSlideEvidence(pageNum);
            return (
              <div key={slide.id} className={`report-print-slide-item ${slide.status === "NG" ? 'is-ng' : ''}`}>
                <div className="report-print-slide-item__header">
                  <span className="report-print-slide-number">Page {pageNum}</span>
                  <StatusBadge 
                    tone={slide.status === "NG" ? "danger" : "success"}
                    icon={slide.status === "NG" ? <AlertCircleIcon size="sm" /> : <CheckCircleIcon size="sm" />}
                  >
                    {slide.status}
                  </StatusBadge>
                </div>
                <div className="report-print-slide-item__content">
                  <h4 className="report-print-slide-title">{slide.displayTitle}</h4>
                  <div className="report-print-slide-summary">{slide.summary}</div>
                  
                  {slide.issues && slide.issues.length > 0 && (
                    <div className="report-print-slide-issues">
                      <strong>{t("project.identifiedIssues")}:</strong>
                      <ul>
                        {slide.issues.map((issue: string, i: number) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {slide.suggestions && (
                    <div className="report-print-slide-suggestions">
                      <strong>{t("project.aiSuggestions")}:</strong>
                      <p>{slide.suggestions}</p>
                    </div>
                  )}

                  {evidence && (
                    <div className="report-print-slide-evidence" style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                      <strong style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>
                        {t("project.documentViewer.title")} ({t("project.aiProofLabel")})
                      </strong>
                      <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic', background: '#f8fafc', padding: '10px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
                        {evidence}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="report-print-footer">
        Â© {new Date().getFullYear()} {t("common.appName")} - Enterprise Design System
      </footer>
    </div>
  );
}


