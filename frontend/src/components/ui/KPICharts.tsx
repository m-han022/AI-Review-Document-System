import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts";
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

export function KPIPieChart({ data }: KPIBarChartProps) {
  const chartData = useMemo(() => {
    return data.map(item => ({
      name: item.label,
      value: item.value,
      max: item.max,
      percent: (item.value / item.max) * 100
    }));
  }, [data]);

  const totalScore = useMemo(() => {
    const sumVal = data.reduce((acc, curr) => acc + curr.value, 0);
    const sumMax = data.reduce((acc, curr) => acc + curr.max, 0);
    return Math.round((sumVal / sumMax) * 100);
  }, [data]);

  const COLORS_PALETTE = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
  ];

  const STATUS_COLORS = {
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444'
  };

  return (
    <div className="kpi-pie-container-v3">
      <div className="kpi-pie-visual">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={75}
              outerRadius={95}
              paddingAngle={4}
              dataKey="value"
              animationBegin={0}
              animationDuration={1200}
            >
              {chartData.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS_PALETTE[index % COLORS_PALETTE.length]} 
                  stroke="#ffffff" 
                  strokeWidth={2}
                />
              ))}
              <Label 
                value={`${totalScore}%`} 
                position="center" 
                className="pie-center-label"
              />
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="kpi-pie-legend">
        {chartData.map((item, idx) => {
          const statusColor = item.percent >= 80 ? STATUS_COLORS.success : item.percent >= 60 ? STATUS_COLORS.warning : STATUS_COLORS.danger;
          const sliceColor = COLORS_PALETTE[idx % COLORS_PALETTE.length];
          return (
            <div key={idx} className="kpi-legend-item">
              <span className="kpi-legend-dot" style={{ background: sliceColor }} />
              <span className="kpi-legend-text">{item.name}</span>
              <span className="kpi-legend-status-dot" style={{ background: statusColor }} title="Status Indicator" />
              <span className="kpi-legend-score">{item.value}/{item.max}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Minimal Tooltip for Recharts
const Tooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="chart-tooltip-v3">
        <p className="label">{`${data.name} : ${data.value}/${data.max}`}</p>
      </div>
    );
  }
  return null;
};

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
