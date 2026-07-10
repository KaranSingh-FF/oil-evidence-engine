import { findNextTradingIndex } from './dateUtils';
import { computeAtrProxy, getReturnForWindow } from './marketData';
import type { DashboardFilters, DailyPriceRow, EventRow, FactorFamily, ScoreRow, StrategyLabel } from './types';

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function confidenceScore(
  sampleSize: number,
  directionHitRate: number,
  averageAtrMultiple: number,
  abnormalShare: number
): number {
  const sampleComponent = clamp((sampleSize / 60) * 40, 0, 40);
  const directionComponent = clamp(Math.abs(directionHitRate - 50) * 0.8, 0, 25);
  const volatilityComponent = clamp(averageAtrMultiple * 12, 0, 20);
  const abnormalPenalty = clamp(abnormalShare * 0.25, 0, 15);
  return round(sampleComponent + directionComponent + volatilityComponent + 15 - abnormalPenalty, 0);
}

function recencyBias(values: number[]): number {
  if (values.length < 4) return 0;
  const middle = Math.floor(values.length / 2);
  return mean(values.slice(middle)) - mean(values.slice(0, middle));
}

function assignLabel(
  sampleSize: number,
  meanReturn: number,
  directionHitRate: number,
  averageAbsReturn: number,
  averageAtrMultiple: number,
  excludedAbnormal: number
): StrategyLabel {
  if (sampleSize < 8) return 'no-edge';
  if (excludedAbnormal > sampleSize * 0.4) return 'avoid';
  if (directionHitRate >= 60 && meanReturn > 0.2) return 'confirm-long';
  if (directionHitRate <= 40 && meanReturn < -0.2) return 'confirm-short';
  if (averageAtrMultiple >= 1.25 || averageAbsReturn >= 1.2) return 'volatility-expected';
  return 'no-edge';
}

function isSampleEvidence(event: EventRow): boolean {
  return event.evidenceProvenance === 'sample' || event.evidenceQuality === 'sample';
}

function hasDirectEvidence(event: EventRow): boolean {
  return (event.sourceStatus === 'direct' || event.sourceStatus === 'manual')
    && !event.excludeFromCoreStats
    && !isSampleEvidence(event);
}

function eventReleaseKey(event: EventRow): string {
  return `${event.date}|${event.family}`;
}

function dedupeEventsByRelease(events: EventRow[]): EventRow[] {
  const deduped = new Map<string, EventRow>();

  for (const event of events) {
    const key = eventReleaseKey(event);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, event);
      continue;
    }

    if (hasDirectEvidence(event) && !hasDirectEvidence(existing)) {
      deduped.set(key, event);
    }
  }

  return Array.from(deduped.values());
}

function evidenceTier(directEvidenceCount: number, sampleSize: number): ScoreRow['evidenceTier'] {
  if (directEvidenceCount === sampleSize) return 'direct';
  if (directEvidenceCount === 0) return 'proxy';
  return 'mixed';
}

export function scoreFactors(
  rows: DailyPriceRow[],
  events: EventRow[],
  filters: DashboardFilters
): ScoreRow[] {
  const selected = new Set(filters.selectedFactors);
  const families = Array.from(selected).filter((family) => {
    if (filters.excludeAbnormal && family === 'abnormal-news') return false;
    return true;
  });

  return families
    .map((family): ScoreRow | null => {
      const familyEvents = dedupeEventsByRelease(
        events.filter((event) => event.family === family && event.supportedWindows.includes(filters.window))
      );
      const includedReturns: number[] = [];
      const atrMultiples: number[] = [];
      let excludedAbnormal = 0;
      let directEvidenceCount = 0;

      for (const event of familyEvents) {
        if (filters.excludeAbnormal && event.excludeFromCoreStats) {
          excludedAbnormal += 1;
          continue;
        }

        const result = getReturnForWindow(rows, event.date, filters.window, filters.market);
        if (!result) continue;

        const startIndex = findNextTradingIndex(rows, result.startDate);
        const atr = computeAtrProxy(rows, startIndex, filters.market);
        includedReturns.push(result.returnPct);
        atrMultiples.push(atr > 0 ? Math.abs(result.returnPct) / atr : 0);
        if (hasDirectEvidence(event)) {
          directEvidenceCount += 1;
        }
      }

      if (includedReturns.length === 0) return null;

      const directEvidenceShare = (directEvidenceCount / includedReturns.length) * 100;
      const positiveRate =
        (includedReturns.filter((value) => value > 0).length / includedReturns.length) * 100;
      const meanReturn = mean(includedReturns);
      const medianReturn = median(includedReturns);
      const averageAbsReturn = mean(includedReturns.map((value) => Math.abs(value)));
      const averageAtrMultiple = mean(atrMultiples);
      const abnormalShare = familyEvents.length === 0 ? 0 : (excludedAbnormal / familyEvents.length) * 100;

      return {
        family: family as FactorFamily,
        market: filters.market,
        window: filters.window,
        sampleSize: includedReturns.length,
        directEvidenceShare: round(directEvidenceShare, 1),
        evidenceTier: evidenceTier(directEvidenceCount, includedReturns.length),
        excludedAbnormal,
        meanReturn: round(meanReturn),
        medianReturn: round(medianReturn),
        directionHitRate: round(positiveRate, 1),
        averageAbsReturn: round(averageAbsReturn),
        averageAtrMultiple: round(averageAtrMultiple),
        confidenceScore: confidenceScore(
          includedReturns.length,
          positiveRate,
          averageAtrMultiple,
          abnormalShare
        ),
        maxAdverseReturn: round(Math.min(0, ...includedReturns)),
        abnormalShare: round(abnormalShare, 1),
        recencyBias: round(recencyBias(includedReturns)),
        label: assignLabel(
          includedReturns.length,
          meanReturn,
          positiveRate,
          averageAbsReturn,
          averageAtrMultiple,
          excludedAbnormal
        )
      };
    })
    .filter((score): score is ScoreRow => score !== null)
    .sort((a, b) => b.sampleSize - a.sampleSize || b.averageAbsReturn - a.averageAbsReturn);
}
