import { KPIProgressList } from "../ui/KPICharts";
import { SparkIcon, AlertTriangleIcon, ShieldCheckIcon, TargetIcon, WorkflowIcon } from "../ui/Icon";
import { useTranslation } from "../LanguageSelector";
import type { FeedbackSectionView } from "./ProjectReviewPanels";
import type { KPIProgressData } from "../ui/KPICharts";

interface Props {
  t: (key: string) => string;
  feedbackSections: FeedbackSectionView[];
  ngSlideCount: number;
  orderedScores: KPIProgressData[];
  slideReviewItems: any[];
}

export default function ProjectOverviewTab({ 
  t, 
  feedbackSections, 
  ngSlideCount, 
  orderedScores,
  slideReviewItems
}: Props) {
  const { lang } = useTranslation();
  // Extract top 4 prioritized issues (NG slides)
  const prioritizedIssues = slideReviewItems
    .filter(item => item.status === "NG")
    .slice(0, 4);

  return (
    <div className="project-overview-v4" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Block 1: Top Row Split Layout */}
      <div className="overview-row-split-v4" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        
        {/* Block 1-1: AI Overview (Left) */}
        <section className="overview-pane-v4">
          <header className="section-header-v3">
            <h2 className="section-title-v3">
              <SparkIcon size="sm" /> {t("project.executiveSummary")}
            </h2>
          </header>
          <div className="summary-card-v4" style={{ 
            background: "var(--ds-color-surface)", 
            border: "1px solid var(--ds-color-border)", 
            padding: "0", 
            borderRadius: "12px",
            boxShadow: 'var(--ds-shadow-sm)',
            height: '100%',
            overflow: 'visible'
          }}>
            <div className="summary-content-v4">
              {feedbackSections.length > 0 ? (
                feedbackSections.map((section, idx) => (
                  <div key={idx} className="summary-block-v4" style={{ 
                    padding: '16px 20px',
                    borderBottom: idx < feedbackSections.length - 1 ? '1px solid var(--ds-color-border)' : 'none',
                    background: /tốt|tích cực|ưu điểm|đạt|excellent|success/i.test(section.title) ? 'var(--ds-color-success-soft)' : 
                                /xấu|vấn đề|cải thiện|hạn chế|lỗi|nghiêm trọng|ng|thất bại/i.test(section.title) ? 'var(--ds-color-danger-soft)' : 'transparent'
                  }}>
                    {section.title && <h5 style={{ 
                      color: /tốt|tích cực|ưu điểm|đạt|excellent|success/i.test(section.title) ? "var(--ds-color-success)" : 
                             /xấu|vấn đề|cải thiện|hạn chế|lỗi|nghiêm trọng|ng|thất bại/i.test(section.title) ? "var(--ds-color-danger)" : "var(--ds-color-primary)",
                      fontSize: "12px", 
                      marginBottom: "8px", 
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {/tốt|tích cực|ưu điểm|đạt|excellent|success/i.test(section.title) ? <ShieldCheckIcon size="xs" /> : 
                       /xấu|vấn đề|cải thiện|hạn chế|lỗi|nghiêm trọng|ng|thất bại/i.test(section.title) ? <AlertTriangleIcon size="xs" /> : <TargetIcon size="xs" />}
                      {section.title}
                    </h5>}
                    <ul style={{ paddingLeft: "0", listStyle: 'none', color: "var(--ds-color-text-body)", lineHeight: "1.6", fontSize: '13.5px', margin: 0 }}>
                      {section.lines.map((line, lidx) => (
                        <li key={lidx} style={{ marginBottom: "6px", display: 'flex', gap: '8px' }}>
                          <span style={{ color: 'var(--ds-color-primary)', opacity: 0.5 }}>•</span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <div style={{ padding: '20px', color: 'var(--ds-color-text-muted)' }}>{t("project.noFeedback")}</div>
              )}
            </div>
          </div>
        </section>

        {/* Block 1-2: Action Checklist & Criteria Scores (Right) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Action Checklist */}
          <section className="action-checklist-v4">
            <header className="action-checklist-v4__header">
              <WorkflowIcon size="sm" color="var(--ds-color-primary)" />
              {t("project.actionChecklist") || "Checklist hành động"}
            </header>
            <div className="action-checklist-v4__list">
              {feedbackSections
                .filter(s => /cải thiện|vấn đề|lỗi|hành động|fix|ng/i.test(s.title))
                .flatMap(s => s.lines)
                .slice(0, 5)
                .map((line, idx) => (
                  <div key={idx} className="action-checklist-v4__item">
                    <input type="checkbox" className="action-checklist-v4__checkbox" />
                    <div className="action-checklist-v4__content">
                      <div className="action-checklist-v4__text">{line}</div>
                      <div className="action-checklist-v4__meta">
                        <span className="action-checklist-v4__tag">AI Suggestion</span>
                        <span>Priority: High</span>
                      </div>
                    </div>
                  </div>
                ))}
              {feedbackSections.filter(s => /cải thiện|vấn đề|lỗi|hành động|fix|ng/i.test(s.title)).length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ds-color-success)', fontSize: '13px', fontWeight: 600 }}>
                  {t("project.noActionRequired") || "Tuyệt vời! Không có hành động nào cần thực hiện cho phiên bản này."}
                </div>
              )}
            </div>
          </section>

          {/* Criteria Scores */}
          <section className="overview-pane-v4">
            <header className="section-header-v3">
              <h2 className="section-title-v3">
                <TargetIcon size="sm" /> {t("project.scoreByCriteria")}
              </h2>
            </header>
            <div className="scores-card-v4" style={{ 
              background: "var(--ds-color-surface)", 
              border: "1px solid var(--ds-color-border)", 
              padding: "20px", 
              borderRadius: "12px",
              boxShadow: 'var(--ds-shadow-sm)',
              height: 'auto'
            }}>
              <KPIProgressList data={orderedScores} onHover={() => {}} />
            </div>
          </section>
        </div>
      </div>

      {/* Block 2: Bottom Row - 4 Prioritized Issues */}
      <section className="prioritized-issues-v4">
        <header className="section-header-v3">
          <h2 className="section-title-v3" style={{ color: 'var(--ds-color-danger)' }}>
            <AlertTriangleIcon size="sm" /> {t("project.prioritySlides") || "Các vấn đề ưu tiên"}
          </h2>
        </header>
        
        <div className="issues-grid-v4" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '16px' 
        }}>
          {prioritizedIssues.length > 0 ? (
            prioritizedIssues.map((issue, idx) => (
              <div key={idx} className="issue-card-v4" style={{
                background: 'var(--ds-color-danger-soft)',
                border: '1px solid var(--ds-color-danger-light)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--ds-color-danger)' }}>
                    Slide {issue.slide_number}
                  </span>
                  <div style={{ padding: '2px 6px', background: 'var(--ds-color-danger)', color: 'white', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>NG</div>
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.4, color: 'var(--ds-color-text-body)', fontWeight: 500 }}>
                  {issue.summary.length > 80 ? issue.summary.slice(0, 80) + '...' : issue.summary}
                </div>
                {issue.issues && issue.issues[lang] && (
                   <div style={{ fontSize: '11px', color: 'var(--ds-color-danger-dark)', marginTop: '4px', fontStyle: 'italic' }}>
                     • {issue.issues[lang].slice(0, 50)}...
                   </div>
                )}
              </div>
            ))
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="issue-card-v4 is-placeholder" style={{
                background: 'var(--ds-color-bg-app)',
                border: '1px dashed var(--ds-color-border)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ds-color-text-muted)',
                fontSize: '12px',
                fontStyle: 'italic',
                minHeight: '100px'
              }}>
                {i === 0 && ngSlideCount === 0 ? t("project.noIssuesFound") : ""}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

