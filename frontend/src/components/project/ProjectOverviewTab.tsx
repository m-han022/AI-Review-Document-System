import { KPIProgressList } from "../ui/KPICharts";
import { SparkIcon, AlertTriangleIcon, ShieldCheckIcon, TargetIcon } from "../ui/Icon";
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
            background: "var(--ds-color-primary-soft)", 
            border: "1px solid var(--ds-color-primary-light)", 
            padding: "20px", 
            borderRadius: "12px",
            height: '100%'
          }}>
            <div className="summary-content-v4">
              {feedbackSections.length > 0 ? (
                feedbackSections.map((section, idx) => (
                  <div key={idx} className="summary-block-v4" style={{ marginBottom: '20px' }}>
                    {section.title && <h5 style={{ color: "var(--ds-color-primary-dark)", fontSize: "1rem", marginBottom: "8px", fontWeight: 700 }}>{section.title}</h5>}
                    <ul style={{ paddingLeft: "18px", color: "var(--ds-color-text-body)", lineHeight: "1.6", fontSize: '13.5px' }}>
                      {section.lines.map((line, lidx) => <li key={lidx} style={{ marginBottom: "6px" }}>{line}</li>)}
                    </ul>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--ds-color-text-muted)' }}>{t("project.noFeedback")}</p>
              )}
            </div>

          </div>
        </section>

        {/* Block 1-2: Criteria Scores (Right) */}
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
            height: '100%'
          }}>
            <KPIProgressList data={orderedScores} onHover={() => {}} />
          </div>
        </section>
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
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--ds-color-danger)' }}>
                    Slide {issue.slide_number}
                  </span>
                  <div style={{ padding: '2px 6px', background: 'var(--ds-color-danger)', color: 'white', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>NG</div>
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.4, color: 'var(--ds-color-text-body)', fontWeight: 500 }}>
                  {issue.summary.length > 80 ? issue.summary.slice(0, 80) + '...' : issue.summary}
                </div>
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
                {i === 0 && ngSlideCount === 0 ? "Tài liệu không có lỗi NG" : ""}
              </div>
            ))
          )}
        </div>
      </section>

    </div>
  );
}

