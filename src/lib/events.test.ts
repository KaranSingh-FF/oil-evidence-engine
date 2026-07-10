import { describe, expect, it } from 'vitest';
import {
  detectAbnormalEvents,
  generateFundamentalEvents,
  generateRecurringEvents,
  mergeDirectEventsWithCalendar
} from './events';
import type { DailyPriceRow, EventRow, FundamentalRecord } from './types';

const rows: DailyPriceRow[] = [
  { date: '2026-06-01', wti: 70, brent: 74, spread: 4 },
  { date: '2026-06-02', wti: 71, brent: 75, spread: 4 },
  { date: '2026-06-03', wti: 80, brent: 84, spread: 4 },
  { date: '2026-06-04', wti: 81, brent: 85, spread: 4 },
  { date: '2026-06-05', wti: 82, brent: 86, spread: 4 },
  { date: '2026-06-08', wti: 83, brent: 87, spread: 4 },
  { date: '2026-06-09', wti: 82, brent: 86, spread: 4 },
  { date: '2026-06-10', wti: 84, brent: 88, spread: 4 },
  { date: '2026-06-12', wti: 85, brent: 89, spread: 4 }
];

describe('recurring event generation', () => {
  it('creates calendar-proxy events for core weekly factors', () => {
    const events = generateRecurringEvents(rows);
    expect(events.some((event) => event.family === 'eia-wpsr' && event.date === '2026-06-03')).toBe(true);
    expect(events.some((event) => event.family === 'api-wsb' && event.date === '2026-06-02')).toBe(true);
    expect(events.some((event) => event.family === 'cftc-cot' && event.date === '2026-06-05')).toBe(true);
    expect(events.some((event) => event.family === 'rig-count' && event.date === '2026-06-05')).toBe(true);
    expect(events.every((event) => event.sourceStatus === 'calendar-proxy')).toBe(true);
  });

  it('marks intraday windows as disabled until imported candle data exists', () => {
    const events = generateRecurringEvents(rows);
    expect(events[0].supportedWindows).not.toContain('intraday-30m-4h');
    expect(events[0].qualityNote).toContain('Daily public baseline');
  });

  it('detects abnormal price moves as explanation-only events', () => {
    const abnormal = detectAbnormalEvents(rows, 8);
    expect(abnormal).toHaveLength(1);
    expect(abnormal[0].family).toBe('abnormal-news');
    expect(abnormal[0].date).toBe('2026-06-03');
    expect(abnormal[0].excludeFromCoreStats).toBe(true);
  });
});

describe('fundamental event generation and calendar merging', () => {
  const eiaCalendarProxy: EventRow = {
    id: 'eia-wpsr-2026-06-03-1030et',
    date: '2026-06-03',
    family: 'eia-wpsr',
    label: 'EIA Weekly Petroleum Status Report',
    sourceStatus: 'calendar-proxy',
    sourceUrl: 'https://www.eia.gov/petroleum/supply/weekly/',
    releaseTime: '10:30 ET',
    qualityNote: 'calendar proxy',
    supportedWindows: ['event-day', '1d', '3d', '5d', 'next-week'],
    excludeFromCoreStats: false
  };

  const apiCalendarProxy: EventRow = {
    ...eiaCalendarProxy,
    id: 'api-wsb-2026-06-03-afterclose',
    family: 'api-wsb',
    label: 'API Weekly Statistical Bulletin'
  };

  const fundamentalRecord = (
    metricId: FundamentalRecord['metricId'],
    actual: number,
    expected: number,
    provenance: FundamentalRecord['provenance'] = 'official'
  ): FundamentalRecord => ({
    date: '2026-06-03',
    family: 'eia-wpsr',
    metricId,
    metric: '',
    actual,
    expected,
    unit: '',
    source: 'EIA WPSR',
    surprise: Number((actual - expected).toFixed(4)),
    provenance,
    sourceKind: provenance,
    surpriseQuality: provenance
  });

  const directEiaEvent = (id: string): EventRow => ({
    ...eiaCalendarProxy,
    id,
    label: 'EIA WPSR surprise basket',
    sourceStatus: 'direct',
    qualityNote: 'direct EIA event',
    evidenceProvenance: 'official',
    evidenceQuality: 'official',
    metricCount: 2
  });

  const directApiEvent: EventRow = {
    ...apiCalendarProxy,
    id: 'api-wsb-2026-06-03-direct',
    sourceStatus: 'direct',
    qualityNote: 'direct API event',
    evidenceProvenance: 'imported',
    evidenceQuality: 'imported',
    metricCount: 2
  };

  it('generates direct two-metric EIA baskets that replace same-date EIA calendar proxies', () => {
    const directEvents = generateFundamentalEvents([
      fundamentalRecord('crude_stocks_change', 2, -1),
      fundamentalRecord('gasoline_stocks_change', -3, 1)
    ]);

    expect(directEvents).toHaveLength(1);
    expect(directEvents[0]).toMatchObject({
      date: '2026-06-03',
      family: 'eia-wpsr',
      sourceStatus: 'direct',
      evidenceProvenance: 'official',
      metricCount: 2,
      excludeFromCoreStats: false
    });

    const merged = mergeDirectEventsWithCalendar(
      [eiaCalendarProxy, apiCalendarProxy],
      directEvents
    );

    expect(merged).toHaveLength(2);
    expect(merged).toContain(apiCalendarProxy);
    expect(merged.find((event) => event.family === 'eia-wpsr')).toBe(directEvents[0]);
  });

  it('dedupes duplicate EIA calendar proxies when replacing with direct evidence', () => {
    const directEvents = generateFundamentalEvents([
      fundamentalRecord('crude_stocks_change', 2, -1),
      fundamentalRecord('gasoline_stocks_change', -3, 1)
    ]);

    const merged = mergeDirectEventsWithCalendar(
      [eiaCalendarProxy, { ...eiaCalendarProxy }, apiCalendarProxy],
      directEvents
    );

    expect(merged).toHaveLength(2);
    expect(merged.filter((event) => event.family === 'eia-wpsr' && event.sourceStatus === 'direct')).toHaveLength(1);
    expect(merged).toContain(apiCalendarProxy);
  });

  it('keeps one qualifying EIA direct marker per date while preserving non-EIA direct events', () => {
    const firstEiaDirect = directEiaEvent('eia-wpsr-2026-06-03-basket-a');
    const secondEiaDirect = directEiaEvent('eia-wpsr-2026-06-03-basket-b');

    const merged = mergeDirectEventsWithCalendar(
      [eiaCalendarProxy],
      [firstEiaDirect, secondEiaDirect, directApiEvent]
    );

    expect(merged.filter((event) => event.family === 'eia-wpsr' && event.sourceStatus === 'direct')).toEqual([
      firstEiaDirect
    ]);
    expect(merged).toContain(directApiEvent);
    expect(merged).not.toContain(eiaCalendarProxy);
  });

  it('keeps the EIA calendar proxy when direct evidence has only one metric', () => {
    const directEvents = generateFundamentalEvents([
      fundamentalRecord('crude_stocks_change', 2, -1)
    ]);

    const merged = mergeDirectEventsWithCalendar([eiaCalendarProxy], directEvents);

    expect(directEvents[0]).toMatchObject({
      sourceStatus: 'direct',
      metricCount: 1,
      excludeFromCoreStats: false
    });
    expect(merged).toContain(eiaCalendarProxy);
    expect(merged).toContain(directEvents[0]);
  });

  it('keeps the EIA calendar proxy and excluded sample basket when all evidence is sample-only', () => {
    const directEvents = generateFundamentalEvents([
      fundamentalRecord('crude_stocks_change', 2, -1, 'sample'),
      fundamentalRecord('gasoline_stocks_change', -3, 1, 'sample')
    ]);

    const merged = mergeDirectEventsWithCalendar([eiaCalendarProxy], directEvents);

    expect(directEvents[0]).toMatchObject({
      sourceStatus: 'calendar-proxy',
      evidenceProvenance: 'sample',
      metricCount: 0,
      excludeFromCoreStats: true
    });
    expect(merged).toContain(eiaCalendarProxy);
    expect(merged).toContain(directEvents[0]);
  });

  it.each(['Demo source', 'Official demo source', 'Imported synthetic feed', 'Manual sample note'])(
    'keeps %s baskets from replacing EIA calendar proxies without explicit provenance',
    (source) => {
      const directEvents = generateFundamentalEvents([
        {
          ...fundamentalRecord('crude_stocks_change', 2, -1, undefined),
          source,
          provenance: undefined,
          sourceKind: undefined,
          surpriseQuality: undefined
        },
        {
          ...fundamentalRecord('gasoline_stocks_change', -3, 1, undefined),
          source,
          provenance: undefined,
          sourceKind: undefined,
          surpriseQuality: undefined
        }
      ]);

      const merged = mergeDirectEventsWithCalendar([eiaCalendarProxy], directEvents);

      expect(directEvents[0]).toMatchObject({
        sourceStatus: 'calendar-proxy',
        evidenceProvenance: 'sample',
        metricCount: 0,
        excludeFromCoreStats: true
      });
      expect(merged).toContain(eiaCalendarProxy);
      expect(merged).toContain(directEvents[0]);
    }
  );

  it('allows explicit non-sample provenance to override descriptive source text', () => {
    const directEvents = generateFundamentalEvents([
      {
        ...fundamentalRecord('crude_stocks_change', 2, -1, 'official'),
        source: 'Official demo import label'
      },
      {
        ...fundamentalRecord('gasoline_stocks_change', -3, 1, 'official'),
        source: 'Official demo import label'
      }
    ]);

    const merged = mergeDirectEventsWithCalendar([eiaCalendarProxy], directEvents);

    expect(directEvents[0]).toMatchObject({
      sourceStatus: 'direct',
      evidenceProvenance: 'official',
      metricCount: 2,
      excludeFromCoreStats: false
    });
    expect(merged).not.toContain(eiaCalendarProxy);
  });
});
