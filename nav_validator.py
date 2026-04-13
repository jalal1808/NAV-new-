import os
import sys

import pandas as pd

NAV_TOLERANCE = 0.01

# Labels to extract from each NAV date block (matched against col 0 / left label)
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
# Value helpers
# ---------------------------------------------------------------------------

def clean_value(val) -> float:
    """Convert any cell value to float. Dashes, blanks, and NaN become 0.0."""
    if pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "").replace("\xa0", "").replace("\u200b", "")
    if s in ("", "-", "- ", "-  ", "nan", "None"):
        return 0.0
    # "- 15000" style (space after minus)
    if s.startswith("- "):
        s = "-" + s[2:].strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def fmt_num(val: float, decimals: int = 2) -> str:
    return f"{val:>{18},.{decimals}f}"


# ---------------------------------------------------------------------------
# NAV sheet parsing
# ---------------------------------------------------------------------------

def parse_nav_blocks(df: pd.DataFrame) -> list[dict]:
    """
    Read the NAV sheet (loaded with header=None) and return a list of
    per-date blocks, each containing the submitted (left) and calculated
    (right) values for every field in NAV_FIELDS.
    """
    # Find row indices where "NAV as at" appears in col 0
    block_starts = [
        i for i, row in df.iterrows()
        if str(row.iloc[0]).strip().startswith("NAV as at")
    ]

    blocks = []
    for idx, start in enumerate(block_starts):
        end = block_starts[idx + 1] if idx + 1 < len(block_starts) else len(df)
        block_rows = df.iloc[start:end]

        date_str = str(block_rows.iloc[0, 0]).replace("NAV as at", "").strip()

        # Build a lookup: left_label -> row (so we can extract both sides)
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
            # Right-side value is always in col 5, same row
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
# System Report parsing
# ---------------------------------------------------------------------------

def parse_system_report(df: pd.DataFrame) -> dict[str, dict]:
    """
    Parse the System Report sheet (loaded with header=None).
    Returns dict keyed by stock code string.

    Layout:
      Row N:   NaN | Quantity | Stock | Sector | Cost Price | Price | Market Value   <- header
      Row N+1: NaN | qty      | code  | sector | cost       | price | mktval
      ...
      (blank row or fee rows follow)
    """
    header_row_idx = None
    for i, row in df.iterrows():
        if str(row.iloc[2]).strip() == "Stock":
            header_row_idx = i
            break

    if header_row_idx is None:
        return {}

    holdings: dict[str, dict] = {}
    for i in range(header_row_idx + 1, len(df)):
        row = df.iloc[i]
        raw_code = row.iloc[2]

        # Stock codes are 4-digit numeric (1000–9999 for Saudi equities).
        # Fee rows have rates (0.02) or large amounts (25000) in this column — skip them.
        try:
            code = int(float(str(raw_code).strip()))
        except (ValueError, TypeError):
            continue
        if not (1000 <= code <= 9999):
            continue

        # Sector (col 3) is a text label for equity rows; fee rows have a decimal rate there
        sector_cell = row.iloc[3]
        if pd.isna(sector_cell) or isinstance(sector_cell, (int, float)):
            continue

        code_str = str(code)
        holdings[code_str] = {
            "symbol": code_str,
            "quantity": clean_value(row.iloc[1]),
            "sector": str(row.iloc[3]).strip() if not pd.isna(row.iloc[3]) else "",
            "cost_price": clean_value(row.iloc[4]),
            "price": clean_value(row.iloc[5]),
            "market_value": clean_value(row.iloc[6]),
        }

    return holdings


# ---------------------------------------------------------------------------
# Custodian Data parsing
# ---------------------------------------------------------------------------

def parse_custodian_data(df: pd.DataFrame) -> dict[str, dict]:
    """
    Parse the CustodianData sheet (loaded with header=0).
    Returns dict keyed by stock code string. Skips the Cash row (no Stock Code).
    """
    holdings: dict[str, dict] = {}
    for _, row in df.iterrows():
        raw_code = row.get("Stock Code")
        if pd.isna(raw_code):
            continue  # Cash row or blank

        code_str = str(int(float(str(raw_code).strip())))
        holdings[code_str] = {
            "symbol": code_str,
            "quantity": clean_value(row.get("Quantity")),
            "isin": str(row.get("ISIN Code", "")).strip(),
            "cost_price": clean_value(row.get("Cost Price")),
            "price": clean_value(row.get("Price")),
            "market_value": clean_value(row.get("Market Value")),
            "asset_class": str(row.get("Asset Class", "")).strip(),
            "sector": str(row.get("Unnamed: 12", "")).strip(),
        }

    return holdings


# ---------------------------------------------------------------------------
# Portfolio validation
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
# Console report
# ---------------------------------------------------------------------------

LINE = "=" * 72


def print_nav_report(nav_results: list[dict]) -> int:
    """Print NAV section. Returns number of passing date blocks."""
    print(LINE)
    print("  NAV VALIDATION REPORT")
    print(LINE)

    passed = 0
    for result in nav_results:
        if result["status"] == "PASS":
            passed += 1
        badge = "PASS ✓" if result["status"] == "PASS" else "FAIL ✗"
        print(f"\n  [{result['date']}]  STATUS: {badge}")
        print(f"  {'Field':<30}  {'Submitted':>18}  {'Calculated':>18}  Note")
        print(f"  {'-'*30}  {'-'*18}  {'-'*18}  {'-'*20}")

        for field, (submitted, calculated) in result["fields"].items():
            diff = submitted - calculated
            decimals = 4 if field == "NAV Per Unit" else 2
            if abs(diff) > NAV_TOLERANCE:
                note = f"✗  DIFF: {diff:+,.{decimals}f}"
            else:
                note = "✓"
            print(
                f"  {field:<30}  {fmt_num(submitted, decimals)}  {fmt_num(calculated, decimals)}  {note}"
            )

    return passed


def print_portfolio_report(portfolio_results: list[dict]) -> int:
    """Print portfolio section. Returns number of failing checks."""
    print(f"\n{LINE}")
    print("  PORTFOLIO VALIDATION  (System Report vs Custodian Data)")
    print(LINE)
    print(f"  {'Stock':<8}  {'Field':<25}  {'System Report':>15}  {'Custodian':>15}  Status")
    print(f"  {'-'*8}  {'-'*25}  {'-'*15}  {'-'*15}  {'-'*20}")

    failed = 0
    for r in portfolio_results:
        if r["status"] == "FAIL":
            failed += 1

        if r["diff"] is None:
            # Missing stock row
            print(f"  {r['stock']:<8}  {r['field']:<25}  {'':>15}  {'':>15}  ✗")
            continue

        sv = r["sys_val"]
        cv = r["cust_val"]
        # Use 4 decimals for Price, 2 for others
        dec = 4 if r["field"] == "Price" else 2
        sv_str = fmt_num(sv, dec) if isinstance(sv, float) else f"{sv:>15}"
        cv_str = fmt_num(cv, dec) if isinstance(cv, float) else f"{cv:>15}"

        if r["status"] == "PASS":
            note = "✓"
        else:
            note = f"✗  DIFF: {r['diff']:+,.4f}"

        print(f"  {r['stock']:<8}  {r['field']:<25}  {sv_str}  {cv_str}  {note}")

    return failed


def print_summary(nav_passed: int, nav_total: int, port_failed: int, port_total: int):
    print(f"\n{LINE}")
    nav_status = "all dates PASSED" if nav_passed == nav_total else f"{nav_passed}/{nav_total} dates PASSED"
    port_status = "all checks PASSED" if port_failed == 0 else f"{port_failed}/{port_total} check(s) FAILED"
    print(f"  SUMMARY  |  NAV: {nav_status}  |  Portfolio: {port_status}")
    print(LINE)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

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

    # --- NAV validation ---
    nav_results = []
    if "NAV" in available:
        nav_df = pd.read_excel(xls, sheet_name="NAV", header=None)
        nav_blocks = parse_nav_blocks(nav_df)
        if not nav_blocks:
            print("Warning: no date blocks found in NAV sheet.")
        else:
            nav_results = validate_nav_blocks(nav_blocks)
    else:
        print("Warning: 'NAV' sheet not found.")

    # --- Portfolio validation ---
    portfolio_results = []
    if "System Report" in available and "CustodianData" in available:
        sys_df = pd.read_excel(xls, sheet_name="System Report", header=None)
        cust_df = pd.read_excel(xls, sheet_name="CustodianData", header=0)
        sys_holdings = parse_system_report(sys_df)
        cust_holdings = parse_custodian_data(cust_df)
        portfolio_results = validate_portfolio(sys_holdings, cust_holdings)
    else:
        print("Warning: 'System Report' or 'CustodianData' sheet not found.")

    # --- Print report ---
    nav_passed = print_nav_report(nav_results)
    port_failed = print_portfolio_report(portfolio_results)
    print_summary(nav_passed, len(nav_results), port_failed, len(portfolio_results))


if __name__ == "__main__":
    main()
