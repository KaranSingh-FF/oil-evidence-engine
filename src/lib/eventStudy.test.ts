import { describe, expect, it } from 'vitest';
import { buildEventStudy } from './eventStudy';
import type { DailyPriceRow, EventRow, FundamentalRecord, NewsAnnotation } from './types';

const rows: DailyPriceRow[] = [
  { date: '2026-06-01', wti: 100, brent: 103, spread: 3 },
  { date: '2026-06-02', wti: 101, brent: 104, spread: 3 },
  { date: '2026-06-03', wti: 102, brent: 105, spread: 3 },
  { date: '2026-06-04', wti: 104, brent: 106, spread: 2 },
  { date: '2026-06-05', wti: 106, brent: 108, spread: 2 },
  { date: '2026-06-08', wti: 109, brent: 110, spread: 1 },
  { date: '2026-06-09', wti: 108, brent: 111, spread: 3 },
  { date: '2026-06-10', wti: 107, brent: 112, spread: 5 },
  { date: '2026-06-11', wti: 106, brent: 111, spread: 5 },
  { date: '2026-06-12', wti: 105, brent: 110, spread: 5 }
];

const events: EventRow[] = [
  {
    id: 'eia-2026-06-03',
    date: '2026-06-03',
    family: 'eia-wpsr',
    label: 'EIA Weekly Petroleum Status Report',
    sourceStatus: 'calendar-proxy',
    sourceUrl: 'https://www.eia.gov/petroleum/supply/weekly/',
    releaseTime: '10:30 ET',
    qualityNote: 'calendar proxy',
    supportedWindows: ['event-day', '1d', '3d', '5d', 'next-week'],
    excludeFromCoreStats: false
  },
  {
    id: 'eia-2026-06-10',
    date: '2026-06-10',
    family: 'eia-wpsr',
    label: 'EIA Weekly Petroleum Status Report',
    sourceStatus: 'calendar-proxy',
    sourceUrl: 'https://www.eia.gov/petroleum/supply/weekly/',
    releaseTime: '10:30 ET',
    qualityNote: 'calendar proxy',
    supportedWindows: ['event-day', '1d', '3d', '5d', 'next-week'],
    excludeFromCoreStats: false
  }
];

const fundamentals: FundamentalRecord[] = [
  {
    date: '2026-06-03',
    family: 'eia-wpsr',
    metric: 'commercial crude stocks',
    actual: 2.1,
    expected: -1,
    unit: 'mb',
    source: 'manual-import',
    surprise: 3.1
  }
];

const newsAnnotations: NewsAnnotation[] = [
  {
    eventId: 'eia-2026-06-03',
    category: 'inventory-shock',
    headline: 'Large crude build',
    note: 'Treat as one-off unless confirmed by repeated surprise data.'
  }
];

const eiaComponents: FundamentalRecord[] = [
  {
    date: '2026-06-03',
    family: 'eia-wpsr',
    metric: 'commercial crude stocks',
    metricId: 'crude_stocks_change',
    actual: 2.1,
    expected: -1,
    unit: 'mb',
    source: 'EIA WPSR',
    surprise: 3.1,
    surpriseQuality: 'official',
    provenance: 'official'
  },
  {
    date: '2026-06-03',
    family: 'eia-wpsr',
    metric: 'gasoline stocks',
    metricId: 'gasoline_stocks_change',
    actual: -1.4,
    expected: 0.5,
    unit: 'mb',
    source: 'EIA WPSR',
    surprise: -1.9,
    surpriseQuality: 'official',
    provenance: 'official'
  }
];

describe('event study drilldown', () => {
  it('builds selected-event window returns and pattern occurrence history', () => {
    const study = buildEventStudy({
      rows,
      events,
      selectedEvent: events[0],
      market: 'wti',
      fundamentals,
      newsAnnotations
    });

    if (!study) throw new Error('Expected selected event study');
    expect(study.selectedEvent.id).toBe('eia-2026-06-03');
    expect(study.windows.map((window) => window.window)).toEqual([
      'event-day',
      '1d',
      '3d',
      '5d',
      'next-week'
    ]);
    expect(study.windows.find((window) => window.window === '3d')?.returnPct).toBeCloseTo(6.86, 2);
    expect(study.fundamental?.surprise).toBe(3.1);
    expect(study.newsAnnotations[0].category).toBe('inventory-shock');
    expect(study.occurrences).toHaveLength(2);
    expect(study.patternStats.sampleSize).toBe(2);
    expect(study.patternStats.positiveRate).toBe(50);
  });

  it('keeps all selected direct EIA components and occurrence basket context', () => {
    const selectedDirectEvent: EventRow = {
      ...events[0],
      id: 'eia-wpsr-2026-06-03-basket',
      label: 'EIA WPSR surprise basket',
      sourceStatus: 'direct',
      evidenceProvenance: 'official',
      evidenceQuality: 'official',
      basketScore: 0.22,
      basketLabel: 'bullish',
      metricCount: 2
    };

    const study = buildEventStudy({
      rows,
      events: [selectedDirectEvent, events[1]],
      selectedEvent: selectedDirectEvent,
      market: 'wti',
      fundamentals: eiaComponents
    });

    if (!study) throw new Error('Expected selected event study');
    const components = (study as unknown as { fundamentalComponents?: FundamentalRecord[] }).fundamentalComponents;

    expect(components?.map((component) => component.metric)).toEqual([
      'commercial crude stocks',
      'gasoline stocks'
    ]);
    expect(study.fundamental?.metric).toBe('commercial crude stocks');
    expect(study.occurrences[0]).toMatchObject({
      eventId: 'eia-wpsr-2026-06-03-basket',
      fundamentalSurprise: 0.22,
      basketScore: 0.22,
      basketLabel: 'bullish',
      componentCount: 2
    });
  });

  it('uses normalized EIA basket components instead of raw duplicate or unknown rows', () => {
    const selectedDirectEvent: EventRow = {
      ...events[0],
      id: 'eia-wpsr-2026-06-03-basket',
      label: 'EIA WPSR surprise basket',
      sourceStatus: 'direct',
      evidenceProvenance: 'official',
      evidenceQuality: 'official',
      basketScore: 0.22,
      basketLabel: 'bullish',
      metricCount: 2
    };

    const dirtyComponents: FundamentalRecord[] = [
      {
        date: '2026-06-03',
        family: 'eia-wpsr',
        metric: 'commercial crude stocks',
        actual: 9.9,
        expected: -1,
        unit: 'mb',
        source: 'imported duplicate',
        surprise: 10.9,
        surpriseQuality: 'imported',
        provenance: 'imported'
      },
      ...eiaComponents,
      {
        date: '2026-06-03',
        family: 'eia-wpsr',
        metric: 'mystery refinery delta',
        actual: 12,
        expected: 0,
        unit: 'unknown',
        source: 'manual row',
        surprise: 12,
        surpriseQuality: 'user',
        provenance: 'user'
      }
    ];

    const study = buildEventStudy({
      rows,
      events: [selectedDirectEvent],
      selectedEvent: selectedDirectEvent,
      market: 'wti',
      fundamentals: dirtyComponents
    });

    if (!study) throw new Error('Expected selected event study');
    expect(study.fundamentalComponents.map((component) => component.metricId)).toEqual([
      'crude_stocks_change',
      'gasoline_stocks_change'
    ]);
    expect(study.fundamentalComponents.map((component) => component.source)).toEqual([
      'EIA WPSR',
      'EIA WPSR'
    ]);
    expect(study.fundamentalComponents.map((component) => component.metric)).not.toContain('mystery refinery delta');
    expect(study.fundamentalComponents.find((component) => component.metricId === 'crude_stocks_change')?.actual).toBe(2.1);
  });

  it('deduplicates same-date calendar proxy and one-metric direct EIA events in occurrence history', () => {
    const proxyEvent = events[0];
    const oneMetricDirectEvent: EventRow = {
      ...proxyEvent,
      id: 'eia-wpsr-2026-06-03-one-metric',
      label: 'EIA WPSR single metric surprise',
      sourceStatus: 'direct',
      evidenceProvenance: 'official',
      evidenceQuality: 'official',
      metricCount: 1
    };

    const study = buildEventStudy({
      rows,
      events: [proxyEvent, oneMetricDirectEvent],
      selectedEvent: oneMetricDirectEvent,
      market: 'wti'
    });

    if (!study) throw new Error('Expected selected event study');
    expect(study.occurrences).toHaveLength(1);
    expect(study.occurrences[0].eventId).toBe('eia-wpsr-2026-06-03-one-metric');
    expect(study.patternStats.sampleSize).toBe(1);
  });
});
