import { Card, Empty } from "antd";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function NAVTrendChart({ dates, selectedDate }) {
  if (!dates || dates.length === 0) {
    return (
      <Card title="NAV Per Unit — Trend" style={{ borderRadius: 12, marginBottom: 24 }}>
        <Empty description="No data" />
      </Card>
    );
  }

  // Only plot dates where NAV was not blocked
  const data = dates
    .filter((d) => !d.nav_blocked && d.nav_result)
    .map((d) => ({
      date: d.date,
      "Calculated NAV": d.nav_result.fields?.["NAV Per Unit"]?.submitted ?? null,
      "Submitted NAV": d.nav_result.fields?.["NAV Per Unit"]?.calculated ?? null,
    }));

  if (data.length === 0) {
    return (
      <Card title="NAV Per Unit — Trend" style={{ borderRadius: 12, marginBottom: 24 }}>
        <Empty description="No unblocked NAV dates to chart" />
      </Card>
    );
  }

  const allVals = data.flatMap((d) => [d["Calculated NAV"], d["Submitted NAV"]]).filter((v) => v != null);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const padding = (maxVal - minVal) * 0.1 || 0.5;

  return (
    <Card
      title="NAV Per Unit — Calculated NAV vs Submitted NAV (all dates)"
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
          {/* Highlight selected date */}
          {selectedDate && data.find((d) => d.date === selectedDate) && (
            <ReferenceLine
              x={selectedDate}
              stroke="#faad14"
              strokeWidth={2}
              strokeDasharray="4 2"
              label={{ value: "Selected", position: "top", fontSize: 11, fill: "#faad14" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="Calculated NAV"
            stroke="#1677ff"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Submitted NAV"
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
