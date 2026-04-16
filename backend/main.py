import io
import sys
import os
from typing import List, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from nav_validator import (
    parse_nav_blocks,
    parse_system_report_by_date,
    parse_custodian_by_date,
    validate_nav_blocks,
    validate_portfolio,
)

app = FastAPI(title="NAV Validator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean(obj):
    """Recursively replace NaN with None for JSON serialisation."""
    if isinstance(obj, float) and obj != obj:
        return None
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(i) for i in obj]
    return obj


def build_portfolio_summary(sys_holdings: dict, cust_holdings: dict) -> list:
    all_codes = sorted(set(sys_holdings) | set(cust_holdings))
    rows = []
    for code in all_codes:
        sys_h = sys_holdings.get(code, {})
        cust_h = cust_holdings.get(code, {})
        rows.append(
            {
                "stock": code,
                "sector": sys_h.get("sector") or cust_h.get("sector", ""),
                "isin": cust_h.get("isin", ""),
                "quantity_sys": sys_h.get("quantity"),
                "quantity_cust": cust_h.get("quantity"),
                "price_sys": sys_h.get("price"),
                "price_cust": cust_h.get("price"),
                "market_value_sys": sys_h.get("market_value"),
                "market_value_cust": cust_h.get("market_value"),
                "cost_price": sys_h.get("cost_price") or cust_h.get("cost_price"),
            }
        )
    return rows


def serialise_nav_result(r: dict) -> dict:
    """Convert tuple-based fields to {submitted, calculated} dicts."""
    return {
        "date": r["date"],
        "status": r["status"],
        "fields": {
            field: {"submitted": left, "calculated": right}
            for field, (left, right) in r["fields"].items()
        },
        "discrepancies": r["discrepancies"],
    }


# ---------------------------------------------------------------------------
# Core validation — per-date loop
# ---------------------------------------------------------------------------

def run_validation(
    nav_df: Optional[pd.DataFrame],
    sys_df: Optional[pd.DataFrame],
    cust_df: Optional[pd.DataFrame],
    source_label: str = "",
) -> dict:
    response: dict = {"source": source_label}

    # Parse all date blocks
    nav_blocks = parse_nav_blocks(nav_df) if nav_df is not None else []
    sys_by_date = parse_system_report_by_date(sys_df) if sys_df is not None else {}
    cust_by_date = parse_custodian_by_date(cust_df) if cust_df is not None else {}

    # Extract fund info from NAV sheet
    fund_info: dict = {}
    if nav_df is not None:
        for _, row in nav_df.iterrows():
            label = str(row.iloc[0]).strip()
            if label == "Fund":
                fund_info["name"] = str(row.iloc[1]).strip()
            elif label == "Fund Code":
                fund_info["code"] = str(row.iloc[1]).strip()
            if len(fund_info) == 2:
                break

    # Per-date validation with portfolio gating NAV
    dates_output = []
    for block in nav_blocks:
        date = block["date"]
        sys_h = sys_by_date.get(date, {})
        cust_h = cust_by_date.get(date, {})

        port_results = validate_portfolio(sys_h, cust_h) if (sys_h or cust_h) else []
        port_passed = all(r["status"] == "PASS" for r in port_results) if port_results else True
        port_summary = build_portfolio_summary(sys_h, cust_h)

        nav_result_raw = validate_nav_blocks([block])[0]
        nav_blocked = not port_passed

        dates_output.append(
            {
                "date": date,
                "portfolio_status": "PASS" if port_passed else "FAIL",
                "portfolio_results": _clean(port_results),
                "portfolio_summary": _clean(port_summary),
                "nav_status": "BLOCKED" if nav_blocked else nav_result_raw["status"],
                "nav_result": None if nav_blocked else serialise_nav_result(nav_result_raw),
                "nav_blocked": nav_blocked,
                "nav_block_reason": (
                    None if port_passed
                    else "Portfolio reconciliation failed — NAV cannot be confirmed for this date."
                ),
            }
        )

    response["dates"] = dates_output
    response["fund_info"] = fund_info

    # Global KPI summary
    total = len(dates_output)
    response["kpi"] = {
        "total_dates": total,
        "dates_nav_passed": sum(1 for d in dates_output if d["nav_status"] == "PASS"),
        "dates_nav_failed": sum(1 for d in dates_output if d["nav_status"] == "FAIL"),
        "dates_nav_blocked": sum(1 for d in dates_output if d["nav_blocked"]),
        "dates_portfolio_passed": sum(1 for d in dates_output if d["portfolio_status"] == "PASS"),
    }

    return response


# ---------------------------------------------------------------------------
# Endpoint 1 — single multi-sheet Excel file
# ---------------------------------------------------------------------------

@app.post("/api/validate")
async def validate(file: UploadFile = File(...)):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Please upload an Excel (.xlsx) file.")

    contents = await file.read()
    try:
        xls = pd.ExcelFile(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {e}")

    available = xls.sheet_names

    nav_df = pd.read_excel(xls, sheet_name="NAV", header=None) if "NAV" in available else None
    sys_df = pd.read_excel(xls, sheet_name="System Report", header=None) if "System Report" in available else None
    cust_df = pd.read_excel(xls, sheet_name="CustodianData", header=None) if "CustodianData" in available else None

    result = run_validation(nav_df, sys_df, cust_df, source_label=file.filename)
    result["filename"] = file.filename
    result["sheets_found"] = available
    result["upload_mode"] = "combined"
    return result


# ---------------------------------------------------------------------------
# Endpoint 2 — individual sheet files
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Endpoint 3 — folder of individual Excel files (auto-detect roles)
# ---------------------------------------------------------------------------

# Maps known sheet names to their validation role
_SHEET_ROLE = {
    "NAV":           "nav",
    "System Report": "system_report",
    "CustodianData": "custodian",
}

# Filename keyword patterns used as fallback
_FILENAME_PATTERNS: dict[str, list[str]] = {
    "nav":           ["nav"],
    "system_report": ["system", "sysreport", "systemreport", "sys_report"],
    "custodian":     ["custodian", "cust"],
}


def _detect_role(filename: str, sheet_names: list[str]) -> tuple[str | None, str | None]:
    """Return (role, sheet_name_to_read) for a file, or (None, None) if unrecognised."""
    # Prefer detection by sheet name — most reliable
    for sheet, role in _SHEET_ROLE.items():
        if sheet in sheet_names:
            return role, sheet

    # Fall back to filename keyword matching
    name = filename.lower().replace("_", "").replace("-", "").replace(" ", "")
    for role, patterns in _FILENAME_PATTERNS.items():
        if any(p in name for p in patterns):
            return role, sheet_names[0] if sheet_names else None

    return None, None


@app.post("/api/validate-folder")
async def validate_folder(files: List[UploadFile] = File(...)):
    """Accept multiple Excel files from a folder and auto-assign roles."""
    assigned: dict[str, tuple[pd.DataFrame, str]] = {}  # role → (df, filename)

    for upload in files:
        if not upload.filename.endswith((".xlsx", ".xls")):
            continue
        contents = await upload.read()
        try:
            xls = pd.ExcelFile(io.BytesIO(contents))
        except Exception:
            continue

        role, sheet_to_read = _detect_role(upload.filename, xls.sheet_names)
        if role and role not in assigned and sheet_to_read:
            df = pd.read_excel(xls, sheet_name=sheet_to_read, header=None)
            assigned[role] = (df, upload.filename)

    if not assigned:
        raise HTTPException(
            status_code=400,
            detail="No recognisable Excel files found. Check that the folder contains .xlsx files.",
        )
    if "nav" not in assigned:
        raise HTTPException(
            status_code=400,
            detail=(
                'NAV file not detected. Ensure a file has "nav" in its name '
                'or contains a sheet named "NAV".'
            ),
        )

    nav_df  = assigned.get("nav",           (None, ""))[0]
    sys_df  = assigned.get("system_report", (None, ""))[0]
    cust_df = assigned.get("custodian",     (None, ""))[0]

    files_used     = ", ".join(v[1] for v in assigned.values())
    roles_detected = {role: fname for role, (_, fname) in assigned.items()}

    result = run_validation(nav_df, sys_df, cust_df, source_label=files_used)
    result["filename"]       = files_used
    result["upload_mode"]    = "folder"
    result["roles_detected"] = roles_detected
    return result


@app.post("/api/validate-sheets")
async def validate_sheets(
    nav_file: Optional[UploadFile] = File(None),
    system_report_file: Optional[UploadFile] = File(None),
    custodian_file: Optional[UploadFile] = File(None),
):
    if not any([nav_file, system_report_file, custodian_file]):
        raise HTTPException(status_code=400, detail="At least one sheet file must be provided.")

    async def _read(upload: Optional[UploadFile], preferred: str, header) -> Optional[pd.DataFrame]:
        if upload is None:
            return None
        if not upload.filename.endswith((".xlsx", ".xls")):
            raise HTTPException(status_code=400, detail=f"'{upload.filename}' is not a valid Excel file.")
        try:
            contents = await upload.read()
            xls = pd.ExcelFile(io.BytesIO(contents))
            target = preferred if preferred in xls.sheet_names else xls.sheet_names[0]
            return pd.read_excel(xls, sheet_name=target, header=header)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read '{upload.filename}': {e}")

    nav_df = await _read(nav_file, "NAV", None)
    sys_df = await _read(system_report_file, "System Report", None)
    cust_df = await _read(custodian_file, "CustodianData", None)

    files_used = ", ".join(
        f.filename for f in [nav_file, system_report_file, custodian_file] if f is not None
    )

    result = run_validation(nav_df, sys_df, cust_df, source_label=files_used)
    result["filename"] = files_used
    result["upload_mode"] = "individual"
    return result
