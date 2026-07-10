import { describe, expect, it } from 'vitest';
import { buildReportResponses } from './reportResponses';
import type { DailyPriceRow, EventRow, FundamentalRecord } from './types';

const rows: DailyPriceRow[] = [
  { date: '2026-06-03', wti: 100, brent: 102, spread: 2 },
  { date: '2026-06-04', wti: 102, brent: 105, spread: 3 },
  { date: '2026-06-05', wti: 104, brent: 107, spread: 3 },
  { date: '2026-06-08', wti: 108, brent: 110, spread: 2 }
];

const proxyEvent: EventRow = {
  id: 'eia-2026-06-03-proxy',
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

const directEvent: EventRow = {
  ...proxyEvent,
  id: 'eia-wpsr-2026-06-03-basket',
  label: 'EIA WPSR surprise basket',
  sourceStatus: 'direct',
  basketLabel: 'bullish',
  basketScore: 0.35,
  metricCount: 2,
  evidenceProvenance: 'official',
  evidenceQuality: 'official'
};

const apiEvent: EventRow = {
  ...proxyEvent,
  id: 'api-2026-06-02',
  date: '2026-06-04',
  family: 'api-wsb',
  label: 'API Weekly Statistical Bulletin',
  sourceStatus: 'calendar-proxy',
  releaseTime: 'after U.S. close'
};

const abnormalEvent: EventRow = {
  ...proxyEvent,
  id: 'abnormal-2026-06-04',
  date: '2026-06-04',
  family: 'abnormal-news',
  label: 'Abnormal candle',
  sourceStatus: 'news-annotation',
  excludeFromCoreStats: true
};

const fundamentals: FundamentalRecord[] = [
  {
    date: '2026-06-03',
    family: 'eia-wpsr',
    metric: 'commercial crude stocks',
    metricId: 'crude_stocks_change',
    actual: -3.2,
    expected: 0.4,
    unit: 'mb',
    source: 'official',
    surprise: -3.6,
    provenance: 'official'
  }
];

describe('EIA report responses', () => {
  it('shows one response row per public report release with report read and WTI/Brent moves', () => {
    const responses = buildReportResponses(rows, [proxyEvent, directEvent, apiEvent, abnormalEvent], fundamentals);

    expect(responses.map((row) => row.event.id)).toEqual([
      'api-2026-06-02',
      'eia-wpsr-2026-06-03-basket'
    ]);
    expect(responses[0].reportRead).toBe('API Weekly Statistical Bulletin proxy');
    expect(responses[0].componentSummary).toBe('Calendar/public release timing; direct surprise values not loaded');
    expect(responses[1].reportRead).toBe('Bullish report (+0.35)');
    expect(responses[1].componentSummary).toContain('commercial crude stocks: -3.6 mb');
    expect(responses[1].wti1d?.returnPct).toBeCloseTo(2);
    expect(responses[1].wti3d?.returnPct).toBeCloseTo(8);
    expect(responses[1].brent3d?.returnPct).toBeCloseTo(7.84, 2);
    expect(responses[1].verdict).toBe('Confirmed by price');
  });
});
