import { Card, Table, Tag, Tooltip } from "antd";

const fmt = (v, dec = 2) =>
  v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const DiffCell = ({ sys, cust, dec = 2, tol = 0.01 }) => {
  if (sys == null || cust == null) {
    const missing = sys == null ? "System Report" : "Custodian";
    return <Tag color="error">Missing in {missing}</Tag>;
  }
  const diff = sys - cust;
  const ok = Math.abs(diff) <= tol;
  return (
    <Tooltip title={ok ? "Match" : `Diff: ${diff > 0 ? "+" : ""}${fmt(diff, dec)}`}>
      <Tag color={ok ? "success" : "error"} style={{ fontWeight: ok ? 400 : 700 }}>
        {ok ? "✓" : `✗ ${diff > 0 ? "+" : ""}${fmt(diff, dec)}`}
      </Tag>
    </Tooltip>
  );
};

const columns = [
  { title: "Stock", dataIndex: "stock", key: "stock", width: 90, render: (v) => <strong>{v}</strong> },
  { title: "Sector", dataIndex: "sector", key: "sector", width: 110 },
  { title: "ISIN", dataIndex: "isin", key: "isin", width: 150, render: (v) => v || "—" },
  {
    title: "Quantity",
    key: "qty",
    align: "right",
    render: (_, r) => (
      <span>
        {fmt(r.quantity_sys, 0)}{" "}
        <DiffCell sys={r.quantity_sys} cust={r.quantity_cust} dec={0} tol={0} />
      </span>
    ),
  },
  {
    title: "Cost Price",
    dataIndex: "cost_price",
    key: "cost_price",
    align: "right",
    render: (v) => fmt(v, 2),
  },
  {
    title: "Price",
    key: "price",
    align: "right",
    render: (_, r) => (
      <span>
        {fmt(r.price_sys, 4)}{" "}
        <DiffCell sys={r.price_sys} cust={r.price_cust} dec={4} tol={0.01} />
      </span>
    ),
  },
  {
    title: "Market Value",
    key: "mv",
    align: "right",
    render: (_, r) => (
      <span>
        {fmt(r.market_value_sys, 0)}{" "}
        <DiffCell sys={r.market_value_sys} cust={r.market_value_cust} dec={0} tol={0.01} />
      </span>
    ),
  },
];

export default function PortfolioTable({ portfolioSummary }) {
  if (!portfolioSummary || portfolioSummary.length === 0) return null;

  const dataSource = portfolioSummary.map((r, i) => ({ ...r, key: i }));

  const totalFail = portfolioSummary.filter(
    (r) =>
      Math.abs((r.quantity_sys ?? 0) - (r.quantity_cust ?? 0)) > 0 ||
      Math.abs((r.price_sys ?? 0) - (r.price_cust ?? 0)) > 0.01 ||
      Math.abs((r.market_value_sys ?? 0) - (r.market_value_cust ?? 0)) > 0.01
  ).length;

  return (
    <Card
      title={
        <span>
          Portfolio Reconciliation — System Report vs Custodian&nbsp;&nbsp;
          <Tag color={totalFail === 0 ? "success" : "error"}>
            {totalFail === 0 ? "All matched" : `${totalFail} stock(s) with discrepancies`}
          </Tag>
        </span>
      }
      style={{ borderRadius: 12, marginBottom: 24 }}
    >
      <Table
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        size="small"
        scroll={{ x: 800 }}
        rowClassName={(r) => {
          const hasDiff =
            Math.abs((r.quantity_sys ?? 0) - (r.quantity_cust ?? 0)) > 0 ||
            Math.abs((r.price_sys ?? 0) - (r.price_cust ?? 0)) > 0.01 ||
            Math.abs((r.market_value_sys ?? 0) - (r.market_value_cust ?? 0)) > 0.01;
          return hasDiff ? "row-fail" : "";
        }}
      />
    </Card>
  );
}
