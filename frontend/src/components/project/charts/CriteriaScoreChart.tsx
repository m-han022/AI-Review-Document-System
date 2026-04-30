interface CriteriaScoreChartItem {
  key: string;
  label: string;
  value: number;
  max: number;
}

interface CriteriaScoreChartProps {
  data: CriteriaScoreChartItem[];
}

export default function CriteriaScoreChart({ data }: CriteriaScoreChartProps) {
  return (
    <div className="chart-card chart-card--criteria">
      <div className="criteria-score-list">
        {data.map((item) => {
          const percent = item.max > 0 ? Math.max(0, Math.min(100, (item.value / item.max) * 100)) : 0;
          return (
            <article className="criteria-score-row" key={item.key}>
              <div className="criteria-score-row__label" title={item.label}>{item.label}</div>
              <div className="criteria-score-row__track" aria-hidden="true">
                <span className="criteria-score-row__fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="criteria-score-row__value">
                <strong>{item.value}</strong>
                <span>/{item.max}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
