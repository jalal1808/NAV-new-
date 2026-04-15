import { Card } from "antd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOLERANCE = 0.01;

// Fields shown in the chart — exclude derived/redundant ones
const CHART_FIELDS = [
  "Total Investment",
  "Cash",
  "Assets Before fee & Exp",
  "Management Fee",
  "Total Expenses",
  "Net Assets",
];

const fmt = (v) =>
  Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toFixed(2)}M`
    : Math.abs(v) >= 1_000
    ? `${(v / 1_000).toFixed(1)}K`
    : v.toFixed(2);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
      ))}
    </div>
  );
};

export default function NAVFieldChart({ navResult }) {
  if (!navResult?.fields) return null;

  const data = CHART_FIELDS
    .filter((f) => navResult.fields[f])
    .map((field) => {
      const { submitted, calculated } = navResult.fields[field];
      return {
        field: field.replace("Assets Before fee & Exp", "Assets b/f Exp"),
        submitted,
        calculated,
        diff: submitted - calculated,
      };
    });

  return (
    <Card
      title={`NAV Fields — Submitted vs Calculated (${navResult.date})`}
      style={{ borderRadius: 12, marginBottom: 24 }}
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 80, left: 140, bottom: 5 }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis
            type="number"
            tickFormatter={fmt}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="field"
            tick={{ fontSize: 12 }}
            width={140}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="submitted" name="Calculated NAV" fill="#1677ff" fillOpacity={0.85} radius={[0, 4, 4, 0]} barSize={10}>
            <LabelList dataKey="submitted" position="right" formatter={fmt} style={{ fontSize: 10, fill: "#595959" }} />
          </Bar>
          <Bar dataKey="calculated" name="Submitted NAV" fill="#52c41a" fillOpacity={0.85} radius={[0, 4, 4, 0]} barSize={10}>
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
