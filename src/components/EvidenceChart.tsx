import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LineData,
  type LineWidth,
  type MouseEventHandler,
  type SeriesMarker,
  type Time
} from 'lightweight-charts';
import { AlertTriangle, Info } from 'lucide-react';
import {
  getVisibleRangeForPreset,
  toLineSeriesData,
  type ChartRangePreset
} from '../lib/chartData';
import { getChartMarkerEvents, isChartMarkerSelected, isDirectEiaMarkerEvent } from '../lib/chartMarkers';
import { factorLabels } from '../lib/events';
import { getMarketValue } from '../lib/marketData';
import type { DashboardFilters, DailyPriceRow, EventRow, FactorFamily, MarketId } from '../lib/types';

interface EvidenceChartProps {
  rows: DailyPriceRow[];
  events: EventRow[];
  filters: DashboardFilters;
  selectedEvent: EventRow | null;
  onSelectEvent: (event: EventRow) => void;
}

interface SeriesDefinition {
  id: MarketId;
  label: string;
  color: string;
  lineWidth: LineWidth;
  muted?: boolean;
}

interface ActiveSeries {
  id: MarketId;
  label: string;
  color: string;
  api: ISeriesApi<'Line', Time>;
}

interface ChartReadout {
  date: string;
  values: Array<{ id: MarketId; label: string; color: string; value: number }>;
}

const colors: Record<FactorFamily, string> = {
  'eia-wpsr': '#0ea5a5',
  'api-wsb': '#2563eb',
  'cftc-cot': '#7c3aed',
  'rig-count': '#0891b2',
  'monthly-outlooks': '#d97706',
  'opec-meetings': '#ea580c',
  'macro-usd': '#475569',
  'roll-expiry': '#9333ea',
  'spreads-refinery': '#0284c7',
  seasonality: '#65a30d',
  'brent-physical': '#be123c',
  'brent-dubai': '#a16207',
  'shipping-risk': '#0369a1',
  'abnormal-news': '#dc2626'
};

const rangeButtons: Array<{ id: ChartRangePreset; label: string }> = [
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '1y', label: '1Y' },
  { id: 'all', label: 'All' }
];

function seriesForMarket(market: MarketId): SeriesDefinition[] {
  if (market === 'spread') {
    return [{ id: 'spread', label: 'Brent-WTI spread', color: '#0f766e', lineWidth: 3 }];
  }

  if (market === 'wti') {
    return [
      { id: 'wti', label: 'WTI', color: '#0f766e', lineWidth: 3 },
      { id: 'brent', label: 'Brent', color: '#94a3b8', lineWidth: 2, muted: true }
    ];
  }

  return [
    { id: 'brent', label: 'Brent', color: '#1d4ed8', lineWidth: 3 },
    { id: 'wti', label: 'WTI', color: '#94a3b8', lineWidth: 2, muted: true }
  ];
}

function formatValue(value: number, market: MarketId): string {
  if (market === 'spread') return value.toFixed(4);
  return `$${value.toFixed(2)}`;
}

function readoutFromRow(row: DailyPriceRow | undefined, definitions: SeriesDefinition[]): ChartReadout | null {
  if (!row) return null;

  return {
    date: row.date,
    values: definitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      color: definition.color,
      value: getMarketValue(row, definition.id)
    }))
  };
}

function timeToDateKey(time: Time | undefined): string | null {
  if (!time) return null;
  if (typeof time === 'string') return time;
  if (typeof time === 'number') return new Date(time * 1000).toISOString().slice(0, 10);
  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
}

function isAbnormalMarker(event: EventRow): boolean {
  return event.family === 'abnormal-news' || event.sourceStatus === 'news-annotation';
}

function directEiaShape(event: EventRow): SeriesMarker<Time>['shape'] {
  if (event.basketLabel === 'bullish') return 'arrowUp';
  if (event.basketLabel === 'bearish') return 'arrowDown';
  return 'circle';
}

function directEiaPosition(event: EventRow): SeriesMarker<Time>['position'] {
  if (event.basketLabel === 'bullish') return 'atPriceBottom';
  if (event.basketLabel === 'bearish') return 'atPriceTop';
  return 'atPriceMiddle';
}

function directEiaText(event: EventRow): string {
  if (event.basketScore === undefined) return 'EIA+';
  return `${event.basketScore > 0 ? '+' : ''}${event.basketScore.toFixed(2)}`;
}

function toMarkers(
  events: EventRow[],
  rowByDate: Map<string, DailyPriceRow>,
  market: MarketId,
  selectedEvent?: EventRow | null
): SeriesMarker<Time>[] {
  return getChartMarkerEvents(events)
    .filter((event) => rowByDate.has(event.date))
    .map((event) => {
      const row = rowByDate.get(event.date);
      const price = row ? getMarketValue(row, market) : 0;
      const abnormal = isAbnormalMarker(event);
      const directEia = isDirectEiaMarkerEvent(event);

      return {
        id: event.id,
        time: event.date,
        position: directEia ? directEiaPosition(event) : 'atPriceTop',
        price,
        shape: directEia ? directEiaShape(event) : abnormal ? 'square' : 'circle',
        color: colors[event.family],
        size: isChartMarkerSelected(event, selectedEvent) ? 1.8 : directEia ? 1.35 : abnormal ? 1.25 : 1,
        text: directEia ? directEiaText(event) : abnormal ? 'news' : undefined
      };
    });
}

export function EvidenceChart({ rows, events, filters, selectedEvent, onSelectEvent }: EvidenceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const activeSeriesRef = useRef<ActiveSeries[]>([]);
  const markerApiRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const eventsByIdRef = useRef(new Map<string, EventRow>());
  const [rangePreset, setRangePreset] = useState<ChartRangePreset>('1m');
  const [crosshairReadout, setCrosshairReadout] = useState<ChartReadout | null>(null);

  const definitions = useMemo(() => seriesForMarket(filters.market), [filters.market]);
  const rowByDate = useMemo(() => new Map(rows.map((row) => [row.date, row])), [rows]);
  const visibleRange = useMemo(() => getVisibleRangeForPreset(rows, rangePreset), [rows, rangePreset]);
  const latestReadout = useMemo(
    () => readoutFromRow(rows[rows.length - 1], definitions),
    [definitions, rows]
  );
  const activeReadout = crosshairReadout ?? latestReadout;

  useEffect(() => {
    eventsByIdRef.current = new Map(events.map((event) => [event.id, event]));
  }, [events]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 430,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#61716f',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12
      },
      grid: {
        vertLines: { color: '#edf2f1' },
        horzLines: { color: '#edf2f1' }
      },
      crosshair: {
        mode: CrosshairMode.Normal
      },
      rightPriceScale: {
        borderColor: '#d8e1df',
        scaleMargins: {
          top: 0.12,
          bottom: 0.14
        }
      },
      timeScale: {
        borderColor: '#d8e1df',
        fixLeftEdge: false,
        fixRightEdge: false,
        rightOffset: 3,
        timeVisible: false,
        secondsVisible: false
      },
      handleScroll: true,
      handleScale: true
    });

    const handleClick: MouseEventHandler<Time> = (param) => {
      const objectId = param.hoveredInfo?.objectId ?? param.hoveredObjectId;
      if (typeof objectId !== 'string') return;

      const event = eventsByIdRef.current.get(objectId);
      if (event) onSelectEvent(event);
    };

    const handleCrosshairMove: MouseEventHandler<Time> = (param) => {
      const date = timeToDateKey(param.time);
      if (!date) {
        setCrosshairReadout(null);
        return;
      }

      const values = activeSeriesRef.current.flatMap((series) => {
        const datum = param.seriesData.get(series.api) as LineData<Time> | undefined;
        return datum && Number.isFinite(datum.value)
          ? [{ id: series.id, label: series.label, color: series.color, value: datum.value }]
          : [];
      });

      setCrosshairReadout(values.length ? { date, values } : null);
    };

    chart.subscribeClick(handleClick);
    chart.subscribeCrosshairMove(handleCrosshairMove);
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      chart.resize(Math.floor(entry.contentRect.width), Math.floor(entry.contentRect.height));
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeClick(handleClick);
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      markerApiRef.current?.detach();
      chart.remove();
      chartRef.current = null;
      activeSeriesRef.current = [];
      markerApiRef.current = null;
    };
  }, [onSelectEvent]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    markerApiRef.current?.detach();
    activeSeriesRef.current.forEach((series) => chart.removeSeries(series.api));
    activeSeriesRef.current = [];

    definitions.forEach((definition, index) => {
      const api = chart.addSeries(LineSeries, {
        color: definition.color,
        lineWidth: definition.lineWidth,
        lastValueVisible: true,
        priceLineVisible: index === 0,
        priceFormat: {
          type: 'price',
          precision: definition.id === 'spread' ? 4 : 2,
          minMove: definition.id === 'spread' ? 0.0001 : 0.01
        }
      });

      api.setData(toLineSeriesData(rows, definition.id));
      activeSeriesRef.current.push({
        id: definition.id,
        label: definition.label,
        color: definition.color,
        api
      });
    });

    const primarySeries = activeSeriesRef.current[0]?.api;
    if (primarySeries) {
      markerApiRef.current = createSeriesMarkers(
        primarySeries,
        toMarkers(events, rowByDate, filters.market, selectedEvent),
        { autoScale: true }
      );
    }
  }, [definitions, events, filters.market, rowByDate, rows, selectedEvent]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !visibleRange) return;

    window.requestAnimationFrame(() => {
      if (rangePreset === 'all') {
        chart.timeScale().fitContent();
      } else {
        chart.timeScale().setVisibleRange({ from: visibleRange.from, to: visibleRange.to });
      }
    });
  }, [rangePreset, visibleRange, definitions]);

  return (
    <section className="chart-panel">
      <div className="panel-heading chart-heading">
        <div>
          <h2>WTI and Brent chart</h2>
          <p>
            {rows[0]?.date ?? 'No data'} to {rows[rows.length - 1]?.date ?? 'No data'}
          </p>
        </div>
        <div className="legend" aria-label="Chart series">
          {definitions.map((item) => (
            <span key={item.id}>
              <i style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="chart-toolbar">
        <div className="range-buttons" aria-label="Visible chart range">
          {rangeButtons.map((button) => (
            <button
              key={button.id}
              type="button"
              className={rangePreset === button.id ? 'selected' : ''}
              onClick={() => setRangePreset(button.id)}
            >
              {button.label}
            </button>
          ))}
        </div>

        {activeReadout ? (
          <div className="chart-readout" data-testid="chart-readout">
            <strong>{activeReadout.date}</strong>
            {activeReadout.values.map((value) => (
              <span key={value.id}>
                <i style={{ background: value.color }} />
                {value.label} {formatValue(value.value, value.id)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="tradingview-chart" ref={chartContainerRef} data-testid="tradingview-chart" />

      <div className="chart-data-audit" data-testid="chart-data-audit">
        <span>
          Visible {rangeButtons.find((button) => button.id === rangePreset)?.label}:{' '}
          {visibleRange ? `${visibleRange.firstDataDate} to ${visibleRange.lastDataDate}` : 'No data'}
        </span>
        {rows[rows.length - 1] ? (
          <span>
            Latest official row: {rows[rows.length - 1].date} | WTI{' '}
            {formatValue(rows[rows.length - 1].wti, 'wti')} | Brent{' '}
            {formatValue(rows[rows.length - 1].brent, 'brent')} | Spread{' '}
            {formatValue(rows[rows.length - 1].spread, 'spread')}
          </span>
        ) : null}
      </div>

      <div className="selected-event">
        {selectedEvent ? (
          <>
            {selectedEvent.excludeFromCoreStats ? <AlertTriangle size={18} /> : <Info size={18} />}
            <div>
              <h3>{selectedEvent.label}</h3>
              <p>
                {selectedEvent.date} | {factorLabels[selectedEvent.family]} | {selectedEvent.sourceStatus}
              </p>
              <span>{selectedEvent.qualityNote}</span>
            </div>
          </>
        ) : (
          <>
            <Info size={18} />
            <div>
              <h3>Select an event marker</h3>
              <p>Markers show recurring calendar factors and abnormal daily moves for historical explanation.</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
