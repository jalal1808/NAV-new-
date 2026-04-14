import { Card, Empty } from "antd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOLERANCE = 0.01;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const diff = payload[0].value;
  const ok = Math.abs(diff) <= TOLERANCE;
  return (
    <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ color: ok ? "#52c41a" : "#ff4d4f" }}>
        Difference: {diff > 0 ? "+" : ""}{diff.toFixed(4)}
      </div>
      <div style={{ color: "#8c8c8c", fontSize: 11 }}>
        {ok ? "Within tolerance" : `Exceeds ±${TOLERANCE} tolerance`}
      </div>
    </div>
  );
};

export default function NAVDiffChart({ dates }) {
  if (!dates || dates.length === 0) return null;

  const data = dates
    .filter((d) => !d.nav_blocked && d.nav_result)
    .map((d) => {
      const f = d.nav_result.fields?.["NAV Per Unit"];
      const diff = f ? f.submitted - f.calculated : 0;
      return { date: d.date, diff: parseFloat(diff.toFixed(4)) };
    });

  if (data.length === 0) return null;

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.diff)), TOLERANCE * 2);

  return (
    <Card
      title="NAV Per Unit — Difference per Date"
      style={{ borderRadius: 12, marginBottom: 24 }}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis
            domain={[-maxAbs * 1.2, maxAbs * 1.2]}
            tickFormatter={(v) => v.toFixed(4)}
            tick={{ fontSize: 11 }}
            width={72}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#595959" strokeWidth={1} />
          <ReferenceLine y={TOLERANCE} stroke="#52c41a" strokeDasharray="4 2" strokeWidth={1}
            label={{ value: `+${TOLERANCE}`, position: "right", fontSize: 10, fill: "#52c41a" }} />
          <ReferenceLine y={-TOLERANCE} stroke="#52c41a" strokeDasharray="4 2" strokeWidth={1}
            label={{ value: `-${TOLERANCE}`, position: "right", fontSize: 10, fill: "#52c41a" }} />
          <Bar dataKey="diff" radius={[4, 4, 0, 0]} maxBarSize={60}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={Math.abs(entry.diff) <= TOLERANCE ? "#52c41a" : "#ff4d4f"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
