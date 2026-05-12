import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Label, Tooltip } from "recharts";
import "./KPICharts.css";

export interface KPIBarChartProps {
  data: {
    key: string;
    label: string;
    value: number;
    max: number;
  }[];
}

export function KPIProgressList({ data, highlightedKey, onHover }: { 
  data: KPIBarChartProps["data"], 
  highlightedKey?: string | null,
  onHover?: (key: string | null) => void 
}) {
  return (
    <div className="kpi-progress-list-v4">
      {data.map((item) => {
        const percent = Math.round((item.value / item.max) * 100);
        const status = percent >= 80 ? 'success' : percent >= 60 ? 'warning' : 'danger';
        const isFocused = highlightedKey === item.key;
        
        return (
          <div 
            key={item.key} 
            className={`kpi-progress-row-v4 ${isFocused ? 'is-focused' : ''} ${highlightedKey && !isFocused ? 'is-dimmed' : ''}`}
            onMouseEnter={() => onHover?.(item.key)}
            onMouseLeave={() => onHover?.(null)}
          >
            <div className="kpi-progress-info-v4">
              <span className="kpi-progress-label-v4">{item.label}</span>
              <span className="kpi-progress-value-v4">{item.value}/{item.max}</span>
            </div>
            <div className="kpi-progress-track-v4">
              <div 
                className={`kpi-progress-fill-v4 kpi-progress-fill-v4--${status}`}
                style={{ width: `${percent}%` }}
              >
                {percent > 15 && <span className="kpi-progress-percent-tag-v4">{percent}%</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface KPIPieChartProps extends KPIBarChartProps {
  highlightedKey?: string | null;
}

export function KPIPieChart({ data, highlightedKey }: KPIPieChartProps) {
  const chartData = useMemo(() => {
    return data.map(item => ({
      key: item.key,
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

  return (
    <div className="kpi-pie-container-v3">
      <div className="kpi-pie-visual">
        <ResponsiveContainer width="100%" height={360}>
          <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={85}
              outerRadius={110}
              paddingAngle={6}
              dataKey="value"
              animationBegin={0}
              animationDuration={1500}
              stroke="#ffffff"
              strokeWidth={3}
            >
              {chartData.map((item, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS_PALETTE[index % COLORS_PALETTE.length]} 
                  opacity={!highlightedKey || highlightedKey === item.key ? 1 : 0.3}
                  stroke={highlightedKey === item.key ? '#000' : '#fff'}
                  strokeWidth={highlightedKey === item.key ? 4 : 2}
                />
              ))}
              <Label 
                content={({ viewBox }) => {
                  const { cx, cy } = (viewBox || {}) as any;
                  if (!cx || !cy) return null;
                  return (
                    <g>
                      <text
                        x={cx}
                        y={cy - 10}
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ fontSize: '12px', fontWeight: 600, fill: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        Score
                      </text>
                      <text
                        x={cx}
                        y={cy + 20}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="pie-center-label"
                      >
                        {totalScore}%
                      </text>
                    </g>
                  );
                }}
              />
            </Pie>
            <Tooltip 
              content={<CustomTooltip />} 
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ zIndex: 1000 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Minimal Tooltip for Recharts
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="chart-tooltip-v3">
        <p className="label">{data.name}</p>
        <p className="value">{data.value}/{data.max}</p>
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
