import React, { useState } from "react";
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
  lang: any;
  filterNG: boolean;
  setFilterNG: (val: boolean) => void;
}

export default function ProjectSlidesTab({ t, projectId, viewModel, setSelectedSlideId, lang, filterNG, setFilterNG }: Props) {
  const { gradingDetail, slideReviewItems, activeSlide } = viewModel;
  const [showJson, setShowJson] = useState(false);

  if (!(slideReviewItems.length > 0 && activeSlide)) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ds-color-bg-app)", borderRadius: "12px", border: "1px dashed var(--ds-color-border)" }}>
        <EmptyState title={slideReviewItems.length === 0 ? t("project.noSlideReviewsTitle") : t("project.selectSlideForDetails")} description={slideReviewItems.length === 0 ? t("project.noSlideReviewsText") : undefined} />
      </div>
    );
  }

  return (
    <div className="slides-tab-layout-v4">
      {/* Mini Sidebar Navigator inside Tab */}
      <div className="tab-slide-navigator-v4">
        <div className="tab-slide-navigator-v4__header">
          <span className="ds-caption" style={{ fontWeight: 700 }}>{t("project.slideList")}</span>
          <button 
            className={`ng-filter-pill ${filterNG ? 'active' : ''}`}
            onClick={() => setFilterNG(!filterNG)}
          >
            {filterNG ? "NG Only" : "All"}
          </button>
        </div>
        <div className="tab-slide-grid-v4">
          {slideReviewItems
            .filter(item => !filterNG || item.status === "NG")
            .map((item) => {
              const isActive = activeSlide.id === item.id;
              const isNG = item.status === "NG";
              return (
                <div 
                  key={item.id}
                  className={`tab-slide-item-v4 ${isActive ? 'is-active' : ''} ${isNG ? 'is-ng' : ''}`}
                  onClick={() => setSelectedSlideId(item.id)}
                >
                  {item.slide_number}
                </div>
              );
            })}
        </div>
      </div>

      {/* Main Analysis Content */}
      <div className="tab-slide-content-v4">
        <header className="analysis-header-v3" style={{ padding: '16px 24px', borderBottom: '1px solid var(--ds-color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="analysis-title-row">
              <h2 className="analysis-title-v3" style={{ margin: 0 }}>{activeSlide.displayTitle}</h2>
              <StatusBadge tone={activeSlide.status === "NG" ? "danger" : "success"}>{activeSlide.status}</StatusBadge>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowJson(!showJson)}
                style={{ color: showJson ? 'var(--ds-color-primary)' : 'var(--ds-color-text-muted)', fontWeight: 600 }}
              >
                {showJson ? "{ } JSON" : "{ } Show JSON"}
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => window.open(getSubmissionFileUrl(projectId, "attachment"), "_blank")}
              >
                <DownloadIcon size="sm" /> {t("project.downloadToView")}
              </Button>
            </div>
          </div>
        </header>

        <div className="analysis-workspace-v4">
          {showJson ? (
            <div className="json-result-viewer-v4">
              <div className="json-viewer-header-v4">
                <span className="ds-caption" style={{ color: 'var(--ds-color-text-body)' }}>Raw AI Response (Slide {activeSlide.slide_number})</span>
              </div>
              <pre className="json-pre-v4">
                {JSON.stringify((activeSlide as any).result || activeSlide, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="analysis-content-v3" style={{ padding: '24px' }}>
              <div className="analysis-grid-v4" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
                <div className="analysis-main-col">
                  <section className="analysis-section-v3">
                    <h3 className="analysis-section-title-v3">{t("project.slideSummary")}</h3>
                    <div className="analysis-card-v3" style={{ background: "var(--ds-color-bg-app)", border: "1px solid var(--ds-color-border)", padding: "16px", borderRadius: "8px", lineHeight: "1.6" }}>
                      {activeSlide.summary}
                    </div>
                  </section>
                  
                  {activeSlide.issues.length > 0 && (
                    <section className="analysis-section-v3" style={{ marginTop: '24px' }}>
                      <h3 className="analysis-section-title-v3 has-error" style={{ color: "var(--ds-color-danger)" }}>{t("project.identifiedIssues")}</h3>
                      <div className="issue-list-v3">
                        {activeSlide.issues.map((issue: string, idx: number) => (
                          <div key={idx} className="issue-card-v3" style={{ background: "#fff1f2", border: "1px solid #fecdd3", padding: "12px 16px", borderRadius: "8px", display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "8px" }}>
                            <div style={{ color: "#e11d48", marginTop: "2px" }}><AlertTriangleIcon size="sm" /></div>
                            <span style={{ fontSize: "14px", color: "#9f1239" }}>{issue}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {activeSlide.suggestions && (
                    <section className="analysis-section-v3" style={{ marginTop: '24px' }}>
                      <h3 className="analysis-section-title-v3 is-highlight" style={{ color: "var(--ds-color-success)" }}>{t("project.aiSuggestions")}</h3>
                      <div className="analysis-card-v3 is-suggestion" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "16px", borderRadius: "8px", display: "flex", gap: "10px" }}>
                        <div style={{ color: "#166534" }}><SparkIcon size="sm" /></div>
                        <div style={{ fontSize: "14px", color: "#166534", lineHeight: 1.6 }}>{activeSlide.suggestions}</div>
                      </div>
                    </section>
                  )}
                </div>

                <div className="analysis-side-col">
                  <section className="analysis-section-v3">
                    <h3 className="analysis-section-title-v3 is-meta">{t("project.documentViewer.title")} (Text)</h3>
                    <div className="evidence-card-v3" style={{ background: '#f8fafc', border: '1px solid var(--ds-color-border)', borderRadius: '8px', padding: '12px' }}>
                      <pre className="evidence-text-v3" style={{ fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '500px', overflowY: 'auto' }}>
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

                          // Highlight text
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
                            const markTag = `<mark style="background: #fef08a; color: #854d0e; padding: 1px 3px; border-radius: 2px;">${escapedQ}</mark>`;
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
          )}
        </div>
      </div>
    </div>
  );
}
