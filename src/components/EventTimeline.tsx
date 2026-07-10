import { CalendarDays } from 'lucide-react';
import { factorLabels } from '../lib/events';
import type { EventRow } from '../lib/types';

interface EventTimelineProps {
  events: EventRow[];
  selectedEvent: EventRow | null;
  onSelectEvent: (event: EventRow) => void;
}

export function EventTimeline({ events, selectedEvent, onSelectEvent }: EventTimelineProps) {
  const recent = [...events].slice(-28).reverse();

  return (
    <section className="timeline-panel">
      <div className="panel-heading">
        <CalendarDays size={18} />
        <h2>Event Timeline</h2>
      </div>
      <div className="timeline-list">
        {recent.map((event) => (
          <button
            key={event.id}
            type="button"
            className={`timeline-row ${selectedEvent?.id === event.id ? 'selected' : ''}`}
            onClick={() => onSelectEvent(event)}
          >
            <span className={`event-kind ${event.excludeFromCoreStats ? 'abnormal' : ''}`} />
            <span>{event.date}</span>
            <strong>{factorLabels[event.family]}</strong>
            <em>{event.sourceStatus}</em>
          </button>
        ))}
      </div>
    </section>
  );
}
