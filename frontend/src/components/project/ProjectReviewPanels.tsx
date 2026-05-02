import type { ReactNode } from "react";

import SectionBlock from "../ui/SectionBlock";
import Badge from "../ui/Badge";

export interface SummaryLine {
  id: string;
  text: string;
}

export interface HighlightItemView {
  title: string;
  detail: string;
  tone: "success" | "warning" | "danger" | "primary";
}

export interface BreakdownItemView {
  label: string;
  value: number;
}

export interface FeedbackSectionView {
  title: string;
  lines: string[];
}

interface ExecutiveSummaryPanelProps {
  title: string;
  subtitle: string;
  items: SummaryLine[];
}

export function ExecutiveSummaryPanel({ title, subtitle, items }: ExecutiveSummaryPanelProps) {
  return (
    <SectionBlock>
      <SectionBlock.Header title={title} subtitle={subtitle} />
      <SectionBlock.Body>
        <div className="detail-summary-list">
          {items.map((item, index) => (
            <article className="detail-summary-list__item" key={item.id}>
              <span>{index + 1}</span>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </SectionBlock.Body>
    </SectionBlock>
  );
}

interface IssueHighlightsPanelProps {
  title: string;
  subtitle: string;
  items: HighlightItemView[];
}

export function IssueHighlightsPanel({ title, subtitle, items }: IssueHighlightsPanelProps) {
  return (
    <SectionBlock>
      <SectionBlock.Header title={title} subtitle={subtitle} />
      <SectionBlock.Body>
        <div className="detail-highlight-list">
          {items.map((item) => (
            <article
              className={`detail-highlight-card detail-highlight-card--${item.tone}`.trim()}
              key={`${item.title}-${item.detail}`}
            >
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </SectionBlock.Body>
    </SectionBlock>
  );
}

interface FeedbackPreviewPanelProps {
  title: string;
  sections: FeedbackSectionView[];
  emptyText: string;
  detailLabel: string;
  onOpenDetail: () => void;
}

export function FeedbackPreviewPanel({
  title,
  sections,
  emptyText,
  detailLabel,
  onOpenDetail,
}: FeedbackPreviewPanelProps) {
  return (
    <SectionBlock className="detail-feedback-section">
      <SectionBlock.Header
        title={title}
        aside={
          sections.length ? (
            <button className="text-button" type="button" onClick={onOpenDetail}>
              {detailLabel}
            </button>
          ) : null
        }
      />
      <SectionBlock.Body>
        <div className="detail-score-board__summary detail-feedback-preview">
          {sections.length ? (
            sections.map((section, index) => (
              <section className="detail-feedback-section-block" key={`${section.title}-${index}`}>
                {section.title ? <h4>{section.title}</h4> : null}
                {section.lines.map((line, lineIndex) => (
                  <p key={`${section.title}-${lineIndex}`}>{line}</p>
                ))}
              </section>
            ))
          ) : (
            <p>{emptyText}</p>
          )}
        </div>
      </SectionBlock.Body>
    </SectionBlock>
  );
}

interface IssueBreakdownPanelProps {
  title: string;
  subtitle: string;
  items: BreakdownItemView[];
  emptyTitle: string;
  emptyText: string;
}

export function IssueBreakdownPanel({
  title,
  subtitle,
  items,
  emptyTitle,
  emptyText,
}: IssueBreakdownPanelProps) {
  return (
    <SectionBlock>
      <SectionBlock.Header title={title} subtitle={subtitle} />
      <SectionBlock.Body>
        {items.length ? (
          <div className="issue-breakdown-list">
            {items.map((item, index) => (
              <article className="issue-breakdown-item" key={`${item.label}-${index}`}>
                <div className="issue-breakdown-item__copy">
                  <span>{item.label}</span>
                  <small>{((item.value / items[0].value) * 100).toFixed(0)}%</small>
                </div>
                <div className="issue-breakdown-item__bar" aria-hidden="true">
                  <span style={{ width: `${(item.value / items[0].value) * 100}%` }} />
                </div>
                <Badge tone={index === 0 ? "danger" : index < 3 ? "warning" : "default"}>{item.value}</Badge>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state-inline">
            <p className="empty-state-inline__title">{emptyTitle}</p>
            <p className="empty-state-inline__text">{emptyText}</p>
          </div>
        )}
      </SectionBlock.Body>
    </SectionBlock>
  );
}

interface MetadataPanelProps {
  title: string;
  items: Array<{ label: string; value: ReactNode }>;
}

export function MetadataPanel({ title, items }: MetadataPanelProps) {
  return (
    <SectionBlock>
      <SectionBlock.Header title={title} />
      <SectionBlock.Body>
        <div className="detail-overview-strip detail-overview-strip--sidebar">
          {items.map((item) => (
            <div className="detail-overview-strip__item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </SectionBlock.Body>
    </SectionBlock>
  );
}
