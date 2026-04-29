import type { ReactNode } from "react";

interface FeedbackItemProps {
  title?: string;
  children: ReactNode;
  emphasis?: "neutral" | "success" | "warning";
}

export default function FeedbackItem({
  title,
  children,
  emphasis = "neutral",
}: FeedbackItemProps) {
  return (
    <div className={`feedback-item feedback-item--${emphasis}`}>
      {title ? <div className="feedback-item__title">{title}</div> : null}
      <div className="feedback-item__content">{children}</div>
    </div>
  );
}
