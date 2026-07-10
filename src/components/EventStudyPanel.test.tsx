import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { EventStudyPanel } from './EventStudyPanel';
import type { EventRow, EventStudy, NewsAnnotation } from '../lib/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const eventA: EventRow = {
  id: 'eia-2026-06-03',
  date: '2026-06-03',
  family: 'eia-wpsr',
  label: 'EIA Weekly Petroleum Status Report',
  sourceStatus: 'calendar-proxy',
  sourceUrl: 'https://www.eia.gov/petroleum/supply/weekly/',
  releaseTime: '10:30 ET',
  qualityNote: 'calendar proxy',
  supportedWindows: ['event-day', '1d', '3d', '5d', 'next-week'],
  excludeFromCoreStats: false
};

const eventB: EventRow = {
  ...eventA,
  id: 'api-2026-06-02',
  date: '2026-06-02',
  family: 'api-wsb',
  label: 'API Weekly Statistical Bulletin'
};

function studyFor(event: EventRow): EventStudy {
  return {
    selectedEvent: event,
    market: 'wti',
    windows: [],
    occurrences: [],
    patternStats: {
      sampleSize: 0,
      positiveRate: 0,
      meanReturn: 0,
      medianReturn: 0
    },
    newsAnnotations: [],
    fundamental: null,
    fundamentalComponents: []
  };
}

function setControlValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

describe('EventStudyPanel annotation draft', () => {
  it('clears unsaved draft text when the selected event changes', () => {
    const savedAnnotations: NewsAnnotation[] = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <EventStudyPanel
          study={studyFor(eventA)}
          newsAnnotations={[]}
          onSaveAnnotation={(annotation) => savedAnnotations.push(annotation)}
        />
      );
    });

    const headline = container.querySelector<HTMLInputElement>('input[placeholder="Headline"]');
    const note = container.querySelector<HTMLTextAreaElement>('textarea[placeholder="Review note"]');
    if (!headline || !note) throw new Error('Expected annotation fields');

    act(() => {
      setControlValue(headline, 'Old event draft');
      setControlValue(note, 'This belongs to the first selected event.');
    });

    act(() => {
      root?.render(
        <EventStudyPanel
          study={studyFor(eventB)}
          newsAnnotations={[]}
          onSaveAnnotation={(annotation) => savedAnnotations.push(annotation)}
        />
      );
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save note')
    );
    if (!saveButton) throw new Error('Expected save button');

    act(() => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(savedAnnotations).toEqual([]);
    expect(container.querySelector<HTMLInputElement>('input[placeholder="Headline"]')?.value).toBe('');
    expect(container.querySelector<HTMLTextAreaElement>('textarea[placeholder="Review note"]')?.value).toBe('');
  });
});
