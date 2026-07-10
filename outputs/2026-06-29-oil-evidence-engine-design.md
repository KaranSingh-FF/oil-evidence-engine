# WTI and Brent Evidence Engine Design

Date: 2026-06-29

## Goal

Build an interactive research dashboard and report workflow for WTI and Brent crude oil that helps the user place recurring fundamentals on top of an existing technical trading strategy. The tool should identify repeatable post-event behavior, annotate abnormal news-driven candles for historical explanation, and avoid treating one-off news shocks as strategy signals.

This is not intended to replace the user's technical entries. It is a filter and context layer: confirm, avoid, expect volatility, or no repeatable edge.

## Confirmed Scope

The user approved the evidence-engine approach with these choices:

- Price baseline: free daily public data.
- Timeframe design: multi-timeframe, with daily/weekly available first and intraday enabled only when the user provides suitable candle data.
- History range: last 5 years.
- Markets: WTI, Brent, and Brent-WTI spread behavior.
- Output: interactive local dashboard plus written research report.
- Abnormal movement handling: annotate abnormal news candles and exclude them from core repeatable-pattern statistics by default.
- Factors: include all proposed recurring factor families.
- Measures: direction, volatility expansion, follow-through, Brent-vs-WTI response, and strategy-filter labels.
- Reaction windows: same-day close, 1D, 3D, 5D, next weekly candle, plus 30m-4h only when intraday data is available.

## Data Sources

The implementation should start with public, documented data sources and keep paid or user-provided data optional.

### Price Data

- WTI daily spot baseline: FRED series `DCOILWTICO`.
- Brent daily spot baseline: FRED series `DCOILBRENTEU`.
- Optional futures OHLC: free market-data source if reliable symbols are confirmed.
- Optional intraday candles: user-provided TradingView or broker CSV export.

Daily spot data is enough for event-day, 1D, 3D, 5D, and weekly analysis. It is not enough for 30m-4h release-window research.

### Recurring Fundamentals

Weekly factors:

- EIA Weekly Petroleum Status Report: crude inventories, Cushing, gasoline and distillate stocks, refinery utilization, production, imports, exports, and SPR.
- API Weekly Statistical Bulletin: useful as a Tuesday precursor if accessible.
- CFTC Commitments of Traders: managed money, producer/merchant positioning, net length, open interest, and percentile/extreme positioning.
- Baker Hughes rig count: oil rig changes as a slower supply-side signal.

Monthly or scheduled factors:

- EIA Short-Term Energy Outlook.
- OPEC Monthly Oil Market Report.
- IEA Oil Market Report.
- OPEC/OPEC+ scheduled meetings and quota decisions.
- Major U.S. macro events: FOMC, CPI, NFP, PMI/ISM, and USD/risk sentiment proxies.
- Futures roll and expiry windows for WTI and Brent.
- Spread and refinery context: Brent-WTI spread, backwardation/contango, crack-spread proxies if available, refinery utilization.
- Seasonality: U.S. driving season, refinery maintenance periods, hurricane season, and year-end liquidity.

News shocks such as war, sanctions, outages, and surprise policy headlines should be treated as abnormal annotations unless the user explicitly includes them in an alternative run.

## Dashboard Design

The dashboard should have three primary regions:

1. Controls panel
   - Market selector: WTI, Brent, Brent-WTI spread.
   - Timeframe selector: daily, weekly, imported intraday.
   - Event-window selector: same day, 1D, 3D, 5D, next weekly candle, 30m-4h where supported.
   - Factor selector: EIA, API, COT, rigs, monthly reports, OPEC meetings, macro/USD, roll/expiry, spreads/refinery, seasonality, abnormal news.
   - Toggle: exclude abnormal news from statistics.
   - Timezone setting for release timing and candle boundaries.

2. Chart panel
   - Candlestick or OHLC-style chart for WTI and Brent.
   - Optional spread chart for Brent-WTI.
   - Event markers on candles.
   - Marker categories: scheduled reports, positioning/regime factors, macro events, roll/expiry, seasonality, abnormal news.
   - Hover or click annotation explaining the factor, release context, observed reaction, and whether it was included in stats.

3. Evidence panel
   - Direction hit rate by factor and window.
   - Average and median return by factor and window.
   - Volatility expansion using candle range and ATR multiple.
   - Follow-through or mean-reversion statistics.
   - WTI-vs-Brent sensitivity comparison.
   - Sample size, exclusions, and confidence warnings.
   - Strategy-facing label: confirm long, confirm short, avoid, volatility expected, or no repeatable edge.

## Research Workflow

1. Build the baseline dataset.
   - Pull daily WTI and Brent data for the last 5 years.
   - Normalize dates, missing values, holidays, and timezone alignment.
   - Compute daily returns, weekly returns, ATR/range metrics, and Brent-WTI spread.

2. Build the recurring-event calendar.
   - Create event rows with date, release time where available, event family, factor values, and source.
   - Support weekly, monthly, scheduled macro, roll/expiry, and seasonal tags.
   - Preserve raw event values separately from derived signals.

3. Derive factor signals.
   - EIA/API: inventory direction and magnitude versus recent range or expectation if available.
   - COT: percentile of managed money net length and weekly change.
   - Rig count: weekly change and trend.
   - Monthly reports: revisions to demand, supply, stocks, or balance when machine-readable enough.
   - Macro/USD: risk-on/risk-off or USD proxy classification.
   - Roll/expiry: proximity windows and spread distortion flags.
   - Seasonality: calendar-window tags rather than directional assumptions.

4. Measure market response.
   - Same-day close, 1D, 3D, 5D, and next-week returns.
   - Candle range and ATR multiple.
   - Directional hit rate.
   - Brent-vs-WTI relative response and spread move.
   - Follow-through versus mean reversion.

5. Identify abnormal candles.
   - Flag returns or ranges above a configurable threshold.
   - Search or ingest news annotations for those dates.
   - Mark them as explanation-only by default.
   - Exclude them from the core repeatability stats unless the user toggles inclusion.

6. Produce outputs.
   - Interactive dashboard.
   - Written research report summarizing strongest repeating patterns, weak/non-repeatable factors, abnormal historical moves, and practical filter rules.
   - Optional CSV/JSON export with date, factor, market, bias label, volatility flag, avoid flag, and abnormal-news flag.

## Implementation Phasing

The full product includes every confirmed factor family, but the first build should be phased so the dashboard becomes useful before every integration is automated.

Phase 1: public daily evidence engine.

- Use public daily WTI and Brent prices.
- Implement the dashboard shell, chart, event-window calculations, abnormal-candle detection, scoring tables, and report generation.
- Include recurring-event calendars where dates are accessible and factor values can be downloaded or manually seeded.
- Disable intraday windows with a visible explanation until intraday CSV exists.

Phase 2: richer recurring-factor integrations.

- Add deeper EIA report fields, COT positioning, rig count, monthly report revisions, macro calendar tags, roll/expiry windows, and seasonality tags.
- Add proxy scoring where direct surprise data is unavailable.
- Improve source-specific data validation.

Phase 3: imported intraday and strategy export.

- Add TradingView or broker CSV import for WTI and Brent intraday candles.
- Enable 30m-4h release-window studies.
- Export CSV/JSON factor labels for use beside the user's technical strategy.

## Scoring Model

Each factor should be scored as evidence rather than as a guaranteed signal.

For each factor and reaction window, compute:

- Sample size.
- Mean and median return.
- Directional hit rate.
- Volatility expansion versus recent ATR.
- Follow-through rate.
- WTI-Brent relative sensitivity.
- Exclusion count for abnormal news.

The final strategy-facing label should use conservative thresholds:

- Confirm long or confirm short only when direction, magnitude, and sample quality agree.
- Volatility expected when direction is weak but range expansion is consistent.
- Avoid when abnormal-event risk, release uncertainty, or noisy historical behavior is high.
- No edge when repeatability is weak or sample size is too small.

The dashboard must show why a label was assigned, including sample count and exclusions.

## Error Handling and Data Quality

The system should make data quality visible:

- If intraday data is missing, disable 30m-4h windows and explain why.
- If a factor lacks clean machine-readable data, use a proxy only when documented.
- If event dates are unavailable or ambiguous, keep the factor hidden or marked "needs source".
- If too many abnormal events are excluded, warn that the sample may be unstable.
- If WTI and Brent calendars differ because of holidays or missing prices, align carefully and flag dropped rows.

## Testing and Verification

The first implementation should include:

- Unit tests for event-window calculations.
- Unit tests for abnormal-event exclusion.
- Unit tests for factor scoring thresholds.
- Data sanity checks for missing dates, duplicate events, and WTI/Brent alignment.
- A small fixture dataset so scoring logic can be verified without network access.
- Browser verification that filters, event markers, chart hover states, and report sections render correctly.

## Open Configuration

These are intentionally not assumed:

- Exact traded symbols or broker contracts.
- Candle timezone.
- Whether intraday TradingView or broker CSV is available now.
- Whether any factor family should be hidden by default despite being included in the system.
- Whether the user wants a later version to generate standalone signals rather than strategy filters.

## Reference Links

- EIA Weekly Petroleum Status Report: https://www.eia.gov/petroleum/supply/weekly/
- EIA Short-Term Energy Outlook: https://www.eia.gov/outlooks/steo/
- CFTC Commitments of Traders: https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm
- Baker Hughes rig count: https://rigcount.bakerhughes.com/
- OPEC Monthly Oil Market Report: https://www.opec.org/opec_web/en/publications/338.htm
- IEA Oil Market Report: https://www.iea.org/data-and-statistics/data-product/oil-market-report-omr
- FRED WTI series: https://fred.stlouisfed.org/series/DCOILWTICO
- FRED Brent series: https://fred.stlouisfed.org/series/DCOILBRENTEU
- Federal Reserve FOMC calendars: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
- CME WTI contract information: https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.contractSpecs.html
- ICE Brent contract information: https://www.ice.com/products/219/Brent-Crude-Futures
