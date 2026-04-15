import { Card, Table, Tag } from "antd";

const fmt = (v, dec = 2) =>
  v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const columns = [
  {
    title: "Field",
    dataIndex: "field",
    key: "field",
    width: 220,
    render: (v) => <strong>{v}</strong>,
  },
  {
    title: "Calculated NAV",
    dataIndex: "submitted",
    key: "submitted",
    align: "right",
    render: (v, row) => fmt(v, row.field === "NAV Per Unit" ? 4 : 2),
  },
  {
    title: "Submitted NAV",
    dataIndex: "calculated",
    key: "calculated",
    align: "right",
    render: (v, row) => fmt(v, row.field === "NAV Per Unit" ? 4 : 2),
  },
  {
    title: "Difference (Calc. NAV − Sub. NAV)",
    dataIndex: "diff",
    key: "diff",
    align: "right",
    render: (v, row) => {
      if (v == null) return "—";
      const ok = Math.abs(v) <= 0.01;
      const dec = row.field === "NAV Per Unit" ? 4 : 2;
      return ok ? (
        <span style={{ color: "#52c41a" }}>—</span>
      ) : (
        <span style={{ color: "#ff4d4f", fontWeight: 700 }}>
          {v > 0 ? "+" : ""}{fmt(v, dec)}
        </span>
      );
    },
  },
  {
    title: "Status",
    key: "status",
    align: "center",
    render: (_, row) => {
      const ok = row.diff == null || Math.abs(row.diff) <= 0.01;
      return <Tag color={ok ? "success" : "error"} style={{ fontWeight: 700 }}>{ok ? "PASS" : "FAIL"}</Tag>;
    },
  },
];

export default function NAVValidationTable({ navResult }) {
  if (!navResult) return null;

  const rows = Object.entries(navResult.fields || {}).map(([field, vals]) => ({
    key: field,
    field,
    submitted: vals.submitted,
    calculated: vals.calculated,
    diff: vals.submitted - vals.calculated,
  }));

  const overallTag = (
    <Tag color={navResult.status === "PASS" ? "success" : "error"} style={{ fontWeight: 700, fontSize: 13 }}>
      {navResult.status}
    </Tag>
  );

  return (
    <Card
      title={<span>NAV Validation &nbsp;{overallTag}</span>}
      style={{ borderRadius: 12, marginBottom: 24 }}
    >
      <Table
        dataSource={rows}
        columns={columns}
        pagination={false}
        size="small"
        rowClassName={(row) => (Math.abs(row.diff) > 0.01 ? "row-fail" : "")}
      />
    </Card>
  );
}
