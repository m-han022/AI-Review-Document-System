import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface WeakCriteriaItem {
  key: string;
  label: string;
  average: number;
  ratio: number;
}

interface WeakCriteriaChartProps {
  data: WeakCriteriaItem[];
}

export default function WeakCriteriaChart({ data }: WeakCriteriaChartProps) {
  return (
    <div className="chart-card chart-card--bar">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fill: "#334155", fontSize: 12 }}
          />
          <Tooltip formatter={(value) => [`${Number(value ?? 0).toFixed(1)}/100`, "Score"]} />
          <Bar dataKey="average" radius={[0, 6, 6, 0]}>
            {data.map((item) => (
              <Cell
                key={item.key}
                fill={item.ratio < 0.6 ? "#ef4444" : item.ratio < 0.8 ? "#f59e0b" : "#2563eb"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
