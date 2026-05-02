import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import slideWatermarkImage from "../../assets/dashboard-reference/cropped/slide-watermark-v3.png";
import { DOCUMENT_TYPE_OPTIONS, getDocumentTypeKey } from "../../constants/documentTypes";
import type { CriteriaResult, LanguageCode, Submission } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { formatUploadedAt } from "../submissions/utils";
import { FileReviewIcon, ShieldCheckIcon, SparkIcon, TargetIcon } from "../ui/Icon";
import { PageHeader } from "../ui/PageHeader";

interface DashboardOverviewProps {
  submissions: Submission[];
}

interface SummaryCardItem {
  id: string;
  title: string;
  averageScore: number;
  totalCount: number;
  highScoreCount: number;
  lowScoreCount: number;
  iconIndex: number;
}

interface ReferenceItem {
  id: string;
  filename: string;
  score: number;
  okCount: number;
  ngCount: number;
  documentType: string;
}

interface PositiveItem {
  id: string;
  filename: string;
  documentType: string;
  language: LanguageCode;
  text: string;
  score: number;
  criterionLabel?: string;
}

interface WeakCriterionItem {
  key: string;
  label: string;
  average: number;
  ratio: number;
  sampleCount: number;
  percent: number;
}

interface RecentHistoryItem {
  id: string;
  filename: string;
  type: string;
  reviewedAt: string;
  score: number;
  status: string;
  statusCode: "completed" | "failed" | "pending";
}

type FilterValue = "all" | (typeof DOCUMENT_TYPE_OPTIONS)[number]["id"];

const CLEAN_DASHBOARD_COPY = {
  vi: {
    heroTitle: "Xin chào! AI hỗ trợ nâng cao chất lượng tài liệu của bạn",
    heroSubtitle: "AI phân tích toàn bộ tài liệu, tổng hợp điểm mạnh và gợi ý các điểm cần cải thiện.",
    allDocuments: "Tất cả tài liệu",
    averageScore: "Điểm trung bình",
    total: "Tổng số",
    items: "bài",
    highScore: "80+",
    lowScore: "Dưới 80",
    topReferencesTitle: "Top 5 tài liệu nên tham khảo",
    topCommentsTitle: "Top 5 nội dung tốt nên học",
    weakCriteriaTitle: "Top 5 tiêu chí cần cải thiện",
    weakCriteriaSubtitle: "Điểm trung bình thấp nhất",
    slideSummaryTitle: "Tổng hợp slide",
    slideSummarySubtitle: "Toàn bộ dự án",
    reviewHistoryTitle: "Lịch sử review gần nhất",
    totalSlides: "Tổng slide",
    okSlides: "Slide OK",
    ngSlides: "Slide NG",
    commentSource: "Nguồn",
    criterion: "Tiêu chí",
    scoreSuffix: "/100",
    noData: "Chưa có dữ liệu",
    filterLabel: "Lọc theo loại tài liệu",
    dateRangeLabel: "Khoảng thời gian thống kê",
    recommendationText: "Ưu tiên cải thiện tiêu chí “{criterion}” trước để tác động nhanh nhất tới chất lượng chung.",
    historyHeaders: {
      fileName: "Tên tài liệu",
      type: "Loại",
      version: "Phiên bản",
      reviewedAt: "Ngày review",
      score: "Điểm",
      model: "Mô hình AI",
      status: "Trạng thái",
    },
    statusCompleted: "Hoàn tất",
    statusPending: "Đang chờ",
    statusFailed: "Lỗi",
  },
  ja: {
    heroTitle: "こんにちは！AI があなたのドキュメント品質向上をサポートします",
    heroSubtitle: "AI が全てのドキュメントを分析し、良い点と改善ポイントをまとめます。",
    allDocuments: "すべてのドキュメント",
    averageScore: "平均スコア",
    total: "総数",
    items: "件",
    highScore: "80点以上",
    lowScore: "80点未満",
    topReferencesTitle: "Top 5 参考にすべき資料",
    topCommentsTitle: "Top 5 学ぶべき良い内容",
    weakCriteriaTitle: "Top 5 改善すべき基準",
    weakCriteriaSubtitle: "平均スコアが低い順",
    slideSummaryTitle: "スライド集計",
    slideSummarySubtitle: "プロジェクト全体",
    reviewHistoryTitle: "最新レビュー履歴",
    totalSlides: "総スライド",
    okSlides: "OKスライド",
    ngSlides: "NGスライド",
    commentSource: "参照元",
    criterion: "基準",
    scoreSuffix: "/100",
    noData: "データがありません",
    filterLabel: "資料タイプで絞り込み",
    dateRangeLabel: "集計期間",
    recommendationText: "最も効果が高いのは「{criterion}」の改善です。まずこの基準から見直してください。",
    historyHeaders: {
      fileName: "文書名",
      type: "種別",
      version: "バージョン",
      reviewedAt: "レビュー日",
      score: "スコア",
      model: "AIモデル",
      status: "ステータス",
    },
    statusCompleted: "完了",
    statusPending: "処理中",
    statusFailed: "失敗",
  },
} as const;

function cleanLine(text: string) {
  return text.replace(/^[-\s\u2022*.]+/u, "").replace(/^\d+[.)]\s*/u, "").trim();
}

function shorten(text: string, max = 96) {
  const value = cleanLine(text).replace(/\s+/g, " ");
  return value.length <= max ? value : `${value.slice(0, max).trim()}...`;
}

function getCopy(lang: LanguageCode) {
  return CLEAN_DASHBOARD_COPY[lang] ?? CLEAN_DASHBOARD_COPY.vi;
}

function getSuggestionText(suggestion: CriteriaResult["suggestion"], language: LanguageCode) {
  if (!suggestion || typeof suggestion !== "object") {
    return null;
  }

  const direct = suggestion[language];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  for (const item of Object.values(suggestion)) {
    if (typeof item === "string" && item.trim()) {
      return item.trim();
    }
  }

  return null;
}

function getSummaryIcon(index: number) {
  if (index === 1) return <SparkIcon size="sm" />;
  if (index === 2) return <ShieldCheckIcon size="sm" />;
  if (index === 3) return <TargetIcon size="sm" />;
  return <FileReviewIcon size="sm" />;
}

function getDocumentTypeLabel(documentType: string | null | undefined, t: (key: string) => string) {
  return t(getDocumentTypeKey(documentType));
}

function filterByDocumentType(items: Submission[], documentType: FilterValue) {
  return documentType === "all" ? items : items.filter((item) => item.document_type === documentType);
}

function getStatusLabel(status: string, score: number | null, copy: (typeof CLEAN_DASHBOARD_COPY)[LanguageCode]) {
  if (typeof score === "number") return copy.statusCompleted;
  if (status === "failed" || status === "error") return copy.statusFailed;
  return copy.statusPending;
}

function extractPositiveFeedback(
  submission: Submission,
  t: (key: string) => string,
): PositiveItem[] {
  const latestRun = submission.latest_run;
  if (!latestRun || typeof latestRun.score !== "number") {
    return [];
  }

  const language = submission.language;
  const sourceId = `${submission.project_id}-${submission.filename}`;
  const documentType = getDocumentTypeLabel(submission.document_type, t);

  const feedbackLines = (latestRun.draft_feedback?.[language] ?? "")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => line.length > 14)
    .slice(0, 2)
    .map((line, index) => ({
      id: `${sourceId}-feedback-${index}`,
      filename: submission.filename,
      documentType,
      language,
      text: shorten(line),
      score: latestRun.score ?? 0,
    }));

  const criteriaLines = (latestRun.criteria_results ?? [])
    .map((criterion, index) => ({
      id: `${sourceId}-criterion-${criterion.key}-${index}`,
      text: getSuggestionText(criterion.suggestion, language),
      criterionLabel: t(`upload.criteria.${criterion.key}`),
    }))
    .filter((value): value is { id: string; text: string; criterionLabel: string } => Boolean(value.text))
    .slice(0, 3)
    .map((line) => ({
      id: line.id,
      filename: submission.filename,
      documentType,
      language,
      text: shorten(line.text),
      score: latestRun.score ?? 0,
      criterionLabel: line.criterionLabel,
    }));

  return [...feedbackLines, ...criteriaLines];
}

export default function DashboardOverview({ submissions }: DashboardOverviewProps) {
  const { lang, t } = useTranslation();
  const copy = getCopy(lang);
  const [globalFilter, setGlobalFilter] = useState<FilterValue>("all");
  const [activeTab, setActiveTab] = useState<"references" | "comments" | "criteria">("references");

  const graded = useMemo(
    () => submissions.filter((item) => item.latest_run && typeof item.latest_run.score === "number"),
    [submissions],
  );


  const summaryCards = useMemo<SummaryCardItem[]>(
    () =>
      DOCUMENT_TYPE_OPTIONS.map((option, index) => {
        const docs = graded.filter((item) => item.document_type === option.id);
        const totalCount = submissions.filter((item) => item.document_type === option.id).length;
        const averageScore = docs.length
          ? Math.round(docs.reduce((sum, item) => sum + (item.latest_run?.score ?? 0), 0) / docs.length)
          : 0;
        const highScoreCount = docs.filter((item) => (item.latest_run?.score ?? 0) >= 80).length;
        const lowScoreCount = docs.filter((item) => (item.latest_run?.score ?? 0) < 80).length;

        return {
          id: option.id,
          title: getDocumentTypeLabel(option.id, t),
          averageScore,
          totalCount,
          highScoreCount,
          lowScoreCount,
          iconIndex: index,
        };
      }),
    [graded, submissions, t],
  );

  const filterOptions = useMemo(
    () =>
      DOCUMENT_TYPE_OPTIONS.map((option) => ({
        value: option.id as FilterValue,
        label: getDocumentTypeLabel(option.id, t),
      })),
    [t],
  );

  const topReferences = useMemo<ReferenceItem[]>(
    () =>
      filterByDocumentType(graded, globalFilter)
        .map((item) => {
          const slideReviews = item.latest_run?.slide_reviews ?? [];
          const okCount = slideReviews.filter((slide) => slide.status === "OK").length;
          const ngCount = slideReviews.filter((slide) => slide.status === "NG").length;
          return {
            id: `${item.project_id}-${item.filename}`,
            filename: item.filename,
            score: item.latest_run?.score ?? 0,
            okCount,
            ngCount,
            documentType: getDocumentTypeLabel(item.document_type, t),
          };
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.okCount !== a.okCount) return b.okCount - a.okCount;
          return a.ngCount - b.ngCount;
        })
        .slice(0, 5),
    [graded, globalFilter, t],
  );

  const topComments = useMemo<PositiveItem[]>(
    () =>
      filterByDocumentType(graded, globalFilter)
        .flatMap((item) => extractPositiveFeedback(item, t))
        .filter((item, index, array) => array.findIndex((candidate) => candidate.text === item.text) === index)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    [globalFilter, graded, t],
  );

  const weakCriteria = useMemo<WeakCriterionItem[]>(() => {
    const criteriaMap = new Map<string, { total: number; max: number; count: number }>();

    filterByDocumentType(graded, globalFilter).forEach((submission) => {
      (submission.latest_run?.criteria_results ?? []).forEach((criterion) => {
        const current = criteriaMap.get(criterion.key) ?? { total: 0, max: 0, count: 0 };
        current.total += criterion.score;
        current.max += criterion.max_score;
        current.count += 1;
        criteriaMap.set(criterion.key, current);
      });
    });

    return [...criteriaMap.entries()]
      .map(([key, value]) => ({
        key,
        label: t(`upload.criteria.${key}`),
        average: value.count ? Math.round(value.total / value.count) : 0,
        ratio: value.max > 0 ? value.total / value.max : 0,
        sampleCount: value.count,
        percent: value.max > 0 ? Math.round((value.total / value.max) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 5);
  }, [globalFilter, graded, t]);

  const slideSummary = useMemo(() => {
    const slides = graded.flatMap((item) => item.latest_run?.slide_reviews ?? []);
    const okSlideCount = slides.filter((slide) => slide.status === "OK").length;
    const ngSlideCount = slides.filter((slide) => slide.status === "NG").length;
    const totalSlides = okSlideCount + ngSlideCount;
    const okRate = totalSlides > 0 ? Math.round((okSlideCount / totalSlides) * 1000) / 10 : 0;
    const ngRate = totalSlides > 0 ? Math.round((ngSlideCount / totalSlides) * 1000) / 10 : 0;

    return { okSlideCount, ngSlideCount, totalSlides, okRate, ngRate };
  }, [graded]);

  const recentHistory = useMemo<RecentHistoryItem[]>(
    () =>
      [...graded]
        .sort((a, b) => {
          const aDate = new Date(a.latest_run?.graded_at ?? a.uploaded_at).getTime();
          const bDate = new Date(b.latest_run?.graded_at ?? b.uploaded_at).getTime();
          return bDate - aDate;
        })
        .slice(0, 5)
        .map((item) => ({
          id: `${item.project_id}-${item.filename}`,
          filename: item.filename,
          type: getDocumentTypeLabel(item.document_type, t),
          reviewedAt: formatUploadedAt(item.latest_run?.graded_at ?? item.uploaded_at, lang),
          score: item.latest_run?.score ?? 0,
          status: getStatusLabel(item.status, item.latest_run?.score ?? null, copy),
          statusCode:
            typeof item.latest_run?.score === "number"
              ? "completed"
              : item.status === "failed" || item.status === "error"
              ? "failed"
              : "pending",
        })),
    [copy, graded, lang, t],
  );

  const recommendationText = copy.recommendationText.replace(
    "{criterion}",
    weakCriteria[0]?.label ?? getDocumentTypeLabel("qa-review", t),
  );

  return (
    <section className="dashboard-reference" aria-label={t("nav.dashboard")}>
      <PageHeader title={copy.heroTitle} subtitle={copy.heroSubtitle} />

      <section className="dashboard-reference-recommendation">
        <strong>{recommendationText}</strong>
      </section>

      <div className="dashboard-reference__global-filter" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <select
          value={globalFilter}
          aria-label={copy.filterLabel}
          onChange={(event) => setGlobalFilter(event.target.value as FilterValue)}
          style={{ width: 'auto', minWidth: '200px' }}
        >
          <option value="all">{copy.allDocuments}</option>
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="dashboard-reference-summary-grid dashboard-reference-summary-grid--v3">
        {summaryCards.filter((card) => globalFilter === "all" || card.id === globalFilter).map((card) => {
          const total = card.highScoreCount + card.lowScoreCount;
          const highRate = total > 0 ? Math.round((card.highScoreCount / total) * 1000) / 10 : 0;
          const lowRate = total > 0 ? Math.round((card.lowScoreCount / total) * 1000) / 10 : 0;

          return (
            <section
              className="dashboard-reference-panel dashboard-reference-summary-card dashboard-reference-summary-card--v3"
              key={card.id}
            >
              <div className="dashboard-reference-summary-card__head">
                <span
                  className={`dashboard-reference-summary-card__icon dashboard-reference-summary-card__icon--${card.iconIndex}`}
                >
                  {getSummaryIcon(card.iconIndex)}
                </span>
                <strong>{card.title}</strong>
              </div>

              <div className="dashboard-reference-summary-card__score">
                <strong>{card.averageScore}</strong>
                <span>{copy.scoreSuffix}</span>
              </div>
              <span className="dashboard-reference-summary-card__caption">{copy.averageScore}</span>

              <div className="dashboard-reference-summary-card__count">
                <span>{copy.total}</span>
                <strong>{card.totalCount}</strong>
                <span>{copy.items}</span>
              </div>

              <div className="dashboard-reference-mini-chart">
                <span
                  className="dashboard-reference-mini-chart__donut"
                  style={{ "--dashboard-chart-value": `${highRate}%` } as CSSProperties}
                />
                <div className="dashboard-reference-mini-chart__legend">
                  <span>
                    <i className="is-ok" />
                    {copy.highScore} <strong>{card.highScoreCount}</strong> ({highRate}%)
                  </span>
                  <span>
                    <i className="is-ng" />
                    {copy.lowScore} <strong>{card.lowScoreCount}</strong> ({lowRate}%)
                  </span>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="dashboard-reference-mobile-tabs">
        <button className={activeTab === "references" ? "is-active" : ""} onClick={() => setActiveTab("references")}>
          {copy.topReferencesTitle}
        </button>
        <button className={activeTab === "comments" ? "is-active" : ""} onClick={() => setActiveTab("comments")}>
          {copy.topCommentsTitle}
        </button>
        <button className={activeTab === "criteria" ? "is-active" : ""} onClick={() => setActiveTab("criteria")}>
          {copy.weakCriteriaTitle}
        </button>
      </div>

      <div className="dashboard-reference-main-grid dashboard-reference-main-grid--v3">
        <DashboardListPanel
          index="2"
          title={copy.topReferencesTitle}
          panelClassName={`dashboard-reference-panel--references ${activeTab !== "references" ? "is-hidden-on-mobile" : ""}`}
        >
          {topReferences.length ? (
            topReferences.map((item, index) => (
              <div className="dashboard-reference-ranked-row" key={item.id}>
                <span className={`dashboard-reference-rank ${index === 0 ? "is-featured" : ""}`}>{index + 1}</span>
                <div className="dashboard-reference-ranked-row__main">
                  <strong title={item.filename}>{item.filename}</strong>
                  <div className="dashboard-reference-ranked-row__meta">
                    <span>{item.documentType}</span>
                    <span>
                      {copy.okSlides}: {item.okCount}
                    </span>
                    <span>
                      {copy.ngSlides}: {item.ngCount}
                    </span>
                  </div>
                </div>
                <span className="dashboard-reference-ranked-row__value">
                  {item.score}
                  <small>{copy.scoreSuffix}</small>
                </span>
              </div>
            ))
          ) : (
            <div className="dashboard-reference-empty">{copy.noData}</div>
          )}
        </DashboardListPanel>

        <DashboardListPanel
          index="3"
          title={copy.topCommentsTitle}
          panelClassName={`dashboard-reference-panel--comments ${activeTab !== "comments" ? "is-hidden-on-mobile" : ""}`}
        >
          {topComments.length ? (
            topComments.map((item, index) => (
              <div className="dashboard-reference-ranked-row" key={item.id}>
                <span className="dashboard-reference-rank">{index + 1}</span>
                <div className="dashboard-reference-ranked-row__main">
                  <strong title={item.text}>{item.text}</strong>
                  <div className="dashboard-reference-ranked-row__sub">
                    <span>
                      {copy.commentSource}: {item.filename}
                    </span>
                    <span>{item.documentType}</span>
                    {item.criterionLabel ? <span>{copy.criterion}: {item.criterionLabel}</span> : null}
                    <span>{item.language.toUpperCase()}</span>
                  </div>
                </div>
                <span className="dashboard-reference-score-warn">
                  {item.score}
                  <small>{copy.scoreSuffix}</small>
                </span>
              </div>
            ))
          ) : (
            <div className="dashboard-reference-empty">{copy.noData}</div>
          )}
        </DashboardListPanel>

        <DashboardListPanel
          index="4"
          title={`${copy.weakCriteriaTitle} (${copy.weakCriteriaSubtitle})`}
          panelClassName={`dashboard-reference-panel--criteria ${activeTab !== "criteria" ? "is-hidden-on-mobile" : ""}`}
        >
          {weakCriteria.length ? (
            weakCriteria.map((item, index) => (
              <div className="dashboard-reference-ranked-row" key={item.key}>
                <span className="dashboard-reference-rank">{index + 1}</span>
                <div className="dashboard-reference-ranked-row__main">
                  <strong title={item.label}>{item.label}</strong>
                  <div className="dashboard-reference-ranked-row__meta">
                    <span>{item.percent}%</span>
                    <span>
                      {copy.total}: {item.sampleCount}
                    </span>
                  </div>
                </div>
                <span className="dashboard-reference-score-warn">
                  {item.average}
                  <small>{copy.scoreSuffix}</small>
                </span>
              </div>
            ))
          ) : (
            <div className="dashboard-reference-empty">{copy.noData}</div>
          )}
        </DashboardListPanel>
      </div>

      <div className="dashboard-reference-bottom-grid dashboard-reference-bottom-grid--v3">
        <section className="dashboard-reference-panel dashboard-reference-panel--slide" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="dashboard-reference-panel__visual-head">
            <div>
            <h2>5. {copy.slideSummaryTitle}</h2>
            <p className="dashboard-reference-panel__subtitle">{copy.slideSummarySubtitle}</p>
          </div>
            <span className="dashboard-reference-panel__watermark" aria-hidden="true">
              <img className="dashboard-reference-panel__watermark-image" src={slideWatermarkImage} alt="" />
            </span>
          </div>

          <div className="dashboard-reference-slide-visual" style={{ flex: 1 }}>
            <div className="dashboard-reference-slide-chart-wrap">
              <span
                className="dashboard-reference-slide-donut"
                style={{ "--dashboard-chart-value": `${slideSummary.okRate}%` } as CSSProperties}
              />
              <div className="dashboard-reference-slide-total">
                <strong>{slideSummary.totalSlides}</strong>
                <span>{copy.totalSlides}</span>
              </div>
            </div>

            <div className="dashboard-reference-slide-legend">
              <span>
                <i className="is-ok" />
                {copy.okSlides} <strong>{slideSummary.okSlideCount}</strong> ({slideSummary.okRate}%)
              </span>
              <span>
                <i className="is-ng" />
                {copy.ngSlides} <strong>{slideSummary.ngSlideCount}</strong> ({slideSummary.ngRate}%)
              </span>
            </div>
          </div>
        </section>

        <section className="dashboard-reference-panel dashboard-reference-panel--history">
          <h2>6. {copy.reviewHistoryTitle}</h2>

          <div className="dashboard-reference-table-wrap">
            <table className="dashboard-reference-table">
              <thead>
                <tr>
                  <th>{copy.historyHeaders.fileName}</th>
                  <th>{copy.historyHeaders.type}</th>
                  <th>{copy.historyHeaders.reviewedAt}</th>
                  <th>{copy.historyHeaders.score}</th>
                  <th>{copy.historyHeaders.status}</th>
                </tr>
              </thead>
              <tbody>
                {recentHistory.length ? (
                  recentHistory.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <FileReviewIcon size="sm" />
                        <span title={item.filename}>{item.filename}</span>
                      </td>
                      <td>{item.type}</td>
                      <td>{item.reviewedAt}</td>
                      <td>
                        <strong className={item.score >= 80 ? "text-score-high" : "text-score-low"}>{item.score}</strong>
                        <span className="text-score-suffix">{copy.scoreSuffix}</span>
                      </td>
                      <td>
                        <span className={`dashboard-reference-status dashboard-reference-status--${item.statusCode}`}>
                          <i className={item.statusCode === "completed" ? "is-ok" : item.statusCode === "failed" ? "is-ng" : "is-pending"} />
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                      <td colSpan={5} className="dashboard-reference-empty">
                        {copy.noData}
                      </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

    </section>
  );
}

function DashboardListPanel({
  index,
  title,
  children,
  panelClassName,
}: {
  index: string;
  title: string;
  children: ReactNode;
  panelClassName?: string;
}) {
  return (
    <section className={`dashboard-reference-panel dashboard-reference-panel--list ${panelClassName ?? ""}`.trim()}>
      <div className="dashboard-reference-panel__head">
        <h2>
          {index}. {title}
        </h2>
      </div>
      <div className="dashboard-reference-ranked-list">{children}</div>
    </section>
  );
}


