import {
  getMonthKey,
  getUtcDateOfMonth,
  getUtcDay,
  getUtcMonth
} from './dateUtils';
import { buildEiaBasketsByDate } from './fundamentals';
import type { DailyPriceRow, EventRow, EventWindow, FactorFamily, FundamentalRecord } from './types';

const SUPPORTED_DAILY_WINDOWS: EventWindow[] = ['event-day', '1d', '3d', '5d', 'next-week'];

export const factorLabels: Record<FactorFamily, string> = {
  'eia-wpsr': 'EIA Weekly Petroleum Status Report',
  'api-wsb': 'API Weekly Statistical Bulletin',
  'cftc-cot': 'CFTC Commitments of Traders',
  'rig-count': 'Baker Hughes rig count',
  'monthly-outlooks': 'Monthly oil outlooks',
  'opec-meetings': 'OPEC/OPEC+ meetings',
  'macro-usd': 'Macro and USD calendar',
  'roll-expiry': 'Futures roll and expiry',
  'spreads-refinery': 'Spreads and refinery signals',
  seasonality: 'Oil seasonality',
  'brent-physical': 'Brent physical supply',
  'brent-dubai': 'Brent-Dubai / Asia arb',
  'shipping-risk': 'Tanker and freight stress',
  'abnormal-news': 'Abnormal news annotation'
};

export const factorOrder: FactorFamily[] = [
  'eia-wpsr',
  'api-wsb',
  'cftc-cot',
  'rig-count',
  'monthly-outlooks',
  'opec-meetings',
  'macro-usd',
  'roll-expiry',
  'spreads-refinery',
  'seasonality',
  'brent-physical',
  'brent-dubai',
  'shipping-risk',
  'abnormal-news'
];

const factorSources: Record<FactorFamily, string> = {
  'eia-wpsr': 'https://www.eia.gov/petroleum/supply/weekly/',
  'api-wsb': 'https://www.api.org/products-and-services/statistics/api-weekly-statistical-bulletin',
  'cftc-cot': 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm',
  'rig-count': 'https://rigcount.bakerhughes.com/',
  'monthly-outlooks': 'https://www.eia.gov/outlooks/steo/',
  'opec-meetings': 'https://www.opec.org/opec_web/en/publications/338.htm',
  'macro-usd': 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
  'roll-expiry': 'https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.contractSpecs.html',
  'spreads-refinery': 'https://www.eia.gov/petroleum/supply/weekly/',
  seasonality: 'https://www.eia.gov/energyexplained/oil-and-petroleum-products/',
  'brent-physical': 'https://www.ice.com/products/219/Brent-Crude-Futures',
  'brent-dubai': 'https://www.spglobal.com/commodityinsights/en/our-methodology/methodology-specifications/oil',
  'shipping-risk': 'https://www.eia.gov/todayinenergy/',
  'abnormal-news': ''
};

function eventId(family: FactorFamily, date: string, suffix = ''): string {
  return `${family}-${date}${suffix ? `-${suffix}` : ''}`;
}

function sortEvents(events: EventRow[]): EventRow[] {
  return [...events].sort(
    (a, b) =>
      a.date.localeCompare(b.date)
      || a.family.localeCompare(b.family)
      || a.id.localeCompare(b.id)
  );
}

function createCalendarEvent(row: DailyPriceRow, family: FactorFamily, releaseTime?: string): EventRow {
  return {
    id: eventId(family, row.date, releaseTime?.replace(/[^a-z0-9]/gi, '').toLowerCase()),
    date: row.date,
    family,
    label: factorLabels[family],
    sourceStatus: 'calendar-proxy',
    sourceUrl: factorSources[family],
    releaseTime,
    qualityNote:
      'Daily public baseline; direct report surprise values are not loaded in Phase 1, so this is a recurring calendar proxy.',
    supportedWindows: SUPPORTED_DAILY_WINDOWS,
    excludeFromCoreStats: false
  };
}

export function generateRecurringEvents(rows: DailyPriceRow[]): EventRow[] {
  const events: EventRow[] = [];
  const monthlyOutlooks = new Set<string>();
  const opecMeetings = new Set<string>();
  const rollWindows = new Set<string>();
  const seasonalMonths = new Set<string>();
  const brentPhysical = new Set<string>();
  const brentDubai = new Set<string>();
  const shippingRisk = new Set<string>();

  for (const row of rows) {
    const day = getUtcDay(row.date);
    const dateOfMonth = getUtcDateOfMonth(row.date);
    const month = getUtcMonth(row.date);
    const monthKey = getMonthKey(row.date);

    if (day === 2) {
      events.push(createCalendarEvent(row, 'api-wsb', 'after U.S. close'));
    }

    if (day === 3) {
      events.push(createCalendarEvent(row, 'eia-wpsr', '10:30 ET'));
      events.push(createCalendarEvent(row, 'spreads-refinery', '10:30 ET'));
    }

    if (day === 5) {
      events.push(createCalendarEvent(row, 'cftc-cot', '15:30 ET'));
      events.push(createCalendarEvent(row, 'rig-count', 'Friday'));
      if (dateOfMonth <= 7) {
        events.push(createCalendarEvent(row, 'macro-usd', '08:30-10:00 ET'));
      }
    }

    if (!monthlyOutlooks.has(monthKey) && dateOfMonth >= 10 && dateOfMonth <= 16) {
      monthlyOutlooks.add(monthKey);
      events.push(createCalendarEvent(row, 'monthly-outlooks', 'monthly'));
    }

    if (!opecMeetings.has(monthKey) && [0, 2, 5, 8, 11].includes(month) && dateOfMonth <= 7) {
      opecMeetings.add(monthKey);
      events.push(createCalendarEvent(row, 'opec-meetings', 'scheduled'));
    }

    if (!rollWindows.has(monthKey) && dateOfMonth >= 18 && dateOfMonth <= 24) {
      rollWindows.add(monthKey);
      events.push(createCalendarEvent(row, 'roll-expiry', 'monthly roll window'));
    }

    if (!seasonalMonths.has(monthKey) && [4, 5, 6, 7, 8, 9, 10, 11].includes(month)) {
      seasonalMonths.add(monthKey);
      events.push(createCalendarEvent(row, 'seasonality', 'monthly tag'));
    }

    if (!brentPhysical.has(monthKey) && dateOfMonth <= 5) {
      brentPhysical.add(monthKey);
      events.push(createCalendarEvent(row, 'brent-physical', 'monthly physical watch'));
    }

    if (!brentDubai.has(monthKey) && dateOfMonth >= 10 && dateOfMonth <= 16) {
      brentDubai.add(monthKey);
      events.push(createCalendarEvent(row, 'brent-dubai', 'monthly arb watch'));
    }

    if (!shippingRisk.has(monthKey) && day === 5 && dateOfMonth >= 15) {
      shippingRisk.add(monthKey);
      events.push(createCalendarEvent(row, 'shipping-risk', 'freight risk watch'));
    }
  }

  return sortEvents(events);
}

export function detectAbnormalEvents(rows: DailyPriceRow[], thresholdPct = 4): EventRow[] {
  const abnormal: EventRow[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const previous = rows[i - 1];
    const current = rows[i];
    const wtiMove = Math.abs(((current.wti - previous.wti) / previous.wti) * 100);
    const brentMove = Math.abs(((current.brent - previous.brent) / previous.brent) * 100);
    const maxMove = Math.max(wtiMove, brentMove);

    if (maxMove >= thresholdPct) {
      abnormal.push({
        id: eventId('abnormal-news', current.date),
        date: current.date,
        family: 'abnormal-news',
        label: `Abnormal candle: ${maxMove.toFixed(1)}% daily move`,
        sourceStatus: 'news-annotation',
        sourceUrl: '',
        qualityNote:
          'Large daily move flagged for historical explanation. Add a news note before treating this as repeatable evidence.',
        supportedWindows: SUPPORTED_DAILY_WINDOWS,
        excludeFromCoreStats: true,
        magnitude: maxMove
      });
    }
  }

  return abnormal;
}

export function generateFundamentalEvents(fundamentals: FundamentalRecord[]): EventRow[] {
  return buildEiaBasketsByDate(fundamentals);
}

function canReplaceEiaCalendarProxy(event: EventRow): boolean {
  return event.family === 'eia-wpsr'
    && (event.sourceStatus === 'direct' || event.sourceStatus === 'manual')
    && !event.excludeFromCoreStats
    && (event.metricCount ?? 0) >= 2;
}

function isEiaCalendarProxy(event: EventRow): boolean {
  return event.family === 'eia-wpsr' && event.sourceStatus === 'calendar-proxy';
}

export function mergeDirectEventsWithCalendar(
  calendarEvents: EventRow[],
  directEvents: EventRow[]
): EventRow[] {
  const qualifyingDirectByDate = new Map<string, EventRow>();

  for (const event of directEvents) {
    if (canReplaceEiaCalendarProxy(event) && !qualifyingDirectByDate.has(event.date)) {
      qualifyingDirectByDate.set(event.date, event);
    }
  }

  const seenEventKeys = new Set<string>();
  const merged: EventRow[] = [];
  const pushUnique = (event: EventRow) => {
    const key = `${event.date}|${event.family}|${event.id}`;
    if (seenEventKeys.has(key)) return;

    seenEventKeys.add(key);
    merged.push(event);
  };

  for (const event of calendarEvents) {
    const replacement = isEiaCalendarProxy(event)
      ? qualifyingDirectByDate.get(event.date)
      : undefined;

    if (replacement) {
      pushUnique(replacement);
    } else {
      pushUnique(event);
    }
  }

  for (const event of directEvents) {
    if (canReplaceEiaCalendarProxy(event)) {
      if (qualifyingDirectByDate.get(event.date) === event) {
        pushUnique(event);
      }
    } else {
      pushUnique(event);
    }
  }

  return sortEvents(merged);
}
