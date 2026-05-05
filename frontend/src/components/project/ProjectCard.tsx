import { Suspense, lazy, useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { 
  listProjectDocuments, 
  listProjects,
  listDocumentVersions, 
  listVersionGradings, 
  getGradingRun,
  gradeSubmission,
  compareVersions,
  exportSubmissionsExcel,
  previewFinalPrompt
} from "../../api/client";
import { getDocumentTypeKey } from "../../constants/documentTypes";
import { getLocalizedText } from "../../locales/utils";
import { 
  projectsQueryKey
} from "../../query";
import type { 
  LanguageCode, 
  SlideReview, 
  GradingListOut,
  VersionListOut,
  DocumentListOut,
  GradingRunDetail,
  VersionComparison as VersionComparisonData
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
  AlertTriangleIcon,
  LayersIcon
} from "../ui/Icon";
import { formatUploadedAt } from "../submissions/utils";
import ProjectReviewDialog from "./ProjectReviewDialog";
import VersionComparison from "./VersionComparison";
import {
  MetadataPanel,
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

function extractCriterionSuggestionText(raw: unknown, lang: LanguageCode): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw !== "object") return "";

  const bag = raw as Record<string, unknown>;
  const fallbackLang: LanguageCode = lang === "vi" ? "ja" : "vi";
  const primary = bag[lang] ?? bag[fallbackLang];

  if (typeof primary === "string") return primary;
  if (primary && typeof primary === "object") {
    const nested = primary as Record<string, unknown>;
    const nestedPrimary = nested[lang] ?? nested[fallbackLang];
    if (typeof nestedPrimary === "string") return nestedPrimary;
    const anyNestedString = Object.values(nested).find((v) => typeof v === "string");
    return typeof anyNestedString === "string" ? anyNestedString : "";
  }

  const anyString = Object.values(bag).find((v) => typeof v === "string");
  return typeof anyString === "string" ? anyString : "";
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

export default function ProjectCard({ projectId, onBack }: ProjectCardProps) {
  const { lang, t } = useTranslation();
  const queryClient = useQueryClient();
  
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedGradingId, setSelectedGradingId] = useState<number | null>(null);
  
  const [activeTab, setActiveTab] = useState<"criteria" | "slides">("criteria");
  const [selectedSlideId, setSelectedSlideId] = useState<number | null>(null);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [promptUsedOpen, setPromptUsedOpen] = useState(false);
  const [promptUsedText, setPromptUsedText] = useState("");
  const [actionMessage, setActionMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  // Comparison states
  const [comparisonMode, setComparisonMode] = useState(false);
  const [baseVersionId, setBaseVersionId] = useState<number | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<number | null>(null);

  // Queries
  const { data: documents = [], isLoading: loadingDocs, error: docsError } = useQuery<DocumentListOut[]>({
    queryKey: ["project-documents", projectId],
    queryFn: () => listProjectDocuments(projectId),
  });
  const { data: projectList = [] } = useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => listProjects(),
  });

  const { data: versions = [], isLoading: loadingVersions, error: versionsError } = useQuery<VersionListOut[]>({
    queryKey: ["document-versions", selectedDocumentId],
    queryFn: () => listDocumentVersions(selectedDocumentId!),
    enabled: selectedDocumentId !== null && selectedDocumentId !== undefined,
    staleTime: 0, 
  });

  const { data: gradings = [], isLoading: loadingGradings, error: gradingsError } = useQuery<GradingListOut[]>({
    queryKey: ["version-gradings", selectedVersionId],
    queryFn: () => listVersionGradings(selectedVersionId!),
    enabled: !!selectedVersionId,
    staleTime: 0,
    refetchInterval: (query) => {
      const list = Array.isArray(query.state.data) ? query.state.data as GradingListOut[] : [];
      const hasPending = list.some(g => {
        const s = g.status?.toLowerCase();
        return s === "pending" || s === "extracting" || s === "grading";
      });
      return hasPending ? 3000 : false;
    }
  });

  const { data: gradingDetail, isLoading: loadingDetail, error: detailError } = useQuery<GradingRunDetail>({
    queryKey: ["grading-detail", selectedGradingId],
    queryFn: () => getGradingRun(selectedGradingId!),
    enabled: !!selectedGradingId,
    refetchInterval: (query) => {
      const detail = query.state.data as GradingRunDetail | undefined;
      const s = detail?.grading_run?.status?.toLowerCase();
      const isPending = s === "pending" || s === "extracting" || s === "grading";
      return isPending ? 3000 : false;
    }
  });
  
  const { data: comparisonData, isLoading: loadingComparison } = useQuery<VersionComparisonData>({
    queryKey: ["version-comparison", selectedDocumentId, baseVersionId, compareVersionId],
    queryFn: () => compareVersions(selectedDocumentId!, baseVersionId!, compareVersionId!),
    enabled: !!(selectedDocumentId && baseVersionId && compareVersionId && comparisonMode),
  });

  useEffect(() => {
    console.log("[ProjectCard] selectedDocumentId updated:", selectedDocumentId);
  }, [selectedDocumentId]);

  useEffect(() => {
    if (selectedDocumentId) {
      console.log(`[ProjectCard] Trace - Selected Document ID: ${selectedDocumentId}`);
    }
  }, [selectedDocumentId]);

  useEffect(() => {
    if (selectedVersionId) {
      console.log(`[ProjectCard] Selected Version ID: ${selectedVersionId}`);
    }
  }, [selectedVersionId]);

  useEffect(() => {
    if (selectedGradingId) {
      console.log(`[ProjectCard] Selected Grading Run ID: ${selectedGradingId}`);
    }
  }, [selectedGradingId]);

  // Auto-select logic
  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      const aCompleted = (a.latest_status || "").toLowerCase() === "completed" ? 1 : 0;
      const bCompleted = (b.latest_status || "").toLowerCase() === "completed" ? 1 : 0;
      if (aCompleted !== bCompleted) return bCompleted - aCompleted;
      const aTime = new Date(a.latest_uploaded_at || 0).getTime();
      const bTime = new Date(b.latest_uploaded_at || 0).getTime();
      return bTime - aTime;
    });
  }, [documents]);

  useEffect(() => {
    if (sortedDocuments.length > 0 && selectedDocumentId === null) {
      setSelectedDocumentId(sortedDocuments[0].document_id);
    }
  }, [sortedDocuments, selectedDocumentId]);

  useEffect(() => {
    if (versions.length > 0) {
      // Find the version to select:
      // 1. Current selectedVersionId if it's in the current versions list
      // 2. Latest version (is_latest)
      // 3. First version in list
      const currentExists = versions.some(v => v.document_version_id === selectedVersionId);
      if (!currentExists) {
        const latest = versions.find(v => v.is_latest) || versions[0];
        setSelectedVersionId(latest.document_version_id);
      }
    } else if (!loadingVersions) {
      setSelectedVersionId(null);
    }
  }, [versions, selectedVersionId, loadingVersions]);

  useEffect(() => {
    if (gradings.length > 0) {
      // Find the grading run to select:
      // 1. Current selectedGradingId if it's in the current gradings list
      // 2. Latest COMPLETED run
      // 3. First run in list
      const currentExists = gradings.some(g => g.grading_run_id === selectedGradingId);
      if (!currentExists) {
        const completed = gradings.find(g => g.status?.toLowerCase() === "completed") || gradings[0];
        setSelectedGradingId(completed.grading_run_id);
      }
    } else if (!loadingGradings) {
      setSelectedGradingId(null);
    }
  }, [gradings, selectedGradingId, loadingGradings]);

  const currentProject = (projectList || []).find((p: any) => p.project_id === projectId);
  const currentDocument = sortedDocuments.find(d => d.document_id === selectedDocumentId);
  const currentVersion = versions.find(v => v.document_version_id === selectedVersionId);

  const rerunMutation = useMutation({
    mutationFn: () => gradeSubmission({
      projectId,
      documentVersionId: selectedVersionId!,
      force: true,
      evaluationSetId: gradingDetail?.grading_run?.evaluation_set_id ?? undefined,
    }),
    onSuccess: async () => {
      setActionMessage({ tone: "success", text: lang === "ja" ? "レビューを再実行しました。" : "Đã chạy lại review." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["version-gradings", selectedVersionId!] }),
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

  const feedbackLines = useMemo(() => splitFeedbackLines(result?.draft_feedback ?? null, lang), [result, lang]);
  const feedbackSections = useMemo(() => splitFeedbackSections(feedbackLines), [feedbackLines]);
  const criteriaDetails = useMemo(() => {
    return criteriaResults.map((item) => {
      const suggestion = extractCriterionSuggestionText(item.suggestion, lang);
      return {
        key: item.key,
        label: t(`upload.criteria.${item.key}`),
        score: item.score,
        max: item.max_score,
        suggestion,
      };
    });
  }, [criteriaResults, lang, t]);

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
    { label: "Rubric", value: result?.rubric_version ? `v${result.rubric_version}` : "—" },
    { label: "Prompt", value: result?.prompt_version ? `v${result.prompt_version}` : "—" },
    { label: "Policy", value: result?.policy_version ? `v${result.policy_version}` : "—" },
    { label: "Level", value: result?.prompt_level ?? "—" },
    { label: "Required Rules Hash", value: result?.required_rule_hash ?? "—" },
    { label: "Description", value: gradingDetail?.submission?.project_description || "—" },
  ], [currentDocument, currentVersion, result, gradingDetail, lang]);

  if (loadingDocs) return <LoadingState title="Loading documents..." />;
  if (docsError) {
    return <EmptyState title="Cannot load project documents" description={docsError instanceof Error ? docsError.message : "Unknown error"} />;
  }

  return (
    <div className="project-workspace-container">
      <header className="project-workspace-header">
        <div className="project-header-info">
          <div className="project-detail-hero__eyebrow">
            <button className="text-button" onClick={onBack} style={{ marginRight: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeftIcon size="sm" />
              {t("nav.allReviews")}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge tone={
                result?.status === "completed" || result?.status === "graded" ? "success" :
                result?.status === "failed" ? "danger" :
                "warning"
              }>
                {result?.status ? (t(`status.${result.status.toLowerCase()}`) || result.status) : t("project.pending")}
              </Badge>
              {result?.status === "failed" && result?.error_message && (
                <span style={{ fontSize: '12px', color: '#ef4444' }} title={result.error_message}>
                  {result.error_message}
                </span>
              )}
            </div>
          </div>
          <h2>{currentProject?.project_name || projectId}</h2>
        </div>

        <div className="project-header-navigation">
          <button className={`btn-secondary btn-secondary--compact ${comparisonMode ? 'is-active' : ''}`} onClick={() => setComparisonMode(!comparisonMode)}>
            <LayersIcon size="sm" />
            {lang === "ja" ? "バージョン比較" : "So sánh version"}
          </button>
          <button className="btn-secondary btn-secondary--compact" onClick={() => rerunMutation.mutate()} disabled={rerunMutation.isPending || !selectedVersionId}>
            <RefreshIcon size="sm" className={rerunMutation.isPending ? "animate-spin" : ""} />
            {lang === "ja" ? "再レビュー" : "Re-run review"}
          </button>
          <button className="btn-secondary btn-secondary--compact" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            <DownloadIcon size="sm" />
            {lang === "ja" ? "レポート出力" : "Export report"}
          </button>
          <button
            className="btn-secondary btn-secondary--compact"
            disabled={!result}
            onClick={async () => {
              try {
                if (result?.final_prompt_snapshot) {
                  setPromptUsedText(result.final_prompt_snapshot);
                  setPromptUsedOpen(true);
                  return;
                }
                const preview = await previewFinalPrompt(currentDocument?.document_type || "project-review", result?.prompt_level || "medium");
                setPromptUsedText(
                  `[Reconstructed preview - active configuration]\n` +
                  `This is not the exact historical snapshot for run #${result?.id ?? "N/A"}.\n\n` +
                  preview.full_prompt_preview
                );
                setPromptUsedOpen(true);
              } catch (error) {
                setActionMessage({
                  tone: "danger",
                  text: error instanceof Error ? error.message : t("project.promptPreviewLoadFailed"),
                });
              }
            }}
          >
            View Prompt Used
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
                const docId = e.target.value ? Number(e.target.value) : null;
                console.log("[ProjectCard] DOCUMENT CHANGE:", docId);
                setSelectedDocumentId(docId);
                setSelectedVersionId(null);
                setSelectedGradingId(null);
                setBaseVersionId(null);
                setCompareVersionId(null);
              }}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
            >
              <option value="">{t("project.selectDocument")}</option>
              {sortedDocuments.map(d => (
                <option key={d.document_id} value={d.document_id}>
                  {d.document_name} ({t(getDocumentTypeKey(d.document_type))}) {d.latest_version ? `• ${d.latest_version}` : ""}
                </option>
              ))}
            </select>
          </SectionBlock.Body>
        </SectionBlock>

        {!comparisonMode ? (
          <>
            <SectionBlock>
              <SectionBlock.Header title={t("project.versions") || "Versions"} />
              <SectionBlock.Body>
                <select 
                  value={selectedVersionId || ""} 
                  onChange={(e) => {
                    const vId = Number(e.target.value);
                    setSelectedVersionId(vId);
                    setSelectedGradingId(null);
                  }}
                  disabled={!selectedDocumentId}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                >
                  <option value="">{t("project.selectVersion")}</option>
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
                  disabled={!selectedVersionId}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                >
                  <option value="">Select grading...</option>
                  {gradings.map(g => (
                    <option key={g.grading_run_id} value={g.grading_run_id}>
                      {formatDateTime(g.created_at, lang)} - {g.status?.toUpperCase() || "PENDING"} {g.total_score !== null ? `(Score: ${g.total_score})` : ""}
                    </option>
                  ))}
                </select>
              </SectionBlock.Body>
            </SectionBlock>
          </>
        ) : (
          <>
            <SectionBlock>
              <SectionBlock.Header title={t("compare.baseVersion")} />
              <SectionBlock.Body>
                <select 
                  value={baseVersionId || ""} 
                  onChange={(e) => setBaseVersionId(Number(e.target.value))}
                  disabled={!selectedDocumentId || loadingVersions}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                >
                  <option value="">{t("project.selectVersion")}</option>
                  {versions.map(v => <option key={v.document_version_id} value={v.document_version_id}>{v.version}</option>)}
                </select>
              </SectionBlock.Body>
            </SectionBlock>

            <SectionBlock>
              <SectionBlock.Header title={t("compare.compareVersion")} />
              <SectionBlock.Body>
                <select 
                  value={compareVersionId || ""} 
                  onChange={(e) => setCompareVersionId(Number(e.target.value))}
                  disabled={!selectedDocumentId || loadingVersions}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                >
                  <option value="">{t("project.selectVersion")}</option>
                  {versions.map(v => <option key={v.document_version_id} value={v.document_version_id}>{v.version}</option>)}
                </select>
              </SectionBlock.Body>
            </SectionBlock>
          </>
        )}
      </div>

      {(loadingDetail || loadingComparison || loadingVersions || loadingGradings) ? (
        <LoadingState title="Fetching details..." />
      ) : (versionsError || gradingsError || detailError) ? (
        <EmptyState
          title="Cannot load review detail"
          description={
            (detailError instanceof Error && detailError.message)
            || (gradingsError instanceof Error && gradingsError.message)
            || (versionsError instanceof Error && versionsError.message)
            || "Unknown error"
          }
        />
      ) : comparisonMode ? (
        comparisonData ? <VersionComparison data={comparisonData} /> : <EmptyState title={t("compare.selectVersions")} />
      ) : result ? (
        <div className="project-detail-layout">
          <div className="project-detail-main">
            <div className="project-tab-nav">
              <button className={`project-tab-btn ${activeTab === "criteria" ? "is-active" : ""}`} onClick={() => setActiveTab("criteria")}>
                {t("project.tabCriteria")}
              </button>
              <button className={`project-tab-btn ${activeTab === "slides" ? "is-active" : ""}`} onClick={() => setActiveTab("slides")}>
                {t("project.tabSlidesResult")}
                {ngSlideCount > 0 && <Badge tone="danger">{ngSlideCount}</Badge>}
              </button>
            </div>

            {activeTab === "criteria" ? (
              <div className="project-tab-content">
                <SectionBlock>
                  <SectionBlock.Header title={t("project.criteriaDetailTitle")} />
                  <SectionBlock.Body>
                    <div style={{ height: "300px" }}>
                      <Suspense fallback={chartFallback}>
                        <CriteriaScoreChart data={orderedScores} />
                      </Suspense>
                    </div>
                    <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
                      {criteriaDetails.map((item) => (
                        <article key={item.key} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                            <strong>{item.label}</strong>
                            <span>{item.score}/{item.max}</span>
                          </div>
                          <p style={{ margin: 0, color: "#475569", whiteSpace: "pre-wrap" }}>
                            {item.suggestion || t("project.noDetailedComment")}
                          </p>
                        </article>
                      ))}
                    </div>
                  </SectionBlock.Body>
                </SectionBlock>
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
        <EmptyState title={t("project.noGradingDataTitle")} description={t("project.noGradingDataDesc")} />
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
      {promptUsedOpen && (
        <ProjectReviewDialog
          title="Prompt Used"
          onClose={() => setPromptUsedOpen(false)}
          closeLabel={t("common.close") || "Close"}
          wide
        >
          <pre style={{ whiteSpace: "pre-wrap", maxHeight: "60vh", overflow: "auto" }}>{promptUsedText || "N/A"}</pre>
        </ProjectReviewDialog>
      )}
    </div>
  );
}

