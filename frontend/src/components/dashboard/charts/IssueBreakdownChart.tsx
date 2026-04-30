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

const ISSUE_COLORS = ["#ea4e57", "#f29d38", "#f3be4b", "#4b8ef7", "#9aadc4", "#c7d1dc"];

export default function IssueBreakdownChart({ data, totalLabel }: IssueBreakdownChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="chart-card chart-card--donut">
      <div className="chart-card__split">
        <div className="chart-card__canvas">
          <ResponsiveContainer width="100%" height={214}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius={54}
                outerRadius={78}
                paddingAngle={1}
                stroke="#ffffff"
                strokeWidth={2}
              >
                {data.map((item, index) => (
                  <Cell key={item.key} fill={ISSUE_COLORS[index % ISSUE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, totalLabel]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-card__center">
            <span>{totalLabel}</span>
            <strong>{total}</strong>
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
