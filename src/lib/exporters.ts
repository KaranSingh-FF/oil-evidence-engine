import { factorLabels } from './events';
import type { EventRow, EventStudy, NewsAnnotation, ScoreRow } from './types';

function csvEscape(value: string | number): string {
  const text = typeof value === 'string' && /^[\s]*[=+\-@]/.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function selectedEventNote(event: EventRow): string {
  const basketDetails = [
    event.basketLabel ? `basketLabel ${event.basketLabel}` : '',
    typeof event.basketScore === 'number' ? `basketScore ${event.basketScore}` : ''
  ].filter(Boolean);

  return [...basketDetails, event.qualityNote].filter(Boolean).join('; ');
}

export function exportScoresCsv(scores: ScoreRow[]): string {
  const header = [
    'family',
    'market',
    'window',
    'sampleSize',
    'excludedAbnormal',
    'meanReturn',
    'medianReturn',
    'directionHitRate',
    'averageAbsReturn',
    'averageAtrMultiple',
    'confidenceScore',
    'maxAdverseReturn',
    'abnormalShare',
    'recencyBias',
    'label',
    'evidenceTier',
    'directEvidenceShare'
  ];
  const rows = scores.map((score) =>
    [
      score.family,
      score.market,
      score.window,
      score.sampleSize,
      score.excludedAbnormal,
      score.meanReturn,
      score.medianReturn,
      score.directionHitRate,
      score.averageAbsReturn,
      score.averageAtrMultiple,
      score.confidenceScore,
      score.maxAdverseReturn,
      score.abnormalShare,
      score.recencyBias,
      score.label,
      score.evidenceTier,
      score.directEvidenceShare
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

export function exportEventsJson(events: EventRow[]): string {
  return JSON.stringify(events, null, 2);
}

export function exportReviewWorkbookCsv({
  scores,
  selectedStudy,
  newsAnnotations
}: {
  scores: ScoreRow[];
  selectedStudy: EventStudy | null;
  newsAnnotations: NewsAnnotation[];
}): string {
  const header = [
    'section',
    'date',
    'family',
    'market',
    'window',
    'category',
    'label',
    'sampleSize',
    'returnPct',
    'confidenceScore',
    'evidenceTier',
    'directEvidenceShare',
    'actual',
    'expected',
    'surprise',
    'unit',
    'note',
    'eventId'
  ];

  const rows: Array<Array<string | number>> = [];

  for (const score of scores) {
    rows.push([
      'score',
      '',
      score.family,
      score.market,
      score.window,
      score.label,
      factorLabels[score.family],
      score.sampleSize,
      score.meanReturn,
      score.confidenceScore,
      score.evidenceTier,
      score.directEvidenceShare,
      '',
      '',
      '',
      '',
      `direction ${score.directionHitRate}%, max adverse ${score.maxAdverseReturn}%`,
      ''
    ]);
  }

  if (selectedStudy) {
    const preferredWindow = selectedStudy.windows.find((window) => window.window === '3d') ?? selectedStudy.windows[0];
    rows.push([
      'selected-event',
      selectedStudy.selectedEvent.date,
      selectedStudy.selectedEvent.family,
      selectedStudy.market,
      preferredWindow?.window ?? '',
      selectedStudy.selectedEvent.sourceStatus,
      selectedStudy.selectedEvent.label,
      selectedStudy.patternStats.sampleSize,
      preferredWindow?.returnPct ?? '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      selectedEventNote(selectedStudy.selectedEvent),
      selectedStudy.selectedEvent.id
    ]);

    for (const component of selectedStudy.fundamentalComponents) {
      rows.push([
        'component',
        component.date,
        component.family,
        selectedStudy.market,
        preferredWindow?.window ?? '',
        component.surpriseQuality ?? component.provenance ?? component.sourceKind ?? 'component',
        component.metric,
        '',
        '',
        '',
        '',
        '',
        component.actual,
        component.expected,
        component.surprise,
        component.unit,
        component.provenance ? `${component.provenance}: ${component.source}` : component.source,
        selectedStudy.selectedEvent.id
      ]);
    }

    for (const occurrence of selectedStudy.occurrences) {
      rows.push([
        'occurrence',
        occurrence.date,
        selectedStudy.selectedEvent.family,
        selectedStudy.market,
        preferredWindow?.window ?? '',
        occurrence.abnormal ? 'abnormal' : occurrence.basketLabel ?? 'repeatable',
        selectedStudy.selectedEvent.label,
        '',
        occurrence.returnPct ?? '',
        '',
        '',
        '',
        '',
        '',
        occurrence.fundamentalSurprise ?? '',
        '',
        occurrence.note ?? (occurrence.componentCount ? `${occurrence.componentCount} components` : ''),
        occurrence.eventId
      ]);
    }
  }

  for (const note of newsAnnotations) {
    const selectedEvent = selectedStudy?.selectedEvent.id === note.eventId ? selectedStudy.selectedEvent : null;
    rows.push([
      'news-note',
      selectedEvent?.date ?? '',
      selectedEvent?.family ?? '',
      selectedStudy?.market ?? '',
      '',
      note.category,
      note.headline,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      note.note,
      note.eventId
    ]);
  }

  return [header.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
}
