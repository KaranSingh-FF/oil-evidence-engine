import { describe, expect, it } from 'vitest';
import { buildRegimeProfiles, eventMatchesRegime, filterEventsByRegime } from './regimes';
import type { DailyPriceRow, EventRow } from './types';

const rows: DailyPriceRow[] = [
  { date: '2026-06-01', wti: 100, brent: 103, spread: 3 },
  { date: '2026-06-02', wti: 101, brent: 104, spread: 3 },
  { date: '2026-06-03', wti: 102, brent: 105, spread: 3 },
  { date: '2026-06-04', wti: 110, brent: 115, spread: 5 },
  { date: '2026-06-05', wti: 118, brent: 124, spread: 6 },
  { date: '2026-06-08', wti: 119, brent: 121, spread: 2 }
];

const events: EventRow[] = [
  {
    id: 'slow',
    date: '2026-06-03',
    family: 'api-wsb',
    label: 'API Weekly Statistical Bulletin',
    sourceStatus: 'calendar-proxy',
    sourceUrl: '',
    qualityNote: 'calendar proxy',
    supportedWindows: ['event-day', '1d', '3d', '5d', 'next-week'],
    excludeFromCoreStats: false
  },
  {
    id: 'fast',
    date: '2026-06-05',
    family: 'eia-wpsr',
    label: 'EIA Weekly Petroleum Status Report',
    sourceStatus: 'calendar-proxy',
    sourceUrl: '',
    qualityNote: 'calendar proxy',
    supportedWindows: ['event-day', '1d', '3d', '5d', 'next-week'],
    excludeFromCoreStats: false
  }
];

describe('regime filters', () => {
  it('classifies volatility, trend, and spread regimes from price rows', () => {
    const profiles = buildRegimeProfiles(rows, { trendLookback: 3, volatilityLookback: 2 });

    expect(profiles.get('2026-06-03')?.volatility).toBe('low');
    expect(profiles.get('2026-06-05')?.volatility).toBe('high');
    expect(profiles.get('2026-06-05')?.trend).toBe('wti-uptrend');
    expect(profiles.get('2026-06-05')?.spread).toBe('wide');
    expect(eventMatchesRegime(profiles.get('2026-06-05'), 'spread-wide')).toBe(true);
  });

  it('filters events by selected regime without changing event dates', () => {
    const filtered = filterEventsByRegime(events, buildRegimeProfiles(rows), 'high-volatility');

    expect(filtered.map((event) => event.id)).toEqual(['fast']);
  });
});
