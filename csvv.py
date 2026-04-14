import pandas as pd

xls = pd.ExcelFile("NAV_updated.xlsx")

output = ""

for sheet in xls.sheet_names:
    df = pd.read_excel(xls, sheet_name=sheet)
    output += f"\n=== SHEET: {sheet} ===\n"
    output += df.head(20).to_string()
    output += "\n"

print(output)