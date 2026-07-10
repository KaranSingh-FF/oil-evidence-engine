import { getReturnForWindow } from './marketData';
import { normalizeFundamentalRecords } from './fundamentals';
import type {
  DailyPriceRow,
  EventRow,
  EventStudy,
  EventStudyOccurrence,
  EventStudyStats,
  EventWindow,
  FundamentalRecord,
  MarketId,
  NewsAnnotation
} from './types';

interface BuildEventStudyInput {
  rows: DailyPriceRow[];
  events: EventRow[];
  selectedEvent: EventRow | null;
  market: MarketId;
  fundamentals?: FundamentalRecord[];
  newsAnnotations?: NewsAnnotation[];
  patternWindow?: EventWindow;
}

const studyWindows: EventWindow[] = ['event-day', '1d', '3d', '5d', 'next-week'];

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

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function summarizeOccurrenceStats(occurrences: EventStudyOccurrence[]): EventStudyStats {
  const returns = occurrences
    .map((occurrence) => occurrence.returnPct)
    .filter((value): value is number => value !== null);

  if (returns.length === 0) {
    return { sampleSize: 0, positiveRate: 0, meanReturn: 0, medianReturn: 0 };
  }

  return {
    sampleSize: returns.length,
    positiveRate: round((returns.filter((value) => value > 0).length / returns.length) * 100, 1),
    meanReturn: round(mean(returns)),
    medianReturn: round(median(returns))
  };
}

function dateFamilyKey(date: string, family: string): string {
  return `${date}-${family}`;
}

function isSampleEvidence(event: EventRow): boolean {
  return event.evidenceProvenance === 'sample' || event.evidenceQuality === 'sample';
}

function isPreferredDirectEvent(event: EventRow): boolean {
  return (event.sourceStatus === 'direct' || event.sourceStatus === 'manual')
    && !event.excludeFromCoreStats
    && !isSampleEvidence(event);
}

function dedupeEventsByRelease(events: EventRow[]): EventRow[] {
  const deduped = new Map<string, EventRow>();

  for (const event of events) {
    const key = dateFamilyKey(event.date, event.family);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, event);
      continue;
    }

    if (isPreferredDirectEvent(event) && !isPreferredDirectEvent(existing)) {
      deduped.set(key, event);
    }
  }

  return Array.from(deduped.values());
}

function groupFundamentalsByDateFamily(records: FundamentalRecord[]): Map<string, FundamentalRecord[]> {
  const grouped = new Map<string, FundamentalRecord[]>();
  const studyComponents = [
    ...records.filter((record) => record.family !== 'eia-wpsr'),
    ...normalizeFundamentalRecords(records)
  ];

  for (const record of studyComponents) {
    const key = dateFamilyKey(record.date, record.family);
    const recordsForKey = grouped.get(key) ?? [];
    recordsForKey.push(record);
    grouped.set(key, recordsForKey);
  }

  return grouped;
}

export function buildEventStudy({
  rows,
  events,
  selectedEvent,
  market,
  fundamentals = [],
  newsAnnotations = [],
  patternWindow = '3d'
}: BuildEventStudyInput): EventStudy | null {
  if (!selectedEvent) return null;

  const fundamentalsByDateFamily = groupFundamentalsByDateFamily(fundamentals);
  const selectedFundamentalComponents = fundamentalsByDateFamily.get(
    dateFamilyKey(selectedEvent.date, selectedEvent.family)
  ) ?? [];
  const fundamental = selectedFundamentalComponents[0] ?? null;
  const notesByEventId = new Map(newsAnnotations.map((note) => [note.eventId, note]));
  const familyEvents = dedupeEventsByRelease(events.filter((event) => event.family === selectedEvent.family));
  const occurrences = familyEvents.map((event): EventStudyOccurrence => {
    const result = getReturnForWindow(rows, event.date, patternWindow, market);
    const note = notesByEventId.get(event.id);
    const components = fundamentalsByDateFamily.get(dateFamilyKey(event.date, event.family)) ?? [];
    const componentCount = event.metricCount ?? components.length;
    const representativeSurprise = event.basketScore ?? components[0]?.surprise;

    return {
      eventId: event.id,
      date: event.date,
      returnPct: result ? round(result.returnPct) : null,
      abnormal: event.excludeFromCoreStats,
      fundamentalSurprise: representativeSurprise,
      basketScore: event.basketScore,
      basketLabel: event.basketLabel,
      componentCount: componentCount > 0 ? componentCount : undefined,
      note: note?.headline
    };
  });

  return {
    selectedEvent,
    market,
    windows: studyWindows.flatMap((window) => {
      if (!selectedEvent.supportedWindows.includes(window)) return [];
      const result = getReturnForWindow(rows, selectedEvent.date, window, market);
      return result
        ? [
            {
              window,
              startDate: result.startDate,
              endDate: result.endDate,
              startValue: result.startValue,
              endValue: result.endValue,
              returnPct: round(result.returnPct)
            }
          ]
        : [];
    }),
    occurrences,
    patternStats: summarizeOccurrenceStats(occurrences),
    newsAnnotations: newsAnnotations.filter((note) => note.eventId === selectedEvent.id),
    fundamental,
    fundamentalComponents: selectedFundamentalComponents
  };
}
