import { Suspense, lazy, useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { 
  listProjectDocuments, 
  listDocumentVersions, 
  listVersionGradings, 
  getGradingRun,
  gradeSubmission,
  exportSubmissionsExcel 
} from "../../api/client";
import { getDocumentTypeKey } from "../../constants/documentTypes";
import { getLocalizedText } from "../../locales/utils";
import { 
  projectDocumentsQueryKey, 
  documentVersionsQueryKey, 
  versionGradingsQueryKey, 
  gradingRunDetailQueryKey,
  projectsQueryKey
} from "../../query";
import type { 
  LanguageCode, 
  SlideReview, 
  GradingListOut,
  VersionListOut,
  DocumentListOut,
  GradingRunDetail
} from "../../types";
import { useTranslation } from "../LanguageSelector";
import Badge from "../ui/Badge";
import SectionBlock from "../ui/SectionBlock";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  DownloadIcon,
  RefreshIcon,
  ShieldCheckIcon,
  SparkIcon,
  TargetIcon,
  WorkflowIcon,
  AlertTriangleIcon
} from "../ui/Icon";
import { formatUploadedAt } from "../submissions/utils";
import ProjectReviewDialog from "./ProjectReviewDialog";
import {
  ExecutiveSummaryPanel,
  FeedbackPreviewPanel,
  IssueHighlightsPanel,
  MetadataPanel,
  type SummaryLine,
  type FeedbackSectionView
} from "./ProjectReviewPanels";
import { LoadingState, EmptyState } from "../ui/States";

const CriteriaScoreChart = lazy(() => import("./charts/CriteriaScoreChart"));

const chartFallback = (
  <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px', color: '#64748b' }}>
    <span>Loading...</span>
  </div>
);

interface ProjectCardProps {
  projectId: string;
  onBack: () => void;
}

interface OrderedScoreItem {
  key: string;
  label: string;
  value: number;
  max: number;
  Icon: ReturnType<typeof getCriterionIcon>;
}

function getCriterionIcon(criterionKey: string) {
  switch (criterionKey) {
    case "review_tong_the":
    case "kha_nang_tai_hien_bug":
    case "do_ro_rang":
    case "do_ro_rang_de_hieu":
      return TargetIcon;
    case "diem_tot":
    case "do_bao_phu":
    case "tinh_chinh_xac":
      return ShieldCheckIcon;
    case "kha_nang_truy_vet":
      return SparkIcon;
    case "diem_xau":
    case "danh_gia_anh_huong":
      return AlertTriangleIcon;
    case "chinh_sach":
    case "giai_phap_phong_ngua":
    case "tinh_thuc_thi":
    case "tinh_ung_dung":
      return WorkflowIcon;
    case "chat_luong_viet":
    case "phan_tich_nguyen_nhan":
    case "tinh_day_du_dung_trong_tam":
      return BookOpenIcon;
    default:
      return TargetIcon;
  }
}

function getStatusTone(score: number | null): "primary" | "success" | "warning" | "danger" {
  if (score === null) return "warning";
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function formatDateTime(value: string | null | undefined, lang: LanguageCode) {
  if (!value) return "—";
  return formatUploadedAt(value, lang);
}

function splitFeedbackLines(feedback: Record<string, string> | null, lang: LanguageCode): string[] {
  return getLocalizedText(feedback, lang)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitFeedbackSections(lines: string[]): FeedbackSectionView[] {
  const sections: FeedbackSectionView[] = [];
  for (const line of lines) {
    if (/^[①②③④⑤⑥⑦]\s*/u.test(line)) {
      sections.push({ title: line, lines: [] });
      continue;
    }
    const current = sections.at(-1);
    if (current) current.lines.push(line);
    else sections.push({ title: "", lines: [line] });
  }
  return sections.length ? sections : [{ title: "", lines }];
}

function buildSlideReviewItems(slideReviews: SlideReview[] | undefined, lang: LanguageCode, t: (key: string) => string) {
  if (!slideReviews) return [];
  return [...slideReviews]
    .sort((a, b) => a.slide_number - b.slide_number)
    .map((item) => {
      const title = getLocalizedText(item.title, lang);
      const summary = getLocalizedText(item.summary, lang);
      const localizedIssues = item.issues as Record<string, string[]> | null;
      const issues = (localizedIssues?.[lang] ?? localizedIssues?.[lang === "vi" ? "ja" : "vi"] ?? []).filter(Boolean);
      const suggestions = getLocalizedText(item.suggestions, lang);
      return {
        ...item,
        displayTitle: title || t("project.slideNumber").replace("{number}", String(item.slide_number)),
        summary,
        issues,
        suggestions,
      };
    });
}

function fillTemplate(template: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export default function ProjectCard({ projectId, onBack }: ProjectCardProps) {
  const { lang, t } = useTranslation();
  const queryClient = useQueryClient();
  
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedGradingId, setSelectedGradingId] = useState<number | null>(null);
  
  const [activeTab, setActiveTab] = useState<"overview" | "slides">("overview");
  const [selectedSlideId, setSelectedSlideId] = useState<number | null>(null);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  // Queries
  const { data: documents = [], isLoading: loadingDocs } = useQuery<DocumentListOut[]>({
    queryKey: projectDocumentsQueryKey(projectId),
    queryFn: () => listProjectDocuments(projectId),
  });

  const { data: versions = [], isLoading: loadingVersions } = useQuery<VersionListOut[]>({
    queryKey: selectedDocumentId ? documentVersionsQueryKey(selectedDocumentId) : ["versions", "empty"],
    queryFn: () => listDocumentVersions(selectedDocumentId!),
    enabled: !!selectedDocumentId,
  });

  const { data: gradings = [], isLoading: loadingGradings } = useQuery<GradingListOut[]>({
    queryKey: selectedVersionId ? versionGradingsQueryKey(selectedVersionId) : ["gradings", "empty"],
    queryFn: () => listVersionGradings(selectedVersionId!),
    enabled: !!selectedVersionId,
  });

  const { data: gradingDetail, isLoading: loadingDetail } = useQuery<GradingRunDetail>({
    queryKey: selectedGradingId ? gradingRunDetailQueryKey(selectedGradingId) : ["grading", "empty"],
    queryFn: () => getGradingRun(selectedGradingId!),
    enabled: !!selectedGradingId,
  });

  // Auto-select logic
  useEffect(() => {
    if (documents.length > 0 && selectedDocumentId === null) {
      setSelectedDocumentId(documents[0].document_id);
    }
  }, [documents, selectedDocumentId]);

  useEffect(() => {
    if (versions.length > 0 && selectedVersionId === null) {
      const latest = versions.find(v => v.is_latest) || versions[0];
      setSelectedVersionId(latest.document_version_id);
    }
  }, [versions, selectedVersionId]);

  useEffect(() => {
    if (gradings.length > 0 && selectedGradingId === null) {
      setSelectedGradingId(gradings[0].grading_run_id);
    }
  }, [gradings, selectedGradingId]);

  const currentDocument = documents.find(d => d.document_id === selectedDocumentId);
  const currentVersion = versions.find(v => v.document_version_id === selectedVersionId);

  const rerunMutation = useMutation({
    mutationFn: () => gradeSubmission({
      projectId,
      documentVersionId: selectedVersionId!,
      force: true
    }),
    onSuccess: async () => {
      setActionMessage({ tone: "success", text: lang === "ja" ? "レビューを再実行しました。" : "Đã chạy lại review." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectsQueryKey }),
        queryClient.invalidateQueries({ queryKey: versionGradingsQueryKey(selectedVersionId!) }),
      ]);
    },
    onError: (error) => {
      setActionMessage({
        tone: "danger",
        text: error instanceof Error ? error.message : t("submissions.gradingFailed"),
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: exportSubmissionsExcel,
    onSuccess: ({ blob, filename }) => {
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      setActionMessage({ tone: "success", text: t("submissions.exportSuccess") });
    },
    onError: (error) => {
      setActionMessage({
        tone: "danger",
        text: error instanceof Error ? error.message : t("submissions.exportFailed"),
      });
    },
  });

  // Result derived data
  const result = gradingDetail?.grading_run;
  const criteriaResults = gradingDetail?.criteria_results ?? [];
  const slideReviewItems = useMemo(
    () => buildSlideReviewItems(gradingDetail?.slide_reviews, lang, t),
    [gradingDetail, lang, t],
  );
  const ngSlideCount = slideReviewItems.filter(s => s.status === "NG").length;

  const orderedScores = useMemo<OrderedScoreItem[]>(() => {
    return criteriaResults.map((item) => ({
      key: item.key,
      value: item.score,
      max: item.max_score,
      label: t(`upload.criteria.${item.key}`),
      Icon: getCriterionIcon(item.key),
    }));
  }, [criteriaResults, t]);

  const criteriaHealth = useMemo(
    () => orderedScores.map((item) => ({ ...item, ratio: item.max > 0 ? item.value / item.max : 0 })).sort((a, b) => a.ratio - b.ratio),
    [orderedScores]
  );
  const weakestCriteria = criteriaHealth.slice(0, 3);

  const executiveSummary = useMemo<SummaryLine[]>(() => {
    const score = result?.score ?? null;
    if (score === null) return [{ id: "not-graded", text: t("project.notGradedText") }];
    const scoreLineKey = score >= 80 ? "project.summaryScoreHealthy" : score >= 60 ? "project.summaryScoreWatch" : "project.summaryScoreCritical";
    return [
      { id: "score", text: fillTemplate(t(scoreLineKey), { score }) },
      weakestCriteria[0] ? { id: "weak", text: fillTemplate(t("project.summaryWeakCriteria"), { criterion: weakestCriteria[0].label, score: weakestCriteria[0].value, max: weakestCriteria[0].max }) } : null,
    ].filter(Boolean) as SummaryLine[];
  }, [result, t, weakestCriteria]);

  const feedbackLines = useMemo(() => splitFeedbackLines(result?.draft_feedback ?? null, lang), [result, lang]);
  const feedbackSections = useMemo(() => splitFeedbackSections(feedbackLines), [feedbackLines]);

  const activeSlideId = useMemo(() => {
    if (selectedSlideId !== null) return selectedSlideId;
    const firstNg = slideReviewItems.find(s => s.status === "NG");
    return firstNg ? firstNg.id : slideReviewItems[0]?.id ?? null;
  }, [selectedSlideId, slideReviewItems]);

  const documentMeta = useMemo(() => [
    { label: "Document", value: currentDocument?.document_name ?? "—" },
    { label: "Version", value: currentVersion?.version ?? "—" },
    { label: "Graded At", value: formatDateTime(result?.graded_at, lang) },
    { label: "Score", value: result?.score !== null ? `${result?.score}/100` : "—" },
    { label: "Description", value: gradingDetail?.submission?.project_description || "—" },
  ], [currentDocument, currentVersion, result, gradingDetail, lang]);

  if (loadingDocs) return <LoadingState title="Loading documents..." />;

  return (
    <div className="project-workspace-container">
      <header className="project-workspace-header">
        <div className="project-header-info">
          <div className="project-detail-hero__eyebrow">
            <button className="text-button" onClick={onBack} style={{ marginRight: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeftIcon size="sm" />
              {t("nav.allReviews")}
            </button>
            <Badge tone={getStatusTone(result?.score ?? null)}>
              {result?.score !== null ? t("project.completed") : t("project.pending")}
            </Badge>
          </div>
          <h2>{currentDocument?.document_name || "Project Details"}</h2>
        </div>

        <div className="project-header-navigation">
          <button className="btn-secondary btn-secondary--compact" onClick={() => rerunMutation.mutate()} disabled={rerunMutation.isPending || !selectedVersionId}>
            <RefreshIcon size="sm" className={rerunMutation.isPending ? "animate-spin" : ""} />
            {lang === "ja" ? "再レビュー" : "Re-run review"}
          </button>
          <button className="btn-secondary btn-secondary--compact" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            <DownloadIcon size="sm" />
            {lang === "ja" ? "レポート出力" : "Export report"}
          </button>
        </div>
      </header>

      {actionMessage && (
        <div className={`project-action-message project-action-message--${actionMessage.tone}`}>
          {actionMessage.text}
        </div>
      )}

      {/* Hierarchy Selectors */}
      <div className="hierarchy-selectors" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <SectionBlock>
          <SectionBlock.Header title={t("project.documents") || "Documents"} />
          <SectionBlock.Body>
            <select 
              value={selectedDocumentId || ""} 
              onChange={(e) => {
                setSelectedDocumentId(Number(e.target.value));
                setSelectedVersionId(null);
                setSelectedGradingId(null);
              }}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
            >
              {documents.map(d => <option key={d.document_id} value={d.document_id}>{d.document_name} ({t(getDocumentTypeKey(d.document_type))})</option>)}
            </select>
          </SectionBlock.Body>
        </SectionBlock>

        <SectionBlock>
          <SectionBlock.Header title={t("project.versions") || "Versions"} />
          <SectionBlock.Body>
            <select 
              value={selectedVersionId || ""} 
              onChange={(e) => {
                setSelectedVersionId(Number(e.target.value));
                setSelectedGradingId(null);
              }}
              disabled={!selectedDocumentId || loadingVersions}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
            >
              <option value="">Select version...</option>
              {versions.map(v => <option key={v.document_version_id} value={v.document_version_id}>{v.version} {v.is_latest ? "(Latest)" : ""}</option>)}
            </select>
          </SectionBlock.Body>
        </SectionBlock>

        <SectionBlock>
          <SectionBlock.Header title={t("project.gradingRuns") || "Grading Runs"} />
          <SectionBlock.Body>
            <select 
              value={selectedGradingId || ""} 
              onChange={(e) => setSelectedGradingId(Number(e.target.value))}
              disabled={!selectedVersionId || loadingGradings}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
            >
              <option value="">Select grading...</option>
              {gradings.map(g => <option key={g.grading_run_id} value={g.grading_run_id}>{formatDateTime(g.created_at, lang)} - Score: {g.total_score ?? "N/A"}</option>)}
            </select>
          </SectionBlock.Body>
        </SectionBlock>
      </div>

      {loadingDetail ? (
        <LoadingState title="Fetching result details..." />
      ) : result ? (
        <div className="project-detail-layout">
          <div className="project-detail-main">
            <div className="project-tab-nav">
              <button className={`project-tab-btn ${activeTab === "overview" ? "is-active" : ""}`} onClick={() => setActiveTab("overview")}>
                {t("project.tabOverview")}
              </button>
              <button className={`project-tab-btn ${activeTab === "slides" ? "is-active" : ""}`} onClick={() => setActiveTab("slides")}>
                {t("project.tabSlides")}
                {ngSlideCount > 0 && <Badge tone="danger">{ngSlideCount}</Badge>}
              </button>
            </div>

            {activeTab === "overview" ? (
              <div className="project-tab-content">
                <div className="project-overview-grid">
                  <ExecutiveSummaryPanel 
                    title={t("project.executiveSummary") || "Executive Summary"}
                    subtitle={t("project.executiveSummarySubtitle") || "Overview of project quality"}
                    items={executiveSummary} 
                  />
                  <IssueHighlightsPanel 
                    title={t("project.issueHighlights") || "Issue Highlights"}
                    subtitle={t("project.issueHighlightsSubtitle") || "Key issues identified"}
                    items={slideReviewItems.filter(s => s.status === "NG").slice(0, 3).map(s => ({
                      title: s.displayTitle,
                      detail: s.issues[0] || s.summary,
                      tone: "danger"
                    }))} 
                  />
                </div>

                <SectionBlock>
                  <SectionBlock.Header title={t("project.criteriaScores")} />
                  <SectionBlock.Body>
                    <div style={{ height: "300px" }}>
                      <Suspense fallback={chartFallback}>
                        <CriteriaScoreChart data={orderedScores} />
                      </Suspense>
                    </div>
                  </SectionBlock.Body>
                </SectionBlock>

                <FeedbackPreviewPanel 
                  title={t("project.feedbackPreview") || "Feedback Preview"}
                  sections={feedbackSections}
                  emptyText={t("project.noFeedback") || "No feedback available"}
                  detailLabel={t("project.viewFullFeedback") || "View Full"}
                  onOpenDetail={() => setSummaryDialogOpen(true)}
                />
              </div>
            ) : (
              <div className="project-tab-content">
                <div className="slide-review-explorer">
                  <aside className="slide-sidebar">
                    {slideReviewItems.map((item) => (
                      <button key={item.id} className={`slide-nav-item ${activeSlideId === item.id ? "is-active" : ""}`} onClick={() => setSelectedSlideId(item.id)}>
                        <span className={`slide-status-dot ${item.status === "OK" ? "is-ok" : "is-ng"}`} />
                        <span className="slide-label">{item.displayTitle}</span>
                      </button>
                    ))}
                  </aside>
                  <main className="slide-content">
                    {slideReviewItems.find(s => s.id === activeSlideId) ? (
                      <div className="slide-detail-card">
                        <h3>{slideReviewItems.find(s => s.id === activeSlideId)?.displayTitle}</h3>
                        <div className="slide-detail-body">
                          <p><strong>{t("project.slideSummary")}:</strong> {slideReviewItems.find(s => s.id === activeSlideId)?.summary}</p>
                          {slideReviewItems.find(s => s.id === activeSlideId)?.issues.length ? (
                            <div className="slide-issues">
                              <strong>{t("project.issuesFound")}:</strong>
                              <ul>{slideReviewItems.find(s => s.id === activeSlideId)?.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
                            </div>
                          ) : null}
                          <p><strong>{t("project.suggestions")}:</strong> {slideReviewItems.find(s => s.id === activeSlideId)?.suggestions}</p>
                        </div>
                      </div>
                    ) : <EmptyState title="Select a slide to see details" compact />}
                  </main>
                </div>
              </div>
            )}
          </div>

          <aside className="project-detail-sidebar">
            <MetadataPanel items={documentMeta} title={t("project.metadataTitle")} />
          </aside>
        </div>
      ) : (
        <EmptyState title="No grading data found" description="Please select or run a grading process." />
      )}

      {summaryDialogOpen && (
        <ProjectReviewDialog 
          title={t("project.fullFeedback") || "Full Feedback"}
          onClose={() => setSummaryDialogOpen(false)}
          closeLabel={t("common.close") || "Close"}
          wide
        >
          <div className="detail-feedback-preview">
            {feedbackSections.map((section, index) => (
              <section className="detail-feedback-section-block" key={index}>
                {section.title && <h4>{section.title}</h4>}
                {section.lines.map((line, i) => <p key={i}>{line}</p>)}
              </section>
            ))}
          </div>
        </ProjectReviewDialog>
      )}
    </div>
  );
}
