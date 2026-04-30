import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";

interface ScoreGaugeChartProps {
  score: number;
  label: string;
  statusLabel: string;
}

const SCORE_COLORS = {
  success: "#2563eb",
  warning: "#f59e0b",
  danger: "#ef4444",
  track: "#e5edf8",
  text: "#0f172a",
  muted: "#64748b",
};

function getScoreTone(score: number) {
  if (score >= 80) {
    return SCORE_COLORS.success;
  }
  if (score >= 60) {
    return SCORE_COLORS.warning;
  }
  return SCORE_COLORS.danger;
}

export default function ScoreGaugeChart({ score, label, statusLabel }: ScoreGaugeChartProps) {
  const normalized = Math.max(0, Math.min(100, score));
  const toneColor = getScoreTone(normalized);
  const data = [{ name: label, value: normalized, fill: toneColor }];
  const toneClass = normalized >= 80 ? "is-success" : normalized >= 60 ? "is-warning" : "is-danger";

  return (
    <div className="chart-card chart-card--gauge">
      <div className="chart-card__canvas">
        <ResponsiveContainer width="100%" height={240}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="92%"
            barSize={12}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: SCORE_COLORS.track }} dataKey="value" cornerRadius={999} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="chart-card__center">
          <strong>{normalized.toFixed(0)}</strong>
          <span>/100</span>
        </div>
      </div>
      <div className="chart-card__footer chart-card__footer--stacked">
        <span className={`chart-pill ${toneClass}`} style={{ color: toneColor }}>{statusLabel}</span>
        <small>{label}</small>
      </div>
    </div>
  );
}
