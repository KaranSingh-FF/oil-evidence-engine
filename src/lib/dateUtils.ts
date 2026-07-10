import type { DailyPriceRow, EventWindow } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addCalendarDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  return formatDateKey(new Date(date.getTime() + days * DAY_MS));
}

export function getUtcDay(dateKey: string): number {
  return parseDateKey(dateKey).getUTCDay();
}

export function getUtcDateOfMonth(dateKey: string): number {
  return parseDateKey(dateKey).getUTCDate();
}

export function getUtcMonth(dateKey: string): number {
  return parseDateKey(dateKey).getUTCMonth();
}

export function getMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function findNextTradingIndex(rows: DailyPriceRow[], dateKey: string): number {
  return rows.findIndex((row) => row.date >= dateKey);
}

export function findWindowEndIndex(
  rows: DailyPriceRow[],
  startIndex: number,
  window: EventWindow
): number {
  if (startIndex < 0 || startIndex >= rows.length) return -1;
  if (window === 'event-day' || window === 'intraday-30m-4h') return startIndex;

  if (window === 'next-week') {
    const target = addCalendarDays(rows[startIndex].date, 7);
    const index = findNextTradingIndex(rows, target);
    return index === -1 ? rows.length - 1 : index;
  }

  const tradingDays = window === '1d' ? 1 : window === '3d' ? 3 : 5;
  return Math.min(rows.length - 1, startIndex + tradingDays);
}
