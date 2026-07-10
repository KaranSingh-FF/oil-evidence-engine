import { ArrowRight, CheckCircle2, CircleAlert, TrendingDown, TrendingUp } from 'lucide-react';
import { factorLabels } from '../lib/events';
import { getReturnForWindow } from '../lib/marketData';
import type { DailyPriceRow, EventRow, EventWindow, ScoreRow } from '../lib/types';

interface ReactionStoryPanelProps {
  rows: DailyPriceRow[];
  events: EventRow[];
  selectedEvent: EventRow | null;
  scores: ScoreRow[];
  window: EventWindow;
}

type SignalTone = 'positive' | 'negative' | 'neutral' | 'proxy';

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'n/a';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function windowLabel(window: EventWindow): string {
  if (window === 'event-day') return 'Event day';
  if (window === 'next-week') return 'Next week';
  if (window === 'intraday-30m-4h') return '30m-4h';
  return window.toUpperCase();
}

function signalFromEvent(event: EventRow | null, score: ScoreRow | undefined): SignalTone {
  if (event?.basketLabel === 'bullish') return 'positive';
  if (event?.basketLabel === 'bearish') return 'negative';
  if (event?.basketLabel === 'neutral') return 'neutral';
  if (score?.label === 'confirm-long') return 'positive';
  if (score?.label === 'confirm-short') return 'negative';
  if (score) return 'proxy';
  return 'neutral';
}

function signalText(tone: SignalTone, event: EventRow | null): string {
  if (event?.basketLabel === 'bullish') return 'Positive EIA report';
  if (event?.basketLabel === 'bearish') return 'Negative EIA report';
  if (event?.basketLabel === 'neutral') return 'Neutral EIA report';
  if (tone === 'positive') return 'Bullish EIA pattern';
  if (tone === 'negative') return 'Bearish EIA pattern';
  return 'EIA proxy pattern';
}

function verdictText(tone: SignalTone, averageReturn: number | null): string {
  if (averageReturn === null) return 'Waiting for response data';
  if (tone === 'positive') return averageReturn > 0 ? 'Move confirmed the report' : 'Move faded the report';
  if (tone === 'negative') return averageReturn < 0 ? 'Move confirmed the report' : 'Move faded the report';
  if (tone === 'proxy') return averageReturn > 0 ? 'Historical response skews positive' : 'Historical response skews negative';
  return 'Reaction was mixed';
}

export function ReactionStoryPanel({ rows, events, selectedEvent, scores, window }: ReactionStoryPanelProps) {
  const eiaEvents = events.filter((event) => event.family === 'eia-wpsr');
  const storyEvent = selectedEvent?.family === 'eia-wpsr'
    ? selectedEvent
    : eiaEvents[eiaEvents.length - 1] ?? null;
  const eiaScore = scores.find((score) => score.family === 'eia-wpsr');
  const tone = signalFromEvent(storyEvent, eiaScore);
  const wtiMove = storyEvent ? getReturnForWindow(rows, storyEvent.date, window, 'wti')?.returnPct ?? null : null;
  const brentMove = storyEvent ? getReturnForWindow(rows, storyEvent.date, window, 'brent')?.returnPct ?? null : null;
  const averageMove = wtiMove === null && brentMove === null
    ? eiaScore?.meanReturn ?? null
    : ((wtiMove ?? 0) + (brentMove ?? 0)) / (wtiMove !== null && brentMove !== null ? 2 : 1);
  const Icon = tone === 'negative' ? TrendingDown : tone === 'proxy' ? CircleAlert : TrendingUp;

  return (
    <section className={`reaction-story ${tone}`}>
      <div className="reaction-card signal">
        <span>Fundamental signal</span>
        <strong>
          <Icon size={19} />
          {signalText(tone, storyEvent)}
        </strong>
        <em>
          {storyEvent
            ? `${storyEvent.date} | ${storyEvent.sourceStatus}${storyEvent.metricCount ? ` | ${storyEvent.metricCount} metrics` : ''}`
            : 'No EIA event under current filters'}
        </em>
      </div>

      <ArrowRight className="reaction-arrow" size={20} />

      <div className="reaction-card response">
        <span>{windowLabel(window)} market response</span>
        <strong>
          WTI {formatPct(wtiMove)}
          <small>Brent {formatPct(brentMove)}</small>
        </strong>
        <em>{storyEvent ? factorLabels[storyEvent.family] : `${eiaScore?.sampleSize ?? 0} historical samples`}</em>
      </div>

      <ArrowRight className="reaction-arrow" size={20} />

      <div className="reaction-card verdict">
        <span>Read-through</span>
        <strong>
          <CheckCircle2 size={19} />
          {verdictText(tone, averageMove)}
        </strong>
        <em>
          {eiaScore
            ? `${eiaScore.evidenceTier} evidence | ${eiaScore.confidenceScore}/100 confidence`
            : 'Select an EIA marker for detail'}
        </em>
      </div>
    </section>
  );
}
