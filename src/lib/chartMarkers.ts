import type { EventRow } from './types';

function releaseKey(event: EventRow): string {
  return `${event.date}|${event.family}`;
}

function isSampleEvidence(event: EventRow): boolean {
  return event.evidenceProvenance === 'sample' || event.evidenceQuality === 'sample';
}

export function isDirectEiaMarkerEvent(event: EventRow): boolean {
  return event.family === 'eia-wpsr'
    && (event.sourceStatus === 'direct' || event.sourceStatus === 'manual')
    && !event.excludeFromCoreStats
    && !isSampleEvidence(event)
    && (event.metricCount ?? 0) > 0;
}

function eiaMarkerPriority(event: EventRow): number {
  if (isDirectEiaMarkerEvent(event)) return 3 + Math.min(event.metricCount ?? 0, 99) / 100;
  if (event.sourceStatus === 'calendar-proxy' && !event.excludeFromCoreStats) return 2;
  return 1;
}

export function getChartMarkerEvents(events: EventRow[]): EventRow[] {
  const eiaEventsByRelease = new Map<string, { event: EventRow; index: number }>();
  const passthroughEvents: Array<{ event: EventRow; index: number }> = [];

  events.forEach((event, index) => {
    if (event.family !== 'eia-wpsr') {
      passthroughEvents.push({ event, index });
      return;
    }

    const key = releaseKey(event);
    const existing = eiaEventsByRelease.get(key);

    if (!existing || eiaMarkerPriority(event) > eiaMarkerPriority(existing.event)) {
      eiaEventsByRelease.set(key, { event, index });
    }
  });

  return [...eiaEventsByRelease.values(), ...passthroughEvents]
    .sort((a, b) => a.index - b.index)
    .map(({ event }) => event);
}

export function isChartMarkerSelected(markerEvent: EventRow, selectedEvent: EventRow | null | undefined): boolean {
  if (!selectedEvent) return false;
  if (markerEvent.id === selectedEvent.id) return true;

  return markerEvent.family === 'eia-wpsr'
    && selectedEvent.family === 'eia-wpsr'
    && releaseKey(markerEvent) === releaseKey(selectedEvent);
}
