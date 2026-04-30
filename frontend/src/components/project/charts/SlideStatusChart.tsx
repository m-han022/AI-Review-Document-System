import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface SlideStatusChartProps {
  okCount: number;
  ngCount: number;
  okLabel: string;
  ngLabel: string;
}

export default function SlideStatusChart({
  okCount,
  ngCount,
  okLabel,
  ngLabel,
}: SlideStatusChartProps) {
  const data = [
    { key: "OK", label: okLabel, value: okCount, color: "#22c55e" },
    { key: "NG", label: ngLabel, value: ngCount, color: "#ef4444" },
  ].filter((item) => item.value > 0);
  const total = okCount + ngCount;

  return (
    <div className="chart-card chart-card--donut chart-card--compact">
      <div className="chart-card__canvas">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={40} outerRadius={68} stroke="none">
              {data.map((item) => (
                <Cell key={item.key} fill={item.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, "Slides"]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="chart-card__center chart-card__center--compact">
          <strong>{total}</strong>
          <span>Slides</span>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((item) => (
          <div className="chart-legend__item" key={item.key}>
            <span className="chart-legend__dot" style={{ backgroundColor: item.color }} />
            <span className="chart-legend__label">{item.label}</span>
            <strong className="chart-legend__value">{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
