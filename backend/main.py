import io
import sys
import os
from typing import Optional

# Allow importing nav_validator from the parent directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from nav_validator import (
    parse_custodian_data,
    parse_nav_blocks,
    parse_system_report,
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

def _read_sheet(file_bytes: bytes, preferred_sheet: str, header) -> pd.DataFrame:
    """
    Open an Excel file and return the preferred sheet as a DataFrame.
    Falls back to the first sheet if the preferred name is not found.
    """
    xls = pd.ExcelFile(io.BytesIO(file_bytes))
    target = preferred_sheet if preferred_sheet in xls.sheet_names else xls.sheet_names[0]
    return pd.read_excel(xls, sheet_name=target, header=header)


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


def run_validation(
    nav_df: Optional[pd.DataFrame],
    sys_df: Optional[pd.DataFrame],
    cust_df: Optional[pd.DataFrame],
    source_label: str = "",
) -> dict:
    """
    Core validation logic shared by both endpoints.
    Accepts DataFrames directly; returns the full response dict.
    """
    response: dict = {"source": source_label}

    # ------------------------------------------------------------------ NAV --
    nav_results_raw = []
    fund_info: dict = {}

    if nav_df is not None:
        nav_blocks = parse_nav_blocks(nav_df)
        nav_results_raw = validate_nav_blocks(nav_blocks)

        # Extract fund name / code from the NAV sheet
        for _, row in nav_df.iterrows():
            label = str(row.iloc[0]).strip()
            if label == "Fund":
                fund_info["name"] = str(row.iloc[1]).strip()
            elif label == "Fund Code":
                fund_info["code"] = str(row.iloc[1]).strip()
            if len(fund_info) == 2:
                break

    nav_results = [
        {
            "date": r["date"],
            "status": r["status"],
            "fields": {
                field: {"submitted": left, "calculated": right}
                for field, (left, right) in r["fields"].items()
            },
            "discrepancies": r["discrepancies"],
        }
        for r in nav_results_raw
    ]

    response["nav_results"] = nav_results
    response["fund_info"] = fund_info

    # ------------------------------------------------------------ Portfolio --
    portfolio_results = []
    portfolio_summary = []

    if sys_df is not None and cust_df is not None:
        sys_holdings = parse_system_report(sys_df)
        cust_holdings = parse_custodian_data(cust_df)
        portfolio_results = validate_portfolio(sys_holdings, cust_holdings)
        portfolio_summary = build_portfolio_summary(sys_holdings, cust_holdings)

    response["portfolio_results"] = _clean(portfolio_results)
    response["portfolio_summary"] = _clean(portfolio_summary)

    # --------------------------------------------------------------- KPIs ---
    kpi: dict = {}
    if nav_results:
        latest = nav_results[-1]
        fields = latest["fields"]
        kpi = {
            "latest_date": latest["date"],
            "nav_per_unit": fields.get("NAV Per Unit", {}).get("submitted"),
            "calculated_nav_per_unit": fields.get("NAV Per Unit", {}).get("calculated"),
            "net_assets": fields.get("Net Assets", {}).get("submitted"),
            "units_outstanding": fields.get("Units Outstanding", {}).get("submitted"),
            "total_investment": fields.get("Total Investment", {}).get("submitted"),
            "total_dates": len(nav_results),
            "dates_passed": sum(1 for r in nav_results if r["status"] == "PASS"),
            "portfolio_checks": len(portfolio_results),
            "portfolio_passed": sum(1 for r in portfolio_results if r["status"] == "PASS"),
        }

    response["kpi"] = kpi
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
    cust_df = pd.read_excel(xls, sheet_name="CustodianData", header=0) if "CustodianData" in available else None

    result = run_validation(nav_df, sys_df, cust_df, source_label=file.filename)
    result["filename"] = file.filename
    result["sheets_found"] = available
    result["upload_mode"] = "combined"
    return result


# ---------------------------------------------------------------------------
# Endpoint 2 — individual sheet files
# ---------------------------------------------------------------------------

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
            raise HTTPException(
                status_code=400,
                detail=f"'{upload.filename}' is not a valid Excel file.",
            )
        try:
            contents = await upload.read()
            return _read_sheet(contents, preferred, header)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read '{upload.filename}': {e}")

    nav_df = await _read(nav_file, "NAV", None)
    sys_df = await _read(system_report_file, "System Report", None)
    cust_df = await _read(custodian_file, "CustodianData", 0)

    files_used = ", ".join(
        f.filename for f in [nav_file, system_report_file, custodian_file] if f is not None
    )

    result = run_validation(nav_df, sys_df, cust_df, source_label=files_used)
    result["filename"] = files_used
    result["upload_mode"] = "individual"
    return result
