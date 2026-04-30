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
    { key: "OK", label: okLabel, value: okCount, color: "#61b986" },
    { key: "NG", label: ngLabel, value: ngCount, color: "#ea4e57" },
  ].filter((item) => item.value > 0);
  const total = okCount + ngCount;

  return (
    <div className="chart-card chart-card--donut chart-card--compact">
      <div className="chart-card__split">
        <div className="chart-card__canvas">
          <ResponsiveContainer width="100%" height={214}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={54}
                outerRadius={78}
                paddingAngle={1}
                stroke="#ffffff"
                strokeWidth={2}
              >
                {data.map((item) => (
                  <Cell key={item.key} fill={item.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, "Slides"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-card__center chart-card__center--compact">
            <span>Slides</span>
            <strong>{total}</strong>
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
    </div>
  );
}
