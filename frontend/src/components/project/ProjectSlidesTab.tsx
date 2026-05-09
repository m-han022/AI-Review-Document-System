import { getSubmissionFileUrl } from "../../api/client";
import { Button } from "../ui";
import { EmptyState, StatusBadge } from "../ui/States";
import { AlertTriangleIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, SparkIcon } from "../ui/Icon";
import type { ProjectSlidesTabViewModel } from "./projectCard.viewModels";

interface Props {
  t: (key: string) => string;
  projectId: string;
  viewModel: ProjectSlidesTabViewModel;
  setSelectedSlideId: (id: number) => void;
}

export default function ProjectSlidesTab({ t, projectId, viewModel, setSelectedSlideId }: Props) {
  const { gradingDetail, slideReviewItems, activeSlide } = viewModel;
  if (!(slideReviewItems.length > 0 && activeSlide)) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #e2e8f0" }}>
        <EmptyState title={slideReviewItems.length === 0 ? t("project.noSlideReviewsTitle") : t("project.selectSlideForDetails")} description={slideReviewItems.length === 0 ? t("project.noSlideReviewsText") : undefined} />
      </div>
    );
  }
  return (
    <section className="workspace-viewer-v3" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div className="viewer-toolbar-v3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--ds-color-border)' }}>
        <div className="viewer-pagination-v3">
          <button 
            type="button" 
            className="page-nav-btn" 
            onClick={() => { 
              const idx = slideReviewItems.findIndex((s) => s.id === activeSlide.id); 
              if (idx > 0) setSelectedSlideId(slideReviewItems[idx - 1].id); 
            }} 
            disabled={slideReviewItems.findIndex((s) => s.id === activeSlide.id) === 0}
          >
            <ChevronLeftIcon size="sm" />
          </button>
          <span className="page-indicator-v3">Slide {activeSlide.slide_number} / {slideReviewItems.length}</span>
          <button 
            type="button" 
            className="page-nav-btn" 
            onClick={() => { 
              const idx = slideReviewItems.findIndex((s) => s.id === activeSlide.id); 
              if (idx < slideReviewItems.length - 1) setSelectedSlideId(slideReviewItems[idx + 1].id); 
            }} 
            disabled={slideReviewItems.findIndex((s) => s.id === activeSlide.id) === slideReviewItems.length - 1}
          >
            <ChevronRightIcon size="sm" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button 
            type="button" 
            variant="secondary" 
            size="sm" 
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              window.open(getSubmissionFileUrl(projectId, "attachment"), "_blank"); 
            }}
          >
            <DownloadIcon size="sm" /> {t("project.downloadToView")}
          </Button>
        </div>
      </div>

      <div className="viewer-pane-right" style={{ width: '100%', flex: '1', borderLeft: 'none', background: 'white', borderRadius: '12px', border: '1px solid var(--ds-color-border)', overflowY: 'auto' }}>

          <header className="analysis-header-v3">
            <div className="analysis-title-row">
              <h2 className="analysis-title-v3">{activeSlide.displayTitle}</h2>
              <StatusBadge tone={activeSlide.status === "NG" ? "danger" : "success"}>{activeSlide.status}</StatusBadge>
            </div>
          </header>

          <div className="analysis-content-v3">
            <div className="analysis-grid-v4">
              <div className="analysis-main-col">
                <section className="analysis-section-v3" style={{ marginBottom: "28px" }}>
                  <h3 className="analysis-section-title-v3" style={{ fontSize: "1.125rem", marginBottom: "12px" }}>{t("project.slideSummary")}</h3>
                  <div className="analysis-card-v3" style={{ background: "var(--ds-color-primary-soft)", border: "1px solid var(--ds-color-primary-light)", padding: "20px", borderRadius: "12px", fontSize: "1rem", lineHeight: "1.6", color: "var(--ds-color-text-body)" }}>
                    {activeSlide.summary}
                  </div>
                </section>
                
                {activeSlide.issues.length > 0 && (
                  <section className="analysis-section-v3" style={{ marginBottom: "28px" }}>
                    <h3 className="analysis-section-title-v3 has-error" style={{ fontSize: "1.125rem", color: "var(--ds-color-danger-dark)", marginBottom: "12px" }}>{t("project.identifiedIssues")}</h3>
                    <div className="issue-list-v3">
                      {activeSlide.issues.map((issue: string, idx: number) => (
                        <div key={idx} className="issue-card-v3" style={{ background: "var(--ds-color-danger-soft)", border: "1px solid var(--ds-color-danger-light)", padding: "16px", borderRadius: "8px", display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
                          <div style={{ color: "var(--ds-color-danger)", marginTop: "2px" }}><AlertTriangleIcon size="sm" /></div>
                          <span style={{ fontSize: "0.95rem", lineHeight: "1.5", color: "var(--ds-color-text-body)" }}>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {activeSlide.suggestions && (
                  <section className="analysis-section-v3" style={{ marginBottom: "28px" }}>
                    <h3 className="analysis-section-title-v3 is-highlight" style={{ fontSize: "1.125rem", color: "var(--ds-color-success-dark)", marginBottom: "12px" }}>{t("project.aiSuggestions")}</h3>
                    <div className="analysis-card-v3 is-suggestion" style={{ background: "var(--ds-color-success-soft)", border: "1px solid var(--ds-color-success-light)", padding: "20px", borderRadius: "12px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div style={{ color: "var(--ds-color-success)", marginTop: "2px" }}><SparkIcon size="sm" /></div>
                      <div style={{ fontSize: "1rem", lineHeight: "1.6", color: "var(--ds-color-text-body)" }}>{activeSlide.suggestions}</div>
                    </div>
                  </section>
                )}
              </div>

              <div className="analysis-side-col">
                <section className="analysis-section-v3">
                  <h3 className="analysis-section-title-v3 is-meta">{t("project.documentViewer.title")} (Text)</h3>
                  <div className="evidence-card-v3">
                    <pre className="evidence-text-v3">
                      {gradingDetail?.document_version?.extracted_text ? (() => {
                        const text = gradingDetail.document_version.extracted_text;
                        const currentNum = activeSlide.slide_number;
                        const nextNum = currentNum + 1;
                        const startMarker = `[Slide ${currentNum}]`;
                        const nextMarker = `[Slide ${nextNum}]`;
                        const startIdx = text.indexOf(startMarker);
                        if (startIdx === -1) return "(Evidence not found)";
                        const endIdx = text.indexOf(nextMarker, startIdx + startMarker.length);
                        const slideText = text.substring(startIdx + startMarker.length, endIdx === -1 ? text.length : endIdx).trim();

                        // Highlight text based on quotes in issues and suggestions
                        const quotes: string[] = [];
                        const regex = /["「“]([^"」”]+)["」”]/g;
                        if (activeSlide.issues) {
                          activeSlide.issues.forEach((issue: string) => {
                            let match;
                            while ((match = regex.exec(issue)) !== null) {
                              if (match[1].length > 4) quotes.push(match[1]);
                            }
                          });
                        }
                        if (activeSlide.suggestions) {
                          let match;
                          while ((match = regex.exec(activeSlide.suggestions)) !== null) {
                            if (match[1].length > 4) quotes.push(match[1]);
                          }
                        }

                        if (quotes.length === 0) return slideText;

                        let escapedText = slideText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        quotes.sort((a, b) => b.length - a.length).forEach(q => {
                          const escapedQ = q.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                          const markTag = `<mark style="background: var(--ds-color-warning-soft); color: var(--ds-color-warning-dark); font-weight: bold; padding: 2px 4px; border-radius: 4px;">${escapedQ}</mark>`;
                          escapedText = escapedText.split(escapedQ).join(markTag);
                        });

                        return <span dangerouslySetInnerHTML={{ __html: escapedText }} />;
                      })() : "(No extracted text available)"}
                    </pre>
                  </div>
                </section>
              </div>
            </div>
          </div>
      </div>
    </section>
  );
}
