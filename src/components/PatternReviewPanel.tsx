import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { useMemo, useState } from 'react';
import { factorLabels, factorOrder } from '../lib/events';
import type { EventRow, FactorFamily } from '../lib/types';

interface PatternReviewPanelProps {
  events: EventRow[];
  selectedEvent: EventRow | null;
  onSelectEvent: (event: EventRow) => void;
}

export function PatternReviewPanel({ events, selectedEvent, onSelectEvent }: PatternReviewPanelProps) {
  const [family, setFamily] = useState<FactorFamily>('eia-wpsr');
  const familyEvents = useMemo(
    () => events.filter((event) => event.family === family).sort((a, b) => a.date.localeCompare(b.date)),
    [events, family]
  );
  const activeIndex = Math.max(
    0,
    familyEvents.findIndex((event) => event.id === selectedEvent?.id)
  );
  const activeEvent = familyEvents[activeIndex] ?? familyEvents[0] ?? null;

  const move = (direction: -1 | 1) => {
    if (!familyEvents.length) return;
    const nextIndex = (activeIndex + direction + familyEvents.length) % familyEvents.length;
    onSelectEvent(familyEvents[nextIndex]);
  };

  return (
    <section className="review-panel">
      <div className="panel-heading">
        <ClipboardList size={18} />
        <h2>Pattern Review</h2>
      </div>

      <select value={family} onChange={(event) => setFamily(event.target.value as FactorFamily)}>
        {factorOrder
          .filter((item) => item !== 'abnormal-news')
          .map((item) => (
            <option key={item} value={item}>
              {factorLabels[item]}
            </option>
          ))}
      </select>

      {activeEvent ? (
        <div className="review-card">
          <span>
            {activeIndex + 1} / {familyEvents.length}
          </span>
          <strong>{activeEvent.date}</strong>
          <em>{activeEvent.sourceStatus}</em>
          <div className="review-actions">
            <button type="button" className="icon-only" title="Previous event" onClick={() => move(-1)}>
              <ChevronLeft size={17} />
            </button>
            <button type="button" className="icon-button" onClick={() => onSelectEvent(activeEvent)}>
              Review
            </button>
            <button type="button" className="icon-only" title="Next event" onClick={() => move(1)}>
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state">No events under the current filters.</div>
      )}
    </section>
  );
}
