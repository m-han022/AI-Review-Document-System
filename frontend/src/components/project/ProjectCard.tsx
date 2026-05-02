import { Suspense, lazy, type CSSProperties, useMemo, useState } from "react";

import { getDocumentTypeKey } from "../../constants/documentTypes";
import { useActiveRubricConfig } from "../../hooks/useRubrics";
import { getLocalizedText } from "../../locales/utils";
import type { CriteriaResult, LanguageCode, SlideReview, Submission } from "../../types";
import { useTranslation } from "../LanguageSelector";
import ScoreBar from "../score/ScoreBar";
import Badge from "../ui/Badge";
import SectionBlock from "../ui/SectionBlock";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  ShieldCheckIcon,
  SparkIcon,
  TargetIcon,
  WorkflowIcon,
} from "../ui/Icon";
import { formatUploadedAt } from "../submissions/utils";
import ProjectReviewDialog from "./ProjectReviewDialog";
import {
  ExecutiveSummaryPanel,
  FeedbackPreviewPanel,
  IssueBreakdownPanel,
  IssueHighlightsPanel,
  MetadataPanel,
  type FeedbackSectionView,
  type HighlightItemView,
  type SummaryLine,
} from "./ProjectReviewPanels";

const CriteriaScoreChart = lazy(() => import("./charts/CriteriaScoreChart"));
const SlideStatusChart = lazy(() => import("./charts/SlideStatusChart"));

interface ProjectCardProps {
  submission: Submission;
  allSubmissions: Submission[];
  onNavigate: (projectId: string) => void;
  onBack: () => void;
}

type SuggestionTone = "success" | "warning" | "danger";
type SlideReviewFilter = "all" | "OK" | "NG" | "withSuggestions";

type SuggestionDetail = {
  title: string;
  count: string;
  text: string;
} | null;

type SlideReviewDetail = {
  title: string;
  status: "OK" | "NG";
  summary: string;
  issues: string[];
  suggestions: string;
} | null;

interface TextSection {
  title: string;
  lines: string[];
}

interface MetricCard {
  label: string;
  value: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}

interface RunCompareItem {
  label: string;
  current: string;
  previous: string;
  tone: "default" | "success" | "warning" | "danger";
}

interface OrderedScoreItem {
  key: string;
  label: string;
  value: number;
  max: number;
  Icon: ReturnType<typeof getCriterionIcon>;
}

function getLanguageLabel(language: Submission["language"], uiLanguage: LanguageCode) {
  if (uiLanguage === "ja") {
    return language === "vi" ? "ベトナム語" : "日本語";
  }

  return language === "vi" ? "Tiếng Việt" : "Tiếng Nhật";
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

function getStatusTone(status: string): "primary" | "success" | "warning" | "danger" {
  switch (status) {
    case "graded":
    case "completed":
      return "success";
    case "uploaded":
    case "pending":
      return "warning";
    case "failed":
    case "error":
      return "danger";
    default:
      return "primary";
  }
}

function getStatusLabel(submissionStatus: string, latestScore: number | null, t: (key: string) => string) {
  if (latestScore !== null) {
    return t("project.completed");
  }

  if (submissionStatus === "failed" || submissionStatus === "error") {
    return t("project.failed");
  }

  if (submissionStatus === "uploaded" || submissionStatus === "pending") {
    return t("project.pending");
  }

  return t("project.inReview");
}

function formatDateTime(value: string | null | undefined, lang: LanguageCode) {
  if (!value) {
    return "—";
  }

  return formatUploadedAt(value, lang);
}

function ScoreGauge({ score, t }: { score: number; t: (key: string) => string }) {
  const ratio = Math.max(0, Math.min(1, score / 100));
  const degrees = 180 * ratio;
  const arcStyle = { "--score-gauge-degrees": `${degrees}deg` } as CSSProperties;

  return (
    <div className="detail-gauge detail-gauge--semicircle">
      <div className="detail-gauge__half">
        <div className="detail-gauge__arc" style={arcStyle}>
          <div className="detail-gauge__arc-inner" />
        </div>
      </div>
      <div className="detail-gauge__readout">
        <strong>{score.toFixed(1).replace(/\.0$/, "")}</strong>
        <span>/100</span>
      </div>
      <div className="detail-gauge__meta">
        <span>{t("project.totalScore")}:</span>
        <strong>{score >= 80 ? t("project.scoreExcellent") : score >= 60 ? t("project.scoreGood") : t("project.scoreNeedsWork")}</strong>
      </div>
    </div>
  );
}

function splitFeedbackLines(feedback: Record<string, string> | null, lang: LanguageCode): string[] {
  return getLocalizedText(feedback, lang)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getSuggestionTone(criterionKey: string, index: number): SuggestionTone {
  switch (criterionKey) {
    case "diem_tot":
    case "kha_nang_tai_hien_bug":
    case "do_ro_rang":
    case "do_ro_rang_de_hieu":
      return "success";
    case "diem_xau":
    case "danh_gia_anh_huong":
    case "tinh_chinh_xac":
      return "danger";
    case "chinh_sach":
    case "chat_luong_viet":
    case "phan_tich_nguyen_nhan":
    case "giai_phap_phong_ngua":
    case "do_bao_phu":
    case "kha_nang_truy_vet":
    case "tinh_thuc_thi":
    case "tinh_day_du_dung_trong_tam":
    case "tinh_ung_dung":
      return "warning";
    default:
      return (["success", "warning", "danger"] as const)[index % 3];
  }
}

function normalizeCriteriaSuggestion(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeCriteriaSuggestion(item))
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    const suggestion = value as Record<string, unknown>;
    return [
      normalizeCriteriaSuggestion(suggestion.explanation),
      normalizeCriteriaSuggestion(suggestion.improve),
      normalizeCriteriaSuggestion(suggestion.text),
      normalizeCriteriaSuggestion(suggestion.suggestion),
    ]
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function previewText(text: string, maxLines = 3): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

function splitFeedbackSections(lines: string[]): TextSection[] {
  const sections: TextSection[] = [];

  for (const line of lines) {
    if (/^[①②③④⑤⑥⑦]\s*/u.test(line)) {
      sections.push({ title: line, lines: [] });
      continue;
    }

    const current = sections.at(-1);
    if (current) {
      current.lines.push(line);
    } else {
      sections.push({ title: "", lines: [line] });
    }
  }

  return sections.length ? sections : [{ title: "", lines }];
}

function previewFeedbackSections(sections: TextSection[]): TextSection[] {
  if (sections.length === 1 && !sections[0].title) {
    return [{ title: "", lines: sections[0].lines.slice(0, 5) }];
  }

  return sections
    .slice(0, 3)
    .map((section) => ({ ...section, lines: section.lines.slice(0, 1) }))
    .filter((section) => section.title || section.lines.length);
}

function splitSuggestionBlocks(text: string, t?: (key: string) => string): TextSection[] {
  const explanationPattern = "(?:Giải thích|説明)";
  const improvePattern = "(?:Để tăng điểm|得点を上げるには)";
  const separatorPattern = "[:：]?";
  const explanationMatch = new RegExp(`${explanationPattern}${separatorPattern}\\s*([\\s\\S]*?)(?=${improvePattern}${separatorPattern}|$)`, "i").exec(text);
  const improveMatch = new RegExp(`${improvePattern}${separatorPattern}\\s*([\\s\\S]*)`, "i").exec(text);
  const cleanupBlock = (value: string | undefined) => (value ?? "").trim().replace(/^[:：]\s*/, "").trim();
  const explanation = cleanupBlock(explanationMatch?.[1]);
  const improve = cleanupBlock(improveMatch?.[1]);

  if (!explanation && !improve) {
    return [{ title: "", lines: previewText(text, Number.POSITIVE_INFINITY) }];
  }

  return [
    { title: t?.("project.explanationBlock") ?? "Giải thích", lines: previewText(explanation, Number.POSITIVE_INFINITY) },
    { title: t?.("project.improveScoreBlock") ?? "Để tăng điểm", lines: previewText(improve, Number.POSITIVE_INFINITY) },
  ].filter((block) => block.lines.length > 0);
}

function suggestionPreviewBlocks(text: string, t?: (key: string) => string): TextSection[] {
  return splitSuggestionBlocks(text, t)
    .slice(0, 2)
    .map((block) => ({ ...block, lines: block.lines.slice(0, 1) }))
    .filter((block) => block.title || block.lines.length);
}

function getLocalizedList(value: Record<string, string[]> | null | undefined, lang: LanguageCode): string[] {
  if (!value) {
    return [];
  }

  const localized = value[lang] ?? value[lang === "vi" ? "ja" : "vi"] ?? [];
  return Array.isArray(localized) ? localized.filter(Boolean) : [];
}

function buildSlideReviewItems(slideReviews: SlideReview[], lang: LanguageCode, t: (key: string) => string) {
  return [...slideReviews]
    .sort((a, b) => a.slide_number - b.slide_number)
    .map((item) => {
      const title = getLocalizedText(item.title, lang);
      const summary = getLocalizedText(item.summary, lang);
      const issues = getLocalizedList(item.issues, lang);
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

function buildCriteriaSuggestionItems(
  criteriaResults: CriteriaResult[],
  orderedScores: OrderedScoreItem[],
  lang: LanguageCode,
) {
  const suggestions = Object.fromEntries(
    criteriaResults
      .map((item) => [item.key, getLocalizedText(item.suggestion as Record<string, string> | null, lang)])
      .filter(([, value]) => Boolean(value)),
  ) as Record<string, string>;

  const orderedKeys = orderedScores
    .map((item) => item.key)
    .filter((key) => Boolean(normalizeCriteriaSuggestion(suggestions[key])));
  const extraKeys = Object.keys(suggestions).filter(
    (key) => !orderedKeys.includes(key) && Boolean(normalizeCriteriaSuggestion(suggestions[key])),
  );
  const displayKeys = [...orderedKeys, ...extraKeys];

  return displayKeys.map((key, index) => {
    const scoreItem = orderedScores.find((item) => item.key === key);

    return {
      key,
      title: scoreItem?.label ?? key,
      count: scoreItem ? `${scoreItem.value} / ${scoreItem.max}` : "",
      text: normalizeCriteriaSuggestion(suggestions[key]),
      tone: getSuggestionTone(key, index),
      Icon: getCriterionIcon(key),
    };
  });
}

export default function ProjectCard({ 
  submission, 
  allSubmissions, 
  onNavigate, 
  onBack 
}: ProjectCardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "slides">("overview");
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [suggestionDetail, setSuggestionDetail] = useState<SuggestionDetail>(null);
  const [slideReviewFilter, setSlideReviewFilter] = useState<SlideReviewFilter>("all");
  const [slideReviewDetail, setSlideReviewDetail] = useState<SlideReviewDetail>(null);

  const { lang, t } = useTranslation();

  // Navigation Logic
  const currentIndex = allSubmissions.findIndex(s => s.project_id === submission.project_id);
  const prevSubmission = currentIndex > 0 ? allSubmissions[currentIndex - 1] : null;
  const nextSubmission = currentIndex < allSubmissions.length - 1 ? allSubmissions[currentIndex + 1] : null;

  const handlePrev = () => prevSubmission && onNavigate(prevSubmission.project_id);
  const handleNext = () => nextSubmission && onNavigate(nextSubmission.project_id);
  const criteriaConfig = useActiveRubricConfig(submission.document_type, lang);
  const latestRun = submission.latest_run ?? null;
  const latestScore = latestRun?.score ?? null;

  const criteriaResults = useMemo(() => latestRun?.criteria_results ?? [], [latestRun]);
  const criteriaResultMap = useMemo(
    () => Object.fromEntries(criteriaResults.map((item) => [item.key, item])),
    [criteriaResults],
  );
  const criteriaScoreMap = useMemo(
    () => Object.fromEntries(criteriaResults.map((item) => [item.key, item.score])),
    [criteriaResults],
  );

  const slideReviewItems = useMemo(
    () => buildSlideReviewItems(latestRun?.slide_reviews ?? [], lang, t),
    [latestRun, lang, t],
  );
  const okSlideCount = useMemo(
    () => slideReviewItems.filter((item) => item.status === "OK").length,
    [slideReviewItems],
  );
  const ngSlideCount = useMemo(
    () => slideReviewItems.filter((item) => item.status === "NG").length,
    [slideReviewItems],
  );
  const issueCount = useMemo(
    () => slideReviewItems.reduce((sum, item) => sum + item.issues.length, 0),
    [slideReviewItems],
  );

  const prioritySlideReviewItems = useMemo(
    () =>
      slideReviewItems.filter(
        (item) => item.status === "NG" || item.issues.length > 0 || Boolean(item.suggestions),
      ),
    [slideReviewItems],
  );
  const prioritySlideIds = useMemo(
    () => new Set(prioritySlideReviewItems.map((item) => item.id)),
    [prioritySlideReviewItems],
  );

  const filteredSlideReviewItems = useMemo(() => {
    if (slideReviewFilter === "all") {
      return slideReviewItems;
    }

    if (slideReviewFilter === "withSuggestions") {
      return slideReviewItems.filter((item) => Boolean(item.suggestions));
    }

    return slideReviewItems.filter((item) => item.status === slideReviewFilter);
  }, [slideReviewFilter, slideReviewItems]);

  const filteredSlideIds = useMemo(
    () => new Set(filteredSlideReviewItems.map((item) => item.id)),
    [filteredSlideReviewItems],
  );

  const filteredPrioritySlideReviewItems = useMemo(
    () => prioritySlideReviewItems.filter((item) => filteredSlideIds.has(item.id)),
    [filteredSlideIds, prioritySlideReviewItems],
  );

  const remainingSlideReviewItems = useMemo(
    () => filteredSlideReviewItems.filter((item) => !prioritySlideIds.has(item.id)),
    [filteredSlideReviewItems, prioritySlideIds],
  );

  const statusLabel = getStatusLabel(submission.status, latestScore, t);
  const statusTone = getStatusTone(submission.status);
  const gradedAt = formatDateTime(latestRun?.graded_at ?? null, lang);
  const uploadedAt = formatDateTime(submission.uploaded_at, lang);

  const documentMeta = useMemo(
    () => [
      { label: t("project.projectCode"), value: submission.project_id },
      { label: t("project.documentType"), value: t(getDocumentTypeKey(submission.document_type)) },
      { label: t("project.detectedLanguage"), value: getLanguageLabel(submission.language, lang) },
      { label: t("project.rubricVersion"), value: latestRun?.rubric_version ?? "v1" },
      { label: t("project.uploadLabel"), value: uploadedAt },
      { label: t("project.reviewedAt"), value: gradedAt },
      { label: t("project.appliedModel"), value: latestRun?.gemini_model ?? "—" },
      { label: t("project.fileType"), value: submission.filename.split(".").pop()?.toUpperCase() ?? t("common.noValue") },
    ],
    [gradedAt, lang, latestRun?.gemini_model, latestRun?.rubric_version, submission.document_type, submission.filename, submission.language, submission.project_id, t, uploadedAt],
  );

  const orderedScores = useMemo<OrderedScoreItem[]>(
    () =>
      criteriaConfig.order.map((key) => ({
        key,
        value: criteriaScoreMap[key] ?? 0,
        max: criteriaResultMap[key]?.max_score ?? criteriaConfig.maxScores[key] ?? 100,
        label: t(`upload.criteria.${key}`),
        Icon: getCriterionIcon(key),
      })),
    [criteriaConfig, criteriaResultMap, criteriaScoreMap, t],
  );

  const criteriaHealth = useMemo(
    () =>
      orderedScores
        .map((item) => ({
          ...item,
          ratio: item.max > 0 ? item.value / item.max : 0,
        }))
        .sort((a, b) => a.ratio - b.ratio),
    [orderedScores],
  );
  const weakestCriteria = criteriaHealth.slice(0, 3);
  const strongestCriterion = criteriaHealth.at(-1) ?? null;

  const metricCards = useMemo<MetricCard[]>(
    () => [
      {
        label: t("project.pageCount"),
        value: slideReviewItems.length ? String(slideReviewItems.length) : "—",
        tone: "primary",
      },
      {
        label: t("project.ngSlideCount"),
        value: String(ngSlideCount),
        tone: ngSlideCount > 0 ? "danger" : "success",
      },
      {
        label: t("project.issueCount"),
        value: String(issueCount),
        tone: issueCount > 0 ? "warning" : "success",
      },
      {
        label: t("project.criteriaCount"),
        value: String(orderedScores.length),
        tone: "default",
      },
    ],
    [issueCount, ngSlideCount, orderedScores.length, slideReviewItems.length, t],
  );

  const feedbackLines = useMemo(
    () => splitFeedbackLines(latestRun?.draft_feedback ?? null, lang),
    [latestRun, lang],
  );
  const feedbackSections = useMemo(() => splitFeedbackSections(feedbackLines), [feedbackLines]);
  const compactFeedbackSections = useMemo(
    () => previewFeedbackSections(feedbackSections),
    [feedbackSections],
  );

  const criteriaSuggestionItems = useMemo(
    () => buildCriteriaSuggestionItems(criteriaResults, orderedScores, lang),
    [criteriaResults, orderedScores, lang],
  );

  const runHistory = useMemo(() => submission.run_history ?? [], [submission.run_history]);
  const runCompare = useMemo<RunCompareItem[]>(() => {
    const latest = runHistory[0] ?? null;
    const previous = runHistory[1] ?? null;
    if (!latest || !previous) {
      return [];
    }

    const scoreDelta = (latest.score ?? 0) - (previous.score ?? 0);
    return [
      {
        label: t("project.compareScore"),
        current: latest.score !== null ? `${latest.score}/100` : t("common.noValue"),
        previous: previous.score !== null ? `${previous.score}/100` : t("common.noValue"),
        tone: scoreDelta > 0 ? "success" : scoreDelta < 0 ? "danger" : "default",
      },
      {
        label: t("project.compareNgSlides"),
        current: String(latest.ng_slide_count),
        previous: String(previous.ng_slide_count),
        tone:
          latest.ng_slide_count < previous.ng_slide_count
            ? "success"
            : latest.ng_slide_count > previous.ng_slide_count
              ? "danger"
              : "default",
      },
      {
        label: t("project.compareIssues"),
        current: String(latest.issue_count),
        previous: String(previous.issue_count),
        tone:
          latest.issue_count < previous.issue_count
            ? "success"
            : latest.issue_count > previous.issue_count
              ? "danger"
              : "default",
      },
      {
        label: t("project.compareVersion"),
        current: latest.rubric_version ?? "—",
        previous: previous.rubric_version ?? "—",
        tone: latest.rubric_version === previous.rubric_version ? "default" : "warning",
      },
    ];
  }, [runHistory, t]);

  const executiveSummary = useMemo<SummaryLine[]>(() => {
    if (latestScore === null) {
      return [{ id: "not-graded", text: t("project.notGradedText") }];
    }

    const scoreLineKey =
      latestScore >= 80
        ? "project.summaryScoreHealthy"
        : latestScore >= 60
          ? "project.summaryScoreWatch"
          : "project.summaryScoreCritical";

    const items = [
      fillTemplate(t(scoreLineKey), { score: latestScore }),
      weakestCriteria[0]
        ? fillTemplate(t("project.summaryWeakCriteria"), {
            criterion: weakestCriteria[0].label,
            score: weakestCriteria[0].value,
            max: weakestCriteria[0].max,
          })
        : "",
      ngSlideCount > 0
        ? fillTemplate(t("project.summaryNgSlides"), {
            count: ngSlideCount,
            issues: issueCount,
          })
        : strongestCriterion
          ? fillTemplate(t("project.summaryStrongCriteria"), {
              criterion: strongestCriterion.label,
              score: strongestCriterion.value,
              max: strongestCriterion.max,
            })
          : t("project.summaryNoNgSlides"),
    ].filter(Boolean);

    return items.map((text, index) => ({ id: `summary-${index}`, text }));
  }, [issueCount, latestScore, ngSlideCount, strongestCriterion, t, weakestCriteria]);

  const issueHighlights = useMemo<HighlightItemView[]>(() => {
    const items: HighlightItemView[] = [];

    if (ngSlideCount > 0) {
      const firstNg = slideReviewItems.find((item) => item.status === "NG");
      items.push({
        title: t("project.highlightNgSlides"),
        detail: firstNg
          ? fillTemplate(t("project.highlightNgSlidesDetail"), {
              count: ngSlideCount,
              slide: firstNg.slide_number,
            })
          : fillTemplate(t("project.highlightNgSlidesDetailOnly"), { count: ngSlideCount }),
        tone: "danger",
      });
    }

    if (weakestCriteria[0]) {
      items.push({
        title: t("project.highlightWeakCriteria"),
        detail: fillTemplate(t("project.highlightWeakCriteriaDetail"), {
          criterion: weakestCriteria[0].label,
          score: weakestCriteria[0].value,
          max: weakestCriteria[0].max,
        }),
        tone: weakestCriteria[0].ratio < 0.6 ? "danger" : "warning",
      });
    }

    if (criteriaSuggestionItems[0]) {
      items.push({
        title: t("project.highlightSuggestions"),
        detail: fillTemplate(t("project.highlightSuggestionsDetail"), {
          count: criteriaSuggestionItems.length,
        }),
        tone: "primary",
      });
    }

    if (strongestCriterion) {
      items.push({
        title: t("project.highlightStrength"),
        detail: fillTemplate(t("project.highlightStrengthDetail"), {
          criterion: strongestCriterion.label,
          score: strongestCriterion.value,
          max: strongestCriterion.max,
        }),
        tone: "success",
      });
    }

    return items.slice(0, 4);
  }, [criteriaSuggestionItems, ngSlideCount, slideReviewItems, strongestCriterion, t, weakestCriteria]);

  const issueBreakdownItems = useMemo(
    () =>
      Object.entries(latestRun?.issue_breakdown ?? {})
        .map(([label, value]) => ({ label, value }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    [latestRun?.issue_breakdown],
  );

  const chartFallback = <div className="chart-card chart-card--loading" aria-hidden="true" />;

  const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || "";

  // Set initial selected slide
  useMemo(() => {
    if (!selectedSlideId && slideReviewItems.length > 0) {
      const firstNg = slideReviewItems.find(s => s.status === "NG");
      setSelectedSlideId(firstNg ? firstNg.id : slideReviewItems[0].id);
    }
  }, [slideReviewItems, selectedSlideId]);

  return (
    <div className="project-workspace-container">
      {/* 1. Full-width Header */}
      <header className="project-workspace-header">
        <div className="project-header-info">
          <div className="project-detail-hero__eyebrow">
            <button className="text-button" onClick={onBack} style={{ marginRight: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeftIcon size="sm" />
              {t("nav.allReviews")}
            </button>
            <Badge tone={statusTone}>{statusLabel}</Badge>
            <span style={{ marginLeft: '8px', color: '#64748b' }}>{submission.project_name}</span>
          </div>
          <h2>{submission.filename}</h2>
          <div className="project-header-meta">
            <span><strong>{t("project.totalScore")}:</strong> {latestScore?.toFixed(1) ?? 0}/100</span>
            <span><strong>{t("project.reviewedAt")}:</strong> {gradedAt}</span>
          </div>
        </div>

        <div className="project-header-navigation">
          <button 
            className="btn-secondary btn-secondary--compact" 
            onClick={handlePrev} 
            disabled={!prevSubmission}
            title={prevSubmission?.filename}
          >
            <ChevronLeftIcon size="sm" />
            {t("common.previous") || "Trước"}
          </button>
          <button 
            className="btn-secondary btn-secondary--compact" 
            onClick={handleNext} 
            disabled={!nextSubmission}
            title={nextSubmission?.filename}
          >
            {t("common.next") || "Sau"}
            <ChevronRightIcon size="sm" />
          </button>
          <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 8px' }} />
          <a
            href={`${API_BASE_URL}/submissions/${submission.project_id}/file?disposition=attachment`}
            className="btn-primary btn-primary--compact"
            download
            target="_blank"
            rel="noopener noreferrer"
          >
            <DownloadIcon size="sm" />
            {t("project.downloadResult")}
          </a>
        </div>
      </header>

      {/* 2. Tab Switcher */}
      <nav className="project-workspace-tabs">
        <div 
          className={`workspace-tab ${activeTab === "overview" ? "is-active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          {t("project.overview") || "Tổng quan báo cáo"}
        </div>
        <div 
          className={`workspace-tab ${activeTab === "slides" ? "is-active" : ""}`}
          onClick={() => setActiveTab("slides")}
        >
          {t("project.slideReviews") || "Chi tiết từng Slide"}
        </div>
      </nav>

      {/* 3. Main Content Area */}
      <div className="project-workspace-content">
        {activeTab === "overview" ? (
          <div className="overview-tab-grid">
             {/* Left Column */}
             <div className="overview-main-col">
                <ExecutiveSummaryPanel
                  title={t("project.executiveSummary")}
                  subtitle={t("project.executiveSummarySubtitle")}
                  items={executiveSummary}
                />
                <SectionBlock style={{ marginTop: '24px' }}>
                  <SectionBlock.Header 
                    title={t("project.scoreByCriteria")} 
                    subtitle={t("project.scoreByCriteriaHint")}
                  />
                  <SectionBlock.Body>
                    <div className="project-detail-chart-grid" style={{ gridTemplateColumns: '1fr' }}>
                      <Suspense fallback={chartFallback}>
                        <CriteriaScoreChart data={orderedScores} />
                      </Suspense>
                    </div>
                  </SectionBlock.Body>
                </SectionBlock>
                <div style={{ marginTop: '24px' }}>
                  <FeedbackPreviewPanel
                    title={t("project.summaryTitle")}
                    sections={compactFeedbackSections as FeedbackSectionView[]}
                    emptyText={t("common.noValue")}
                    detailLabel={t("project.detailLink")}
                    onOpenDetail={() => setSummaryDialogOpen(true)}
                  />
                </div>
             </div>
             {/* Right Column */}
             <div className="overview-side-col">
                <IssueHighlightsPanel
                  title={t("project.issueHighlights")}
                  subtitle={t("project.issueHighlightsSubtitle")}
                  items={issueHighlights}
                />
                <div style={{ marginTop: '24px' }}>
                  <MetadataPanel title={t("project.documentOverview") || "Thông tin tài liệu"} items={documentMeta} />
                </div>
             </div>
          </div>
        ) : (
          <div className="split-pane-layout">
            <aside className="split-pane-sidebar">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Danh sách Slide ({slideReviewItems.length})
                </span>
              </div>
              {slideReviewItems.map((item) => (
                <div 
                  key={item.id}
                  className={`slide-nav-item ${selectedSlideId === item.id ? "is-active" : ""}`}
                  onClick={() => setSelectedSlideId(item.id)}
                >
                  <div className="slide-nav-num">{item.slide_number}</div>
                  <div className="slide-nav-info">
                    <div className="slide-nav-title">{item.displayTitle}</div>
                    <div className="slide-nav-meta">
                      <span style={{ color: item.status === "OK" ? "#10b981" : "#ef4444" }}>● {item.status}</span>
                      {item.issues.length > 0 && ` · ${item.issues.length} lỗi`}
                    </div>
                  </div>
                </div>
              ))}
            </aside>
            <main className="split-pane-main">
              {selectedSlideId ? (
                (() => {
                  const item = slideReviewItems.find(s => s.id === selectedSlideId);
                  if (!item) return null;
                  return (
                    <div className="slide-detail-container">
                      <div className="slide-detail-card">
                        <div className="slide-detail-head">
                          <div className="slide-detail-title">
                            <h3>{t("project.slideNumber").replace("{number}", String(item.slide_number))}: {item.displayTitle}</h3>
                          </div>
                          <Badge tone={item.status === "OK" ? "success" : "danger"}>{item.status}</Badge>
                        </div>
                        
                        <div className="detail-suggestion-detail">
                          <section className="detail-suggestion-detail__block">
                            <h4>{t("project.slideSummary")}</h4>
                            <p>{item.summary || t("common.noValue")}</p>
                          </section>
                          
                          <section className="detail-suggestion-detail__block">
                            <h4>{t("project.slideIssues")}</h4>
                            {item.issues.length ? (
                              <ul className="slide-review-detail__list">
                                {item.issues.map((issue, index) => (
                                  <li key={`slide-issue-${index}`}>{issue}</li>
                                ))}
                              </ul>
                            ) : <p>{t("common.noValue")}</p>}
                          </section>
                          
                          <section className="detail-suggestion-detail__block">
                            <h4>{t("project.slideSuggestions")}</h4>
                            <div className="detail-suggestion-card__preview">
                              {item.suggestions ? (
                                <p style={{ whiteSpace: 'pre-wrap' }}>{item.suggestions}</p>
                              ) : <p>{t("common.noValue")}</p>}
                            </div>
                          </section>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="empty-state-inline" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p>{t("project.selectSlideToViewDetails") || "Vui lòng chọn slide từ danh sách bên trái để xem chi tiết đánh giá."}</p>
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      {/* Dialogs for Summary Detail */}
      {summaryDialogOpen ? (
        <ProjectReviewDialog
          title={t("project.detailDialogTitle")}
          onClose={() => setSummaryDialogOpen(false)}
          closeLabel={t("common.close")}
        >
          <div className="detail-summary-dialog__body">
            {feedbackLines.length ? (
              feedbackSections.map((section, index) => (
                <section className="detail-feedback-section-block detail-feedback-section-block--dialog" key={`${section.title}-${index}`}>
                  {section.title ? <h4>{section.title}</h4> : null}
                  {section.lines.map((line, lineIndex) => (
                    <p key={`${section.title}-${lineIndex}`}>{line}</p>
                  ))}
                </section>
              ))
            ) : (
              <p>{t("common.noValue")}</p>
            )}
          </div>
        </ProjectReviewDialog>
      ) : null}

      {suggestionDetail ? (
        <ProjectReviewDialog
          title={suggestionDetail.title}
          score={suggestionDetail.count || undefined}
          wide
          onClose={() => setSuggestionDetail(null)}
          closeLabel={t("common.close")}
        >
          <div className="detail-summary-dialog__body detail-suggestion-detail">
            {splitSuggestionBlocks(suggestionDetail.text, t).map((block, index) => (
              <section className="detail-suggestion-detail__block" key={`${block.title}-${index}`}>
                {block.title ? <h4>{block.title}</h4> : null}
                {block.lines.map((line, lineIndex) => (
                  <p key={`${block.title}-${lineIndex}`}>{line}</p>
                ))}
              </section>
            ))}
          </div>
        </ProjectReviewDialog>
      ) : null}
    </div>
  );
}
