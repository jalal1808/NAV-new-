import { LockOutlined } from "@ant-design/icons";
import { Select, Tag } from "antd";

const statusColor = {
  PASS: "success",
  FAIL: "error",
  BLOCKED: "default",
};

export default function DateSelector({ dates, selectedDate, onChange }) {
  if (!dates || dates.length === 0) return null;

  const options = dates.map((d) => ({
    value: d.date,
    label: (
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 600, minWidth: 100 }}>{d.date}</span>
        <Tag color={statusColor[d.portfolio_status]} style={{ fontSize: 11 }}>
          Portfolio {d.portfolio_status}
        </Tag>
        {d.nav_blocked ? (
          <Tag icon={<LockOutlined />} color="default" style={{ fontSize: 11 }}>
            NAV Blocked
          </Tag>
        ) : (
          <Tag color={statusColor[d.nav_status]} style={{ fontSize: 11 }}>
            NAV {d.nav_status}
          </Tag>
        )}
      </span>
    ),
  }));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <span style={{ fontWeight: 600, color: "#595959", whiteSpace: "nowrap" }}>
        Select Date:
      </span>
      <Select
        value={selectedDate}
        onChange={onChange}
        options={options}
        style={{ minWidth: 380 }}
        size="large"
      />
    </div>
  );
}
