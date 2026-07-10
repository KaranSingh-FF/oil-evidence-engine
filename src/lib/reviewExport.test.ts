import { describe, expect, it } from 'vitest';
import { exportReviewWorkbookCsv } from './exporters';
import type { EventStudy, FundamentalRecord, NewsAnnotation, ScoreRow } from './types';

const study = {
  selectedEvent: {
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
  },
  market: 'wti',
  windows: [
    {
      window: '3d',
      startDate: '2026-06-03',
      endDate: '2026-06-08',
      startValue: 102,
      endValue: 109,
      returnPct: 6.86
    }
  ],
  occurrences: [
    {
      eventId: 'eia-2026-06-03',
      date: '2026-06-03',
      returnPct: 6.86,
      abnormal: false
    }
  ],
  patternStats: {
    sampleSize: 1,
    positiveRate: 100,
    meanReturn: 6.86,
    medianReturn: 6.86
  },
  newsAnnotations: [],
  fundamental: null,
  fundamentalComponents: [
    {
      date: '2026-06-03',
      family: 'eia-wpsr',
      metric: 'commercial crude stocks',
      actual: 2.1,
      expected: -1,
      unit: 'mb',
      source: 'EIA WPSR',
      surprise: 3.1,
      surpriseQuality: 'official',
      provenance: 'official'
    },
    {
      date: '2026-06-03',
      family: 'eia-wpsr',
      metric: 'gasoline stocks',
      actual: -1.4,
      expected: 0.5,
      unit: 'mb',
      source: 'EIA WPSR',
      surprise: -1.9,
      surpriseQuality: 'official',
      provenance: 'official'
    }
  ] satisfies FundamentalRecord[]
} as EventStudy & { fundamentalComponents: FundamentalRecord[] };

const scores = [
  {
    family: 'eia-wpsr',
    market: 'wti',
    window: '3d',
    sampleSize: 12,
    excludedAbnormal: 1,
    meanReturn: 0.4,
    medianReturn: 0.2,
    directionHitRate: 58.3,
    averageAbsReturn: 1.1,
    averageAtrMultiple: 1.3,
    label: 'volatility-expected',
    confidenceScore: 74,
    maxAdverseReturn: -3.2,
    abnormalShare: 7.7,
    recencyBias: 0.1,
    directEvidenceShare: 100,
    evidenceTier: 'direct'
  }
] as Array<ScoreRow & { directEvidenceShare: number; evidenceTier: 'direct' }>;

const notes: NewsAnnotation[] = [
  {
    eventId: 'eia-2026-06-03',
    category: 'inventory-shock',
    headline: 'Large crude build',
    note: 'manual review'
  }
];

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  rows.push(row);
  return rows;
}

describe('review workbook export', () => {
  it('exports score, selected event, occurrence, and note rows in one Excel-friendly CSV', () => {
    const csv = exportReviewWorkbookCsv({ scores, selectedStudy: study, newsAnnotations: notes });

    expect(csv.split('\n')[0]).toContain('section,date,family,market,window');
    expect(csv.split('\n')[0]).toContain('evidenceTier,directEvidenceShare');
    expect(csv).toContain('score,,eia-wpsr,wti,3d');
    expect(csv).toContain('score,,eia-wpsr,wti,3d,volatility-expected,EIA Weekly Petroleum Status Report,12,0.4,74,direct,100');
    expect(csv).toContain('selected-event,2026-06-03,eia-wpsr,wti,3d');
    expect(csv).toContain('component,2026-06-03,eia-wpsr,wti,3d,official,commercial crude stocks');
    expect(csv).toContain('component,2026-06-03,eia-wpsr,wti,3d,official,gasoline stocks');
    expect(csv).toContain('occurrence,2026-06-03,eia-wpsr,wti,3d');
    expect(csv).toContain('news-note,2026-06-03,eia-wpsr,wti,,inventory-shock');
  });

  it('keeps selected basket component fields blank and describes basket context in the note', () => {
    const basketStudy: EventStudy = {
      ...study,
      selectedEvent: {
        ...study.selectedEvent,
        sourceStatus: 'direct',
        label: 'EIA WPSR surprise basket',
        qualityNote: 'basket review note',
        basketScore: 0.22,
        basketLabel: 'bullish',
        metricCount: 2
      },
      fundamental: study.fundamentalComponents[0]
    };

    const csv = exportReviewWorkbookCsv({ scores: [], selectedStudy: basketStudy, newsAnnotations: [] });
    const rows = parseCsvRows(csv);
    const header = rows[0];
    const selectedRow = rows.find((row) => row[0] === 'selected-event');

    expect(selectedRow).toBeDefined();
    expect(selectedRow?.[header.indexOf('actual')]).toBe('');
    expect(selectedRow?.[header.indexOf('expected')]).toBe('');
    expect(selectedRow?.[header.indexOf('surprise')]).toBe('');
    expect(selectedRow?.[header.indexOf('unit')]).toBe('');
    expect(selectedRow?.[header.indexOf('note')]).toContain('bullish');
    expect(selectedRow?.[header.indexOf('note')]).toContain('0.22');
  });

  it('quotes multiline review and news notes so CSV row structure is preserved', () => {
    const multilineStudy: EventStudy = {
      ...study,
      selectedEvent: {
        ...study.selectedEvent,
        qualityNote: 'review line one\nreview line two'
      }
    };
    const multilineNotes: NewsAnnotation[] = [
      {
        eventId: 'eia-2026-06-03',
        category: 'inventory-shock',
        headline: 'Large crude build',
        note: 'news line one\r\nnews line two'
      }
    ];

    const csv = exportReviewWorkbookCsv({
      scores,
      selectedStudy: multilineStudy,
      newsAnnotations: multilineNotes
    });
    const rows = parseCsvRows(csv);
    const header = rows[0];
    const sectionIndex = header.indexOf('section');
    const expectedSections = [
      'section',
      'score',
      'selected-event',
      'component',
      'component',
      'occurrence',
      'news-note'
    ];

    expect(rows.map((row) => row[sectionIndex])).toEqual(expectedSections);
    expect(csv).toContain('"review line one\nreview line two"');
    expect(csv).toContain('"news line one\r\nnews line two"');
  });

  it('includes stable event ids for selected events, components, occurrences, and unselected notes', () => {
    const csv = exportReviewWorkbookCsv({
      scores,
      selectedStudy: study,
      newsAnnotations: [
        ...notes,
        {
          eventId: 'opec-2026-06-01',
          category: 'manual-note',
          headline: 'Unselected event note',
          note: 'Should still be traceable by event id.'
        }
      ]
    });
    const rows = parseCsvRows(csv);
    const header = rows[0];
    const eventIdIndex = header.indexOf('eventId');

    expect(eventIdIndex).toBeGreaterThan(-1);
    expect(rows.find((row) => row[0] === 'selected-event')?.[eventIdIndex]).toBe('eia-2026-06-03');
    expect(rows.filter((row) => row[0] === 'component').map((row) => row[eventIdIndex])).toEqual([
      'eia-2026-06-03',
      'eia-2026-06-03'
    ]);
    expect(rows.find((row) => row[0] === 'occurrence')?.[eventIdIndex]).toBe('eia-2026-06-03');
    expect(rows.find((row) => row[6] === 'Unselected event note')?.[eventIdIndex]).toBe('opec-2026-06-01');
  });

  it('neutralizes formula-like exported text without changing numeric values', () => {
    const dangerousStudy: EventStudy = {
      ...study,
      selectedEvent: {
        ...study.selectedEvent,
        label: '=EIA label',
        qualityNote: '=SUM(1,2)'
      },
      occurrences: [
        {
          eventId: 'eia-2026-06-03',
          date: '2026-06-03',
          returnPct: -1.25,
          abnormal: false,
          fundamentalSurprise: -0.5
        }
      ],
      fundamentalComponents: [
        {
          ...study.fundamentalComponents[0],
          metric: '+commercial crude stocks',
          source: '@official feed',
          provenance: undefined
        }
      ]
    };

    const csv = exportReviewWorkbookCsv({
      scores: [],
      selectedStudy: dangerousStudy,
      newsAnnotations: [
        {
          eventId: 'eia-2026-06-03',
          category: 'manual-note',
          headline: '=dangerous headline',
          note: '-dangerous note'
        }
      ]
    });
    const rows = parseCsvRows(csv);
    const header = rows[0];
    const labelIndex = header.indexOf('label');
    const returnIndex = header.indexOf('returnPct');
    const noteIndex = header.indexOf('note');

    expect(rows.find((row) => row[0] === 'selected-event')?.[labelIndex]).toBe("'=EIA label");
    expect(rows.find((row) => row[0] === 'selected-event')?.[noteIndex]).toBe("'=SUM(1,2)");
    expect(rows.find((row) => row[0] === 'component')?.[labelIndex]).toBe("'+commercial crude stocks");
    expect(rows.find((row) => row[0] === 'component')?.[noteIndex]).toBe("'@official feed");
    expect(rows.find((row) => row[0] === 'occurrence')?.[returnIndex]).toBe('-1.25');
    expect(rows.find((row) => row[0] === 'news-note')?.[labelIndex]).toBe("'=dangerous headline");
    expect(rows.find((row) => row[0] === 'news-note')?.[noteIndex]).toBe("'-dangerous note");
  });
});
