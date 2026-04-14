import { Card, Empty } from "antd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOLERANCE = 0.01;

const fmt = (v) =>
  Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toFixed(2)}M`
    : `${(v / 1_000).toFixed(0)}K`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const sys = payload.find((p) => p.dataKey === "market_value_sys");
  const cust = payload.find((p) => p.dataKey === "market_value_cust");
  const diff = sys && cust ? sys.value - cust.value : null;
  const ok = diff === null || Math.abs(diff) <= TOLERANCE;
  return (
    <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Stock {label}</div>
      {sys && <div style={{ color: "#1677ff" }}>System: SAR {Number(sys.value).toLocaleString()}</div>}
      {cust && <div style={{ color: "#52c41a" }}>Custodian: SAR {Number(cust.value).toLocaleString()}</div>}
      {diff !== null && (
        <div style={{ color: ok ? "#52c41a" : "#ff4d4f", marginTop: 4, fontWeight: ok ? 400 : 700 }}>
          {ok ? "✓ Match" : `✗ Diff: ${diff > 0 ? "+" : ""}${Number(diff).toLocaleString()}`}
        </div>
      )}
    </div>
  );
};

export default function PortfolioBarChart({ portfolioSummary }) {
  if (!portfolioSummary || portfolioSummary.length === 0) {
    return (
      <Card title="Market Value — System vs Custodian" style={{ borderRadius: 12, marginBottom: 24 }}>
        <Empty description="No data" />
      </Card>
    );
  }

  const data = portfolioSummary
    .filter((r) => r.market_value_sys != null || r.market_value_cust != null)
    .map((r) => ({
      stock: r.stock,
      market_value_sys: r.market_value_sys ?? 0,
      market_value_cust: r.market_value_cust ?? 0,
      hasDiscrepancy:
        Math.abs((r.market_value_sys ?? 0) - (r.market_value_cust ?? 0)) > TOLERANCE,
    }));

  return (
    <Card
      title="Market Value — System Report vs Custodian (per Stock)"
      style={{ borderRadius: 12, marginBottom: 24 }}
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="stock" tick={{ fontSize: 13, fontWeight: 600 }} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={60} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(v) => (
              <span style={{ fontSize: 13 }}>
                {v === "market_value_sys" ? "System Report" : "Custodian"}
              </span>
            )}
          />
          <Bar dataKey="market_value_sys" name="market_value_sys" fill="#1677ff" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="market_value_cust" name="market_value_cust" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.hasDiscrepancy ? "#ff4d4f" : "#52c41a"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
