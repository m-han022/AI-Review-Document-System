import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RubricCriterion } from "../../../types";

interface RubricScoreAllocationChartProps {
  criteria: RubricCriterion[];
  language: "vi" | "ja";
}

export default function RubricScoreAllocationChart({
  criteria,
  language,
}: RubricScoreAllocationChartProps) {
  const data = criteria.map((criterion) => ({
    key: criterion.key,
    label: criterion.labels[language] ?? criterion.key,
    maxScore: criterion.max_score,
  }));

  return (
    <div className="chart-card chart-card--bar">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 42)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fill: "#64748b", fontSize: 12 }} />
          <YAxis type="category" dataKey="label" width={140} tick={{ fill: "#334155", fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, "Max score"]} />
          <Bar dataKey="maxScore" fill="#2563eb" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
