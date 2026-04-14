import { Card, Empty } from "antd";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#1677ff", "#52c41a", "#fa8c16", "#722ed1", "#eb2f96", "#13c2c2", "#faad14"];

const fmt = (v) =>
  Number(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0];
  return (
    <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ fontWeight: 700 }}>{name}</div>
      <div>SAR {fmt(value)}</div>
      <div style={{ color: "#8c8c8c" }}>{(percent * 100).toFixed(1)}% of portfolio</div>
    </div>
  );
};

const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

export default function SectorPieChart({ portfolioSummary }) {
  if (!portfolioSummary || portfolioSummary.length === 0) {
    return (
      <Card title="Portfolio — Sector Allocation" style={{ borderRadius: 12, marginBottom: 24 }}>
        <Empty description="No data" />
      </Card>
    );
  }

  // Aggregate market value by sector (use system report value; fall back to custodian)
  const sectorMap = {};
  for (const row of portfolioSummary) {
    const sector = row.sector || "Other";
    const mv = row.market_value_sys ?? row.market_value_cust ?? 0;
    sectorMap[sector] = (sectorMap[sector] ?? 0) + mv;
  }

  const data = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <Card title="Portfolio — Sector Allocation (Market Value)" style={{ borderRadius: 12, marginBottom: 24 }}>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={110}
            dataKey="value"
            labelLine={false}
            label={renderLabel}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => <span style={{ fontSize: 13 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
