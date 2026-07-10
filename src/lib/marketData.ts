import { findNextTradingIndex, findWindowEndIndex } from './dateUtils';
import type { DailyPriceRow, EventWindow, MarketId, PriceDataset, WindowReturn } from './types';

export function getMarketValue(row: DailyPriceRow, market: MarketId): number {
  return row[market];
}

export function normalizeRows(rows: DailyPriceRow[]): DailyPriceRow[] {
  return rows
    .filter((row) => Number.isFinite(row.wti) && Number.isFinite(row.brent))
    .map((row) => ({ ...row, spread: Number((row.brent - row.wti).toFixed(4)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeDataset(dataset: PriceDataset): PriceDataset {
  return {
    ...dataset,
    rows: normalizeRows(dataset.rows)
  };
}

export function getReturnForWindow(
  rows: DailyPriceRow[],
  eventDate: string,
  window: EventWindow,
  market: MarketId
): WindowReturn | null {
  if (window === 'intraday-30m-4h') return null;

  const startIndex = findNextTradingIndex(rows, eventDate);
  const endIndex = findWindowEndIndex(rows, startIndex, window);
  if (startIndex < 0 || endIndex < 0) return null;

  const start = rows[startIndex];
  const end = rows[endIndex];
  const startValue = getMarketValue(start, market);
  const endValue = getMarketValue(end, market);

  if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) return null;

  const denominator = market === 'spread' ? Math.max(Math.abs(startValue), 1) : startValue;
  const returnPct = ((endValue - startValue) / denominator) * 100;

  return {
    startDate: start.date,
    endDate: end.date,
    startValue,
    endValue,
    returnPct
  };
}

export function computeAtrProxy(
  rows: DailyPriceRow[],
  index: number,
  market: MarketId,
  lookback = 14
): number {
  if (index <= 0) return 0;

  const start = Math.max(1, index - lookback + 1);
  const returns: number[] = [];
  for (let i = start; i <= index; i += 1) {
    const previous = getMarketValue(rows[i - 1], market);
    const current = getMarketValue(rows[i], market);
    const denominator = market === 'spread' ? Math.max(Math.abs(previous), 1) : previous;
    if (Number.isFinite(previous) && Number.isFinite(current) && denominator !== 0) {
      returns.push(Math.abs(((current - previous) / denominator) * 100));
    }
  }

  if (returns.length === 0) return 0;
  return returns.reduce((sum, value) => sum + value, 0) / returns.length;
}
