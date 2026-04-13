import { BankOutlined, FundOutlined, LineChartOutlined, TeamOutlined } from "@ant-design/icons";
import { Card, Col, Row, Statistic, Tag } from "antd";

const fmt = (val, decimals = 2) =>
  val == null ? "—" : Number(val).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export default function KPICards({ kpi, fundInfo }) {
  if (!kpi || Object.keys(kpi).length === 0) return null;

  const navMatch =
    kpi.nav_per_unit != null &&
    kpi.calculated_nav_per_unit != null &&
    Math.abs(kpi.nav_per_unit - kpi.calculated_nav_per_unit) <= 0.01;

  const cards = [
    {
      title: "Fund",
      value: fundInfo?.name || "—",
      sub: `Code: ${fundInfo?.code || "—"}  •  ${kpi.latest_date || ""}`,
      icon: <BankOutlined style={{ color: "#1677ff", fontSize: 22 }} />,
      color: "#e6f4ff",
    },
    {
      title: "NAV Per Unit",
      value: fmt(kpi.nav_per_unit, 4),
      sub: (
        <span>
          Calculated:{" "}
          <strong style={{ color: navMatch ? "#52c41a" : "#ff4d4f" }}>
            {fmt(kpi.calculated_nav_per_unit, 4)}
          </strong>
        </span>
      ),
      icon: <LineChartOutlined style={{ color: "#52c41a", fontSize: 22 }} />,
      color: "#f6ffed",
    },
    {
      title: "Net Assets",
      value: `SAR ${fmt(kpi.net_assets, 0)}`,
      sub: `Total Investment: SAR ${fmt(kpi.total_investment, 0)}`,
      icon: <FundOutlined style={{ color: "#fa8c16", fontSize: 22 }} />,
      color: "#fff7e6",
    },
    {
      title: "Units Outstanding",
      value: fmt(kpi.units_outstanding, 0),
      sub: (
        <span>
          NAV dates{" "}
          <Tag color={kpi.dates_passed === kpi.total_dates ? "success" : "error"}>
            {kpi.dates_passed}/{kpi.total_dates} PASSED
          </Tag>
          &nbsp;Portfolio{" "}
          <Tag color={kpi.portfolio_passed === kpi.portfolio_checks ? "success" : "error"}>
            {kpi.portfolio_passed}/{kpi.portfolio_checks} OK
          </Tag>
        </span>
      ),
      icon: <TeamOutlined style={{ color: "#722ed1", fontSize: 22 }} />,
      color: "#f9f0ff",
    },
  ];

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      {cards.map((c) => (
        <Col xs={24} sm={12} lg={6} key={c.title}>
          <Card
            style={{ borderRadius: 12, background: c.color, border: "none" }}
            styles={{ body: { padding: "20px 24px" } }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#8c8c8c", fontSize: 12, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>
                  {c.title}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#141414", marginBottom: 4 }}>
                  {c.value}
                </div>
                <div style={{ fontSize: 12, color: "#595959" }}>{c.sub}</div>
              </div>
              <div style={{ marginLeft: 12, marginTop: 2 }}>{c.icon}</div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
