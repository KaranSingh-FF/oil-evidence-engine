# Oil Evidence Engine Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local interactive WTI/Brent evidence-engine dashboard using public daily price data, recurring event calendars, abnormal-candle exclusions, factor scoring, and a written research report.

**Architecture:** A Vite + React + TypeScript app will run locally and load prebuilt JSON data from `public/data`. Pure TypeScript modules will handle market series normalization, recurring event generation, event-window calculations, abnormal-candle detection, factor scoring, and report text so they can be tested independently from the UI. The UI will expose controls, a chart, event annotations, scorecards, and exportable CSV/JSON outputs.

**Tech Stack:** Vite, React, TypeScript, Vitest, lightweight SVG charting, PowerShell data fetch script, public FRED CSV downloads for WTI/Brent daily spot prices.

---

### Task 1: Scaffold The Local App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Create package and build configuration**

Create a Vite React TypeScript project with scripts:

```json
{
  "name": "oil-evidence-engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "fetch:data": "powershell -ExecutionPolicy Bypass -File scripts/fetch-fred-prices.ps1"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "vitest": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```powershell
& 'C:\Users\deepanshu.goyal\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' install
```

Expected: `node_modules` and `pnpm-lock.yaml` are created.

- [ ] **Step 3: Add the initial React shell**

`src/main.tsx` should mount `<App />`. `src/App.tsx` should render the first real application frame titled "WTI and Brent Evidence Engine" with empty states for data, factors, and report sections. `src/styles.css` should define the base app shell and responsive layout.

- [ ] **Step 4: Verify the shell**

Run:

```powershell
& 'C:\Users\deepanshu.goyal\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' build
```

Expected: TypeScript and Vite build pass.

### Task 2: Add Market Data Fetch And Fixtures

**Files:**
- Create: `scripts/fetch-fred-prices.ps1`
- Create: `src/data/samplePrices.ts`
- Create: `src/lib/types.ts`
- Create: `public/data/prices.json`

- [ ] **Step 1: Define shared types**

Create TypeScript interfaces for daily price rows, market IDs, event rows, factor families, score rows, abnormal flags, and dashboard filters.

- [ ] **Step 2: Add FRED fetch script**

Create a PowerShell script that downloads `DCOILWTICO` and `DCOILBRENTEU`, filters to the last five years, aligns by date, and writes:

```json
{
  "generatedAt": "2026-06-29T00:00:00.000Z",
  "source": "FRED DCOILWTICO and DCOILBRENTEU",
  "rows": [
    { "date": "2021-06-29", "wti": 72.98, "brent": 74.05, "spread": 1.07 }
  ]
}
```

- [ ] **Step 3: Add fallback sample data**

Create `src/data/samplePrices.ts` with a small deterministic 30-row fixture so the app can render and tests can run even if the network fetch is unavailable.

- [ ] **Step 4: Run data fetch**

Run:

```powershell
& 'C:\Users\deepanshu.goyal\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' run fetch:data
```

Expected: `public/data/prices.json` exists and contains aligned WTI/Brent rows.

### Task 3: Implement Core Event And Scoring Logic With Tests

**Files:**
- Create: `src/lib/dateUtils.ts`
- Create: `src/lib/marketData.ts`
- Create: `src/lib/events.ts`
- Create: `src/lib/scoring.ts`
- Create: `src/lib/report.ts`
- Create: `src/lib/exporters.ts`
- Test: `src/lib/dateUtils.test.ts`
- Test: `src/lib/events.test.ts`
- Test: `src/lib/scoring.test.ts`
- Test: `src/lib/report.test.ts`

- [ ] **Step 1: Write failing tests for event windows**

Tests should verify next-trading-day lookup, same-day return, 1D/3D/5D forward returns, weekly return, and missing-date handling.

- [ ] **Step 2: Implement date and market helpers**

Add pure functions: `parseDateKey`, `addCalendarDays`, `findNextTradingIndex`, `getReturnForWindow`, `computeReturns`, and `computeAtrProxy`.

- [ ] **Step 3: Write failing tests for recurring event generation**

Tests should verify generated EIA Wednesday events, COT Friday events, rig-count Friday events, month-window events, seasonality tags, and intraday-disabled metadata.

- [ ] **Step 4: Implement event generation**

Generate event rows from actual price dates and mark each event as `calendar-proxy` unless a direct value source is present. Include source URLs and data-quality notes.

- [ ] **Step 5: Write failing tests for abnormal exclusions and scoring**

Tests should prove abnormal events are excluded by default, included when toggled, and that labels return `confirm-long`, `confirm-short`, `volatility-expected`, `avoid`, or `no-edge`.

- [ ] **Step 6: Implement scoring**

For each factor/window/market combination, compute sample size, mean return, median return, direction hit rate, average ATR proxy, abnormal exclusion count, and strategy label.

- [ ] **Step 7: Implement report and exporters**

Generate readable markdown-style report sections and CSV/JSON exports from score rows and events.

- [ ] **Step 8: Run unit tests**

Run:

```powershell
& 'C:\Users\deepanshu.goyal\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' test
```

Expected: all core logic tests pass.

### Task 4: Build The Interactive Dashboard UI

**Files:**
- Create: `src/components/ControlsPanel.tsx`
- Create: `src/components/EvidenceChart.tsx`
- Create: `src/components/EventTimeline.tsx`
- Create: `src/components/ScoreCards.tsx`
- Create: `src/components/ResearchReport.tsx`
- Create: `src/components/DataQualityPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add controls panel**

Controls must include market, timeframe, event window, factor families, abnormal-exclusion toggle, and timezone display.

- [ ] **Step 2: Add SVG evidence chart**

Render WTI, Brent, or spread as a responsive line chart with event markers, abnormal markers, hover details, and selected-event state.

- [ ] **Step 3: Add scorecards and timeline**

Show direction hit rate, average return, volatility proxy, sample size, exclusions, and strategy label for the selected filter set.

- [ ] **Step 4: Add research report and exports**

Show strongest patterns, weak/noisy factors, abnormal historical moves, and buttons to download CSV/JSON outputs.

- [ ] **Step 5: Add data-quality messaging**

Show that 30m-4h intraday windows are disabled until TradingView or broker CSV is imported. Show calendar-proxy warnings for factors without direct surprise values.

- [ ] **Step 6: Build and manually inspect**

Run:

```powershell
& 'C:\Users\deepanshu.goyal\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' build
```

Expected: build passes and the dashboard renders.

### Task 5: Browser Verification And Delivery

**Files:**
- Modify only if verification finds visual or interaction defects.

- [ ] **Step 1: Start the dev server**

Run:

```powershell
& 'C:\Users\deepanshu.goyal\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' dev -- --port 5173
```

Expected: local dashboard available at `http://127.0.0.1:5173/`.

- [ ] **Step 2: Verify interactions**

Use browser checks to confirm:

- market switch updates the chart and scores;
- factor filters update event markers and scorecards;
- abnormal-exclusion toggle changes sample counts;
- report text updates with selections;
- CSV/JSON export buttons work;
- mobile width does not overlap controls, chart, and scorecards.

- [ ] **Step 3: Final verification**

Run:

```powershell
& 'C:\Users\deepanshu.goyal\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' test
& 'C:\Users\deepanshu.goyal\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' build
```

Expected: both commands pass.
