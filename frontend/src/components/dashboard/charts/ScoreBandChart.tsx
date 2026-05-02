interface ScoreBandChartProps {
  highCount: number;
  lowCount: number;
  highLabel: string;
  lowLabel: string;
}

export default function ScoreBandChart({
  highCount,
  lowCount,
  highLabel,
  lowLabel,
}: ScoreBandChartProps) {
  const total = highCount + lowCount;
  const highWidth = total > 0 ? (highCount / total) * 100 : 0;
  const lowWidth = total > 0 ? (lowCount / total) * 100 : 0;

  return (
    <div className="chart-card chart-card--score-band">
      <div className="score-band-chart">
        <div className="score-band-chart__bar" aria-hidden="true">
          <span className="score-band-chart__segment score-band-chart__segment--high" style={{ width: `${highWidth}%` }} />
          <span className="score-band-chart__segment score-band-chart__segment--low" style={{ width: `${lowWidth}%` }} />
        </div>

        <div className="score-band-chart__legend">
          <div className="score-band-chart__item">
            <span className="score-band-chart__dot score-band-chart__dot--high" />
            <span>{highLabel}</span>
            <strong>{highCount}</strong>
          </div>
          <div className="score-band-chart__item">
            <span className="score-band-chart__dot score-band-chart__dot--low" />
            <span>{lowLabel}</span>
            <strong>{lowCount}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
