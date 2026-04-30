import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  const chartData = data.map((item) => ({
    ...item,
    percent: item.max > 0 ? Number(((item.value / item.max) * 100).toFixed(1)) : 0,
  }));

  return (
    <div className="chart-card chart-card--bar">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 46)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 12 }} />
          <YAxis type="category" dataKey="label" width={130} tick={{ fill: "#334155", fontSize: 12 }} />
          <Tooltip
            formatter={(_value, _name, payload) => {
              const item = payload?.payload as CriteriaScoreChartItem & { percent: number };
              return [`${item.value}/${item.max}`, "Score"];
            }}
          />
          <Bar dataKey="percent" fill="#2563eb" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
