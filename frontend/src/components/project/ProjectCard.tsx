import { type CSSProperties, useMemo, useState } from "react";

import { getDocumentTypeKey } from "../../constants/documentTypes";
import { useActiveRubricConfig } from "../../hooks/useRubrics";
import { getLocalizedText } from "../../locales/utils";
import type { CriteriaResult, LanguageCode, SlideReview, Submission } from "../../types";
import ScoreBar from "../score/ScoreBar";
import { useTranslation } from "../LanguageSelector";
import SectionBlock from "../ui/SectionBlock";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  SparkIcon,
  TargetIcon,
  WorkflowIcon,
} from "../ui/Icon";

interface ProjectCardProps {
  submission: Submission;
}

type SuggestionTone = "success" | "warning" | "danger";

type SuggestionDetail = {
  title: string;
  count: string;
  text: string;
} | null;

type SlideReviewFilter = "all" | "OK" | "NG";

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
        <strong>{t("common.status")}</strong>
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

function buildCriteriaSuggestionItems(
  criteriaResults: CriteriaResult[],
  orderedScores: Array<{
    key: string;
    label: string;
    value: number;
    max: number;
  }>,
  lang: LanguageCode
) {
  const suggestions = Object.fromEntries(
    criteriaResults
      .map((item) => [item.key, getLocalizedText(item.suggestion, lang)])
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

export default function ProjectCard({ submission }: ProjectCardProps) {
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [suggestionDetail, setSuggestionDetail] = useState<SuggestionDetail>(null);
  const [slideReviewFilter, setSlideReviewFilter] = useState<SlideReviewFilter>("all");
  const [slideReviewDetail, setSlideReviewDetail] = useState<SlideReviewDetail>(null);
  const { lang, t } = useTranslation();
  const criteriaConfig = useActiveRubricConfig(submission.document_type, lang);
  const latestRun = submission.latest_run ?? null;
  const criteriaResults = useMemo(() => latestRun?.criteria_results ?? [], [latestRun]);
  const slideReviewItems = useMemo(
    () => buildSlideReviewItems(latestRun?.slide_reviews ?? [], lang, t),
    [latestRun, lang, t],
  );
  const filteredSlideReviewItems = useMemo(
    () =>
      slideReviewFilter === "all"
        ? slideReviewItems
        : slideReviewItems.filter((item) => item.status === slideReviewFilter),
    [slideReviewFilter, slideReviewItems],
  );
  const criteriaScoreMap = useMemo(
    () => Object.fromEntries(criteriaResults.map((item) => [item.key, item.score])),
    [criteriaResults],
  );
  const latestScore = latestRun?.score ?? null;

  const orderedScores = useMemo(
    () =>
      criteriaConfig.order.map((key) => ({
        key,
        value: criteriaScoreMap[key] ?? 0,
        max: criteriaResults.find((item) => item.key === key)?.max_score ?? criteriaConfig.maxScores[key] ?? 100,
        label: t(`upload.criteria.${key}`),
        Icon: getCriterionIcon(key),
      })),
    [criteriaConfig, criteriaResults, criteriaScoreMap, t],
  );

  const feedbackLines = useMemo(() => splitFeedbackLines(latestRun?.draft_feedback ?? null, lang), [latestRun, lang]);
  const feedbackSections = useMemo(() => splitFeedbackSections(feedbackLines), [feedbackLines]);
  const compactFeedbackSections = useMemo(() => previewFeedbackSections(feedbackSections), [feedbackSections]);

  const criteriaSuggestionItems = useMemo(
    () => buildCriteriaSuggestionItems(criteriaResults, orderedScores, lang),
    [criteriaResults, orderedScores, lang],
  );

  const overviewItems = [
    { label: t("project.documentType"), value: t(getDocumentTypeKey(submission.document_type)) },
    { label: t("project.detectedLanguage"), value: getLanguageLabel(submission.language, lang) },
    { label: t("project.rubricVersion"), value: latestRun?.rubric_version ?? "v1" },
    { label: t("project.fileType"), value: submission.filename.split(".").pop()?.toUpperCase() ?? t("common.noValue") },
    { label: t("project.uploadLabel"), value: submission.uploaded_at },
    { label: t("common.status"), value: latestScore !== null ? t("project.completed") : t("project.pending") },
  ];

  return (
    <>
      <aside className="project-dashboard-sidebar">
        <SectionBlock>
          <SectionBlock.Body>
            <div className="dashboard-sidebar-score">
              <h3>{t("project.totalScore")}</h3>
              <ScoreGauge score={latestScore ?? 0} t={t} />
            </div>
          </SectionBlock.Body>
        </SectionBlock>

        <SectionBlock className="detail-feedback-section">
          <SectionBlock.Header
            title={t("project.summaryTitle")}
            aside={
              feedbackLines.length ? (
                <button className="text-button" type="button" onClick={() => setSummaryDialogOpen(true)}>
                  {t("project.detailLink")}
                </button>
              ) : null
            }
          />
          <SectionBlock.Body>
            <div className="detail-score-board__summary detail-feedback-preview">
              {compactFeedbackSections.length && feedbackLines.length ? (
                compactFeedbackSections.map((section, index) => (
                  <section className="detail-feedback-section-block" key={`${section.title}-${index}`}>
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
          </SectionBlock.Body>
        </SectionBlock>

        <SectionBlock>
          <SectionBlock.Header title={t("project.overview")} />
          <SectionBlock.Body>
            <div className="detail-overview-strip detail-overview-strip--sidebar">
              {overviewItems.map((item) => (
                <div className="detail-overview-strip__item" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </SectionBlock.Body>
        </SectionBlock>
      </aside>

      <main className="project-dashboard-main">
        <SectionBlock>
          <SectionBlock.Header title={t("project.scoreByCriteria")} />
          <SectionBlock.Body>
            <div className="detail-score-board__list detail-score-board__list--grid">
              {orderedScores.map((item) => (
                <div className="detail-score-board__item" key={item.key}>
                  <div className="detail-score-board__item-head">
                    <span>{item.label}</span>
                    <strong>
                      {item.value} / {item.max}
                    </strong>
                  </div>
                  <ScoreBar value={item.value} max={item.max} showHeader={false} />
                </div>
              ))}
            </div>
          </SectionBlock.Body>
        </SectionBlock>

        <SectionBlock>
          <SectionBlock.Header
            title={`${t("project.slideReviews")} (${slideReviewItems.length})`}
            aside={
              slideReviewItems.length ? (
                <div className="slide-review-filters" role="group" aria-label={t("project.slideReviews")}>
                  {(["all", "OK", "NG"] as const).map((filter) => (
                    <button
                      type="button"
                      key={filter}
                      className={`slide-review-filter ${slideReviewFilter === filter ? "is-active" : ""}`.trim()}
                      onClick={() => setSlideReviewFilter(filter)}
                    >
                      {filter === "all" ? t("project.filterAll") : filter}
                    </button>
                  ))}
                </div>
              ) : null
            }
          />
          <SectionBlock.Body>
            {filteredSlideReviewItems.length ? (
              <div className="slide-review-list">
                {filteredSlideReviewItems.map((item) => (
                  <article className={`slide-review-card slide-review-card--${item.status.toLowerCase()}`} key={item.id}>
                    <div className="slide-review-card__head">
                      <div>
                        <span>{t("project.slideNumber").replace("{number}", String(item.slide_number))}</span>
                        <strong>{item.displayTitle}</strong>
                      </div>
                      <span className={`slide-review-status slide-review-status--${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="slide-review-card__summary">{item.summary || t("common.noValue")}</p>
                    {item.issues.length ? (
                      <ul className="slide-review-card__issues">
                        {item.issues.slice(0, 2).map((issue, index) => (
                          <li key={`${item.id}-issue-${index}`}>{issue}</li>
                        ))}
                      </ul>
                    ) : null}
                    <button
                      type="button"
                      className="text-button slide-review-card__detail"
                      onClick={() =>
                        setSlideReviewDetail({
                          title: item.displayTitle,
                          status: item.status,
                          summary: item.summary,
                          issues: item.issues,
                          suggestions: item.suggestions,
                        })
                      }
                    >
                      {t("project.detailLink")}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state-inline">
                <p className="empty-state-inline__title">{t("project.noSlideReviewsTitle")}</p>
                <p className="empty-state-inline__text">{t("project.noSlideReviewsText")}</p>
              </div>
            )}
          </SectionBlock.Body>
        </SectionBlock>

        <SectionBlock>
          <SectionBlock.Header
            title={`${t("project.suggestions")} (${criteriaSuggestionItems.length})`}
            aside={
              criteriaSuggestionItems.length ? (
                <div className="detail-suggestion-chips">
                  {criteriaSuggestionItems.map((item) => (
                  <span
                    key={`${item.key}-chip`}
                    className={`detail-suggestion-chip detail-suggestion-chip--${item.tone}`.trim()}
                  >
                    {item.title} {item.count ? <strong>{item.count}</strong> : null}
                  </span>
                  ))}
                </div>
              ) : null
            }
          />
          <SectionBlock.Body>
            {criteriaSuggestionItems.length ? (
              <div className="detail-suggestion-grid detail-suggestion-grid--detail-match">
                {criteriaSuggestionItems.map((item) => (
                  <article
                    key={item.key}
                    className={`detail-suggestion-card detail-suggestion-card--${item.tone}`.trim()}
                  >
                    <div className="detail-suggestion-card__head">
                      <div
                        className={`detail-score-row__icon detail-score-row__icon--outline detail-score-row__icon--${item.tone}`}
                      >
                        <item.Icon size="md" />
                      </div>
                      <strong>{item.title}</strong>
                    </div>
                    <div className="detail-suggestion-card__preview">
                      {suggestionPreviewBlocks(item.text, t).map((block, index) => (
                        <div className="detail-suggestion-card__preview-block" key={`${item.key}-preview-${index}`}>
                          {block.title ? <strong>{block.title}</strong> : null}
                          {block.lines.map((line, lineIndex) => (
                            <p key={`${item.key}-preview-${index}-${lineIndex}`}>{line}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="text-button detail-suggestion-card__detail"
                      onClick={() =>
                        setSuggestionDetail({
                          title: item.title,
                          count: item.count,
                          text: item.text,
                        })
                      }
                    >
                      {t("project.detailLink")}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state-inline">
                <p className="empty-state-inline__title">{t("project.noCriteriaSuggestionsTitle")}</p>
                <p className="empty-state-inline__text">{t("project.noCriteriaSuggestionsText")}</p>
              </div>
            )}
          </SectionBlock.Body>
        </SectionBlock>
      </main>

      {summaryDialogOpen ? (
        <div className="detail-summary-dialog" role="dialog" aria-modal="true">
          <div className="detail-summary-dialog__backdrop" onClick={() => setSummaryDialogOpen(false)} />
          <div className="detail-summary-dialog__card">
            <div className="detail-summary-dialog__header">
              <h3>{t("project.detailDialogTitle")}</h3>
              <button className="btn-secondary btn-secondary--compact" type="button" onClick={() => setSummaryDialogOpen(false)}>
                {t("common.close")}
              </button>
            </div>
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
          </div>
        </div>
      ) : null}

      {suggestionDetail ? (
        <div className="detail-summary-dialog" role="dialog" aria-modal="true">
          <div className="detail-summary-dialog__backdrop" onClick={() => setSuggestionDetail(null)} />
          <div className="detail-summary-dialog__card detail-summary-dialog__card--wide">
            <div className="detail-summary-dialog__header">
              <div>
                <h3>{suggestionDetail.title}</h3>
                {suggestionDetail.count ? <span className="detail-summary-dialog__score">{suggestionDetail.count}</span> : null}
              </div>
              <button className="btn-secondary btn-secondary--compact" type="button" onClick={() => setSuggestionDetail(null)}>
                {t("common.close")}
              </button>
            </div>
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
          </div>
        </div>
      ) : null}

      {slideReviewDetail ? (
        <div className="detail-summary-dialog" role="dialog" aria-modal="true">
          <div className="detail-summary-dialog__backdrop" onClick={() => setSlideReviewDetail(null)} />
          <div className="detail-summary-dialog__card detail-summary-dialog__card--wide">
            <div className="detail-summary-dialog__header">
              <div>
                <h3>{slideReviewDetail.title}</h3>
                <span className={`slide-review-status slide-review-status--${slideReviewDetail.status.toLowerCase()}`}>
                  {slideReviewDetail.status}
                </span>
              </div>
              <button className="btn-secondary btn-secondary--compact" type="button" onClick={() => setSlideReviewDetail(null)}>
                {t("common.close")}
              </button>
            </div>
            <div className="detail-summary-dialog__body slide-review-detail">
              <section className="detail-suggestion-detail__block">
                <h4>{t("project.slideSummary")}</h4>
                <p>{slideReviewDetail.summary || t("common.noValue")}</p>
              </section>
              <section className="detail-suggestion-detail__block">
                <h4>{t("project.slideIssues")}</h4>
                {slideReviewDetail.issues.length ? (
                  <ul className="slide-review-detail__list">
                    {slideReviewDetail.issues.map((issue, index) => (
                      <li key={`slide-detail-issue-${index}`}>{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{t("common.noValue")}</p>
                )}
              </section>
              <section className="detail-suggestion-detail__block">
                <h4>{t("project.slideSuggestions")}</h4>
                <p>{slideReviewDetail.suggestions || t("common.noValue")}</p>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
