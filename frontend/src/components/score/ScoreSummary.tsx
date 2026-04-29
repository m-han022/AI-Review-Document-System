import { useTranslation } from "../LanguageSelector";
import Badge from "../ui/Badge";

interface ScoreSummaryProps {
  score: number;
  statusLabel?: string;
  label?: string;
}

function getTone(score: number) {
  if (score >= 80) {
    return "success";
  }
  if (score >= 60) {
    return "warning";
  }
  return "danger";
}

export default function ScoreSummary({ score, statusLabel, label }: ScoreSummaryProps) {
  const tone = getTone(score);
  const { t } = useTranslation();

  return (
    <div className="score-summary">
      <div>
        <p className="score-summary__eyebrow">{label ?? t("upload.overallScore")}</p>
        <div className="score-summary__value-wrap">
          <strong className={`score-summary__value score-summary__value--${tone}`}>{score}</strong>
          <span className="score-summary__scale">/100</span>
        </div>
      </div>
      {statusLabel ? <Badge tone={tone}>{statusLabel}</Badge> : null}
    </div>
  );
}
