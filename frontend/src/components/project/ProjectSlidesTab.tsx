import { getSubmissionFileUrl } from "../../api/client";
import { Button } from "../ui";
import { EmptyState, StatusBadge } from "../ui/States";
import { AlertTriangleIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FileTextIcon, MaximizeIcon, SparkIcon } from "../ui/Icon";
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
    <section className="workspace-viewer-v3">
      <div className="viewer-split-container">
        <div className="viewer-pane-left">
          <div className="viewer-toolbar-v3">
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
            <a href={getSubmissionFileUrl(projectId, "inline")} target="_blank" rel="noreferrer" className="external-link-v3">
              <MaximizeIcon size="sm" /> {t("project.openFull")}
            </a>
          </div>

          <div className="document-stage-v3">
            <div className="slide-preview-frame">
              {gradingDetail?.document_version?.file_path?.toLowerCase().endsWith(".pdf") ? (
                <iframe 
                  src={getSubmissionFileUrl(projectId, "inline") + `#page=${activeSlide.slide_number}`} 
                  className="slide-iframe-v3" 
                  title={`Slide ${activeSlide.slide_number}`} 
                />
              ) : (
                <div className="preview-placeholder-v3">
                  <FileTextIcon size="lg" />
                  <p>{t("project.renderingSlide")} {activeSlide.slide_number}...</p>
                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>{t("project.previewNotice")}</p>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm" 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      e.stopPropagation(); 
                      window.open(getSubmissionFileUrl(projectId, "attachment"), "_blank"); 
                    }} 
                    style={{ marginTop: "12px" }}
                  >
                    <DownloadIcon size="sm" /> {t("project.downloadToView")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="viewer-pane-right">
          <header className="analysis-header-v3">
            <div className="analysis-title-row">
              <h2 className="analysis-title-v3">{activeSlide.displayTitle}</h2>
              <StatusBadge tone={activeSlide.status === "NG" ? "danger" : "success"}>{activeSlide.status}</StatusBadge>
            </div>
          </header>

          <div className="analysis-content-v3">
            <div className="analysis-grid-v4">
              <div className="analysis-main-col">
                <section className="analysis-section-v3">
                  <h3 className="analysis-section-title-v3">{t("project.slideSummary")}</h3>
                  <div className="analysis-card-v3">{activeSlide.summary}</div>
                </section>
                
                {activeSlide.issues.length > 0 && (
                  <section className="analysis-section-v3">
                    <h3 className="analysis-section-title-v3 has-error">{t("project.identifiedIssues")}</h3>
                    <div className="issue-list-v3">
                      {activeSlide.issues.map((issue: string, idx: number) => (
                        <div key={idx} className="issue-card-v3">
                          <AlertTriangleIcon size="sm" />
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {activeSlide.suggestions && (
                  <section className="analysis-section-v3">
                    <h3 className="analysis-section-title-v3 is-highlight">{t("project.aiSuggestions")}</h3>
                    <div className="analysis-card-v3 is-suggestion">
                      <SparkIcon size="sm" />
                      <div>{activeSlide.suggestions}</div>
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
                        return text.substring(startIdx + startMarker.length, endIdx === -1 ? text.length : endIdx).trim();
                      })() : "(No extracted text available)"}
                    </pre>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
