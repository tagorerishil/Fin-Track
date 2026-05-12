# FinTrack — Personal Finance Tracker
### Complete Project Documentation

---

## Overview

**FinTrack** is a privacy-first, single-page personal finance web application built entirely with vanilla HTML, CSS, and JavaScript. It runs locally in a browser (served via any static file server) and stores all data in **browser localStorage** — no server, no login, no data leaves your device.

The app is centered on the **50-30-20 budgeting rule** (customizable), extended with EMI tracking, bank statement import, and multi-month spending analytics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Structure | HTML5 (semantic) |
| Styling | Vanilla CSS with CSS custom properties |
| Logic | Vanilla JavaScript (ES6+, no frameworks) |
| Charts | [Chart.js v4.4.0](https://cdn.jsdelivr.net/npm/chart.js) via CDN |
| PDF parsing | [pdf.js v3.11.174](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/) via CDN |
| Storage | `localStorage` (`fintrack_data` key) |
| Server | Python `http.server` (development) |

---

## File Structure

```
finance-tracker/
├── index.html       # App shell, all tab HTML, modals, navigation
├── index.css        # All styles, design tokens, responsive breakpoints
├── app.js           # Core data, dashboard, expenses, budget, monthly view
├── tabs-extra.js    # EMI tracker & bike affordability tab logic
└── tabs-import.js   # Bank statement import (CSV/PDF) & spending patterns
```

---

## Data Model

All application state lives in a single object persisted to `localStorage`:

```js
{
  salary: Number,           // Monthly net salary
  needsPct: Number,         // % allocated to Needs (default 50)
  wantsPct: Number,         // % allocated to Wants (default 30)
  savingsPct: Number,       // % allocated to Savings (default 20)

  fixedExpenses: [{         // Recurring monthly costs (auto-added each month)
    name: String,
    amount: Number,
    type: 'Need' | 'Want' | 'Saving',
    category: String
  }],

  expenses: [{              // Individual transaction log
    id: String,             // Unique ID (timestamp-based)
    date: 'YYYY-MM-DD',
    desc: String,
    category: String,       // Life Infrastructure | Future Me | Performance & Growth | etc.
    amount: Number,
    payment: String,        // UPI | Cash | Credit Card | Debit Card | Bank Transfer
    type: 'Need' | 'Want' | 'Saving',
    note: String
  }],

  emis: [{                  // Active loan EMIs
    id: String,
    name: String,
    amount: Number,         // Monthly EMI amount
    totalLoan: Number,      // Original principal
    rate: Number,           // Annual interest rate (%)
    tenure: Number,         // Total months
    paid: Number,           // Months already paid
    startDate: 'YYYY-MM-DD',
    category: String        // Personal Loan | Home Loan | Vehicle Loan | etc.
  }],

  bike: {                   // Vehicle cost tracking
    emi: Number,
    fuel: Number,
    insurance: Number,
    maintenance: Number
  },

  importHistory: [{         // Log of statement imports
    date: ISO String,
    source: String,
    count: Number,
    file: String
  }]
}
```

**Data migrations** run at startup (`loadData()`) to add new fields to existing saved data without breaking backward compatibility.

---

## Tabs & Features

### 1. 🏠 Dashboard

The main overview screen. Recalculates on every visit and on month/year selector change.

**Budget Formula (EMI-first):**
```
Disposable Income = Salary − Total EMIs
Needs Budget      = Disposable × needsPct%
Wants Budget      = Disposable × wantsPct%
Savings Budget    = Disposable × savingsPct%
```

**Summary Cards:**
- **Monthly Salary** — Gross salary
- **Monthly EMIs** — Auto-summed from EMI Tracker; shows % of salary with a red progress bar
- **Needs / Wants / Savings** — Budget cap with progress bar showing how much is spent

**Charts:**
- **Budget vs Actual** (grouped bar) — EMIs, Needs, Wants, Savings with budget vs spent columns
- **Category Breakdown** (doughnut) — Spending split by expense category for the selected month

**Remaining Budget Panel:**
- Monthly EMI deduction
- Disposable income
- Total spent (excluding EMIs)
- Remaining per category (color-coded: green = under, red = over)
- Overall remaining cash

**Fixed Monthly Expenses list** — Pulled from budget setup, displayed for reference.

---

### 2. 💸 Expenses Tab

Daily expense tracker — the core log of all transactions.

**Adding/Editing:**
- Date, Description, Category, Amount, Payment Mode, Type (Need/Want/Saving), Note
- Category auto-sets the Type (e.g., "Future Me" → Saving, "Lifestyle Enjoyment" → Want)
- Edit reopens the form pre-filled; Save overwrites by ID

**Filters (per-month, independent of dashboard):**
- Month selector + **Year selector** — Scoped to the expenses tab only (not linked to dashboard)
- Category filter
- Type filter

**Bulk Edit:**
- Checkbox on each row + Select All in header
- When ≥1 selected, a **Bulk Edit Bar** appears below the table
- Bulk change Category and/or Type for all selected rows at once
- Apply / Clear Selection buttons

**Delete Actions:**
- Individual delete via 🗑️ button → custom confirmation modal
- **Delete All** button (red, top-right) → confirmation modal showing count

**Export CSV:**
- Sidebar button exports all expenses as a `.csv` file (sorted by date)

---

### 3. ⚙️ Budget Setup Tab

Configure salary and allocation percentages.

**Income & Allocation:**
- Input salary and Needs/Wants/Savings percentages
- **Live Allocation Preview** recalculates as you type, showing:
  - EMIs (Fixed) deduction from salary
  - Disposable income after EMIs
  - Needs / Wants / Savings amounts based on disposable income

**Monthly EMI Obligations (read-only):**
- Lists all active EMIs pulled from the EMI Tracker
- Shows total EMI burden and disposable income after EMIs
- Note: "50-30-20 applies to salary *after* EMIs"

**Fixed Monthly Expenses:**
- Fully editable list of recurring costs (rent, food, etc.)
- Each row: Name, Amount, Type, Category — all editable inline
- Changes save immediately and refresh the dashboard
- **Auto-add behavior:** On app load for the current month, all fixed expenses are automatically pushed into the expenses log (once per month, tracked via a separate localStorage key)

---

### 4. 🏦 EMI Tracker Tab

Track all active loans with repayment progress.

**Add / Edit EMI:**
- Fields: Name, Monthly Amount, Principal, Interest Rate, Tenure, Months Paid, Start Date, Category
- Calculates remaining months and projected end date automatically

**Summary Cards:**
- Total Monthly EMI + % of salary
- Total loan outstanding across all EMIs
- Salary after all EMIs
- **EMI Health indicator:** Healthy (< 35%), High (35-50%), Critical (> 50%) — color-coded

**EMI Table:**
- Name, Category, Monthly Amount, Principal, Interest Rate
- Progress bar showing % paid
- Remaining months + projected end date
- Edit ✏️ / Delete 🗑️ per row

**EMI Burden Breakdown:**
- Waterfall: Salary → EMIs deducted → After-EMI salary → Other fixed expenses → Free cash
- Each loan's total remaining obligation (months left × EMI amount)

**EMI Distribution Chart** (doughnut) — proportion of each loan in total EMI burden.

---

### 5. 🏍️ Bike Costs Tab

Track ongoing vehicle ownership costs (separate from EMIs).

**Monthly cost inputs:**
- Bike EMI, Fuel, Insurance, Maintenance
- Shows total monthly cost

**Cost breakdown chart** (doughnut) — lifetime estimated cost split across categories.

---

### 6. 📊 Bike Affordability Tab

Decision-support tool: *"Can I afford to add a bike right now?"*

**Verdict system:**
| Condition | Result |
|---|---|
| Free cash after bike < 0 | 🚫 Cannot Afford |
| Can afford but savings target missed | ⚠️ Tight — Savings Impacted |
| All obligations met | ✅ Affordable |

**Displays:**
- Bike cost as % of income, free cash after adding bike, total obligations %
- **Income Waterfall** — horizontal bar chart: Salary → EMIs → Living → Bike EMI → Fuel → Ins+Maint → Remaining
- **Affordability Pie** — salary split across all obligation categories
- **Scenario Comparison Bar** — Current (No Bike) vs With Bike (EMI period) vs With Bike (Post-EMI)
- **Smart Recommendations** — Dynamic advice based on EMI burden, deficit, buffer levels

---

### 7. 📁 Import Tab (Statement Import)

Import bank or credit card statements as CSV or PDF files.

#### CSV Import Flow

1. **Upload** — drag & drop or click to browse (`.csv`, `.tsv` accepted)
2. **Smart Header Detection** — Scans first 30 rows looking for banking keywords (`date`, `narration`, `debit`, `credit`, `balance`, etc.) to skip preamble rows (account name, account number, period info). The actual data table header is auto-detected.
3. **Delimiter Detection** — Checks comma vs tab across multiple rows, picks whichever gives more columns
4. **Column Mapping UI:**
   - Dropdowns for: Date, Description, Debit, Credit, Amount
   - Options show `[N] ColumnName` format for easy matching with preview
   - **Auto-detection** pre-selects likely columns based on header keywords
   - **Live validation** shows ⚠️ warnings or ✅ "Ready to import" as you map
5. **Data Preview** — First 10 rows shown with column index numbers in headers
6. **Import:**
   - **Debit-only logic:** If both Debit and Credit columns are mapped, rows where only Credit has a value (salary, refunds, deposits) are **skipped** — they are income, not expenses
   - Amount parsing handles Indian formatting (`1,23,456.78`), currency symbols (`₹`), and empty strings
   - All imported transactions default to `Life Infrastructure` / `Need` — use Bulk Edit in Expenses tab to recategorize
   - **Confirmation alert** shows: imported count + skipped credit transaction count

#### PDF Import Flow

1. **Upload** — drag & drop or click (`.pdf` accepted)
2. **Client-side extraction** via pdf.js — no data sent to any server
3. **Text reconstruction** — Items grouped by Y-coordinate to rebuild table rows from PDF text streams
4. **Transaction detection** — Lines are scanned for date patterns at the start:
   - Formats: `dd/mm/yyyy`, `dd-mm-yyyy`, `dd Mon yyyy`, `dd-Mon-yyyy`
5. **Amount detection** — Requires comma-formatted or decimal amounts (`1,234` or `500.00`); minimum ₹5 threshold; `lastIndex` reset per iteration to avoid regex state bugs
6. **Preview & Selection** — Extracted transactions shown in a table with checkboxes; user selects which rows to import
7. **Import** — Selected transactions are pushed to expenses with source noted in description

#### Import History

- Every import is logged with: timestamp, source (Bank/Credit Card), filename, count
- Displayed in reverse-chronological order on the Import tab

---

### 8. 📈 Patterns Tab (Spending Analytics)

Analyzes the most recent **3 months** of expense data.

**Summary Cards:**
- 3-Month Total Spent
- Average Monthly Spend
- Average per Transaction
- Avg vs Salary (color-coded)

**Charts:**
- **Monthly Spending Trend** (bar + salary line) — Month-by-month total with salary reference line
- **Category Split** (doughnut) — 3-month category distribution
- **Needs vs Wants vs Savings Trend** (stacked bar) — Type breakdown per month
- **Week-of-Month Spending** (bar) — Average spend by week (1-7, 8-14, 15-21, 22-28, 29-31) across 3 months

**Top Merchants/Descriptions:**
- Top 10 payees ranked by total spent over 3 months
- Shows: rank, name, frequency, total amount, relative bar

**Spending Insights (auto-generated text):**
- Month-over-month spending trend (% increase/decrease)
- Warning if Wants > 60% of Needs
- Highest-spend week identification
- Alert if average monthly spend exceeds salary
- Biggest single expense category

---

### 9. 📅 Monthly View Tab

Month + year selectable calendar and charts.

**Spending Calendar:**
- Full month grid (Sun–Sat)
- Each day shows total spent if > 0
- Today highlighted; high-spend days (> 1.5× daily average) highlighted in a different color

**Daily Trend Chart** (line) — Day-by-day spending curve for the month

**Payment Mode Chart** (pie) — How money was spent: UPI, Cash, Credit Card, Debit Card, Bank Transfer

---

## Mobile Responsiveness

**Breakpoints:**

| Width | Behavior |
|---|---|
| > 1024px | Full sidebar, 2-column grids |
| ≤ 1024px | 2-column summary cards, single-column grids |
| ≤ 768px | Hamburger menu, sidebar slides in as overlay, filters stack vertically, table scrolls horizontally |
| ≤ 480px | Single-column cards, smaller fonts |

**Hamburger Menu:**
- Fixed ☰ button at top-left on mobile
- Clicking opens sidebar as a slide-in panel
- Dark overlay (`sidebar-overlay`) closes sidebar on tap-outside
- Nav links auto-close sidebar on mobile tap

---

## Expense Categories

| Category | Default Type |
|---|---|
| Life Infrastructure | Need |
| Future Me | Saving |
| Performance & Growth | Need |
| Relationships & Generosity | Want |
| Lifestyle Enjoyment | Want |

---

## Key Design Decisions

### EMI-First Budget
EMIs are deducted from salary *before* the 50-30-20 split is applied. The percentages apply to disposable income, not gross salary. This gives a realistic picture of actually available spending money.

### Credit Transactions Skipped on Import
When a bank statement has both Debit and Credit columns mapped, rows with only a Credit value (salary, refunds, deposits) are automatically skipped. Only Debit rows (expenses, withdrawals) are imported.

### Auto-Fixed Expense Injection
Fixed expenses defined in Budget Setup are automatically added to the expenses log on the first load of each calendar month. This ensures recurring costs appear in the dashboard without manual entry. A flag (`fixed_added_YYYY_M`) in localStorage prevents double-adding.

### Privacy-First Architecture
- No network requests (except CDN loads for Chart.js and pdf.js on page load)
- All CSV and PDF parsing happens entirely in the browser
- No user accounts, no sync, no telemetry
- All data stored only in the local browser's localStorage

### Unique IDs for Expenses
Every expense gets a timestamp-based unique ID (`uid()`). This allows reliable edit, delete, and bulk operations without relying on array index positions, which change after deletions.

### Custom Delete Modal
A shared custom confirmation modal (`deleteModal`) handles all delete operations (individual expense, individual EMI, Delete All). The `pendingDeleteId` / `pendingDeleteType` state pattern routes the confirm action to the right handler.

---

## Running the App

```bash
# From the finance-tracker/ directory
python -m http.server 8080

# Then open in browser:
http://localhost:8080
```

Any static file server works. No build step required.

---

## Dependency Versions (CDN)

```
Chart.js       v4.4.0   (jsdelivr.net)
pdf.js         v3.11.174 (cdnjs.cloudflare.com)
pdf.js worker  v3.11.174 (cdnjs.cloudflare.com)
Google Fonts   Inter (300, 400, 500, 600, 700, 800)
```

---

## Known Limitations & Future Improvements

| Area | Current State | Possible Improvement |
|---|---|---|
| PDF parsing | Text-extraction heuristic; accuracy varies by bank | Use tabula-style bounding-box parsing |
| Default categories | All imports default to "Life Infrastructure / Need" | Add keyword-based auto-categorization |
| Data backup | localStorage only; cleared if browser data is wiped | Add export/import full data JSON |
| Multi-currency | INR (₹) only | Currency selector with conversion |
| EMI calculator | Manual entry only | EMI formula auto-fill from principal + rate + tenure |
| Year range | 2024–2030 hardcoded | Dynamic range based on actual data 
