import { BankOutlined, FundOutlined, LineChartOutlined, TeamOutlined } from "@ant-design/icons";
import { Card, Col, Row, Tag } from "antd";

const fmt = (val, decimals = 2) =>
  val == null ? "—" : Number(val).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export default function KPICards({ dateData, fundInfo, kpi }) {
  if (!kpi) return null;

  const navFields = dateData?.nav_result?.fields ?? {};
  const navPerUnit = navFields["NAV Per Unit"];
  const netAssets = navFields["Net Assets"];
  const unitsOut = navFields["Units Outstanding"];
  const totalInv = navFields["Total Investment"];

  const navMatch =
    navPerUnit &&
    Math.abs(navPerUnit.submitted - navPerUnit.calculated) <= 0.01;

  const cards = [
    {
      title: "Fund",
      value: fundInfo?.name || "—",
      sub: `Code: ${fundInfo?.code || "—"}  •  ${dateData?.date || ""}`,
      icon: <BankOutlined style={{ color: "#1677ff", fontSize: 22 }} />,
      color: "#e6f4ff",
    },
    {
      title: "NAV Per Unit",
      value: navPerUnit ? fmt(navPerUnit.submitted, 4) : "—",
      sub: dateData?.nav_blocked ? (
        <span style={{ color: "#ff4d4f" }}>NAV blocked — portfolio recon failed</span>
      ) : navPerUnit ? (
        <span>
          Calculated:{" "}
          <strong style={{ color: navMatch ? "#52c41a" : "#ff4d4f" }}>
            {fmt(navPerUnit.calculated, 4)}
          </strong>
        </span>
      ) : "—",
      icon: <LineChartOutlined style={{ color: "#52c41a", fontSize: 22 }} />,
      color: "#f6ffed",
    },
    {
      title: "Net Assets",
      value: netAssets ? `SAR ${fmt(netAssets.submitted, 0)}` : "—",
      sub: totalInv ? `Total Investment: SAR ${fmt(totalInv.submitted, 0)}` : "—",
      icon: <FundOutlined style={{ color: "#fa8c16", fontSize: 22 }} />,
      color: "#fff7e6",
    },
    {
      title: "Validation Summary",
      value: unitsOut ? fmt(unitsOut.submitted, 0) : "—",
      sub: (
        <span>
          NAV{" "}
          <Tag color={kpi.dates_nav_passed === kpi.total_dates ? "success" : "error"}>
            {kpi.dates_nav_passed}/{kpi.total_dates} PASSED
          </Tag>
          {kpi.dates_nav_blocked > 0 && (
            <Tag color="default">{kpi.dates_nav_blocked} BLOCKED</Tag>
          )}
          Portfolio{" "}
          <Tag color={kpi.dates_portfolio_passed === kpi.total_dates ? "success" : "error"}>
            {kpi.dates_portfolio_passed}/{kpi.total_dates} OK
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
