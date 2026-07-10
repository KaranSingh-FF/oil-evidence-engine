import { AlertTriangle, Database, Info } from 'lucide-react';
import { factorLabels } from '../lib/events';
import type {
  DashboardFilters,
  DailyPriceRow,
  EventRow,
  FactorFamily,
  ImportedDataSummary,
  PriceDataset
} from '../lib/types';

type EiaSourceKind = 'loading' | 'official' | 'demo' | 'unavailable';

interface DataQualityPanelProps {
  dataset: PriceDataset;
  rows: DailyPriceRow[];
  events: EventRow[];
  dataState: 'loading' | 'fred' | 'sample';
  filters: DashboardFilters;
  importSummary: ImportedDataSummary;
  activeFundamentalRecordCount: number;
  reviewOnlyFundamentalRecordCount: number;
  directFamilies: FactorFamily[];
  eiaSourceStatus: string;
  eiaSourceKind: EiaSourceKind;
}

const emptyImportSummary: ImportedDataSummary = {
  fundamentalRecords: 0,
  directFamilies: [],
  intradayCandles: 0,
  intradayMarkets: []
};

function countWeekdayGaps(rows: DailyPriceRow[]): number {
  if (rows.length < 2) return 0;
  const dates = new Set(rows.map((row) => row.date));
  const start = new Date(`${rows[0].date}T00:00:00.000Z`);
  const end = new Date(`${rows[rows.length - 1].date}T00:00:00.000Z`);
  let gaps = 0;

  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.getUTCDay();
    const key = cursor.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !dates.has(key)) gaps += 1;
  }

  return gaps;
}

function daysSince(date: string | undefined): number | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((todayUtc - parsed.getTime()) / 86_400_000);
}

export function DataQualityPanel({
  dataset,
  rows,
  events,
  dataState,
  filters,
  importSummary = emptyImportSummary,
  activeFundamentalRecordCount,
  reviewOnlyFundamentalRecordCount,
  directFamilies,
  eiaSourceStatus,
  eiaSourceKind
}: DataQualityPanelProps) {
  const proxyCount = events.filter((event) => event.sourceStatus === 'calendar-proxy').length;
  const directCount = events.filter((event) => event.sourceStatus === 'direct').length;
  const manualCount = events.filter((event) => event.sourceStatus === 'manual').length;
  const abnormalCount = events.filter(
    (event) => event.family === 'abnormal-news' && event.excludeFromCoreStats
  ).length;
  const weekdayGaps = countWeekdayGaps(rows);
  const priceStatusText = dataState === 'loading'
    ? 'Loading price data.'
    : dataState === 'fred'
      ? dataset.source
      : 'Using sample price data until FRED fetch is run.';
  const eiaStatusTone = eiaSourceKind === 'official' ? 'good' : 'warn';
  const latestDate = rows[rows.length - 1]?.date;
  const staleDays = daysSince(latestDate);
  const priceFresh = staleDays !== null && staleDays <= 7;
  const hasDirectFundamentals = activeFundamentalRecordCount > 0;
  const hasProxyEvents = proxyCount > 0;
  const tradeReady = dataState === 'fred' && priceFresh && hasDirectFundamentals && !hasProxyEvents;

  return (
    <section className="quality-panel">
      <div className="panel-heading">
        <Database size={18} />
        <h2>Data Quality</h2>
      </div>

      <dl className="quality-list">
        <div>
          <dt>Price rows</dt>
          <dd>{rows.length}</dd>
        </div>
        <div>
          <dt>Latest</dt>
          <dd>{rows[rows.length - 1]?.date ?? 'No data'}</dd>
        </div>
        <div>
          <dt>Proxy events</dt>
          <dd>{proxyCount}</dd>
        </div>
        <div>
          <dt>Direct events</dt>
          <dd>{directCount}</dd>
        </div>
        <div>
          <dt>Manual events</dt>
          <dd>{manualCount}</dd>
        </div>
        <div>
          <dt>Active funds</dt>
          <dd>{activeFundamentalRecordCount}</dd>
        </div>
        <div>
          <dt>Review-only</dt>
          <dd>{reviewOnlyFundamentalRecordCount}</dd>
        </div>
        <div>
          <dt>Direct families</dt>
          <dd>{directFamilies.length}</dd>
        </div>
        <div>
          <dt>Intraday candles</dt>
          <dd>{importSummary.intradayCandles}</dd>
        </div>
        <div>
          <dt>Abnormal excl.</dt>
          <dd>{abnormalCount}</dd>
        </div>
        <div>
          <dt>Weekday gaps</dt>
          <dd>{weekdayGaps}</dd>
        </div>
        <div>
          <dt>Regime</dt>
          <dd>{filters.regimeFilter ?? 'all'}</dd>
        </div>
      </dl>

      <div className={`quality-callout ${tradeReady ? 'good' : 'warn'}`}>
        {tradeReady ? <Info size={17} /> : <AlertTriangle size={17} />}
        <span>
          {tradeReady
            ? 'Trade-readiness gate: direct fundamentals and fresh official prices are loaded with no proxy rows in scope.'
            : 'Trade-readiness gate: research-only until official dated releases and direct actual-vs-expected values are loaded for the reports you trade.'}
        </span>
      </div>

      <div className={`quality-callout ${priceFresh ? 'good' : 'warn'}`}>
        {priceFresh ? <Info size={17} /> : <AlertTriangle size={17} />}
        <span>
          {staleDays === null
            ? 'Price freshness could not be determined.'
            : priceFresh
              ? `Price freshness: latest aligned WTI/Brent row is ${latestDate} (${staleDays} days old).`
              : `Price freshness warning: latest aligned WTI/Brent row is ${latestDate} (${staleDays} days old). Refresh FRED data before live use.`}
        </span>
      </div>

      <div className={`quality-callout ${hasProxyEvents ? 'warn' : 'good'}`}>
        {hasProxyEvents ? <AlertTriangle size={17} /> : <Info size={17} />}
        <span>
          {hasProxyEvents
            ? `${proxyCount} rows are calendar proxies. These show market response around expected public release timing, not actual report surprise. Holiday-adjusted official release dates must be imported for production use.`
            : 'No calendar proxy rows are in the current event set.'}
        </span>
      </div>

      <div className={`quality-callout ${dataState === 'fred' ? 'good' : 'warn'}`}>
        {dataState === 'fred' ? <Info size={17} /> : <AlertTriangle size={17} />}
        <span>{priceStatusText}</span>
      </div>

      <div className={`quality-callout ${eiaStatusTone}`}>
        {eiaSourceKind === 'official' ? <Info size={17} /> : <AlertTriangle size={17} />}
        <span>{eiaSourceStatus}</span>
      </div>

      <div className="quality-callout warn">
        <AlertTriangle size={17} />
        <span>
          30m-4h scoring remains off until imported candles are aligned to exact release timestamps.
        </span>
      </div>

      <div className={`quality-callout ${activeFundamentalRecordCount ? 'good' : 'warn'}`}>
        {activeFundamentalRecordCount ? <Info size={17} /> : <AlertTriangle size={17} />}
        <span>
          {activeFundamentalRecordCount
            ? `${activeFundamentalRecordCount} active actual-vs-expected records loaded; ${reviewOnlyFundamentalRecordCount} demo/sample/synthetic rows remain review-only.`
            : reviewOnlyFundamentalRecordCount
              ? `No active actual-vs-expected records loaded; ${reviewOnlyFundamentalRecordCount} demo/sample/synthetic rows are review-only.`
              : 'No active actual-vs-expected records loaded.'}
        </span>
      </div>

      {directFamilies.length ? (
        <div className="source-chip-list">
          {directFamilies.map((family) => (
            <span key={family}>{factorLabels[family]}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
