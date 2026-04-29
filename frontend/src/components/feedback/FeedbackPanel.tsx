import { useMemo, useState } from "react";
import { useTranslation } from "../LanguageSelector";
import SectionBlock from "../ui/SectionBlock";
import { MessageSquareIcon } from "../ui/Icon";
import FeedbackItem from "./FeedbackItem";
import type { LanguageCode } from "../../types";

interface FeedbackPanelProps {
  feedback: string | Record<string, string> | null;
  language?: LanguageCode;
}

function splitFeedbackLine(line: string) {
  const normalized = line.trim();
  if (!normalized) {
    return [];
  }

  const numberedSegments = normalized
    .split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/u)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (numberedSegments.length > 1) {
    return numberedSegments;
  }

  if (normalized.length > 180) {
    const sentenceSegments = normalized
      .split(/(?<=[.!?。])/u)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (sentenceSegments.length > 1) {
      return sentenceSegments;
    }
  }

  return [normalized];
}

function inferGroups(lines: string[], t: (key: string) => string) {
  const strengths: string[] = [];
  const improvements: string[] = [];
  const neutral: string[] = [];
  let current: "strength" | "improvement" | "neutral" = "neutral";

  // Get localized keywords for grouping
  const strengthKeywords = [
    "điểm mạnh", "良い点", "strength", "tích cực",
    t("project.positive").toLowerCase(),
  ];
  const improvementKeywords = [
    "cải thiện", "改善", "improvement", "thiếu sót",
    t("project.improve").toLowerCase(),
    t("project.issue").toLowerCase(),
  ];

  for (const line of lines) {
    const lowered = line.toLowerCase();
    if (strengthKeywords.some(kw => lowered.includes(kw))) {
      current = "strength";
      strengths.push(line);
      continue;
    }
    if (improvementKeywords.some(kw => lowered.includes(kw))) {
      current = "improvement";
      improvements.push(line);
      continue;
    }

    if (current === "strength") {
      strengths.push(line);
    } else if (current === "improvement") {
      improvements.push(line);
    } else {
      neutral.push(line);
    }
  }

  return { strengths, improvements, neutral };
}

export default function FeedbackPanel({ feedback, language }: FeedbackPanelProps) {
  const { t, lang } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const displayFeedback = useMemo(() => {
    if (!feedback) return null;
    if (typeof feedback === "string") return feedback;
    return feedback[lang] || feedback["ja"] || feedback["vi"] || Object.values(feedback)[0] || "";
  }, [feedback, lang]);

  const lines = useMemo(
    () => (displayFeedback ? displayFeedback.split("\n").map((line) => line.trim()).filter(Boolean) : []),
    [displayFeedback],
  );
  
  const grouped = useMemo(() => inferGroups(lines, t), [lines, t]);

  if (!displayFeedback) {
    return (
      <SectionBlock>
        <SectionBlock.Header title={t("project.feedbackTitle")} subtitle={t("project.noFeedback")} />
      </SectionBlock>
    );
  }

  const visibleNeutral = expanded ? grouped.neutral : grouped.neutral.slice(0, 4);
  const canExpand = grouped.neutral.length > 4;
  const sourceLangLabel = language ? t("project.sourceLanguage", { lang: language.toUpperCase() }) : "";

  return (
    <SectionBlock>
      <SectionBlock.Header
        title={
          <span className="feedback-panel__title">
            <MessageSquareIcon size="md" />
            {t("project.feedbackTitle")}
          </span>
        }
        subtitle={sourceLangLabel}
        aside={
          <button className="btn-secondary btn-secondary--compact" onClick={() => setExpanded((value) => !value)}>
            {expanded ? t("project.collapse") : t("project.expand")}
          </button>
        }
      />
      <SectionBlock.Body className="feedback-panel feedback-panel--enterprise">
        {grouped.strengths.length > 0 ? (
          <FeedbackItem emphasis="success">
            <ul className="feedback-list">
              {grouped.strengths.map((line, index) => (
                <li key={`${line}-${index}`}>
                  <div className="feedback-entry">
                    {splitFeedbackLine(line).map((segment) => (
                      <p key={segment}>{segment}</p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </FeedbackItem>
        ) : null}
        {grouped.improvements.length > 0 ? (
          <FeedbackItem emphasis="warning">
            <ul className="feedback-list">
              {grouped.improvements.map((line, index) => (
                <li key={`${line}-${index}`}>
                  <div className="feedback-entry">
                    {splitFeedbackLine(line).map((segment) => (
                      <p key={segment}>{segment}</p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </FeedbackItem>
        ) : null}
        {visibleNeutral.length > 0 ? (
          <FeedbackItem>
            <ul className="feedback-list">
              {visibleNeutral.map((line, index) => (
                <li key={`${line}-${index}`}>
                  <div className="feedback-entry">
                    {splitFeedbackLine(line).map((segment) => (
                      <p key={segment}>{segment}</p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </FeedbackItem>
        ) : null}
        {!grouped.strengths.length && !grouped.improvements.length && !visibleNeutral.length ? (
          <div className="empty-state-inline">
            <p className="empty-state-inline__title">{t("project.noStructuredTitle")}</p>
            <p className="empty-state-inline__text">{t("project.noStructuredText")}</p>
          </div>
        ) : null}
        {canExpand ? (
          <button className="text-button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? t("project.collapse") : t("project.expand")}
          </button>
        ) : null}
      </SectionBlock.Body>
    </SectionBlock>
  );
}

