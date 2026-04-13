# NAV Validator

A full-stack system for validating mutual fund NAV calculations and reconciling portfolio holdings against custodian data.

## What It Does

- **NAV Validation** — compares the fund's submitted NAV against an independently calculated NAV, field by field, across multiple dates
- **Portfolio Reconciliation** — cross-checks holdings (quantity, price, market value) between the system report and custodian data
- **Dashboard** — interactive React UI with KPI cards, a NAV trend chart, and color-coded pass/fail tables

## Project Structure

```
NAV/
├── nav_validator.py          # Core validation logic (CLI)
├── start_backend.bat         # Start the API server
├── start_frontend.bat        # Start the React dashboard
├── backend/
│   ├── main.py               # FastAPI endpoints
│   └── requirements.txt      # Python dependencies
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        └── components/
            ├── FileUpload.jsx
            ├── KPICards.jsx
            ├── NAVTrendChart.jsx
            ├── NAVValidationTable.jsx
            └── PortfolioTable.jsx
```

## Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, Uvicorn |
| Data | pandas, openpyxl |
| Frontend | React 18, Vite 6 |
| UI Components | Ant Design 5 |
| Charts | Recharts |
| HTTP | Axios |

## Requirements

- Python 3.10+
- Node.js 18+

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd NAV
```

### 2. Backend

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r backend/requirements.txt
```

### 3. Frontend

```bash
cd frontend
npm install
```

## Running

Open two terminals from the project root.

**Terminal 1 — Backend:**
```powershell
.\start_backend.bat
# API running at http://localhost:8000
```

**Terminal 2 — Frontend:**
```powershell
.\start_frontend.bat
# Dashboard at http://localhost:5173
```

## Input File Format

The system accepts `.xlsx` files. Two upload modes are supported:

### All-in-one
A single workbook containing all required sheets:

| Sheet Name | Contents |
|---|---|
| `NAV` | NAV calculation blocks, one per date, with submitted and calculated columns side by side |
| `System Report` | Portfolio holdings from the fund system |
| `CustodianData` | Portfolio holdings from the custodian |

### Sheet by Sheet
Upload each sheet as a separate `.xlsx` file. The system picks the first sheet from each file automatically.

## CLI Usage

The validator can also be run directly from the command line without the dashboard:

```bash
python nav_validator.py path/to/file.xlsx
```

## Validation Rules

- **NAV fields** — compared with a tolerance of ±0.01
- **Portfolio quantity** — exact match required
- **Portfolio price / market value** — tolerance of ±0.01
