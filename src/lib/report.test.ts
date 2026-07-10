import { describe, expect, it } from 'vitest';
import { exportScoresCsv } from './exporters';
import { generateResearchReport } from './report';
import type { DashboardFilters, EventRow, ScoreRow } from './types';

const filters: DashboardFilters = {
  market: 'wti',
  window: '3d',
  selectedFactors: ['eia-wpsr'],
  excludeAbnormal: true,
  timeframe: 'daily',
  timezone: 'Europe/London'
};

const scores = [
  {
    family: 'eia-wpsr',
    market: 'wti',
    window: '3d',
    sampleSize: 24,
    excludedAbnormal: 2,
    meanReturn: 0.8,
    medianReturn: 0.5,
    directionHitRate: 62.5,
    averageAbsReturn: 1.4,
    averageAtrMultiple: 1.2,
    label: 'confirm-long',
    confidenceScore: 78,
    maxAdverseReturn: -1.2,
    abnormalShare: 7.7,
    recencyBias: 0.2,
    directEvidenceShare: 100,
    evidenceTier: 'direct'
  }
] as Array<ScoreRow & { directEvidenceShare: number; evidenceTier: 'direct' }>;

const events: EventRow[] = [
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

describe('report and export output', () => {
  it('generates research sections with strategy-filter language', () => {
    const report = generateResearchReport(scores, events, filters);
    expect(report.summary).toContain('WTI');
    expect(report.strongestPatterns[0]).toContain('EIA');
    expect(report.abnormalNotes[0]).toContain('2026-06-04');
  });

  it('exports score rows as CSV', () => {
    const csv = exportScoresCsv(scores);
    expect(csv).toContain('family,market,window');
    expect(csv).toContain('evidenceTier,directEvidenceShare');
    expect(csv).toContain('eia-wpsr,wti,3d');
    expect(csv).toContain('confirm-long,direct,100');
  });
});
