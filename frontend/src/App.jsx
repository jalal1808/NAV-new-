import {
  AuditOutlined,
  BarChartOutlined,
  CloudUploadOutlined,
  DashboardOutlined,
  FundProjectionScreenOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { Alert, Layout, Menu, Spin, Typography } from "antd";
import { useState } from "react";

import { Col, Row } from "antd";
import DateSelector from "./components/DateSelector";
import FileUpload from "./components/FileUpload";
import KPICards from "./components/KPICards";
import NAVDiffChart from "./components/NAVDiffChart";
import NAVFieldChart from "./components/NAVFieldChart";
import NAVTrendChart from "./components/NAVTrendChart";
import NAVValidationTable from "./components/NAVValidationTable";
import PortfolioBarChart from "./components/PortfolioBarChart";
import PortfolioTable from "./components/PortfolioTable";
import SectorPieChart from "./components/SectorPieChart";

const { Sider, Content, Header } = Layout;
const { Title, Text } = Typography;

const NAV_KEY = "nav";
const PORTFOLIO_KEY = "portfolio";
const UPLOAD_KEY = "upload";

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeKey, setActiveKey] = useState(UPLOAD_KEY);
  const [selectedDate, setSelectedDate] = useState(null);

  const handleResult = (result) => {
    if (result.error) {
      setData({ error: result.error });
    } else {
      setData(result);
      if (result.dates?.length > 0) {
        setSelectedDate(result.dates[0].date);
      }
      setActiveKey(NAV_KEY);
    }
  };

  const hasData = data && !data.error;

  const currentDateData = hasData
    ? data.dates?.find((d) => d.date === selectedDate) ?? null
    : null;

  const menuItems = [
    { key: UPLOAD_KEY, icon: <CloudUploadOutlined />, label: "Upload File" },
    { key: NAV_KEY, icon: <DashboardOutlined />, label: "NAV Validation", disabled: !hasData },
    { key: PORTFOLIO_KEY, icon: <BarChartOutlined />, label: "Portfolio Recon", disabled: !hasData },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* ── Sidebar ─────────────────────────────── */}
      <Sider
        width={220}
        style={{
          background: "linear-gradient(180deg, #001529 0%, #002953 100%)",
          position: "fixed",
          height: "100vh",
          left: 0,
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FundProjectionScreenOutlined style={{ color: "#1677ff", fontSize: 24 }} />
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>NAV Validator</div>
              <div style={{ color: "#8c8c8c", fontSize: 11 }}>Fund Operations</div>
            </div>
          </div>
        </div>

        {hasData && (
          <div style={{ padding: "10px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color: "#1677ff", fontSize: 12, fontWeight: 600 }}>{data.fund_info?.name || "—"}</div>
            <div style={{ color: "#8c8c8c", fontSize: 11 }}>
              Code: {data.fund_info?.code || "—"} • {data.dates?.length ?? 0} date(s)
            </div>
          </div>
        )}

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          onClick={({ key }) => setActiveKey(key)}
          items={menuItems}
          style={{ background: "transparent", border: "none", marginTop: 8 }}
        />

        <div style={{ position: "absolute", bottom: 20, left: 20, right: 20, color: "#434343", fontSize: 11 }}>
          <AuditOutlined style={{ marginRight: 6 }} />
          NAV Validation System
        </div>
      </Sider>

      {/* ── Main area ───────────────────────────── */}
      <Layout style={{ marginLeft: 220 }}>
        <Header
          style={{
            background: "#fff",
            padding: "0 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
            position: "sticky",
            top: 0,
            zIndex: 99,
          }}
        >
          <Title level={4} style={{ margin: 0, color: "#141414" }}>
            {activeKey === UPLOAD_KEY && "Upload NAV File"}
            {activeKey === NAV_KEY && "NAV Validation"}
            {activeKey === PORTFOLIO_KEY && "Portfolio Reconciliation"}
          </Title>
          {hasData && (
            <Text type="secondary" style={{ fontSize: 12 }}>{data.filename}</Text>
          )}
        </Header>

        <Content style={{ padding: "24px 28px", background: "#f5f7fa" }}>
          <Spin spinning={loading} tip="Validating...">

            {/* ── Upload page ─────────────────────── */}
            {activeKey === UPLOAD_KEY && (
              <div style={{ maxWidth: 640, margin: "40px auto 0" }}>
                <FileUpload onResult={handleResult} onLoading={setLoading} />
                {data?.error && (
                  <Alert type="error" message={data.error} style={{ marginTop: 20, borderRadius: 8 }} showIcon />
                )}
              </div>
            )}

            {/* ── NAV Validation page ─────────────── */}
            {activeKey === NAV_KEY && hasData && (
              <>
                <KPICards dateData={currentDateData} fundInfo={data.fund_info} kpi={data.kpi} />
                <DateSelector dates={data.dates} selectedDate={selectedDate} onChange={setSelectedDate} />

                {/* Row 1: trend line + diff bar side by side */}
                <Row gutter={16}>
                  <Col xs={24} lg={14}>
                    <NAVTrendChart dates={data.dates} selectedDate={selectedDate} />
                  </Col>
                  <Col xs={24} lg={10}>
                    <NAVDiffChart dates={data.dates} />
                  </Col>
                </Row>

                {/* Row 2: field breakdown + blocked alert / table */}
                {currentDateData?.nav_blocked ? (
                  <Alert
                    type="error"
                    icon={<LockOutlined />}
                    showIcon
                    message="NAV Blocked"
                    description={currentDateData.nav_block_reason}
                    style={{ borderRadius: 8, marginBottom: 24 }}
                  />
                ) : (
                  <Row gutter={16}>
                    <Col xs={24} lg={12}>
                      <NAVFieldChart navResult={currentDateData?.nav_result} />
                    </Col>
                    <Col xs={24} lg={12}>
                      <NAVValidationTable navResult={currentDateData?.nav_result} />
                    </Col>
                  </Row>
                )}
              </>
            )}

            {/* ── Portfolio page ───────────────────── */}
            {activeKey === PORTFOLIO_KEY && hasData && (
              <>
                <KPICards dateData={currentDateData} fundInfo={data.fund_info} kpi={data.kpi} />
                <DateSelector dates={data.dates} selectedDate={selectedDate} onChange={setSelectedDate} />

                {/* Row 1: sector pie + market value bar side by side */}
                <Row gutter={16}>
                  <Col xs={24} lg={10}>
                    <SectorPieChart portfolioSummary={currentDateData?.portfolio_summary} />
                  </Col>
                  <Col xs={24} lg={14}>
                    <PortfolioBarChart portfolioSummary={currentDateData?.portfolio_summary} />
                  </Col>
                </Row>

                {/* Row 2: full reconciliation table */}
                <PortfolioTable
                  portfolioSummary={currentDateData?.portfolio_summary}
                  portfolioStatus={currentDateData?.portfolio_status}
                />
              </>
            )}

          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
}
