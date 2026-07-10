import { getChartMarkerEvents } from './chartMarkers';
import { factorLabels } from './events';
import { normalizeFundamentalRecords } from './fundamentals';
import { getReturnForWindow } from './marketData';
import type { DailyPriceRow, EventRow, FundamentalRecord, WindowReturn } from './types';

export interface ReportResponseRow {
  event: EventRow;
  reportRead: string;
  componentSummary: string;
  wtiEventDay: WindowReturn | null;
  wti1d: WindowReturn | null;
  wti3d: WindowReturn | null;
  brentEventDay: WindowReturn | null;
  brent1d: WindowReturn | null;
  brent3d: WindowReturn | null;
  verdict: string;
  tone: 'bullish' | 'bearish' | 'neutral' | 'proxy';
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${Number.isInteger(value) ? value : value.toFixed(2).replace(/\.?0+$/, '')}`;
}

function reportRead(event: EventRow): { label: string; tone: ReportResponseRow['tone'] } {
  if (event.basketLabel === 'bullish') {
    return { label: `Bullish report${event.basketScore === undefined ? '' : ` (${signed(event.basketScore)})`}`, tone: 'bullish' };
  }

  if (event.basketLabel === 'bearish') {
    return { label: `Bearish report${event.basketScore === undefined ? '' : ` (${signed(event.basketScore)})`}`, tone: 'bearish' };
  }

  if (event.basketLabel === 'neutral') {
    return { label: `Neutral report${event.basketScore === undefined ? '' : ` (${signed(event.basketScore)})`}`, tone: 'neutral' };
  }

  return { label: `${factorLabels[event.family]} proxy`, tone: 'proxy' };
}

function componentSummary(event: EventRow, records: FundamentalRecord[]): string {
  if (event.family !== 'eia-wpsr') {
    return event.sourceStatus === 'direct' || event.sourceStatus === 'manual'
      ? event.qualityNote
      : 'Calendar/public release timing; direct surprise values not loaded';
  }

  const date = event.date;
  const components = normalizeFundamentalRecords(records).filter((record) => record.date === date);
  if (!components.length) return 'No direct actual-vs-expected rows loaded';

  return components
    .slice(0, 3)
    .map((record) => `${record.metric}: ${signed(record.surprise)} ${record.unit}`)
    .join('; ');
}

function verdict(tone: ReportResponseRow['tone'], wti3d: WindowReturn | null, brent3d: WindowReturn | null): string {
  const moves = [wti3d?.returnPct, brent3d?.returnPct].filter((value): value is number => value !== undefined);
  if (!moves.length) return 'No response window';
  const averageMove = moves.reduce((sum, value) => sum + value, 0) / moves.length;

  if (tone === 'bullish') return averageMove > 0 ? 'Confirmed by price' : 'Faded by price';
  if (tone === 'bearish') return averageMove < 0 ? 'Confirmed by price' : 'Faded by price';
  if (tone === 'neutral') return 'Mixed/neutral read';
  return averageMove > 0 ? 'Response positive' : 'Response negative';
}

export function buildReportResponses(
  rows: DailyPriceRow[],
  events: EventRow[],
  fundamentals: FundamentalRecord[]
): ReportResponseRow[] {
  return getChartMarkerEvents(events)
    .filter((event) => event.family !== 'abnormal-news')
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((event) => {
      const read = reportRead(event);
      const wti3d = getReturnForWindow(rows, event.date, '3d', 'wti');
      const brent3d = getReturnForWindow(rows, event.date, '3d', 'brent');

      return {
        event,
        reportRead: read.label,
        componentSummary: componentSummary(event, fundamentals),
        wtiEventDay: getReturnForWindow(rows, event.date, 'event-day', 'wti'),
        wti1d: getReturnForWindow(rows, event.date, '1d', 'wti'),
        wti3d,
        brentEventDay: getReturnForWindow(rows, event.date, 'event-day', 'brent'),
        brent1d: getReturnForWindow(rows, event.date, '1d', 'brent'),
        brent3d,
        verdict: verdict(read.tone, wti3d, brent3d),
        tone: read.tone
      };
    });
}

export const buildEiaReportResponses = buildReportResponses;
