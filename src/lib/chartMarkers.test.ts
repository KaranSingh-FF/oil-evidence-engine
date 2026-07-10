import { describe, expect, it } from 'vitest';
import { getChartMarkerEvents, isChartMarkerSelected } from './chartMarkers';
import type { EventRow } from './types';

const proxyEia: EventRow = {
  id: 'eia-2026-06-03-proxy',
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

const oneMetricDirectEia: EventRow = {
  ...proxyEia,
  id: 'eia-2026-06-03-one-metric',
  label: 'EIA WPSR single metric surprise',
  sourceStatus: 'direct',
  evidenceProvenance: 'official',
  evidenceQuality: 'official',
  metricCount: 1,
  basketScore: -0.2,
  basketLabel: 'bearish'
};

const sampleDirectEia: EventRow = {
  ...oneMetricDirectEia,
  id: 'eia-2026-06-03-sample',
  evidenceProvenance: 'sample',
  evidenceQuality: 'sample',
  sourceStatus: 'direct'
};

const cftcEvent: EventRow = {
  ...proxyEia,
  id: 'cftc-2026-06-03',
  family: 'cftc-cot',
  label: 'CFTC Commitments of Traders',
  sourceStatus: 'calendar-proxy'
};

describe('chart marker event selection', () => {
  it('uses one direct EIA marker instead of drawing both proxy and direct markers for the same release', () => {
    const markerEvents = getChartMarkerEvents([proxyEia, oneMetricDirectEia]);

    expect(markerEvents.map((event) => event.id)).toEqual(['eia-2026-06-03-one-metric']);
  });

  it('keeps the EIA proxy when the direct row is sample evidence', () => {
    const markerEvents = getChartMarkerEvents([proxyEia, sampleDirectEia]);

    expect(markerEvents.map((event) => event.id)).toEqual(['eia-2026-06-03-proxy']);
  });

  it('does not collapse different recurring factors on the same date', () => {
    const markerEvents = getChartMarkerEvents([proxyEia, cftcEvent]);

    expect(markerEvents.map((event) => event.id)).toEqual(['eia-2026-06-03-proxy', 'cftc-2026-06-03']);
  });

  it('treats the rendered direct EIA marker as selected when the same-release proxy is selected elsewhere', () => {
    expect(isChartMarkerSelected(oneMetricDirectEia, proxyEia)).toBe(true);
    expect(isChartMarkerSelected(cftcEvent, proxyEia)).toBe(false);
  });
});
