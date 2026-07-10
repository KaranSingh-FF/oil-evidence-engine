import { AlertTriangle, BookOpen, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { factorLabels } from '../lib/events';
import type { EventStudy, NewsAnnotation } from '../lib/types';

interface EventStudyPanelProps {
  study: EventStudy | null;
  newsAnnotations: NewsAnnotation[];
  onSaveAnnotation: (annotation: NewsAnnotation) => void;
}

function formatReturn(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'n/a';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatNumber(value: number | undefined): string {
  if (value === undefined) return 'n/a';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function formatSignedNumber(value: number | undefined): string {
  if (value === undefined) return 'n/a';
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

function componentMeta(component: EventStudy['fundamentalComponents'][number]): string {
  const values = [component.surpriseQuality, component.provenance ?? component.sourceKind]
    .filter((value) => value !== undefined);
  const unique = Array.from(new Set(values));

  return unique.length ? unique.join(' / ') : 'n/a';
}

function occurrenceContext(occurrence: EventStudy['occurrences'][number]): string {
  const details = [
    occurrence.fundamentalSurprise === undefined
      ? undefined
      : `surprise ${formatSignedNumber(occurrence.fundamentalSurprise)}`,
    occurrence.componentCount ? `${occurrence.componentCount} comp.` : undefined
  ].filter((value): value is string => Boolean(value));

  return details.join(' | ') || 'proxy';
}

export function EventStudyPanel({ study, newsAnnotations, onSaveAnnotation }: EventStudyPanelProps) {
  const [headline, setHeadline] = useState('');
  const [category, setCategory] = useState('manual-note');
  const [note, setNote] = useState('');

  useEffect(() => {
    setHeadline('');
    setCategory('manual-note');
    setNote('');
  }, [study?.selectedEvent.id]);

  if (!study) {
    return (
      <section className="study-panel">
        <div className="panel-heading">
          <BookOpen size={18} />
          <h2>Event Study</h2>
        </div>
        <div className="empty-state">Select a marker or timeline row.</div>
      </section>
    );
  }

  const existingNotes = newsAnnotations.filter((annotation) => annotation.eventId === study.selectedEvent.id);

  const saveAnnotation = () => {
    if (!headline.trim() || !note.trim()) return;
    onSaveAnnotation({
      eventId: study.selectedEvent.id,
      category: category.trim() || 'manual-note',
      headline: headline.trim(),
      note: note.trim()
    });
    setHeadline('');
    setNote('');
  };

  return (
    <section className="study-panel">
      <div className="panel-heading">
        <BookOpen size={18} />
        <h2>Event Study</h2>
      </div>

      <div className="study-hero">
        <span>{study.selectedEvent.date}</span>
        <strong>{factorLabels[study.selectedEvent.family]}</strong>
        <em>{study.selectedEvent.sourceStatus}</em>
      </div>

      <div className="study-window-grid">
        {study.windows.map((window) => (
          <article key={window.window}>
            <span>{window.window}</span>
            <strong>{formatReturn(window.returnPct)}</strong>
            <em>
              {window.startDate} to {window.endDate}
            </em>
          </article>
        ))}
      </div>

      <div className="study-stats">
        <div>
          <span>Pattern samples</span>
          <strong>{study.patternStats.sampleSize}</strong>
        </div>
        <div>
          <span>Positive</span>
          <strong>{study.patternStats.positiveRate}%</strong>
        </div>
        <div>
          <span>Mean</span>
          <strong>{formatReturn(study.patternStats.meanReturn)}</strong>
        </div>
        <div>
          <span>Median</span>
          <strong>{formatReturn(study.patternStats.medianReturn)}</strong>
        </div>
      </div>

      {study.fundamentalComponents.length ? (
        <div className="component-table">
          {study.fundamentalComponents.map((component, index) => (
            <article key={`${component.date}-${component.metric}-${index}`} className="component-row">
              <strong>{component.metric}</strong>
              <span>
                {formatNumber(component.actual)} vs {formatNumber(component.expected)} {component.unit}
              </span>
              <em>
                {formatSignedNumber(component.surprise)} {component.unit}
              </em>
              <small>{componentMeta(component)}</small>
            </article>
          ))}
        </div>
      ) : (
        <div className="fundamental-chip pending">
          <AlertTriangle size={16} />
          <span>Direct actual-vs-expected values not loaded for this event.</span>
        </div>
      )}

      <div className="annotation-box">
        <div className="annotation-inputs">
          <input
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
            placeholder="Headline"
          />
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Category"
          />
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Review note"
          rows={3}
        />
        <button type="button" className="icon-button" onClick={saveAnnotation}>
          <Save size={15} />
          Save note
        </button>
      </div>

      {existingNotes.length ? (
        <div className="note-list">
          {existingNotes.map((annotation, index) => (
            <article key={`${annotation.eventId}-${index}`}>
              <strong>{annotation.headline}</strong>
              <span>{annotation.category}</span>
              <p>{annotation.note}</p>
            </article>
          ))}
        </div>
      ) : null}

      <div className="occurrence-table">
        {study.occurrences.slice(-12).reverse().map((occurrence) => (
          <div key={occurrence.eventId}>
            <span>{occurrence.date}</span>
            <strong>{formatReturn(occurrence.returnPct)}</strong>
            <em>{occurrence.abnormal ? 'abnormal' : occurrence.basketLabel ?? 'repeatable'}</em>
            <small>{occurrenceContext(occurrence)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
