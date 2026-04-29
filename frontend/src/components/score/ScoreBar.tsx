interface ScoreBarProps {
  label?: string;
  value: number;
  max: number;
  hint?: string;
  showHeader?: boolean;
}

function getToneByRatio(ratio: number) {
  if (ratio >= 0.8) {
    return "success";
  }
  if (ratio >= 0.6) {
    return "warning";
  }
  return "danger";
}

export default function ScoreBar({ label, value, max, hint, showHeader = true }: ScoreBarProps) {
  const safeMax = max || 100;
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const tone = getToneByRatio(ratio);

  return (
    <div className="score-bar">
      {showHeader ? (
        <div className="score-bar__header">
          <div>
            {label ? <p className="score-bar__label">{label}</p> : null}
            {hint ? <p className="score-bar__hint">{hint}</p> : null}
          </div>
          <strong className={`score-bar__value score-bar__value--${tone}`}>
            {value}/{safeMax}
          </strong>
        </div>
      ) : null}
      <div className="score-bar__track">
        <div className={`score-bar__fill score-bar__fill--${tone}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
