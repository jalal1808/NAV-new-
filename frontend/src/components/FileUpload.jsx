import {
  CheckCircleFilled,
  DeleteOutlined,
  FileExcelOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Row, Tabs, Upload } from "antd";
import axios from "axios";
import { useState } from "react";

const { Dragger } = Upload;

// ---------------------------------------------------------------------------
// Single-file (all-in-one) tab
// ---------------------------------------------------------------------------
function CombinedUpload({ onResult, onLoading }) {
  const handleUpload = async (file) => {
    onLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post("/api/validate", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onResult(res.data);
    } catch (err) {
      const msg =
        err.response?.data?.detail || "Upload failed. Is the backend running?";
      onResult({ error: msg });
    } finally {
      onLoading(false);
    }
    return false;
  };

  return (
    <Dragger
      name="file"
      multiple={false}
      accept=".xlsx,.xls"
      beforeUpload={handleUpload}
      showUploadList={false}
      style={{ padding: "12px 0" }}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined style={{ color: "#1677ff", fontSize: 48 }} />
      </p>
      <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600 }}>
        Drop your NAV Excel file here
      </p>
      <p className="ant-upload-hint" style={{ color: "#8c8c8c" }}>
        Single .xlsx containing NAV, System Report, and CustodianData sheets
      </p>
    </Dragger>
  );
}

// ---------------------------------------------------------------------------
// Individual-sheet tab
// ---------------------------------------------------------------------------
const SHEET_SLOTS = [
  {
    key: "nav_file",
    label: "NAV Sheet",
    hint: "Excel file with the NAV sheet (multi-date blocks)",
    required: true,
  },
  {
    key: "system_report_file",
    label: "System Report",
    hint: "Excel file with the System Report sheet",
    required: false,
  },
  {
    key: "custodian_file",
    label: "Custodian Data",
    hint: "Excel file with the CustodianData sheet",
    required: false,
  },
];

function SheetSlot({ slot, file, onChange }) {
  const uploaded = !!file;

  const handleBeforeUpload = (f) => {
    onChange(slot.key, f);
    return false; // prevent antd auto-upload
  };

  return (
    <Card
      size="small"
      style={{
        borderRadius: 10,
        border: uploaded ? "1.5px solid #52c41a" : "1.5px dashed #d9d9d9",
        background: uploaded ? "#f6ffed" : "#fafafa",
        transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Icon */}
        <div style={{ fontSize: 28, color: uploaded ? "#52c41a" : "#1677ff" }}>
          {uploaded ? (
            <CheckCircleFilled />
          ) : (
            <FileExcelOutlined />
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {slot.label}
            {slot.required && (
              <span style={{ color: "#ff4d4f", marginLeft: 4 }}>*</span>
            )}
          </div>
          {uploaded ? (
            <div
              style={{
                color: "#52c41a",
                fontSize: 12,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {file.name}
            </div>
          ) : (
            <div style={{ color: "#8c8c8c", fontSize: 12 }}>{slot.hint}</div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {uploaded ? (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onChange(slot.key, null)}
            >
              Remove
            </Button>
          ) : (
            <Upload
              accept=".xlsx,.xls"
              beforeUpload={handleBeforeUpload}
              showUploadList={false}
            >
              <Button size="small" icon={<InboxOutlined />}>
                Browse
              </Button>
            </Upload>
          )}
        </div>
      </div>
    </Card>
  );
}

function IndividualUpload({ onResult, onLoading }) {
  const [files, setFiles] = useState({
    nav_file: null,
    system_report_file: null,
    custodian_file: null,
  });
  const [error, setError] = useState(null);

  const handleChange = (key, file) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
    setError(null);
  };

  const canValidate = files.nav_file !== null; // NAV sheet is mandatory

  const handleValidate = async () => {
    setError(null);
    onLoading(true);
    const formData = new FormData();
    if (files.nav_file) formData.append("nav_file", files.nav_file);
    if (files.system_report_file)
      formData.append("system_report_file", files.system_report_file);
    if (files.custodian_file)
      formData.append("custodian_file", files.custodian_file);

    try {
      const res = await axios.post("/api/validate-sheets", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onResult(res.data);
    } catch (err) {
      const msg =
        err.response?.data?.detail || "Upload failed. Is the backend running?";
      setError(msg);
      onLoading(false);
    } finally {
      onLoading(false);
    }
  };

  return (
    <div>
      <Row gutter={[0, 12]}>
        {SHEET_SLOTS.map((slot) => (
          <Col span={24} key={slot.key}>
            <SheetSlot
              slot={slot}
              file={files[slot.key]}
              onChange={handleChange}
            />
          </Col>
        ))}
      </Row>

      <div style={{ marginTop: 20, textAlign: "center" }}>
        <Button
          type="primary"
          size="large"
          disabled={!canValidate}
          onClick={handleValidate}
          style={{ minWidth: 180, borderRadius: 8 }}
        >
          Run Validation
        </Button>
        {!canValidate && (
          <div style={{ color: "#8c8c8c", fontSize: 12, marginTop: 8 }}>
            NAV Sheet is required to run validation
          </div>
        )}
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          style={{ marginTop: 16, borderRadius: 8 }}
          showIcon
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export — tabbed container
// ---------------------------------------------------------------------------
export default function FileUpload({ onResult, onLoading }) {
  const [uploadError, setUploadError] = useState(null);

  const handleResult = (result) => {
    if (result.error) {
      setUploadError(result.error);
    } else {
      setUploadError(null);
      onResult(result);
    }
  };

  const tabs = [
    {
      key: "combined",
      label: "All-in-one File",
      children: (
        <div>
          <CombinedUpload onResult={handleResult} onLoading={onLoading} />
          {uploadError && (
            <Alert
              type="error"
              message={uploadError}
              style={{ marginTop: 16, borderRadius: 8 }}
              showIcon
            />
          )}
        </div>
      ),
    },
    {
      key: "individual",
      label: "Sheet by Sheet",
      children: (
        <IndividualUpload onResult={handleResult} onLoading={onLoading} />
      ),
    },
  ];

  return (
    <Card
      style={{ borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
    >
      <Tabs
        defaultActiveKey="combined"
        items={tabs}
        onChange={() => setUploadError(null)}
      />
    </Card>
  );
}
