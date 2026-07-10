import { formatDateKey, parseDateKey } from './dateUtils';
import { getMarketValue } from './marketData';
import type { DailyPriceRow, MarketId } from './types';

export type ChartRangePreset = '1m' | '3m' | '6m' | '1y' | 'all';

export interface ChartLinePoint {
  time: string;
  value: number;
}

export interface ChartVisibleRange {
  from: string;
  to: string;
  firstDataDate: string;
  lastDataDate: string;
}

const rangeMonths: Record<Exclude<ChartRangePreset, 'all'>, number> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '1y': 12
};

function subtractUtcMonths(dateKey: string, months: number): string {
  const date = parseDateKey(dateKey);
  const originalDay = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() - months);

  if (date.getUTCDate() !== originalDay) {
    date.setUTCDate(0);
  }

  return formatDateKey(date);
}

function firstDataDateAtOrAfter(rows: DailyPriceRow[], dateKey: string): string {
  return rows.find((row) => row.date >= dateKey)?.date ?? rows[0]?.date ?? dateKey;
}

export function toLineSeriesData(rows: DailyPriceRow[], market: MarketId): ChartLinePoint[] {
  return rows
    .filter((row) => Number.isFinite(getMarketValue(row, market)))
    .map((row) => ({
      time: row.date,
      value: getMarketValue(row, market)
    }));
}

export function getVisibleRangeForPreset(
  rows: DailyPriceRow[],
  preset: ChartRangePreset
): ChartVisibleRange | null {
  if (rows.length === 0) return null;

  const first = rows[0].date;
  const latest = rows[rows.length - 1].date;
  const from = preset === 'all' ? first : subtractUtcMonths(latest, rangeMonths[preset]);

  return {
    from,
    to: latest,
    firstDataDate: firstDataDateAtOrAfter(rows, from),
    lastDataDate: latest
  };
}
