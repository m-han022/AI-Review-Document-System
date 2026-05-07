import { useMemo } from "react";
import "./KPICharts.css";

interface KPIBarChartProps {
  data: {
    label: string;
    value: number;
    max: number;
  }[];
}

export function KPIBarChart({ data }: KPIBarChartProps) {
  return (
    <div className="kpi-bar-chart">
      {data.map((item, idx) => {
        const percent = Math.round((item.value / item.max) * 100);
        return (
          <div key={idx} className="kpi-bar-chart__row">
            <div className="kpi-bar-chart__header">
              <span className="kpi-bar-chart__label">{item.label}</span>
              <span className="kpi-bar-chart__value">{item.value}/{item.max}</span>
            </div>
            <div className="kpi-bar-chart__track">
              <div 
                className={`kpi-bar-chart__fill kpi-bar-chart__fill--${percent >= 80 ? 'success' : percent >= 60 ? 'warning' : 'danger'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface DeltaBadgeProps {
  value: number;
  label?: string;
  reverseTone?: boolean;
}

export function DeltaBadge({ value, label, reverseTone = false }: DeltaBadgeProps) {
  if (value === 0) return null;
  
  const isPositive = value > 0;
  const isGood = reverseTone ? !isPositive : isPositive;
  const tone = isGood ? 'success' : 'danger';
  
  return (
    <span className={`kpi-delta-badge kpi-delta-badge--${tone}`}>
      {isPositive ? '+' : ''}{value} {label}
    </span>
  );
}
