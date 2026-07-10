import { factorLabels } from './events';
import type { DashboardFilters, EventRow, ResearchReport, ScoreRow } from './types';

function marketName(market: DashboardFilters['market']): string {
  if (market === 'wti') return 'WTI';
  if (market === 'brent') return 'Brent';
  return 'Brent-WTI spread';
}

function labelText(label: ScoreRow['label']): string {
  return label.replace(/-/g, ' ');
}

export function generateResearchReport(
  scores: ScoreRow[],
  events: EventRow[],
  filters: DashboardFilters
): ResearchReport {
  const market = marketName(filters.market);
  const includedEvents = events.filter((event) => filters.selectedFactors.includes(event.family));
  const abnormalEvents = events
    .filter((event) => event.family === 'abnormal-news')
    .slice(-8)
    .reverse();
  const strongScores = scores
    .filter((score) => score.label !== 'no-edge')
    .sort((a, b) => b.sampleSize - a.sampleSize)
    .slice(0, 5);
  const weakScores = scores
    .filter((score) => score.label === 'no-edge')
    .sort((a, b) => b.sampleSize - a.sampleSize)
    .slice(0, 5);

  return {
    summary: `${market} ${filters.window} evidence across ${includedEvents.length} recurring events. Abnormal news is ${
      filters.excludeAbnormal ? 'excluded from' : 'included in'
    } the core statistics.`,
    strongestPatterns:
      strongScores.length > 0
        ? strongScores.map(
            (score) =>
              `${factorLabels[score.family]}: ${labelText(score.label)} with ${score.directionHitRate}% positive follow-through, ${score.meanReturn}% mean return, and ${score.sampleSize} samples.`
          )
        : ['No factor currently clears the conservative repeatability thresholds for this filter set.'],
    weakPatterns:
      weakScores.length > 0
        ? weakScores.map(
            (score) =>
              `${factorLabels[score.family]} has ${score.sampleSize} samples but no repeatable directional edge under the current window.`
          )
        : ['No weak-pattern rows are visible for the current filter set.'],
    abnormalNotes:
      abnormalEvents.length > 0
        ? abnormalEvents.map((event) => `${event.date}: ${event.label}. ${event.qualityNote}`)
        : ['No abnormal candles were detected under the current threshold.'],
    dataQuality: [
      'Phase 1 uses public daily WTI and Brent spot prices, so intraday 30m-4h release studies are disabled.',
      'Recurring report factors are calendar proxies until direct report surprise values are imported.',
      'Strategy labels are filters for a technical strategy, not standalone trade instructions.'
    ]
  };
}
