import { describe, expect, it } from 'vitest';
import {
  getVisibleRangeForPreset,
  toLineSeriesData,
  type ChartRangePreset
} from './chartData';
import type { DailyPriceRow } from './types';

const rows: DailyPriceRow[] = [
  { date: '2026-04-22', wti: 61.2345, brent: 65.4321, spread: 4.1976 },
  { date: '2026-05-20', wti: 62.11, brent: 66.44, spread: 4.33 },
  { date: '2026-05-22', wti: 63.78, brent: 68.12, spread: 4.34 },
  { date: '2026-06-19', wti: 73.84, brent: 77.01, spread: 3.17 },
  { date: '2026-06-22', wti: 75.14, brent: 78.85, spread: 3.71 }
];

describe('chart data adapter', () => {
  it('maps daily rows to TradingView line points without rounding or date shifts', () => {
    expect(toLineSeriesData(rows, 'wti')).toEqual([
      { time: '2026-04-22', value: 61.2345 },
      { time: '2026-05-20', value: 62.11 },
      { time: '2026-05-22', value: 63.78 },
      { time: '2026-06-19', value: 73.84 },
      { time: '2026-06-22', value: 75.14 }
    ]);

    expect(toLineSeriesData(rows, 'brent')[4]).toEqual({ time: '2026-06-22', value: 78.85 });
    expect(toLineSeriesData(rows, 'spread')[0]).toEqual({ time: '2026-04-22', value: 4.1976 });
  });

  it.each<ChartRangePreset>(['1m', '3m', '6m', '1y'])(
    'anchors %s ranges to the latest official datapoint',
    (preset) => {
      const range = getVisibleRangeForPreset(rows, preset);

      expect(range?.to).toBe('2026-06-22');
      expect(range?.lastDataDate).toBe('2026-06-22');
    }
  );

  it('uses calendar month math for the default one-month inspection range', () => {
    expect(getVisibleRangeForPreset(rows, '1m')).toEqual({
      from: '2026-05-22',
      to: '2026-06-22',
      firstDataDate: '2026-05-22',
      lastDataDate: '2026-06-22'
    });
  });

  it('keeps all-data range tied to the first and latest available FRED rows', () => {
    expect(getVisibleRangeForPreset(rows, 'all')).toEqual({
      from: '2026-04-22',
      to: '2026-06-22',
      firstDataDate: '2026-04-22',
      lastDataDate: '2026-06-22'
    });
  });
});
