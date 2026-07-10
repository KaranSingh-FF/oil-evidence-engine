import { useEffect, useMemo, useState } from 'react';
import { Download, FileJson, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { ControlsPanel } from './components/ControlsPanel';
import { DataQualityPanel } from './components/DataQualityPanel';
import { EventStudyPanel } from './components/EventStudyPanel';
import { EventTimeline } from './components/EventTimeline';
import { EvidenceChart } from './components/EvidenceChart';
import { ReportResponsePanel } from './components/EiaReportResponsePanel';
import { FundamentalLabPanel } from './components/FundamentalLabPanel';
import { ImportPanel } from './components/ImportPanel';
import { PatternReviewPanel } from './components/PatternReviewPanel';
import { ReactionStoryPanel } from './components/ReactionStoryPanel';
import { ResearchReportPanel } from './components/ResearchReport';
import { ScoreCards } from './components/ScoreCards';
import { samplePriceDataset } from './data/samplePrices';
import {
  detectAbnormalEvents,
  factorOrder,
  generateFundamentalEvents,
  generateRecurringEvents,
  mergeDirectEventsWithCalendar
} from './lib/events';
import { exportEventsJson, exportReviewWorkbookCsv, exportScoresCsv } from './lib/exporters';
import { buildEventStudy } from './lib/eventStudy';
import { summarizeImportedDatasets } from './lib/imports';
import { isSampleFundamental, markFundamentalsAsSample } from './lib/fundamentalActivity';
import { normalizeDataset } from './lib/marketData';
import { buildRegimeProfiles, filterEventsByRegime } from './lib/regimes';
import { generateResearchReport } from './lib/report';
import { scoreFactors } from './lib/scoring';
import type {
  DashboardFilters,
  EventRow,
  FactorFamily,
  FundamentalRecord,
  IntradayCandle,
  NewsAnnotation,
  PriceDataset
} from './lib/types';

const initialFilters: DashboardFilters = {
  market: 'wti',
  window: '3d',
  selectedFactors: factorOrder,
  excludeAbnormal: true,
  timeframe: 'daily',
  timezone: 'Europe/London',
  regimeFilter: 'all'
};

const annotationStorageKey = 'oil-evidence-news-annotations-v2';

type EiaSourceKind = 'loading' | 'official' | 'demo' | 'unavailable';

interface BundledEiaDataset {
  records: FundamentalRecord[];
  sourceStatus: string;
  sourceKind: EiaSourceKind;
}

const initialBundledEiaDataset: BundledEiaDataset = {
  records: [],
  sourceStatus: 'EIA weekly: loading direct fundamentals.',
  sourceKind: 'loading'
};

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadStoredAnnotations(): NewsAnnotation[] {
  try {
    const raw = window.localStorage.getItem(annotationStorageKey);
    return raw ? (JSON.parse(raw) as NewsAnnotation[]) : [];
  } catch {
    return [];
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseFundamentalPayload(payload: unknown): FundamentalRecord[] {
  const candidate = Array.isArray(payload)
    ? payload
    : isObjectRecord(payload) && Array.isArray(payload.records)
      ? payload.records
      : [];

  return candidate.flatMap((item) => {
    if (!isObjectRecord(item)) return [];
    if (
      typeof item.date !== 'string'
      || typeof item.family !== 'string'
      || typeof item.metric !== 'string'
      || typeof item.actual !== 'number'
      || typeof item.expected !== 'number'
      || typeof item.unit !== 'string'
      || typeof item.source !== 'string'
    ) {
      return [];
    }

    return [{
      ...(item as unknown as FundamentalRecord),
      surprise: typeof item.surprise === 'number'
        ? item.surprise
        : Number((item.actual - item.expected).toFixed(4))
    }];
  });
}

function responseLooksJson(response: Response): boolean {
  return response.headers.get('content-type')?.toLowerCase().includes('json') ?? false;
}

function sortFamilies(families: Iterable<FactorFamily>): FactorFamily[] {
  return Array.from(new Set(families)).sort() as FactorFamily[];
}

export default function App() {
  const [dataset, setDataset] = useState<PriceDataset>(samplePriceDataset);
  const [dataState, setDataState] = useState<'loading' | 'fred' | 'sample'>('loading');
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);
  const [bundledEiaDataset, setBundledEiaDataset] = useState<BundledEiaDataset>(initialBundledEiaDataset);
  const [fundamentals, setFundamentals] = useState<FundamentalRecord[]>([]);
  const [intradayCandles, setIntradayCandles] = useState<IntradayCandle[]>([]);
  const [newsAnnotations, setNewsAnnotations] = useState<NewsAnnotation[]>(() => loadStoredAnnotations());

  useEffect(() => {
    let active = true;
    fetch('/data/prices.json')
      .then((response) => {
        if (!response.ok) throw new Error('prices.json unavailable');
        return response.json() as Promise<PriceDataset>;
      })
      .then((payload) => {
        if (!active) return;
        setDataset(normalizeDataset(payload));
        setDataState(payload.source.includes('Bundled deterministic') ? 'sample' : 'fred');
      })
      .catch(() => {
        if (!active) return;
        setDataset(samplePriceDataset);
        setDataState('sample');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadEiaFundamentals() {
      try {
        const primaryResponse = await fetch('/data/eia-weekly.json');

        if (primaryResponse.ok && responseLooksJson(primaryResponse)) {
          const records = parseFundamentalPayload(await primaryResponse.json());
          if (!active) return;
          setBundledEiaDataset({
            records,
            sourceKind: 'official',
            sourceStatus: `EIA weekly: /data/eia-weekly.json loaded (${records.length} records). Non-sample rows are active direct evidence.`
          });
          return;
        }

        const sampleResponse = await fetch('/data/eia-weekly-sample.json');
        if (!sampleResponse.ok) {
          throw new Error(`eia-weekly-sample.json unavailable (${sampleResponse.status})`);
        }

        const records = markFundamentalsAsSample(parseFundamentalPayload(await sampleResponse.json()));
        if (!active) return;
        setBundledEiaDataset({
          records,
          sourceKind: 'demo',
          sourceStatus: `EIA weekly: demo/review fixture loaded from /data/eia-weekly-sample.json (${records.length} sample rows); excluded from active markers and scoring.`
        });
      } catch {
        if (!active) return;
        setBundledEiaDataset({
          records: [],
          sourceKind: 'unavailable',
          sourceStatus: 'EIA weekly: no direct fundamentals file loaded.'
        });
      }
    }

    void loadEiaFundamentals();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(annotationStorageKey, JSON.stringify(newsAnnotations));
  }, [newsAnnotations]);

  const rows = dataset.rows;
  const combinedFundamentals = useMemo(
    () => [...bundledEiaDataset.records, ...fundamentals],
    [bundledEiaDataset.records, fundamentals]
  );
  const activeFundamentals = useMemo(
    () => combinedFundamentals.filter((record) => !isSampleFundamental(record)),
    [combinedFundamentals]
  );
  const reviewOnlyFundamentals = useMemo(
    () => combinedFundamentals.filter(isSampleFundamental),
    [combinedFundamentals]
  );
  const activeDirectFamilies = useMemo(
    () => sortFamilies(activeFundamentals.map((record) => record.family)),
    [activeFundamentals]
  );
  const regimeProfiles = useMemo(() => buildRegimeProfiles(rows), [rows]);
  const importSummary = useMemo(
    () => summarizeImportedDatasets({ fundamentals, intradayCandles }),
    [fundamentals, intradayCandles]
  );
  const events = useMemo(() => {
    const recurring = generateRecurringEvents(rows);
    const direct = generateFundamentalEvents(activeFundamentals);
    const calendarAndDirect = mergeDirectEventsWithCalendar(recurring, direct);
    const abnormal = detectAbnormalEvents(rows);
    return [...calendarAndDirect, ...abnormal].sort(
      (a, b) => a.date.localeCompare(b.date) || a.family.localeCompare(b.family)
    );
  }, [activeFundamentals, rows]);
  const regimeEvents = useMemo(
    () => filterEventsByRegime(events, regimeProfiles, filters.regimeFilter ?? 'all'),
    [events, filters.regimeFilter, regimeProfiles]
  );

  const visibleEvents = useMemo(
    () =>
      regimeEvents.filter((event) => {
        if (!filters.selectedFactors.includes(event.family)) return false;
        if (filters.excludeAbnormal && event.excludeFromCoreStats) return false;
        return event.supportedWindows.includes(filters.window);
      }),
    [regimeEvents, filters]
  );

  const activeSelectedEvent = useMemo(() => {
    if (!selectedEvent) return null;
    return visibleEvents.find((event) => event.id === selectedEvent.id) ?? null;
  }, [selectedEvent, visibleEvents]);

  useEffect(() => {
    if (selectedEvent && !activeSelectedEvent) {
      setSelectedEvent(null);
    }
  }, [activeSelectedEvent, selectedEvent]);

  const scoringWindow = filters.window === 'intraday-30m-4h' ? '3d' : filters.window;
  const scoringFilters = useMemo(
    () => ({ ...filters, window: scoringWindow }),
    [filters, scoringWindow]
  );
  const scores = useMemo(() => scoreFactors(rows, regimeEvents, scoringFilters), [rows, regimeEvents, scoringFilters]);
  const report = useMemo(() => generateResearchReport(scores, events, filters), [scores, events, filters]);
  const selectedStudy = useMemo(
    () =>
      buildEventStudy({
        rows,
        events: visibleEvents,
        selectedEvent: activeSelectedEvent,
        market: filters.market,
        fundamentals: activeFundamentals,
        newsAnnotations,
        patternWindow: scoringWindow
      }),
    [activeFundamentals, activeSelectedEvent, filters.market, newsAnnotations, rows, scoringWindow, visibleEvents]
  );

  const saveAnnotation = (annotation: NewsAnnotation) => {
    setNewsAnnotations((current) => [...current, annotation]);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>WTI & Brent Evidence Engine</h1>
          <p>{dataset.source}</p>
        </div>
        <div className="topbar-actions">
          <span className={`data-pill ${dataState}`}>{dataState === 'fred' ? 'FRED daily data' : 'sample data'}</span>
          <button
            className="icon-button"
            type="button"
            title="Download score CSV"
            onClick={() => downloadFile('oil-evidence-scores.csv', exportScoresCsv(scores), 'text/csv')}
          >
            <Download size={16} />
            Scores
          </button>
          <button
            className="icon-button"
            type="button"
            title="Download event JSON"
            onClick={() => downloadFile('oil-evidence-events.json', exportEventsJson(visibleEvents), 'application/json')}
          >
            <FileJson size={16} />
            Events
          </button>
          <button
            className="icon-button"
            type="button"
            title="Download review workbook CSV"
            onClick={() =>
              downloadFile(
                'oil-review-workbook.csv',
                exportReviewWorkbookCsv({ scores, selectedStudy, newsAnnotations }),
                'text/csv'
              )
            }
          >
            <FileSpreadsheet size={16} />
            Review
          </button>
        </div>
      </header>

      <section className="workspace">
        <ControlsPanel filters={filters} onChange={setFilters} eventCount={visibleEvents.length} />

        <section className="main-column">
          <ReactionStoryPanel
            rows={rows}
            events={visibleEvents}
            selectedEvent={activeSelectedEvent}
            scores={scores}
            window={scoringWindow}
          />
          <ReportResponsePanel rows={rows} events={events} fundamentals={activeFundamentals} />
          <EvidenceChart
            rows={rows}
            events={visibleEvents}
            filters={filters}
            selectedEvent={activeSelectedEvent}
            onSelectEvent={setSelectedEvent}
          />
          <EventStudyPanel
            study={selectedStudy}
            newsAnnotations={newsAnnotations}
            onSaveAnnotation={saveAnnotation}
          />
          <EventTimeline events={visibleEvents} selectedEvent={activeSelectedEvent} onSelectEvent={setSelectedEvent} />
        </section>

        <aside className="evidence-column">
          <ScoreCards scores={scores} />
          <PatternReviewPanel
            events={visibleEvents}
            selectedEvent={activeSelectedEvent}
            onSelectEvent={setSelectedEvent}
          />
          <DataQualityPanel
            dataset={dataset}
            rows={rows}
            events={events}
            dataState={dataState}
            filters={filters}
            importSummary={importSummary}
            activeFundamentalRecordCount={activeFundamentals.length}
            reviewOnlyFundamentalRecordCount={reviewOnlyFundamentals.length}
            directFamilies={activeDirectFamilies}
            eiaSourceStatus={bundledEiaDataset.sourceStatus}
            eiaSourceKind={bundledEiaDataset.sourceKind}
          />
          <FundamentalLabPanel
            activeFundamentals={activeFundamentals}
            reviewOnlyFundamentals={reviewOnlyFundamentals}
            eiaSourceStatus={bundledEiaDataset.sourceStatus}
          />
          <ImportPanel
            fundamentals={fundamentals}
            intradayCandles={intradayCandles}
            onFundamentalsLoaded={setFundamentals}
            onIntradayLoaded={setIntradayCandles}
          />
        </aside>
      </section>

      <section className="report-grid">
        <ResearchReportPanel report={report} />
        <div className="implementation-note">
          <RefreshCw size={18} />
          <div>
            <h2>Phase 1 boundary</h2>
            <p>
              Daily event studies, regime filtering, manual annotations, and CSV imports are active.
              30m-4h scoring stays guarded until release timestamps are explicitly aligned.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
