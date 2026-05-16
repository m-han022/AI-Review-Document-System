import { useEffect, useState } from "react";
import { getSubmissionFileUrl, getVersionEvidenceFileUrl, getVersionEvidenceStatus, getVersionFileUrl } from "../../api/client";
import { Button } from "../ui";
import { EmptyState, StatusBadge } from "../ui/States";
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, DownloadIcon, LayersIcon, SparkIcon, TargetIcon } from "../ui/Icon";
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

export default function ProjectSlidesTab({ t, projectId, viewModel, setSelectedSlideId, filterNG, setFilterNG }: Props) {
  const { gradingDetail, pageReviewItems, activeSlide } = viewModel;
  const [showJson, setShowJson] = useState(false);
  const [pdfUnavailable, setPdfUnavailable] = useState(false);
  const [evidenceStatus, setEvidenceStatus] = useState("PENDING");
  const runStatus = String(gradingDetail?.grading_run?.status || "").toUpperCase();
  const runError = gradingDetail?.grading_run?.error_message;


  useEffect(() => {
    let canceled = false;
    const versionId = gradingDetail?.document_version?.id;
    const filename = (gradingDetail?.document_version?.filename || "").toLowerCase();
    if (!versionId || (!filename.endsWith(".pptx") && !filename.endsWith(".ppt"))) {
      setEvidenceStatus("PENDING");
      return;
    }
    const poll = async () => {
      try {
        const status = await getVersionEvidenceStatus(versionId);
        if (!canceled) setEvidenceStatus(status.status || "PENDING");
      } catch {
        if (!canceled) setEvidenceStatus("FAILED");
      }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, [gradingDetail?.document_version?.id, gradingDetail?.document_version?.filename]);

  if (!(pageReviewItems.length > 0 && activeSlide)) {
    const isFailed = runStatus.startsWith("FAILED");
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ds-color-bg-app)", borderRadius: "12px", border: "1px dashed var(--ds-color-border)" }}>
        <EmptyState
          title={pageReviewItems.length === 0 ? t("project.noSlideReviewsTitle") : t("project.selectSlideForDetails")}
          description={
            pageReviewItems.length === 0
              ? isFailed
                ? `${t("project.gradingFailedLabel")}: ${runError || t("common.unknownError")}`
                : t("project.noSlideReviewsText")
              : undefined
          }
        />
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
            {filterNG ? t("project.filterNgOnly") : t("project.filterAll")}
          </button>
        </div>
        <div className="tab-slide-grid-v4">
          {pageReviewItems
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
                  {item.page_number ?? item.slide_number}
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
              <StatusBadge 
                tone={activeSlide.status === "NG" ? "danger" : "success"}
                icon={activeSlide.status === "NG" ? <AlertCircleIcon size="sm" /> : <CheckCircleIcon size="sm" />}
              >
                {activeSlide.status}
              </StatusBadge>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowJson(!showJson)}
                style={{ color: showJson ? 'var(--ds-color-primary)' : 'var(--ds-color-text-muted)', fontWeight: 600 }}
              >
                {showJson ? t("project.hideJson") : t("project.showJson")}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  const url = gradingDetail?.document_version?.id 
                    ? getVersionFileUrl(gradingDetail.document_version.id, "attachment")
                    : getSubmissionFileUrl(projectId, "attachment");
                  window.open(url, "_blank");
                }}
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
                <span className="ds-caption" style={{ color: 'var(--ds-color-text-body)' }}>{t("project.rawAiResponse")} (Page {activeSlide.page_number ?? activeSlide.slide_number})</span>
              </div>
              <pre className="json-pre-v4">
                {JSON.stringify((activeSlide as any).result || activeSlide, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="analysis-content-v3" style={{ padding: '24px' }}>
              <div className="analysis-grid-v4" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                <div className="analysis-main-col">
                  {/* AI Summary Block */}
                  <section className="analysis-section-v3">
                    <h3 className="analysis-section-title-v3" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ds-color-primary)' }}>
                      <TargetIcon size="sm" /> {t("project.slideSummary")}
                    </h3>
                    <div className="analysis-card-v3" style={{ 
                      background: "var(--ds-color-surface)", 
                      border: "1px solid var(--ds-color-border)", 
                      padding: "16px", 
                      borderRadius: "10px", 
                      lineHeight: "1.6",
                      fontSize: '14px',
                      color: 'var(--ds-color-text-body)',
                      boxShadow: 'var(--ds-shadow-sm)'
                    }}>
                      {activeSlide.summary}
                    </div>
                  </section>
                  
                  {/* AI Issues Block */}
                  {activeSlide.issues.length > 0 && (
                    <section className="analysis-section-v3" style={{ marginTop: '24px' }}>
                      <h3 className="analysis-section-title-v3 has-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: "var(--ds-color-danger)" }}>
                        <AlertTriangleIcon size="sm" /> {t("project.identifiedIssues")}
                      </h3>
                      <div className="issue-list-v3">
                        {activeSlide.issues.map((issue: string, idx: number) => (
                          <div key={idx} className="issue-card-v3" style={{ 
                            background: "rgba(239, 68, 68, 0.05)", 
                            border: "1px solid rgba(239, 68, 68, 0.15)", 
                            padding: "12px 16px", 
                            borderRadius: "10px", 
                            display: "flex", 
                            gap: "12px", 
                            alignItems: "flex-start", 
                            marginBottom: "10px" 
                          }}>
                            <div style={{ color: "var(--ds-color-danger)", marginTop: "3px" }}><AlertCircleIcon size="sm" /></div>
                            <span style={{ fontSize: "14px", color: "var(--ds-color-danger-dark)", fontWeight: 500 }}>{issue}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* AI Suggestions Block */}
                  {activeSlide.suggestions && (
                    <section className="analysis-section-v3" style={{ marginTop: '24px' }}>
                      <h3 className="analysis-section-title-v3 is-highlight" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: "var(--ds-color-success)" }}>
                        <SparkIcon size="sm" /> {t("project.aiSuggestions")}
                      </h3>
                      <div className="analysis-card-v3 is-suggestion" style={{ 
                        background: "rgba(16, 185, 129, 0.05)", 
                        border: "1px solid rgba(16, 185, 129, 0.15)", 
                        padding: "16px", 
                        borderRadius: "10px", 
                        display: "flex", 
                        gap: "12px",
                        boxShadow: 'var(--ds-shadow-sm)'
                      }}>
                        <div style={{ color: "var(--ds-color-success)" }}><CheckCircleIcon size="sm" /></div>
                        <div style={{ fontSize: "14px", color: "var(--ds-color-success-dark)", lineHeight: 1.6, fontWeight: 500 }}>{activeSlide.suggestions}</div>
                      </div>
                    </section>
                  )}
                </div>

                <div className="analysis-side-col">
                  {/* Evidence Block */}
                  <section className="analysis-section-v3" style={{ display: 'flex', flexDirection: 'column', position: 'sticky', top: '24px' }}>
                    <h3 className="analysis-section-title-v3 is-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <LayersIcon size="sm" /> {t("project.documentViewer.title")}
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--ds-color-text-muted)', marginBottom: '12px', fontStyle: 'italic', lineHeight: '1.4' }}>
                      {t("project.aiProofDisclaimer")}
                    </p>

                    {gradingDetail?.document_version?.filename.toLowerCase().endsWith(".pdf") && !pdfUnavailable ? (
                      <div className="evidence-card-v3" style={{ width: '100%', aspectRatio: '16 / 9', minHeight: '360px', maxHeight: '540px', padding: 0, overflow: 'hidden', background: '#f1f5f9', borderRadius: '12px', border: '1px solid var(--ds-color-border)' }}>
                        <iframe 
                          src={`${gradingDetail?.document_version?.id ? getVersionFileUrl(gradingDetail.document_version.id) : getSubmissionFileUrl(projectId)}#page=${activeSlide.page_number ?? activeSlide.slide_number}`}
                          title={t("project.documentViewer.pdfTitle")}
                          onError={() => setPdfUnavailable(true)}
                          style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
                        />
                      </div>
                    ) : gradingDetail?.document_version?.filename.toLowerCase().endsWith(".pdf") ? (
                      <div className="evidence-card-v3" style={{ padding: "16px", background: "var(--ds-color-surface)", border: "1px solid var(--ds-color-border)", borderRadius: "10px" }}>
                        <div style={{ fontSize: "13px", color: "var(--ds-color-text-body)", lineHeight: 1.6 }}>
                          {t("project.documentViewer.unavailableDescription")}
                        </div>
                        <div style={{ marginTop: "12px" }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const url = gradingDetail?.document_version?.id
                                ? getVersionFileUrl(gradingDetail.document_version.id, "attachment")
                                : getSubmissionFileUrl(projectId, "attachment");
                              window.open(url, "_blank");
                            }}
                          >
                            <DownloadIcon size="sm" /> {t("project.downloadToView")}
                          </Button>
                        </div>
                      </div>
                    ) : gradingDetail?.document_version?.filename.toLowerCase().endsWith(".pptx") || gradingDetail?.document_version?.filename.toLowerCase().endsWith(".ppt") ? (
                      evidenceStatus === "COMPLETED" ? (
                        <div className="evidence-card-v3" style={{ width: '100%', aspectRatio: '16 / 9', minHeight: '360px', maxHeight: '540px', padding: 0, overflow: 'hidden', background: '#f1f5f9', borderRadius: '12px', border: '1px solid var(--ds-color-border)' }}>
                          <iframe
                            src={`${gradingDetail?.document_version?.id ? getVersionEvidenceFileUrl(gradingDetail.document_version.id) : getSubmissionFileUrl(projectId)}#page=${activeSlide.page_number ?? activeSlide.slide_number}`}
                            title={t("project.documentViewer.pdfTitle")}
                            style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
                          />
                        </div>
                      ) : (
                        <div className="evidence-card-v3" style={{ padding: "16px", background: "var(--ds-color-surface)", border: "1px solid var(--ds-color-border)", borderRadius: "10px" }}>
                          <div style={{ fontSize: "13px", color: "var(--ds-color-text-body)", lineHeight: 1.6 }}>
                            {evidenceStatus === "PENDING" ? "Dang chuyen doi PPT sang PDF..." : t("project.documentViewer.unavailableDescription")}
                          </div>
                          <div style={{ marginTop: "12px" }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const url = gradingDetail?.document_version?.id
                                  ? getVersionFileUrl(gradingDetail.document_version.id, "attachment")
                                  : getSubmissionFileUrl(projectId, "attachment");
                                window.open(url, "_blank");
                              }}
                            >
                              <DownloadIcon size="sm" /> {t("project.downloadToView")}
                            </Button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="evidence-card-v3">
                        <div style={{ 
                          position: 'absolute', 
                          top: 0, right: 0, 
                          background: 'var(--ds-color-primary-soft)', 
                          padding: '4px 12px', 
                          fontSize: '10px', 
                          fontWeight: 800, 
                          color: 'var(--ds-color-primary)',
                          borderBottomLeftRadius: '8px',
                          textTransform: 'uppercase'
                        }}>
                          {t("project.documentSnippetLabel")}
                        </div>
                        <pre className="evidence-text-v3">
                          {gradingDetail?.document_version?.extracted_text ? (() => {
                            const text = gradingDetail.document_version.extracted_text;
                            const currentNum = activeSlide.page_number ?? activeSlide.slide_number;
                            const nextNum = currentNum + 1;
                            const startMarkerPage = `[Page ${currentNum}]`;
                            const nextMarkerPage = `[Page ${nextNum}]`;
                            const startMarkerSlide = `[Slide ${currentNum}]`;
                            const nextMarkerSlide = `[Slide ${nextNum}]`;
                            let startIdx = text.indexOf(startMarkerPage);
                            let endIdx = -1;
                            let markerLen = startMarkerPage.length;
                            if (startIdx !== -1) {
                              endIdx = text.indexOf(nextMarkerPage, startIdx + markerLen);
                            } else {
                              startIdx = text.indexOf(startMarkerSlide);
                              markerLen = startMarkerSlide.length;
                              if (startIdx !== -1) {
                                endIdx = text.indexOf(nextMarkerSlide, startIdx + markerLen);
                              }
                            }
                            if (startIdx === -1) return <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>{t("project.noEvidenceFound")}</span>;
                            const slideText = text.substring(startIdx + markerLen, endIdx === -1 ? text.length : endIdx).trim();

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
                              const markTag = `<mark>${escapedQ}</mark>`;
                              escapedText = escapedText.split(escapedQ).join(markTag);
                            });

                            return <span dangerouslySetInnerHTML={{ __html: escapedText }} />;
                          })() : <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>{t("project.noExtractedText")}</span>}
                        </pre>
                      </div>
                    )}
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




