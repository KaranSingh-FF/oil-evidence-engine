import { describe, expect, it } from 'vitest';
import { addCalendarDays, findNextTradingIndex, findWindowEndIndex } from './dateUtils';
import { getReturnForWindow } from './marketData';
import type { DailyPriceRow } from './types';

const rows: DailyPriceRow[] = [
  { date: '2026-06-01', wti: 70, brent: 74, spread: 4 },
  { date: '2026-06-02', wti: 71, brent: 75, spread: 4 },
  { date: '2026-06-03', wti: 72, brent: 76, spread: 4 },
  { date: '2026-06-04', wti: 73, brent: 75, spread: 2 },
  { date: '2026-06-05', wti: 74, brent: 77, spread: 3 },
  { date: '2026-06-08', wti: 78, brent: 80, spread: 2 },
  { date: '2026-06-09', wti: 76, brent: 78, spread: 2 }
];

describe('date utilities and event windows', () => {
  it('adds calendar days without timezone drift', () => {
    expect(addCalendarDays('2026-06-03', 5)).toBe('2026-06-08');
  });

  it('finds the next available trading date after a weekend', () => {
    expect(findNextTradingIndex(rows, '2026-06-06')).toBe(5);
  });

  it('resolves event-day and forward trading windows', () => {
    const eventIndex = findNextTradingIndex(rows, '2026-06-03');
    expect(findWindowEndIndex(rows, eventIndex, 'event-day')).toBe(2);
    expect(findWindowEndIndex(rows, eventIndex, '1d')).toBe(3);
    expect(findWindowEndIndex(rows, eventIndex, '3d')).toBe(5);
    expect(findWindowEndIndex(rows, eventIndex, '5d')).toBe(6);
    expect(findWindowEndIndex(rows, eventIndex, 'next-week')).toBe(6);
  });

  it('calculates market returns for a selected window', () => {
    const result = getReturnForWindow(rows, '2026-06-03', '3d', 'wti');
    expect(result?.returnPct).toBeCloseTo(8.333, 2);
    expect(result?.startDate).toBe('2026-06-03');
    expect(result?.endDate).toBe('2026-06-08');
  });
});
