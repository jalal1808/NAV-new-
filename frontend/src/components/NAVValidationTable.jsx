import { Card, Collapse, Table, Tag, Tooltip } from "antd";

const fmt = (v, dec = 2) =>
  v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const StatusTag = ({ status }) => (
  <Tag color={status === "PASS" ? "success" : "error"} style={{ fontWeight: 700, fontSize: 13 }}>
    {status}
  </Tag>
);

const fieldColumns = [
  { title: "Field", dataIndex: "field", key: "field", width: 220, render: (v) => <strong>{v}</strong> },
  {
    title: "Submitted",
    dataIndex: "submitted",
    key: "submitted",
    align: "right",
    render: (v, row) => fmt(v, row.field === "NAV Per Unit" ? 4 : 2),
  },
  {
    title: "Calculated",
    dataIndex: "calculated",
    key: "calculated",
    align: "right",
    render: (v, row) => fmt(v, row.field === "NAV Per Unit" ? 4 : 2),
  },
  {
    title: "Diff",
    dataIndex: "diff",
    key: "diff",
    align: "right",
    render: (v, row) => {
      if (v == null) return "—";
      const isOk = Math.abs(v) <= 0.01;
      const dec = row.field === "NAV Per Unit" ? 4 : 2;
      return (
        <span style={{ color: isOk ? "#52c41a" : "#ff4d4f", fontWeight: isOk ? 400 : 700 }}>
          {isOk ? "—" : `${v > 0 ? "+" : ""}${fmt(v, dec)}`}
        </span>
      );
    },
  },
  {
    title: "Status",
    key: "status",
    align: "center",
    render: (_, row) => {
      const isOk = row.diff == null || Math.abs(row.diff) <= 0.01;
      return <StatusTag status={isOk ? "PASS" : "FAIL"} />;
    },
  },
];

export default function NAVValidationTable({ navResults }) {
  if (!navResults || navResults.length === 0) return null;

  const items = navResults.map((r, i) => {
    const rows = Object.entries(r.fields || {}).map(([field, vals]) => ({
      key: field,
      field,
      submitted: vals.submitted,
      calculated: vals.calculated,
      diff: vals.submitted - vals.calculated,
    }));

    return {
      key: String(i),
      label: (
        <span style={{ fontWeight: 600 }}>
          {r.date}&nbsp;&nbsp;
          <StatusTag status={r.status} />
          {r.discrepancies?.length > 0 && (
            <Tooltip title={`${r.discrepancies.length} field(s) differ`}>
              <Tag color="warning" style={{ marginLeft: 8 }}>
                {r.discrepancies.length} issue{r.discrepancies.length > 1 ? "s" : ""}
              </Tag>
            </Tooltip>
          )}
        </span>
      ),
      children: (
        <Table
          dataSource={rows}
          columns={fieldColumns}
          pagination={false}
          size="small"
          rowClassName={(row) => (Math.abs(row.diff) > 0.01 ? "row-fail" : "")}
        />
      ),
    };
  });

  return (
    <Card
      title="NAV Validation — by Date"
      style={{ borderRadius: 12, marginBottom: 24 }}
    >
      <Collapse
        defaultActiveKey={navResults.map((_, i) => String(i))}
        items={items}
        style={{ background: "transparent", border: "none" }}
      />
    </Card>
  );
}
