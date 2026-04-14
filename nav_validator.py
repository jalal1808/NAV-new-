import os
import sys
from datetime import datetime

import pandas as pd

NAV_TOLERANCE = 0.01

NAV_FIELDS = [
    "Total Investment",
    "Cash",
    "Dividend",
    "Assets Before fee & Exp",
    "Management Fee",
    "Total Expenses",
    "Total Liab",
    "Net Assets",
    "Total Units",
    "Sub/Red",
    "Units Outstanding",
    "NAV Per Unit",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_date(val) -> str:
    """Convert any date representation to 'DD/Mon/YYYY' string."""
    if isinstance(val, (pd.Timestamp, datetime)):
        return val.strftime("%d/%b/%Y")
    s = str(val).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%d/%b/%Y")
        except ValueError:
            continue
    return s


def clean_value(val) -> float:
    """Convert any cell value to float. Dashes, blanks, and NaN become 0.0."""
    if pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "").replace("\xa0", "").replace("\u200b", "")
    if s in ("", "-", "- ", "-  ", "nan", "None"):
        return 0.0
    if s.startswith("- "):
        s = "-" + s[2:].strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def fmt_num(val: float, decimals: int = 2) -> str:
    return f"{val:>{18},.{decimals}f}"


def _is_timestamp(val) -> bool:
    """Return True if val is a pandas Timestamp or looks like a date string."""
    if isinstance(val, pd.Timestamp):
        return True
    if isinstance(val, datetime):
        return True
    if isinstance(val, str):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                datetime.strptime(val.strip(), fmt)
                return True
            except ValueError:
                continue
    return False


# ---------------------------------------------------------------------------
# NAV sheet parsing (unchanged — already multi-date)
# ---------------------------------------------------------------------------

def parse_nav_blocks(df: pd.DataFrame) -> list[dict]:
    """
    Read the NAV sheet (header=None) and return a list of per-date blocks,
    each containing submitted (left col 1) and calculated (right col 5) values.
    """
    block_starts = [
        i for i, row in df.iterrows()
        if str(row.iloc[0]).strip().startswith("NAV as at")
    ]

    blocks = []
    for idx, start in enumerate(block_starts):
        end = block_starts[idx + 1] if idx + 1 < len(block_starts) else len(df)
        block_rows = df.iloc[start:end]

        date_str = str(block_rows.iloc[0, 0]).replace("NAV as at", "").strip()

        label_to_row: dict[str, pd.Series] = {}
        for _, row in block_rows.iterrows():
            label = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ""
            if label and label not in label_to_row:
                label_to_row[label] = row

        fields: dict[str, tuple[float, float]] = {}
        for field in NAV_FIELDS:
            row = label_to_row.get(field)
            if row is None:
                continue
            left_val = clean_value(row.iloc[1] if len(row) > 1 else None)
            right_val = clean_value(row.iloc[5] if len(row) > 5 else None)
            fields[field] = (left_val, right_val)

        blocks.append({"date": date_str, "fields": fields})

    return blocks


def validate_nav_blocks(blocks: list[dict]) -> list[dict]:
    results = []
    for block in blocks:
        discrepancies = []
        for field, (submitted, calculated) in block["fields"].items():
            diff = submitted - calculated
            if abs(diff) > NAV_TOLERANCE:
                discrepancies.append(
                    {"field": field, "submitted": submitted, "calculated": calculated, "diff": diff}
                )
        results.append(
            {
                "date": block["date"],
                "status": "PASS" if not discrepancies else "FAIL",
                "fields": block["fields"],
                "discrepancies": discrepancies,
            }
        )
    return results


# ---------------------------------------------------------------------------
# System Report — multi-date parser
# ---------------------------------------------------------------------------

def parse_system_report_by_date(df: pd.DataFrame) -> dict[str, dict]:
    """
    Parse a multi-date System Report sheet (header=None).
    Each date block starts with col[0] == 'Fund'.

    Returns: dict[normalized_date_str → holdings_dict]
    """
    # Find all block-start rows (col[0] == "Fund")
    block_starts = [
        i for i, row in df.iterrows()
        if str(row.iloc[0]).strip() == "Fund"
    ]

    result: dict[str, dict] = {}

    for idx, start in enumerate(block_starts):
        end = block_starts[idx + 1] if idx + 1 < len(block_starts) else len(df)

        date_str: str | None = None
        stock_header_idx: int | None = None

        for ri in range(start, end):
            row = df.iloc[ri]
            val0 = row.iloc[0]

            # Date row: col[0] is a Timestamp
            if _is_timestamp(val0):
                date_str = normalize_date(val0)
                continue

            # Stock header row: col[2] == "Stock"
            if len(row) > 2 and str(row.iloc[2]).strip() == "Stock":
                stock_header_idx = ri

        if date_str is None or stock_header_idx is None:
            continue

        holdings: dict[str, dict] = {}
        for ri in range(stock_header_idx + 1, end):
            row = df.iloc[ri]
            raw_code = row.iloc[2] if len(row) > 2 else None

            try:
                code = int(float(str(raw_code).strip()))
            except (ValueError, TypeError):
                continue

            # Saudi stock codes only (1000–9999)
            if not (1000 <= code <= 9999):
                continue

            # Sector in col[3] must be text — filters out fee rows (which have decimal rates)
            sector_cell = row.iloc[3] if len(row) > 3 else None
            if pd.isna(sector_cell) or isinstance(sector_cell, (int, float)):
                continue

            code_str = str(code)
            holdings[code_str] = {
                "symbol": code_str,
                "quantity": clean_value(row.iloc[1] if len(row) > 1 else None),
                "sector": str(sector_cell).strip(),
                "cost_price": clean_value(row.iloc[4] if len(row) > 4 else None),
                "price": clean_value(row.iloc[5] if len(row) > 5 else None),
                "market_value": clean_value(row.iloc[6] if len(row) > 6 else None),
            }

        result[date_str] = holdings

    return result


# ---------------------------------------------------------------------------
# Custodian Data — multi-date parser
# ---------------------------------------------------------------------------

def parse_custodian_by_date(df: pd.DataFrame) -> dict[str, dict]:
    """
    Parse a multi-date CustodianData sheet (header=None).
    Each date block starts with a Timestamp in col[0], followed by a header row.

    Returns: dict[normalized_date_str → holdings_dict]
    """
    # Find all date rows
    date_rows = [
        i for i, row in df.iterrows()
        if _is_timestamp(row.iloc[0])
    ]

    result: dict[str, dict] = {}

    for idx, date_idx in enumerate(date_rows):
        date_str = normalize_date(df.iloc[date_idx, 0])
        end_idx = date_rows[idx + 1] if idx + 1 < len(date_rows) else len(df)

        header_idx = date_idx + 1
        if header_idx >= end_idx:
            continue

        # Build column name → position mapping from the header row
        header_row = df.iloc[header_idx]
        col_map: dict[str, int] = {}
        for ci, val in enumerate(header_row):
            if not pd.isna(val):
                col_map[str(val).strip()] = ci

        stock_col = col_map.get("Stock Code", 4)
        isin_col = col_map.get("ISIN Code", 5)
        cost_col = col_map.get("Cost Price", 7)
        qty_col = col_map.get("Quantity", 8)
        price_col = col_map.get("Price", 9)
        mv_col = col_map.get("Market Value", 10)
        asset_col = col_map.get("Asset Class", 11)
        # Sector is the column after Asset Class (labelled "Unnamed" in the sheet)
        sector_col = asset_col + 1

        holdings: dict[str, dict] = {}
        for ri in range(header_idx + 1, end_idx):
            row = df.iloc[ri]
            raw_code = row.iloc[stock_col] if len(row) > stock_col else None

            if pd.isna(raw_code):
                continue  # Cash row or blank

            try:
                code = int(float(str(raw_code).strip()))
            except (ValueError, TypeError):
                continue

            code_str = str(code)
            holdings[code_str] = {
                "symbol": code_str,
                "quantity": clean_value(row.iloc[qty_col] if len(row) > qty_col else None),
                "isin": str(row.iloc[isin_col]).strip() if len(row) > isin_col and not pd.isna(row.iloc[isin_col]) else "",
                "cost_price": clean_value(row.iloc[cost_col] if len(row) > cost_col else None),
                "price": clean_value(row.iloc[price_col] if len(row) > price_col else None),
                "market_value": clean_value(row.iloc[mv_col] if len(row) > mv_col else None),
                "asset_class": str(row.iloc[asset_col]).strip() if len(row) > asset_col and not pd.isna(row.iloc[asset_col]) else "",
                "sector": str(row.iloc[sector_col]).strip() if len(row) > sector_col and not pd.isna(row.iloc[sector_col]) else "",
            }

        result[date_str] = holdings

    return result


# ---------------------------------------------------------------------------
# Portfolio validation (unchanged — operates on a single date's holdings)
# ---------------------------------------------------------------------------

def validate_portfolio(
    sys_holdings: dict[str, dict], cust_holdings: dict[str, dict]
) -> list[dict]:
    results = []
    all_codes = sorted(set(sys_holdings) | set(cust_holdings))

    for code in all_codes:
        sys_h = sys_holdings.get(code)
        cust_h = cust_holdings.get(code)

        if sys_h is None:
            results.append(
                {"stock": code, "field": "MISSING IN SYSTEM REPORT",
                 "sys_val": "N/A", "cust_val": "present", "status": "FAIL", "diff": None}
            )
            continue
        if cust_h is None:
            results.append(
                {"stock": code, "field": "MISSING IN CUSTODIAN DATA",
                 "sys_val": "present", "cust_val": "N/A", "status": "FAIL", "diff": None}
            )
            continue

        checks = [
            ("Quantity", sys_h["quantity"], cust_h["quantity"], 0.0),
            ("Price", sys_h["price"], cust_h["price"], NAV_TOLERANCE),
            ("Market Value", sys_h["market_value"], cust_h["market_value"], NAV_TOLERANCE),
        ]
        for field, sv, cv, tol in checks:
            diff = sv - cv
            results.append(
                {
                    "stock": code,
                    "field": field,
                    "sys_val": sv,
                    "cust_val": cv,
                    "status": "PASS" if abs(diff) <= tol else "FAIL",
                    "diff": diff,
                }
            )

    return results


# ---------------------------------------------------------------------------
# Console report (CLI only)
# ---------------------------------------------------------------------------

LINE = "=" * 72


def print_date_report(date: str, port_results: list, nav_result: dict | None, nav_blocked: bool):
    print(f"\n{LINE}")
    print(f"  DATE: {date}")
    print(LINE)

    # Portfolio section
    port_passed = all(r["status"] == "PASS" for r in port_results) if port_results else True
    port_badge = "PASS ✓" if port_passed else "FAIL ✗"
    print(f"\n  PORTFOLIO RECON — {port_badge}")

    if port_results:
        print(f"  {'Stock':<8}  {'Field':<25}  {'System':>15}  {'Custodian':>15}  Status")
        print(f"  {'-'*8}  {'-'*25}  {'-'*15}  {'-'*15}  {'-'*6}")
        for r in port_results:
            if r["diff"] is None:
                print(f"  {r['stock']:<8}  {r['field']:<25}")
            else:
                ok = abs(r["diff"]) <= NAV_TOLERANCE
                sv = fmt_num(r["sys_val"]) if isinstance(r["sys_val"], float) else f"{r['sys_val']:>15}"
                cv = fmt_num(r["cust_val"]) if isinstance(r["cust_val"], float) else f"{r['cust_val']:>15}"
                mark = "✓" if ok else f"✗ DIFF:{r['diff']:+,.2f}"
                print(f"  {r['stock']:<8}  {r['field']:<25}  {sv}  {cv}  {mark}")

    # NAV section
    print()
    if nav_blocked:
        print("  NAV — BLOCKED ⛔  (portfolio reconciliation must pass first)")
        return

    if nav_result is None:
        print("  NAV — no data")
        return

    nav_badge = "PASS ✓" if nav_result["status"] == "PASS" else "FAIL ✗"
    print(f"  NAV VALIDATION — {nav_badge}")
    print(f"  {'Field':<30}  {'Submitted':>18}  {'Calculated':>18}  Note")
    print(f"  {'-'*30}  {'-'*18}  {'-'*18}  {'-'*20}")

    for field, (submitted, calculated) in nav_result["fields"].items():
        diff = submitted - calculated
        dec = 4 if field == "NAV Per Unit" else 2
        note = "✓" if abs(diff) <= NAV_TOLERANCE else f"✗  DIFF: {diff:+,.{dec}f}"
        print(f"  {field:<30}  {fmt_num(submitted, dec)}  {fmt_num(calculated, dec)}  {note}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        print("Usage: python nav_validator.py <path-to-file.xlsx>")
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f"Error: file not found — {file_path}")
        sys.exit(1)

    xls = pd.ExcelFile(file_path)
    available = xls.sheet_names

    nav_blocks = []
    if "NAV" in available:
        nav_df = pd.read_excel(xls, sheet_name="NAV", header=None)
        nav_blocks = parse_nav_blocks(nav_df)
    else:
        print("Warning: 'NAV' sheet not found.")

    sys_by_date: dict = {}
    if "System Report" in available:
        sys_df = pd.read_excel(xls, sheet_name="System Report", header=None)
        sys_by_date = parse_system_report_by_date(sys_df)

    cust_by_date: dict = {}
    if "CustodianData" in available:
        cust_df = pd.read_excel(xls, sheet_name="CustodianData", header=None)
        cust_by_date = parse_custodian_by_date(cust_df)

    nav_pass = 0
    nav_blocked_count = 0

    for block in nav_blocks:
        date = block["date"]
        sys_h = sys_by_date.get(date, {})
        cust_h = cust_by_date.get(date, {})

        port_results = validate_portfolio(sys_h, cust_h) if (sys_h or cust_h) else []
        port_passed = all(r["status"] == "PASS" for r in port_results) if port_results else True

        nav_result = validate_nav_blocks([block])[0]
        nav_blocked = not port_passed

        if not nav_blocked and nav_result["status"] == "PASS":
            nav_pass += 1
        if nav_blocked:
            nav_blocked_count += 1

        print_date_report(date, port_results, nav_result if not nav_blocked else None, nav_blocked)

    total = len(nav_blocks)
    print(f"\n{LINE}")
    print(f"  SUMMARY  |  {nav_pass}/{total} dates NAV PASSED  |  {nav_blocked_count}/{total} dates BLOCKED")
    print(LINE)


if __name__ == "__main__":
    main()
