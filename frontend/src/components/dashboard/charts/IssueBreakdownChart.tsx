import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface IssueBreakdownItem {
  key: string;
  label: string;
  count: number;
}

interface IssueBreakdownChartProps {
  data: IssueBreakdownItem[];
  totalLabel: string;
}

const ISSUE_COLORS = ["#ef4444", "#f59e0b", "#fbbf24", "#3b82f6", "#94a3b8", "#64748b"];

export default function IssueBreakdownChart({ data, totalLabel }: IssueBreakdownChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="chart-card chart-card--donut">
      <div className="chart-card__split">
        <div className="chart-card__canvas">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius={54}
                outerRadius={84}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((item, index) => (
                  <Cell key={item.key} fill={ISSUE_COLORS[index % ISSUE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, totalLabel]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-card__center">
            <strong>{total}</strong>
            <span>{totalLabel}</span>
          </div>
        </div>

        <div className="chart-legend">
          {data.map((item, index) => (
            <div className="chart-legend__item" key={item.key}>
              <span className="chart-legend__dot" style={{ backgroundColor: ISSUE_COLORS[index % ISSUE_COLORS.length] }} />
              <span className="chart-legend__label">{item.label}</span>
              <strong className="chart-legend__value">{item.count}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
