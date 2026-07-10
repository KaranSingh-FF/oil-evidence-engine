import { useMemo } from 'react';
import { Activity, FlaskConical } from 'lucide-react';
import { generateFundamentalEvents } from '../lib/events';
import type { EventRow, FundamentalRecord } from '../lib/types';

interface FundamentalLabPanelProps {
  activeFundamentals: FundamentalRecord[];
  reviewOnlyFundamentals: FundamentalRecord[];
  eiaSourceStatus: string;
}

interface LabBasket {
  event: EventRow;
  rawMetricCount: number;
  sourceSummary: string;
}

function groupRecordsByDate(records: FundamentalRecord[]): Map<string, FundamentalRecord[]> {
  const grouped = new Map<string, FundamentalRecord[]>();

  for (const record of records) {
    if (record.family !== 'eia-wpsr') continue;
    const recordsForDate = grouped.get(record.date) ?? [];
    recordsForDate.push(record);
    grouped.set(record.date, recordsForDate);
  }

  return grouped;
}

function summarizeSources(records: FundamentalRecord[]): string {
  const sources = Array.from(new Set(records.map((record) => record.source).filter(Boolean)));

  return sources.slice(0, 2).join(' + ') || 'No source';
}

function buildLabBaskets(records: FundamentalRecord[]): LabBasket[] {
  const recordsByDate = groupRecordsByDate(records);

  return generateFundamentalEvents(records)
    .map((event) => {
      const dateRecords = recordsByDate.get(event.date) ?? [];

      return {
        event,
        rawMetricCount: dateRecords.length,
        sourceSummary: summarizeSources(dateRecords)
      };
    })
    .sort((a, b) => b.event.date.localeCompare(a.event.date));
}

function formatScore(event: EventRow): string {
  return event.basketScore === undefined ? 'Excluded' : event.basketScore.toFixed(3);
}

function BasketRow({
  basket,
  mode
}: {
  basket: LabBasket;
  mode: 'active' | 'review-only';
}) {
  const { event, rawMetricCount, sourceSummary } = basket;
  const stateText = mode === 'active' && !event.excludeFromCoreStats ? 'Active' : 'Review-only';
  const metricText = mode === 'active'
    ? String(event.metricCount ?? rawMetricCount)
    : `${rawMetricCount} raw`;

  return (
    <article className={`fundamental-basket ${mode}`}>
      <div className="fundamental-basket-top">
        <strong>{event.date}</strong>
        <span>{stateText}</span>
      </div>
      <dl className="fundamental-basket-stats">
        <div>
          <dt>Score</dt>
          <dd>{formatScore(event)}</dd>
        </div>
        <div>
          <dt>Metrics</dt>
          <dd>{metricText}</dd>
        </div>
        <div>
          <dt>Quality</dt>
          <dd>{event.evidenceQuality ?? 'n/a'}</dd>
        </div>
        <div>
          <dt>Provenance</dt>
          <dd>{event.evidenceProvenance ?? 'n/a'}</dd>
        </div>
      </dl>
      <div className="fundamental-basket-foot">
        <span>{event.sourceStatus}</span>
        <em>{sourceSummary}</em>
      </div>
    </article>
  );
}

export function FundamentalLabPanel({
  activeFundamentals,
  reviewOnlyFundamentals,
  eiaSourceStatus
}: FundamentalLabPanelProps) {
  const activeBaskets = useMemo(
    () => buildLabBaskets(activeFundamentals).slice(0, 4),
    [activeFundamentals]
  );
  const reviewOnlyBaskets = useMemo(
    () => buildLabBaskets(reviewOnlyFundamentals).slice(0, 4),
    [reviewOnlyFundamentals]
  );
  const hasBaskets = activeBaskets.length > 0 || reviewOnlyBaskets.length > 0;

  return (
    <section className="fundamental-lab-panel">
      <div className="panel-heading">
        <FlaskConical size={18} />
        <h2>EIA Basket Lab</h2>
      </div>

      <div className="fundamental-lab-meta">
        <Activity size={15} />
        <span>{eiaSourceStatus}</span>
      </div>

      {hasBaskets ? (
        <div className="fundamental-basket-list">
          {activeBaskets.map((basket) => (
            <BasketRow
              key={`active-${basket.event.id}`}
              basket={basket}
              mode="active"
            />
          ))}
          {reviewOnlyBaskets.map((basket) => (
            <BasketRow
              key={`review-${basket.event.id}`}
              basket={basket}
              mode="review-only"
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">No EIA fundamental baskets loaded.</div>
      )}
    </section>
  );
}
