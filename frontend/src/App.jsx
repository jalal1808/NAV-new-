import {
  AuditOutlined,
  BarChartOutlined,
  CloudUploadOutlined,
  DashboardOutlined,
  FundProjectionScreenOutlined,
} from "@ant-design/icons";
import { Layout, Menu, Spin, Typography } from "antd";
import { useState } from "react";

import FileUpload from "./components/FileUpload";
import KPICards from "./components/KPICards";
import NAVTrendChart from "./components/NAVTrendChart";
import NAVValidationTable from "./components/NAVValidationTable";
import PortfolioTable from "./components/PortfolioTable";

const { Sider, Content, Header } = Layout;
const { Title, Text } = Typography;

const NAV_KEY = "nav";
const PORTFOLIO_KEY = "portfolio";
const UPLOAD_KEY = "upload";

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeKey, setActiveKey] = useState(UPLOAD_KEY);

  const handleResult = (result) => {
    setData(result);
    setActiveKey(NAV_KEY); // jump to dashboard after upload
  };

  const hasData = data && !data.error;

  const menuItems = [
    {
      key: UPLOAD_KEY,
      icon: <CloudUploadOutlined />,
      label: "Upload File",
    },
    {
      key: NAV_KEY,
      icon: <DashboardOutlined />,
      label: "NAV Validation",
      disabled: !hasData,
    },
    {
      key: PORTFOLIO_KEY,
      icon: <BarChartOutlined />,
      label: "Portfolio Recon",
      disabled: !hasData,
    },
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
        {/* Logo area */}
        <div
          style={{
            padding: "24px 20px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FundProjectionScreenOutlined style={{ color: "#1677ff", fontSize: 24 }} />
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
                NAV Validator
              </div>
              <div style={{ color: "#8c8c8c", fontSize: 11 }}>Fund Operations</div>
            </div>
          </div>
        </div>

        {hasData && (
          <div style={{ padding: "10px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color: "#1677ff", fontSize: 12, fontWeight: 600 }}>
              {data.fund_info?.name || "—"}
            </div>
            <div style={{ color: "#8c8c8c", fontSize: 11 }}>
              Code: {data.fund_info?.code || "—"} • {data.kpi?.latest_date || ""}
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

        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            right: 20,
            color: "#434343",
            fontSize: 11,
          }}
        >
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
            <Text type="secondary" style={{ fontSize: 12 }}>
              {data.filename}
            </Text>
          )}
        </Header>

        <Content style={{ padding: "24px 28px", background: "#f5f7fa" }}>
          <Spin spinning={loading} tip="Validating...">
            {/* ── Upload page ──────────────────────── */}
            {activeKey === UPLOAD_KEY && (
              <div style={{ maxWidth: 640, margin: "40px auto 0" }}>
                <FileUpload onResult={handleResult} onLoading={setLoading} />
              </div>
            )}

            {/* ── NAV Validation page ───────────────── */}
            {activeKey === NAV_KEY && hasData && (
              <>
                <KPICards kpi={data.kpi} fundInfo={data.fund_info} />
                <NAVTrendChart navResults={data.nav_results} />
                <NAVValidationTable navResults={data.nav_results} />
              </>
            )}

            {/* ── Portfolio page ────────────────────── */}
            {activeKey === PORTFOLIO_KEY && hasData && (
              <>
                <KPICards kpi={data.kpi} fundInfo={data.fund_info} />
                <PortfolioTable portfolioSummary={data.portfolio_summary} />
              </>
            )}
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
}
