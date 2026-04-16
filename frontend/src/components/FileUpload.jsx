import {
  FileExcelOutlined,
  FolderOpenOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Row, Tabs, Tag, Upload } from "antd";
import axios from "axios";
import { useEffect, useRef, useState } from "react";

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
// Folder upload tab — auto-detects file roles by sheet name then filename
// ---------------------------------------------------------------------------

const ROLE_CONFIG = {
  nav:           { label: "NAV Sheet",      tagColor: "blue",    border: "#1677ff", bg: "#e6f4ff" },
  system_report: { label: "System Report",  tagColor: "green",   border: "#52c41a", bg: "#f6ffed" },
  custodian:     { label: "Custodian Data", tagColor: "orange",  border: "#fa8c16", bg: "#fff7e6" },
  unknown:       { label: null,             tagColor: "default", border: "#d9d9d9", bg: "#fafafa" },
};

function detectRole(filename) {
  const name = filename.toLowerCase().replace(/[\s_\-\.]/g, "");
  if (name.includes("nav")) return "nav";
  if (name.includes("system") || name.includes("sysreport")) return "system_report";
  if (name.includes("custodian") || name.includes("cust")) return "custodian";
  return "unknown";
}

function FolderUpload({ onResult, onLoading }) {
  const [detectedFiles, setDetectedFiles] = useState({});  // role → File
  const [allFiles, setAllFiles] = useState([]);             // [{file, role}]
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // Set webkitdirectory imperatively — React doesn't forward this non-standard attribute
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setAttribute("webkitdirectory", "");
      inputRef.current.setAttribute("directory", "");
    }
  }, []);

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files).filter(
      (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
    );
    const detected = {};
    const annotated = files.map((f) => {
      const role = detectRole(f.name);
      // Last file per role wins (backend also filters by sheet name)
      detected[role] = f;
      return { file: f, role };
    });
    setAllFiles(annotated);
    setDetectedFiles(detected);
    setError(null);
  };

  const handleClear = () => {
    setAllFiles([]);
    setDetectedFiles({});
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const recognizedFiles = allFiles.filter(({ role }) => role !== "unknown");
  const canValidate = !!detectedFiles.nav;
  const hasFiles = allFiles.length > 0;

  const handleValidate = async () => {
    setError(null);
    onLoading(true);
    const formData = new FormData();
    ["nav", "system_report", "custodian"].forEach((role) => {
      if (detectedFiles[role]) formData.append("files", detectedFiles[role]);
    });
    try {
      const res = await axios.post("/api/validate-folder", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onResult(res.data);
    } catch (err) {
      const msg = err.response?.data?.detail || "Upload failed. Is the backend running?";
      setError(msg);
    } finally {
      onLoading(false);
    }
  };

  return (
    <div>
      {/* Hidden folder input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFolderSelect}
      />

      {!hasFiles ? (
        /* ── Empty state ── */
        <div
          style={{
            border: "1.5px dashed #d9d9d9",
            borderRadius: 10,
            background: "#fafafa",
            padding: "40px 24px",
            textAlign: "center",
            cursor: "pointer",
          }}
          onClick={() => inputRef.current?.click()}
        >
          <FolderOpenOutlined style={{ fontSize: 48, color: "#1677ff", marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
            Select a folder containing your Excel files
          </p>
          <p style={{ color: "#8c8c8c", fontSize: 12, margin: "0 0 16px" }}>
            Files are matched automatically by sheet name, then by filename keyword
            <br />
            <code style={{ fontSize: 11 }}>nav_…xlsx</code> &nbsp;·&nbsp;
            <code style={{ fontSize: 11 }}>system_…xlsx</code> &nbsp;·&nbsp;
            <code style={{ fontSize: 11 }}>custodian_…xlsx</code>
          </p>
          <Button type="primary" icon={<FolderOpenOutlined />}>
            Browse Folder
          </Button>
        </div>
      ) : (
        /* ── Detected files ── */
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {allFiles.length} Excel file{allFiles.length !== 1 ? "s" : ""} in folder
            </span>
            <Button size="small" onClick={handleClear}>Clear</Button>
          </div>

          <Row gutter={[0, 10]}>
            {allFiles.map(({ file, role }) => {
              const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.unknown;
              const tagLabel = cfg.label ?? file.name.replace(/\.(xlsx|xls)$/i, "");
              return (
                <Col span={24} key={file.name}>
                  <Card
                    size="small"
                    style={{
                      borderRadius: 10,
                      border: `1.5px solid ${cfg.border}`,
                      background: cfg.bg,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <FileExcelOutlined style={{ fontSize: 22, color: cfg.border }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {file.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                          {(file.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <Tag color={cfg.tagColor} style={{ fontWeight: 600 }}>{tagLabel}</Tag>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>

          {!canValidate && (
            <Alert
              type="warning"
              message="NAV file not detected"
              description='No file was matched as the NAV sheet. Make sure a file has "nav" in its filename or contains a sheet named "NAV".'
              showIcon
              style={{ marginTop: 12, borderRadius: 8 }}
            />
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center" }}>
            <Button icon={<FolderOpenOutlined />} onClick={() => inputRef.current?.click()}>
              Change Folder
            </Button>
            <Button
              type="primary"
              disabled={!canValidate}
              onClick={handleValidate}
              style={{ minWidth: 160, borderRadius: 8 }}
            >
              Run Validation
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert type="error" message={error} style={{ marginTop: 16, borderRadius: 8 }} showIcon />
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
        <FolderUpload onResult={handleResult} onLoading={onLoading} />
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
