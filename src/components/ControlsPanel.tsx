import { Activity, CalendarDays, Clock, Filter } from 'lucide-react';
import { factorLabels, factorOrder } from '../lib/events';
import type { DashboardFilters, EventWindow, FactorFamily, MarketId, RegimeFilter, Timeframe } from '../lib/types';

interface ControlsPanelProps {
  filters: DashboardFilters;
  eventCount: number;
  onChange: (filters: DashboardFilters) => void;
}

const markets: Array<{ id: MarketId; label: string }> = [
  { id: 'wti', label: 'WTI' },
  { id: 'brent', label: 'Brent' },
  { id: 'spread', label: 'Spread' }
];

const windows: Array<{ id: EventWindow; label: string; disabled?: boolean }> = [
  { id: 'event-day', label: 'Event day' },
  { id: '1d', label: '1D' },
  { id: '3d', label: '3D' },
  { id: '5d', label: '5D' },
  { id: 'next-week', label: 'Next week' },
  { id: 'intraday-30m-4h', label: '30m-4h', disabled: true }
];

const timeframes: Array<{ id: Timeframe; label: string; disabled?: boolean }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'intraday', label: 'Intraday', disabled: true }
];

const regimes: Array<{ id: RegimeFilter; label: string }> = [
  { id: 'all', label: 'All regimes' },
  { id: 'high-volatility', label: 'High vol' },
  { id: 'low-volatility', label: 'Low vol' },
  { id: 'wti-uptrend', label: 'WTI uptrend' },
  { id: 'wti-downtrend', label: 'WTI downtrend' },
  { id: 'spread-wide', label: 'Wide spread' },
  { id: 'spread-tight', label: 'Tight spread' }
];

export function ControlsPanel({ filters, eventCount, onChange }: ControlsPanelProps) {
  const patch = (updates: Partial<DashboardFilters>) => onChange({ ...filters, ...updates });

  const toggleFactor = (family: FactorFamily) => {
    const selected = new Set(filters.selectedFactors);
    if (selected.has(family)) {
      selected.delete(family);
    } else {
      selected.add(family);
    }
    patch({ selectedFactors: Array.from(selected) });
  };

  return (
    <aside className="controls-panel">
      <div className="panel-heading">
        <Filter size={18} />
        <h2>Controls</h2>
      </div>

      <div className="control-block">
        <label>Market</label>
        <div className="segmented">
          {markets.map((market) => (
            <button
              key={market.id}
              type="button"
              className={filters.market === market.id ? 'selected' : ''}
              onClick={() => patch({ market: market.id })}
            >
              {market.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-block">
        <label>Timeframe</label>
        <div className="segmented">
          {timeframes.map((timeframe) => (
            <button
              key={timeframe.id}
              type="button"
              disabled={timeframe.disabled}
              className={filters.timeframe === timeframe.id ? 'selected' : ''}
              onClick={() => patch({ timeframe: timeframe.id })}
              title={timeframe.disabled ? 'Import intraday candles to enable this mode' : undefined}
            >
              {timeframe.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-block">
        <label>Event Window</label>
        <div className="window-grid">
          {windows.map((window) => (
            <button
              key={window.id}
              type="button"
              disabled={window.disabled}
              className={filters.window === window.id ? 'selected' : ''}
              onClick={() => patch({ window: window.id })}
              title={window.disabled ? 'Requires imported intraday OHLCV' : undefined}
            >
              {window.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-block">
        <label>Regime</label>
        <div className="regime-grid">
          {regimes.map((regime) => (
            <button
              key={regime.id}
              type="button"
              className={(filters.regimeFilter ?? 'all') === regime.id ? 'selected' : ''}
              onClick={() => patch({ regimeFilter: regime.id })}
            >
              {regime.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-block">
        <div className="toggle-row">
          <span>
            <Activity size={16} />
            Abnormal news excluded
          </span>
          <button
            type="button"
            className={`switch ${filters.excludeAbnormal ? 'on' : ''}`}
            onClick={() => patch({ excludeAbnormal: !filters.excludeAbnormal })}
            aria-pressed={filters.excludeAbnormal}
            title="Toggle abnormal event inclusion"
          >
            <span />
          </button>
        </div>
      </div>

      <div className="control-block factor-list-block">
        <label>Recurring Factors</label>
        <div className="factor-list">
          {factorOrder.map((family) => (
            <label key={family} className="factor-check">
              <input
                type="checkbox"
                checked={filters.selectedFactors.includes(family)}
                onChange={() => toggleFactor(family)}
              />
              <span>{factorLabels[family]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="control-footer">
        <span>
          <CalendarDays size={15} />
          {eventCount} visible events
        </span>
        <span>
          <Clock size={15} />
          {filters.timezone}
        </span>
      </div>
    </aside>
  );
}
