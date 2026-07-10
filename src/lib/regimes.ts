import type { DailyPriceRow, EventRow, RegimeFilter, RegimeProfile } from './types';

interface RegimeOptions {
  trendLookback?: number;
  volatilityLookback?: number;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance);
}

function windowRows(rows: DailyPriceRow[], index: number, lookback: number): DailyPriceRow[] {
  return rows.slice(Math.max(0, index - lookback + 1), index + 1);
}

export function buildRegimeProfiles(
  rows: DailyPriceRow[],
  options: RegimeOptions = {}
): Map<string, RegimeProfile> {
  const trendLookback = options.trendLookback ?? 50;
  const volatilityLookback = options.volatilityLookback ?? 20;
  const moves = rows.map((row, index) => {
    if (index === 0) return 0;
    const previous = rows[index - 1].wti;
    return Math.abs(((row.wti - previous) / previous) * 100);
  });
  const spreadAverage = mean(rows.map((row) => row.spread));
  const spreadStd = standardDeviation(rows.map((row) => row.spread)) || 1;
  const profiles = new Map<string, RegimeProfile>();

  rows.forEach((row, index) => {
    const volatilityWindow = moves.slice(Math.max(1, index - volatilityLookback), index);
    const volatilityThreshold = median(volatilityWindow.length ? volatilityWindow : moves.slice(1)) || 0;
    const trendAverage = mean(windowRows(rows, index, trendLookback).map((item) => item.wti));
    const trendDistancePct = trendAverage === 0 ? 0 : ((row.wti - trendAverage) / trendAverage) * 100;
    const spreadZScore = (row.spread - spreadAverage) / spreadStd;
    const absoluteMovePct = moves[index] ?? 0;

    profiles.set(row.date, {
      date: row.date,
      volatility: absoluteMovePct >= volatilityThreshold ? 'high' : 'low',
      trend: trendDistancePct >= 0 ? 'wti-uptrend' : 'wti-downtrend',
      spread: spreadZScore >= 0 ? 'wide' : 'tight',
      absoluteMovePct: Number(absoluteMovePct.toFixed(2)),
      trendDistancePct: Number(trendDistancePct.toFixed(2)),
      spreadZScore: Number(spreadZScore.toFixed(2))
    });
  });

  return profiles;
}

export function eventMatchesRegime(
  profile: RegimeProfile | undefined,
  filter: RegimeFilter = 'all'
): boolean {
  if (filter === 'all') return true;
  if (!profile) return false;

  if (filter === 'high-volatility') return profile.volatility === 'high';
  if (filter === 'low-volatility') return profile.volatility === 'low';
  if (filter === 'wti-uptrend' || filter === 'wti-downtrend') return profile.trend === filter;
  if (filter === 'spread-wide') return profile.spread === 'wide';
  if (filter === 'spread-tight') return profile.spread === 'tight';
  return true;
}

export function filterEventsByRegime(
  events: EventRow[],
  profiles: Map<string, RegimeProfile>,
  filter: RegimeFilter = 'all'
): EventRow[] {
  if (filter === 'all') return events;
  return events.filter((event) => eventMatchesRegime(profiles.get(event.date), filter));
}
