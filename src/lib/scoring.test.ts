import { describe, expect, it } from 'vitest';
import { scoreFactors } from './scoring';
import type { DailyPriceRow, EventRow, FactorFamily, SourceStatus } from './types';

const rows: DailyPriceRow[] = [
  { date: '2026-06-01', wti: 100, brent: 102, spread: 2 },
  { date: '2026-06-02', wti: 100, brent: 102, spread: 2 },
  { date: '2026-06-03', wti: 100, brent: 102, spread: 2 },
  { date: '2026-06-04', wti: 102, brent: 103, spread: 1 },
  { date: '2026-06-05', wti: 104, brent: 104, spread: 0 },
  { date: '2026-06-08', wti: 106, brent: 105, spread: -1 },
  { date: '2026-06-09', wti: 108, brent: 106, spread: -2 },
  { date: '2026-06-10', wti: 110, brent: 107, spread: -3 },
  { date: '2026-06-11', wti: 111, brent: 108, spread: -3 },
  { date: '2026-06-12', wti: 112, brent: 109, spread: -3 }
];

const events: EventRow[] = [
  {
    id: 'eia-1',
    date: '2026-06-03',
    family: 'eia-wpsr',
    label: 'EIA weekly petroleum status report',
    sourceStatus: 'calendar-proxy',
    sourceUrl: 'https://www.eia.gov/petroleum/supply/weekly/',
    releaseTime: '10:30 ET',
    qualityNote: 'Daily public baseline; report surprise values not loaded.',
    supportedWindows: ['event-day', '1d', '3d', '5d', 'next-week'],
    excludeFromCoreStats: false
  },
  {
    id: 'news-1',
    date: '2026-06-04',
    family: 'abnormal-news',
    label: 'Abnormal candle',
    sourceStatus: 'news-annotation',
    sourceUrl: '',
    qualityNote: 'Large move flagged for annotation.',
    supportedWindows: ['event-day', '1d', '3d', '5d', 'next-week'],
    excludeFromCoreStats: true
  }
];

function dateFromOffset(offset: number): string {
  const date = new Date(Date.UTC(2020, 0, 1 + offset));
  return date.toISOString().slice(0, 10);
}

function generatedRows(count: number): DailyPriceRow[] {
  return Array.from({ length: count }, (_, index) => ({
    date: dateFromOffset(index),
    wti: 100 + index * 0.01,
    brent: 102 + index * 0.01,
    spread: 2
  }));
}

function scoringEvent({
  id,
  date,
  family = 'eia-wpsr',
  sourceStatus = 'calendar-proxy',
  excludeFromCoreStats = false,
  evidenceProvenance
}: {
  id: string;
  date: string;
  family?: FactorFamily;
  sourceStatus?: SourceStatus;
  excludeFromCoreStats?: boolean;
  evidenceProvenance?: EventRow['evidenceProvenance'];
}): EventRow {
  return {
    id,
    date,
    family,
    label: 'Scoring event',
    sourceStatus,
    sourceUrl: '',
    qualityNote: 'test event',
    supportedWindows: ['event-day', '1d', '3d', '5d', 'next-week'],
    excludeFromCoreStats,
    evidenceProvenance
  };
}

describe('factor scoring', () => {
  it('computes score rows and excludes abnormal annotations by default', () => {
    const scores = scoreFactors(rows, events, {
      market: 'wti',
      window: '3d',
      selectedFactors: ['eia-wpsr', 'abnormal-news'],
      excludeAbnormal: true,
      timeframe: 'daily',
      timezone: 'Europe/London'
    });
    expect(scores).toHaveLength(1);
    expect(scores[0].family).toBe('eia-wpsr');
    expect(scores[0].sampleSize).toBe(1);
    expect(scores[0].meanReturn).toBeCloseTo(6);
    expect(scores[0].label).toBe('no-edge');
    expect(scores[0].confidenceScore).toBeGreaterThanOrEqual(0);
    expect(scores[0].confidenceScore).toBeLessThanOrEqual(100);
    expect(scores[0].maxAdverseReturn).toBeLessThanOrEqual(0);
    expect(scores[0].abnormalShare).toBe(0);
  });

  it('includes abnormal annotations when exclusion is off', () => {
    const scores = scoreFactors(rows, events, {
      market: 'wti',
      window: '1d',
      selectedFactors: ['abnormal-news'],
      excludeAbnormal: false,
      timeframe: 'daily',
      timezone: 'Europe/London'
    });
    expect(scores[0].family).toBe('abnormal-news');
    expect(scores[0].sampleSize).toBe(1);
    expect(scores[0].excludedAbnormal).toBe(0);
  });

  it('marks a scored direct/manual-only family as direct and ignores unscored family events', () => {
    const scores = scoreFactors(rows, [
      scoringEvent({
        id: 'direct-1',
        date: '2026-06-03',
        sourceStatus: 'manual',
        evidenceProvenance: 'user'
      }),
      scoringEvent({
        id: 'future-proxy',
        date: '2026-07-01'
      })
    ], {
      market: 'wti',
      window: '1d',
      selectedFactors: ['eia-wpsr'],
      excludeAbnormal: true,
      timeframe: 'daily',
      timezone: 'Europe/London'
    });

    expect(scores[0]).toMatchObject({
      sampleSize: 1,
      directEvidenceShare: 100,
      evidenceTier: 'direct'
    });
  });

  it('marks families with both direct and proxy scored observations as mixed', () => {
    const scores = scoreFactors(rows, [
      scoringEvent({
        id: 'direct-1',
        date: '2026-06-03',
        sourceStatus: 'direct',
        evidenceProvenance: 'official'
      }),
      scoringEvent({
        id: 'proxy-1',
        date: '2026-06-04'
      })
    ], {
      market: 'wti',
      window: '1d',
      selectedFactors: ['eia-wpsr'],
      excludeAbnormal: true,
      timeframe: 'daily',
      timezone: 'Europe/London'
    });

    expect(scores[0]).toMatchObject({
      sampleSize: 2,
      directEvidenceShare: 50,
      evidenceTier: 'mixed'
    });
  });

  it('treats scored sample evidence as proxy evidence', () => {
    const scores = scoreFactors(rows, [
      scoringEvent({
        id: 'sample-direct',
        date: '2026-06-03',
        sourceStatus: 'direct',
        evidenceProvenance: 'sample'
      })
    ], {
      market: 'wti',
      window: '1d',
      selectedFactors: ['eia-wpsr'],
      excludeAbnormal: true,
      timeframe: 'daily',
      timezone: 'Europe/London'
    });

    expect(scores[0]).toMatchObject({
      sampleSize: 1,
      directEvidenceShare: 0,
      evidenceTier: 'proxy'
    });
  });

  it('deduplicates same-date calendar proxy and one-metric direct EIA events for scoring', () => {
    const sameDateEvents = [
      scoringEvent({
        id: 'proxy-2026-06-03',
        date: '2026-06-03'
      }),
      scoringEvent({
        id: 'direct-one-metric-2026-06-03',
        date: '2026-06-03',
        sourceStatus: 'direct',
        evidenceProvenance: 'official'
      })
    ];

    const scores = scoreFactors(rows, sameDateEvents, {
      market: 'wti',
      window: '1d',
      selectedFactors: ['eia-wpsr'],
      excludeAbnormal: true,
      timeframe: 'daily',
      timezone: 'Europe/London'
    });

    expect(scores[0]).toMatchObject({
      sampleSize: 1,
      directEvidenceShare: 100,
      evidenceTier: 'direct'
    });
  });

  it('computes evidence tier from raw direct and proxy counts before display rounding', () => {
    const largeRows = generatedRows(2001);
    const manyEvents = Array.from({ length: 2000 }, (_, index) =>
      scoringEvent({
        id: `event-${index}`,
        date: dateFromOffset(index),
        sourceStatus: index === 1999 ? 'calendar-proxy' : 'direct',
        evidenceProvenance: index === 1999 ? undefined : 'official'
      })
    );

    const scores = scoreFactors(largeRows, manyEvents, {
      market: 'wti',
      window: '1d',
      selectedFactors: ['eia-wpsr'],
      excludeAbnormal: true,
      timeframe: 'daily',
      timezone: 'Europe/London'
    });

    expect(scores[0]).toMatchObject({
      sampleSize: 2000,
      directEvidenceShare: 100,
      evidenceTier: 'mixed'
    });
  });
});
