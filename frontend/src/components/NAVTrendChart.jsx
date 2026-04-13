import { Card, Empty } from "antd";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function NAVTrendChart({ navResults }) {
  if (!navResults || navResults.length === 0) {
    return (
      <Card title="NAV Per Unit — Trend" style={{ borderRadius: 12, marginBottom: 24 }}>
        <Empty description="No data" />
      </Card>
    );
  }

  const data = navResults.map((r) => ({
    date: r.date,
    Submitted: r.fields?.["NAV Per Unit"]?.submitted ?? null,
    Calculated: r.fields?.["NAV Per Unit"]?.calculated ?? null,
  }));

  const allVals = data.flatMap((d) => [d.Submitted, d.Calculated]).filter((v) => v != null);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const padding = (maxVal - minVal) * 0.1 || 0.5;

  return (
    <Card
      title="NAV Per Unit — Submitted vs Calculated"
      style={{ borderRadius: 12, marginBottom: 24 }}
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            tickFormatter={(v) => v.toFixed(4)}
            tick={{ fontSize: 11 }}
            width={80}
          />
          <Tooltip formatter={(v) => v?.toFixed(4)} />
          <Legend />
          <Line
            type="monotone"
            dataKey="Submitted"
            stroke="#1677ff"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Calculated"
            stroke="#52c41a"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
