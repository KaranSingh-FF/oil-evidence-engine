# EIA Surprise Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace weak EIA calendar-proxy research with direct, auditable EIA weekly petroleum observations, consensus surprise handling, basket scoring, and chart-level review tools.

**Architecture:** Keep the current React/Vite/TypeScript dashboard and add a focused fundamentals layer. Direct EIA observations are normalized into one internal dataset, expectations are imported or proxied with explicit quality labels, and direct events override calendar-proxy EIA markers when enough metric evidence exists.

**Tech Stack:** React, TypeScript, Vitest, Lightweight Charts, local JSON/CSV data files, PowerShell data scripts.

---

## Scope

This plan implements the EIA-first research upgrade only. It does not implement CFTC, rig count, term structure, OPEC, Brent-Dubai, or paid consensus integrations. Those should be separate plans after the EIA engine proves the workflow.

Primary official references:

- EIA Weekly Petroleum Status Report: https://www.eia.gov/petroleum/supply/weekly/
- EIA Open Data: https://www.eia.gov/opendata/

The app must always label each EIA value as one of:

- `direct-consensus`: actual and user/imported expectation both available
- `direct-proxy`: actual available, expectation derived from previous or historical change
- `calendar-proxy`: no direct metric evidence for that date

## File Structure

- Create: `src/lib/eiaMetrics.ts`
  - Owns canonical EIA metric IDs, labels, units, directional interpretation, and basket weights.
- Create: `src/lib/fundamentals.ts`
  - Owns normalization of raw/imported fundamental records, surprise standardization, basket construction, event conversion, and data quality summaries.
- Create: `src/lib/fundamentals.test.ts`
  - Unit tests for surprise math, basket direction, quality labels, and direct event generation.
- Modify: `src/lib/types.ts`
  - Adds metric IDs, evidence quality, direct event fields, basket fields, and pattern quality fields.
- Modify: `src/lib/imports.ts`
  - Extends fundamental CSV import to support `metricId`, `expectationMethod`, `publishedAt`, and multi-metric EIA records.
- Modify: `src/lib/imports.test.ts`
  - Adds parser tests for the new EIA CSV format while keeping current CSV compatibility.
- Modify: `src/lib/events.ts`
  - Adds `generateFundamentalEvents()` and keeps calendar EIA only where direct EIA data is missing.
- Modify: `src/lib/events.test.ts`
  - Adds tests that direct EIA events override calendar-proxy EIA markers.
- Modify: `src/lib/scoring.ts`
  - Adds basket-aware score quality and a minimum evidence gate for direct fundamental patterns.
- Modify: `src/lib/scoring.test.ts`
  - Adds tests for direct EIA basket scoring and weak sample labeling.
- Modify: `src/lib/eventStudy.ts`
  - Shows all EIA metric components attached to the selected event, not just one fundamental record.
- Modify: `src/lib/eventStudy.test.ts`
  - Adds selected-event tests for crude, gasoline, distillate, Cushing, utilization, and basket values.
- Create: `src/components/FundamentalLabPanel.tsx`
  - Displays EIA metric table, basket interpretation, quality tier, and pattern review controls.
- Modify: `src/components/EventStudyPanel.tsx`
  - Adds a compact EIA component breakdown for selected WPSR events.
- Modify: `src/components/DataQualityPanel.tsx`
  - Separates calendar proxies from direct EIA observations and expectation quality.
- Modify: `src/components/ScoreCards.tsx`
  - Shows direct evidence quality and basket label when available.
- Modify: `src/components/EvidenceChart.tsx`
  - Uses different marker shape or text for direct EIA basket events.
- Modify: `src/App.tsx`
  - Loads bundled EIA sample data, merges imported EIA data, generates direct events, and renders the new panel.
- Modify: `src/styles.css`
  - Adds dense research-table styling without introducing a landing-page feel.
- Create: `public/data/eia-weekly-sample.json`
  - Small deterministic fixture for UI and tests. It must be visibly labeled as a sample, not official historical coverage.
- Create: `scripts/fetch-eia-weekly.ps1`
  - Script scaffold that writes `public/data/eia-weekly.json` from a verified CSV/JSON source path supplied by the user or official EIA download. It must not silently invent missing series IDs.

---

## Task 1: Add EIA Metric Types

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/eiaMetrics.ts`
- Test: `src/lib/fundamentals.test.ts`

- [ ] **Step 1: Write failing type and metric tests**

Create `src/lib/fundamentals.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { eiaMetricDefinitions, getEiaMetricDefinition } from './eiaMetrics';

describe('EIA metric definitions', () => {
  it('defines the core weekly petroleum components used in basket scoring', () => {
    expect(Object.keys(eiaMetricDefinitions)).toEqual([
      'crude_stocks_change',
      'cushing_stocks_change',
      'gasoline_stocks_change',
      'distillate_stocks_change',
      'refinery_utilization_change',
      'crude_production_change',
      'net_imports_change',
      'spr_stocks_change',
      'product_supplied_change'
    ]);
  });

  it('knows whether a positive surprise is bullish or bearish for crude', () => {
    expect(getEiaMetricDefinition('crude_stocks_change').bullishWhen).toBe('lower');
    expect(getEiaMetricDefinition('refinery_utilization_change').bullishWhen).toBe('higher');
    expect(getEiaMetricDefinition('product_supplied_change').bullishWhen).toBe('higher');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm vitest run src/lib/fundamentals.test.ts
```

Expected: fail because `src/lib/eiaMetrics.ts` does not exist.

- [ ] **Step 3: Extend `src/lib/types.ts`**

Add these exported types after `FactorFamily`:

```ts
export type EiaMetricId =
  | 'crude_stocks_change'
  | 'cushing_stocks_change'
  | 'gasoline_stocks_change'
  | 'distillate_stocks_change'
  | 'refinery_utilization_change'
  | 'crude_production_change'
  | 'net_imports_change'
  | 'spr_stocks_change'
  | 'product_supplied_change';

export type SurpriseQuality = 'direct-consensus' | 'direct-proxy' | 'calendar-proxy';

export type BullishDirection = 'higher' | 'lower';

export interface EiaMetricDefinition {
  id: EiaMetricId;
  label: string;
  unit: 'mb' | 'kbd' | 'pct';
  bullishWhen: BullishDirection;
  basketWeight: number;
}
```

Extend `FundamentalRecord` to:

```ts
export interface FundamentalRecord {
  date: string;
  family: FactorFamily;
  metric: string;
  metricId?: EiaMetricId;
  actual: number;
  expected: number;
  unit: string;
  source: string;
  surprise: number;
  surpriseQuality?: SurpriseQuality;
  expectationMethod?: 'consensus' | 'previous-change' | 'rolling-median';
  publishedAt?: string;
  note?: string;
}
```

Extend `EventRow` with optional direct EIA fields:

```ts
  evidenceQuality?: SurpriseQuality;
  basketScore?: number;
  basketLabel?: 'bullish' | 'bearish' | 'mixed';
  metricCount?: number;
```

- [ ] **Step 4: Create `src/lib/eiaMetrics.ts`**

Use this file content:

```ts
import type { EiaMetricDefinition, EiaMetricId } from './types';

export const eiaMetricDefinitions: Record<EiaMetricId, EiaMetricDefinition> = {
  crude_stocks_change: {
    id: 'crude_stocks_change',
    label: 'Commercial crude stocks change',
    unit: 'mb',
    bullishWhen: 'lower',
    basketWeight: 1.4
  },
  cushing_stocks_change: {
    id: 'cushing_stocks_change',
    label: 'Cushing stocks change',
    unit: 'mb',
    bullishWhen: 'lower',
    basketWeight: 1.1
  },
  gasoline_stocks_change: {
    id: 'gasoline_stocks_change',
    label: 'Gasoline stocks change',
    unit: 'mb',
    bullishWhen: 'lower',
    basketWeight: 0.9
  },
  distillate_stocks_change: {
    id: 'distillate_stocks_change',
    label: 'Distillate stocks change',
    unit: 'mb',
    bullishWhen: 'lower',
    basketWeight: 0.8
  },
  refinery_utilization_change: {
    id: 'refinery_utilization_change',
    label: 'Refinery utilization change',
    unit: 'pct',
    bullishWhen: 'higher',
    basketWeight: 0.7
  },
  crude_production_change: {
    id: 'crude_production_change',
    label: 'Crude production change',
    unit: 'kbd',
    bullishWhen: 'lower',
    basketWeight: 0.7
  },
  net_imports_change: {
    id: 'net_imports_change',
    label: 'Net imports change',
    unit: 'kbd',
    bullishWhen: 'lower',
    basketWeight: 0.5
  },
  spr_stocks_change: {
    id: 'spr_stocks_change',
    label: 'SPR stocks change',
    unit: 'mb',
    bullishWhen: 'higher',
    basketWeight: 0.3
  },
  product_supplied_change: {
    id: 'product_supplied_change',
    label: 'Product supplied change',
    unit: 'kbd',
    bullishWhen: 'higher',
    basketWeight: 0.8
  }
};

export function getEiaMetricDefinition(metricId: EiaMetricId): EiaMetricDefinition {
  return eiaMetricDefinitions[metricId];
}
```

- [ ] **Step 5: Run test**

Run:

```powershell
pnpm vitest run src/lib/fundamentals.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/types.ts src/lib/eiaMetrics.ts src/lib/fundamentals.test.ts
git commit -m "feat: define eia metric model"
```

---

## Task 2: Normalize EIA Fundamental Records

**Files:**
- Create: `src/lib/fundamentals.ts`
- Modify: `src/lib/fundamentals.test.ts`

- [ ] **Step 1: Add failing normalization tests**

Append to `src/lib/fundamentals.test.ts`:

```ts
import {
  buildEiaBasket,
  normalizeFundamentalRecords,
  signedSurprise
} from './fundamentals';
import type { FundamentalRecord } from './types';

describe('EIA fundamental normalization', () => {
  const records: FundamentalRecord[] = [
    {
      date: '2026-06-03',
      family: 'eia-wpsr',
      metric: 'Commercial crude stocks change',
      metricId: 'crude_stocks_change',
      actual: -6,
      expected: -1.2,
      unit: 'mb',
      source: 'EIA WPSR plus imported consensus',
      surprise: -4.8,
      surpriseQuality: 'direct-consensus',
      expectationMethod: 'consensus'
    },
    {
      date: '2026-06-03',
      family: 'eia-wpsr',
      metric: 'Gasoline stocks change',
      metricId: 'gasoline_stocks_change',
      actual: -2,
      expected: 0.5,
      unit: 'mb',
      source: 'EIA WPSR plus imported consensus',
      surprise: -2.5,
      surpriseQuality: 'direct-consensus',
      expectationMethod: 'consensus'
    },
    {
      date: '2026-06-03',
      family: 'eia-wpsr',
      metric: 'Refinery utilization change',
      metricId: 'refinery_utilization_change',
      actual: 1.2,
      expected: 0.2,
      unit: 'pct',
      source: 'EIA WPSR plus imported consensus',
      surprise: 1,
      surpriseQuality: 'direct-consensus',
      expectationMethod: 'consensus'
    }
  ];

  it('keeps only EIA records with known metric IDs', () => {
    const normalized = normalizeFundamentalRecords([
      ...records,
      {
        date: '2026-06-03',
        family: 'eia-wpsr',
        metric: 'Unknown',
        actual: 1,
        expected: 0,
        unit: 'mb',
        source: 'test',
        surprise: 1
      }
    ]);

    expect(normalized).toHaveLength(3);
    expect(normalized.every((record) => record.metricId)).toBe(true);
  });

  it('turns lower inventory surprises into bullish signed scores', () => {
    expect(signedSurprise(records[0])).toBeCloseTo(4.8);
    expect(signedSurprise(records[2])).toBeCloseTo(1);
  });

  it('builds a bullish basket when multiple core components agree', () => {
    const basket = buildEiaBasket(records);

    expect(basket.date).toBe('2026-06-03');
    expect(basket.metricCount).toBe(3);
    expect(basket.quality).toBe('direct-consensus');
    expect(basket.label).toBe('bullish');
    expect(basket.score).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm vitest run src/lib/fundamentals.test.ts
```

Expected: fail because `src/lib/fundamentals.ts` does not exist.

- [ ] **Step 3: Create `src/lib/fundamentals.ts`**

Use this file content:

```ts
import { eiaMetricDefinitions, getEiaMetricDefinition } from './eiaMetrics';
import type { EiaMetricId, FundamentalRecord, SurpriseQuality } from './types';

export interface EiaBasket {
  date: string;
  score: number;
  label: 'bullish' | 'bearish' | 'mixed';
  metricCount: number;
  quality: SurpriseQuality;
  records: FundamentalRecord[];
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function isEiaMetricId(value: string | undefined): value is EiaMetricId {
  return Boolean(value && value in eiaMetricDefinitions);
}

export function normalizeFundamentalRecords(records: FundamentalRecord[]): FundamentalRecord[] {
  return records
    .filter((record) => record.family === 'eia-wpsr' && isEiaMetricId(record.metricId))
    .map((record) => ({
      ...record,
      metric: getEiaMetricDefinition(record.metricId as EiaMetricId).label,
      unit: getEiaMetricDefinition(record.metricId as EiaMetricId).unit,
      surprise: round(record.actual - record.expected, 4),
      surpriseQuality: record.surpriseQuality ?? 'direct-proxy',
      expectationMethod: record.expectationMethod ?? 'previous-change'
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.metricId).localeCompare(String(b.metricId)));
}

export function signedSurprise(record: FundamentalRecord): number {
  if (!isEiaMetricId(record.metricId)) return 0;
  const definition = getEiaMetricDefinition(record.metricId);
  const sign = definition.bullishWhen === 'higher' ? 1 : -1;
  return round(record.surprise * sign, 4);
}

function weakestQuality(records: FundamentalRecord[]): SurpriseQuality {
  if (records.some((record) => record.surpriseQuality === 'calendar-proxy')) return 'calendar-proxy';
  if (records.some((record) => record.surpriseQuality === 'direct-proxy' || !record.surpriseQuality)) return 'direct-proxy';
  return 'direct-consensus';
}

export function buildEiaBasket(records: FundamentalRecord[]): EiaBasket {
  const normalized = normalizeFundamentalRecords(records);
  const date = normalized[0]?.date ?? '';
  const weightedScore = normalized.reduce((sum, record) => {
    const definition = getEiaMetricDefinition(record.metricId as EiaMetricId);
    return sum + signedSurprise(record) * definition.basketWeight;
  }, 0);
  const totalWeight = normalized.reduce((sum, record) => {
    const definition = getEiaMetricDefinition(record.metricId as EiaMetricId);
    return sum + definition.basketWeight;
  }, 0);
  const score = totalWeight > 0 ? round(weightedScore / totalWeight) : 0;

  return {
    date,
    score,
    label: score >= 0.5 ? 'bullish' : score <= -0.5 ? 'bearish' : 'mixed',
    metricCount: normalized.length,
    quality: weakestQuality(normalized),
    records: normalized
  };
}

export function buildEiaBasketsByDate(records: FundamentalRecord[]): EiaBasket[] {
  const grouped = new Map<string, FundamentalRecord[]>();
  for (const record of normalizeFundamentalRecords(records)) {
    const list = grouped.get(record.date) ?? [];
    list.push(record);
    grouped.set(record.date, list);
  }
  return Array.from(grouped.values()).map(buildEiaBasket).sort((a, b) => a.date.localeCompare(b.date));
}
```

- [ ] **Step 4: Run test**

Run:

```powershell
pnpm vitest run src/lib/fundamentals.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/fundamentals.ts src/lib/fundamentals.test.ts
git commit -m "feat: normalize eia fundamental surprises"
```

---

## Task 3: Extend Fundamental CSV Import

**Files:**
- Modify: `src/lib/imports.ts`
- Modify: `src/lib/imports.test.ts`

- [ ] **Step 1: Add failing CSV import test**

Append to `src/lib/imports.test.ts`:

```ts
it('parses extended EIA surprise CSV records with metric IDs and quality labels', () => {
  const records = parseFundamentalCsv(
    'date,family,metricId,actual,expected,unit,source,surpriseQuality,expectationMethod,publishedAt,note\n' +
      '2026-06-03,eia-wpsr,crude_stocks_change,-6,-1.2,mb,EIA WPSR,direct-consensus,consensus,2026-06-03T14:30:00Z,large draw\n'
  );

  expect(records).toEqual([
    {
      date: '2026-06-03',
      family: 'eia-wpsr',
      metric: 'Commercial crude stocks change',
      metricId: 'crude_stocks_change',
      actual: -6,
      expected: -1.2,
      unit: 'mb',
      source: 'EIA WPSR',
      surprise: -4.8,
      surpriseQuality: 'direct-consensus',
      expectationMethod: 'consensus',
      publishedAt: '2026-06-03T14:30:00Z',
      note: 'large draw'
    }
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm vitest run src/lib/imports.test.ts
```

Expected: fail because parser does not map `metricId` to canonical labels.

- [ ] **Step 3: Modify `src/lib/imports.ts`**

Add imports:

```ts
import { getEiaMetricDefinition } from './eiaMetrics';
import type { EiaMetricId, SurpriseQuality } from './types';
```

Replace the existing `parseFundamentalCsv()` body with:

```ts
export function parseFundamentalCsv(text: string): FundamentalRecord[] {
  return parseCsv(text).map((row) => {
    const actual = parseNumber(row.actual, 'actual');
    const expected = parseNumber(row.expected, 'expected');
    const metricId = row.metricId as EiaMetricId | undefined;
    const definition = metricId ? getEiaMetricDefinition(metricId) : undefined;

    return {
      date: row.date,
      family: row.family as FactorFamily,
      metric: row.metric || definition?.label || metricId || '',
      metricId,
      actual,
      expected,
      unit: row.unit || definition?.unit || '',
      source: row.source,
      note: row.note || undefined,
      surprise: Number((actual - expected).toFixed(4)),
      surpriseQuality: (row.surpriseQuality as SurpriseQuality | undefined) || undefined,
      expectationMethod:
        (row.expectationMethod as FundamentalRecord['expectationMethod'] | undefined) || undefined,
      publishedAt: row.publishedAt || undefined
    };
  });
}
```

- [ ] **Step 4: Run import tests**

Run:

```powershell
pnpm vitest run src/lib/imports.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/imports.ts src/lib/imports.test.ts
git commit -m "feat: parse eia surprise imports"
```

---

## Task 4: Convert EIA Baskets Into Direct Events

**Files:**
- Modify: `src/lib/events.ts`
- Modify: `src/lib/events.test.ts`

- [ ] **Step 1: Add failing direct-event tests**

Append to `src/lib/events.test.ts`:

```ts
import { generateFundamentalEvents } from './events';
import type { FundamentalRecord } from './types';

describe('direct EIA event generation', () => {
  it('creates direct EIA events from measured weekly basket data', () => {
    const fundamentals: FundamentalRecord[] = [
      {
        date: '2026-06-03',
        family: 'eia-wpsr',
        metric: 'Commercial crude stocks change',
        metricId: 'crude_stocks_change',
        actual: -6,
        expected: -1.2,
        unit: 'mb',
        source: 'EIA WPSR plus imported consensus',
        surprise: -4.8,
        surpriseQuality: 'direct-consensus',
        expectationMethod: 'consensus'
      },
      {
        date: '2026-06-03',
        family: 'eia-wpsr',
        metric: 'Cushing stocks change',
        metricId: 'cushing_stocks_change',
        actual: -1.5,
        expected: 0,
        unit: 'mb',
        source: 'EIA WPSR plus imported consensus',
        surprise: -1.5,
        surpriseQuality: 'direct-consensus',
        expectationMethod: 'consensus'
      }
    ];

    const events = generateFundamentalEvents(fundamentals);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      date: '2026-06-03',
      family: 'eia-wpsr',
      sourceStatus: 'direct',
      evidenceQuality: 'direct-consensus',
      basketLabel: 'bullish',
      metricCount: 2
    });
    expect(events[0].qualityNote).toContain('Direct EIA basket');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
pnpm vitest run src/lib/events.test.ts
```

Expected: fail because `generateFundamentalEvents` does not exist.

- [ ] **Step 3: Modify `src/lib/events.ts`**

Add import:

```ts
import { buildEiaBasketsByDate } from './fundamentals';
import type { FundamentalRecord } from './types';
```

Add this function below `createCalendarEvent()`:

```ts
export function generateFundamentalEvents(fundamentals: FundamentalRecord[]): EventRow[] {
  return buildEiaBasketsByDate(fundamentals).map((basket) => ({
    id: eventId('eia-wpsr', basket.date, `basket-${basket.quality}`),
    date: basket.date,
    family: 'eia-wpsr',
    label: `EIA WPSR basket: ${basket.label}`,
    sourceStatus: 'direct',
    sourceUrl: factorSources['eia-wpsr'],
    releaseTime: '10:30 ET',
    qualityNote: `Direct EIA basket using ${basket.metricCount} measured components. Quality: ${basket.quality}. Score: ${basket.score}.`,
    supportedWindows: SUPPORTED_DAILY_WINDOWS,
    excludeFromCoreStats: false,
    evidenceQuality: basket.quality,
    basketScore: basket.score,
    basketLabel: basket.label,
    metricCount: basket.metricCount
  }));
}
```

- [ ] **Step 4: Run event tests**

Run:

```powershell
pnpm vitest run src/lib/events.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/events.ts src/lib/events.test.ts
git commit -m "feat: create direct eia basket events"
```

---

## Task 5: Merge Direct EIA Events Into App Flow

**Files:**
- Modify: `src/App.tsx`
- Test: `src/lib/events.test.ts`

- [ ] **Step 1: Add helper test for replacing EIA proxies**

Append to `src/lib/events.test.ts`:

```ts
import { mergeDirectEventsWithCalendar } from './events';

describe('calendar and direct event merge', () => {
  it('removes calendar-proxy EIA markers on dates where direct EIA events exist', () => {
    const calendar = generateRecurringEvents(rows);
    const direct = generateFundamentalEvents([
      {
        date: '2026-06-03',
        family: 'eia-wpsr',
        metric: 'Commercial crude stocks change',
        metricId: 'crude_stocks_change',
        actual: -6,
        expected: -1.2,
        unit: 'mb',
        source: 'EIA WPSR plus imported consensus',
        surprise: -4.8,
        surpriseQuality: 'direct-consensus',
        expectationMethod: 'consensus'
      }
    ]);

    const merged = mergeDirectEventsWithCalendar(calendar, direct);
    const eiaOnDate = merged.filter((event) => event.family === 'eia-wpsr' && event.date === '2026-06-03');

    expect(eiaOnDate).toHaveLength(1);
    expect(eiaOnDate[0].sourceStatus).toBe('direct');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm vitest run src/lib/events.test.ts
```

Expected: fail because `mergeDirectEventsWithCalendar` does not exist.

- [ ] **Step 3: Add merge helper to `src/lib/events.ts`**

```ts
export function mergeDirectEventsWithCalendar(calendarEvents: EventRow[], directEvents: EventRow[]): EventRow[] {
  const directKeys = new Set(directEvents.map((event) => `${event.date}-${event.family}`));
  return [
    ...calendarEvents.filter((event) => !directKeys.has(`${event.date}-${event.family}`)),
    ...directEvents
  ].sort((a, b) => a.date.localeCompare(b.date) || a.family.localeCompare(b.family));
}
```

- [ ] **Step 4: Wire direct events in `src/App.tsx`**

Change the imports from `events` to include the new helpers:

```ts
import {
  detectAbnormalEvents,
  factorOrder,
  generateFundamentalEvents,
  generateRecurringEvents,
  mergeDirectEventsWithCalendar
} from './lib/events';
```

Replace the current `events` memo with:

```ts
  const events = useMemo(() => {
    const recurring = generateRecurringEvents(rows);
    const directFundamental = generateFundamentalEvents(fundamentals);
    const recurringWithDirect = mergeDirectEventsWithCalendar(recurring, directFundamental);
    const abnormal = detectAbnormalEvents(rows);
    return [...recurringWithDirect, ...abnormal].sort(
      (a, b) => a.date.localeCompare(b.date) || a.family.localeCompare(b.family)
    );
  }, [fundamentals, rows]);
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
pnpm vitest run src/lib/events.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add src/App.tsx src/lib/events.ts src/lib/events.test.ts
git commit -m "feat: prefer direct eia events over calendar proxies"
```

---

## Task 6: Upgrade Event Study With EIA Components

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/eventStudy.ts`
- Modify: `src/lib/eventStudy.test.ts`
- Modify: `src/components/EventStudyPanel.tsx`

- [ ] **Step 1: Add failing event-study test**

Append to `src/lib/eventStudy.test.ts`:

```ts
it('includes all EIA component records for a selected direct EIA event', () => {
  const selectedEvent: EventRow = {
    id: 'eia-wpsr-2026-06-03-basket-direct-consensus',
    date: '2026-06-03',
    family: 'eia-wpsr',
    label: 'EIA WPSR basket: bullish',
    sourceStatus: 'direct',
    sourceUrl: 'https://www.eia.gov/petroleum/supply/weekly/',
    releaseTime: '10:30 ET',
    qualityNote: 'Direct EIA basket using 2 measured components.',
    supportedWindows: ['event-day', '1d', '3d', '5d', 'next-week'],
    excludeFromCoreStats: false,
    evidenceQuality: 'direct-consensus',
    basketScore: 3,
    basketLabel: 'bullish',
    metricCount: 2
  };

  const study = buildEventStudy({
    rows,
    events: [selectedEvent],
    selectedEvent,
    market: 'wti',
    fundamentals: [
      {
        date: '2026-06-03',
        family: 'eia-wpsr',
        metric: 'Commercial crude stocks change',
        metricId: 'crude_stocks_change',
        actual: -6,
        expected: -1.2,
        unit: 'mb',
        source: 'EIA WPSR',
        surprise: -4.8,
        surpriseQuality: 'direct-consensus'
      },
      {
        date: '2026-06-03',
        family: 'eia-wpsr',
        metric: 'Cushing stocks change',
        metricId: 'cushing_stocks_change',
        actual: -1.5,
        expected: 0,
        unit: 'mb',
        source: 'EIA WPSR',
        surprise: -1.5,
        surpriseQuality: 'direct-consensus'
      }
    ]
  });

  expect(study?.fundamentalComponents).toHaveLength(2);
  expect(study?.fundamentalComponents[0].metricId).toBe('crude_stocks_change');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm vitest run src/lib/eventStudy.test.ts
```

Expected: fail because `fundamentalComponents` does not exist on `EventStudy`.

- [ ] **Step 3: Extend `EventStudy` in `src/lib/types.ts`**

Add this field:

```ts
  fundamentalComponents: FundamentalRecord[];
```

- [ ] **Step 4: Modify `src/lib/eventStudy.ts`**

Inside `buildEventStudy()`, after `fundamental`, add:

```ts
  const fundamentalComponents = fundamentals.filter(
    (record) => record.date === selectedEvent.date && record.family === selectedEvent.family
  );
```

Add it to the returned object:

```ts
    fundamentalComponents,
```

- [ ] **Step 5: Modify `src/components/EventStudyPanel.tsx`**

Below the existing `fundamental-chip`, add:

```tsx
      {study.fundamentalComponents.length ? (
        <div className="eia-component-table">
          {study.fundamentalComponents.map((record) => (
            <div key={`${record.date}-${record.metricId ?? record.metric}`}>
              <span>{record.metric}</span>
              <strong>
                {record.actual} vs {record.expected} {record.unit}
              </strong>
              <em>
                surprise {record.surprise} | {record.surpriseQuality ?? 'direct-proxy'}
              </em>
            </div>
          ))}
        </div>
      ) : null}
```

- [ ] **Step 6: Run event study tests**

Run:

```powershell
pnpm vitest run src/lib/eventStudy.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/types.ts src/lib/eventStudy.ts src/lib/eventStudy.test.ts src/components/EventStudyPanel.tsx
git commit -m "feat: show eia components in event study"
```

---

## Task 7: Add Fundamental Lab Panel

**Files:**
- Create: `src/components/FundamentalLabPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Create `src/components/FundamentalLabPanel.tsx`**

Use this file content:

```tsx
import { FlaskConical } from 'lucide-react';
import { buildEiaBasketsByDate } from '../lib/fundamentals';
import type { FundamentalRecord } from '../lib/types';

interface FundamentalLabPanelProps {
  fundamentals: FundamentalRecord[];
}

function formatScore(score: number): string {
  return `${score > 0 ? '+' : ''}${score.toFixed(2)}`;
}

export function FundamentalLabPanel({ fundamentals }: FundamentalLabPanelProps) {
  const baskets = buildEiaBasketsByDate(fundamentals).slice(-8).reverse();

  return (
    <section className="fundamental-lab-panel">
      <div className="panel-heading">
        <FlaskConical size={18} />
        <h2>EIA Surprise Lab</h2>
      </div>

      {baskets.length ? (
        <div className="eia-basket-list">
          {baskets.map((basket) => (
            <article key={basket.date} className={`eia-basket-card ${basket.label}`}>
              <div>
                <span>{basket.date}</span>
                <strong>{basket.label}</strong>
                <em>{basket.quality}</em>
              </div>
              <dl>
                <div>
                  <dt>Score</dt>
                  <dd>{formatScore(basket.score)}</dd>
                </div>
                <div>
                  <dt>Metrics</dt>
                  <dd>{basket.metricCount}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          Import EIA metric CSV rows to replace calendar-proxy WPSR markers with direct surprise baskets.
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Render panel in `src/App.tsx`**

Add import:

```ts
import { FundamentalLabPanel } from './components/FundamentalLabPanel';
```

Place this after `ScoreCards` in the evidence column:

```tsx
          <FundamentalLabPanel fundamentals={fundamentals} />
```

- [ ] **Step 3: Add CSS to `src/styles.css`**

```css
.fundamental-lab-panel,
.eia-component-table {
  background: #ffffff;
  border: 1px solid #d8e1df;
  border-radius: 8px;
  padding: 14px;
}

.eia-basket-list {
  display: grid;
  gap: 8px;
}

.eia-basket-card {
  border: 1px solid #d8e1df;
  border-left: 4px solid #94a3b8;
  border-radius: 6px;
  padding: 10px;
  display: grid;
  gap: 8px;
}

.eia-basket-card.bullish {
  border-left-color: #0f766e;
}

.eia-basket-card.bearish {
  border-left-color: #dc2626;
}

.eia-basket-card.mixed {
  border-left-color: #d97706;
}

.eia-basket-card div,
.eia-basket-card dl,
.eia-component-table div {
  display: grid;
  gap: 4px;
}

.eia-basket-card dl {
  grid-template-columns: 1fr 1fr;
  margin: 0;
}

.eia-basket-card span,
.eia-basket-card em,
.eia-component-table em {
  color: #61716f;
  font-size: 12px;
  font-style: normal;
}

.eia-component-table {
  display: grid;
  gap: 8px;
}

.eia-component-table div {
  border-top: 1px solid #edf2f1;
  padding-top: 8px;
}
```

- [ ] **Step 4: Run build**

Run:

```powershell
pnpm build
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/FundamentalLabPanel.tsx src/App.tsx src/styles.css
git commit -m "feat: add eia surprise lab panel"
```

---

## Task 8: Improve Score Quality Gates For Direct Fundamentals

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/scoring.ts`
- Modify: `src/lib/scoring.test.ts`
- Modify: `src/components/ScoreCards.tsx`

- [ ] **Step 1: Add failing scoring test**

Append to `src/lib/scoring.test.ts`:

```ts
it('marks direct consensus EIA samples as higher quality than calendar proxies', () => {
  const directEvents: EventRow[] = [
    {
      id: 'direct-eia-1',
      date: '2026-06-03',
      family: 'eia-wpsr',
      label: 'EIA WPSR basket: bullish',
      sourceStatus: 'direct',
      sourceUrl: 'https://www.eia.gov/petroleum/supply/weekly/',
      releaseTime: '10:30 ET',
      qualityNote: 'Direct EIA basket.',
      supportedWindows: ['event-day', '1d', '3d', '5d', 'next-week'],
      excludeFromCoreStats: false,
      evidenceQuality: 'direct-consensus',
      basketScore: 3.2,
      basketLabel: 'bullish',
      metricCount: 4
    }
  ];

  const scores = scoreFactors(rows, directEvents, {
    market: 'wti',
    window: '3d',
    selectedFactors: ['eia-wpsr'],
    excludeAbnormal: true,
    timeframe: 'daily',
    timezone: 'Europe/London'
  });

  expect(scores[0].directEvidenceShare).toBe(100);
  expect(scores[0].evidenceTier).toBe('direct');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm vitest run src/lib/scoring.test.ts
```

Expected: fail because `directEvidenceShare` and `evidenceTier` do not exist.

- [ ] **Step 3: Extend `ScoreRow` in `src/lib/types.ts`**

Add:

```ts
  directEvidenceShare: number;
  evidenceTier: 'direct' | 'mixed' | 'proxy';
```

- [ ] **Step 4: Modify `scoreFactors()` in `src/lib/scoring.ts`**

Inside each family map, before the event loop:

```ts
      let directEvidence = 0;
```

Inside the event loop, after abnormal exclusion:

```ts
        if (event.sourceStatus === 'direct') {
          directEvidence += 1;
        }
```

Before the return object:

```ts
      const directEvidenceShare = familyEvents.length === 0 ? 0 : (directEvidence / familyEvents.length) * 100;
      const evidenceTier = directEvidenceShare >= 80 ? 'direct' : directEvidenceShare > 0 ? 'mixed' : 'proxy';
```

Add these fields to the returned object:

```ts
        directEvidenceShare: round(directEvidenceShare, 1),
        evidenceTier,
```

- [ ] **Step 5: Modify `src/components/ScoreCards.tsx`**

Add evidence tier text inside the summary score paragraph:

```tsx
            {' '}| {best.evidenceTier} evidence
```

Add a metric tile row:

```tsx
              <div>
                <dt>Evidence</dt>
                <dd>{score.evidenceTier}</dd>
              </div>
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
pnpm vitest run src/lib/scoring.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/types.ts src/lib/scoring.ts src/lib/scoring.test.ts src/components/ScoreCards.tsx
git commit -m "feat: label score evidence quality"
```

---

## Task 9: Add Deterministic EIA Sample Dataset

**Files:**
- Create: `public/data/eia-weekly-sample.json`
- Modify: `src/App.tsx`
- Modify: `src/components/DataQualityPanel.tsx`

- [ ] **Step 1: Create sample JSON**

Create `public/data/eia-weekly-sample.json`:

```json
{
  "generatedAt": "2026-06-30T00:00:00.000Z",
  "source": "Bundled deterministic EIA surprise sample for UI verification. Not complete official history.",
  "records": [
    {
      "date": "2026-06-03",
      "family": "eia-wpsr",
      "metric": "Commercial crude stocks change",
      "metricId": "crude_stocks_change",
      "actual": -6,
      "expected": -1.2,
      "unit": "mb",
      "source": "EIA WPSR plus sample consensus",
      "surprise": -4.8,
      "surpriseQuality": "direct-consensus",
      "expectationMethod": "consensus",
      "publishedAt": "2026-06-03T14:30:00Z",
      "note": "Sample row for dashboard verification"
    },
    {
      "date": "2026-06-03",
      "family": "eia-wpsr",
      "metric": "Cushing stocks change",
      "metricId": "cushing_stocks_change",
      "actual": -1.5,
      "expected": 0,
      "unit": "mb",
      "source": "EIA WPSR plus sample consensus",
      "surprise": -1.5,
      "surpriseQuality": "direct-consensus",
      "expectationMethod": "consensus",
      "publishedAt": "2026-06-03T14:30:00Z",
      "note": "Sample row for dashboard verification"
    },
    {
      "date": "2026-06-10",
      "family": "eia-wpsr",
      "metric": "Commercial crude stocks change",
      "metricId": "crude_stocks_change",
      "actual": 3.4,
      "expected": -0.8,
      "unit": "mb",
      "source": "EIA WPSR plus sample consensus",
      "surprise": 4.2,
      "surpriseQuality": "direct-consensus",
      "expectationMethod": "consensus",
      "publishedAt": "2026-06-10T14:30:00Z",
      "note": "Sample row for dashboard verification"
    },
    {
      "date": "2026-06-10",
      "family": "eia-wpsr",
      "metric": "Gasoline stocks change",
      "metricId": "gasoline_stocks_change",
      "actual": 1.8,
      "expected": 0.3,
      "unit": "mb",
      "source": "EIA WPSR plus sample consensus",
      "surprise": 1.5,
      "surpriseQuality": "direct-consensus",
      "expectationMethod": "consensus",
      "publishedAt": "2026-06-10T14:30:00Z",
      "note": "Sample row for dashboard verification"
    }
  ]
}
```

- [ ] **Step 2: Add loading code to `src/App.tsx`**

Add:

```ts
interface FundamentalDatasetPayload {
  generatedAt: string;
  source: string;
  records: FundamentalRecord[];
}
```

Add state:

```ts
  const [fundamentalSource, setFundamentalSource] = useState('No bundled EIA sample loaded');
```

Add a `useEffect()` after price loading:

```ts
  useEffect(() => {
    let active = true;
    fetch('/data/eia-weekly.json')
      .catch(() => fetch('/data/eia-weekly-sample.json'))
      .then((response) => {
        if (!response.ok) throw new Error('EIA data unavailable');
        return response.json() as Promise<FundamentalDatasetPayload>;
      })
      .then((payload) => {
        if (!active) return;
        setFundamentals(payload.records);
        setFundamentalSource(payload.source);
      })
      .catch(() => {
        if (!active) return;
        setFundamentals([]);
      });

    return () => {
      active = false;
    };
  }, []);
```

Pass `fundamentalSource` into `DataQualityPanel`.

- [ ] **Step 3: Modify `DataQualityPanel` props**

Add prop:

```ts
  fundamentalSource: string;
```

Show it below the fundamental count callout:

```tsx
      <div className={`quality-callout ${importSummary.fundamentalRecords ? 'good' : 'warn'}`}>
        <Info size={17} />
        <span>{fundamentalSource}</span>
      </div>
```

- [ ] **Step 4: Run build**

Run:

```powershell
pnpm build
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add public/data/eia-weekly-sample.json src/App.tsx src/components/DataQualityPanel.tsx
git commit -m "feat: load bundled eia surprise sample"
```

---

## Task 10: Add Verified Fetch Script Scaffold

**Files:**
- Create: `scripts/fetch-eia-weekly.ps1`
- Modify: `package.json`

- [ ] **Step 1: Create script**

Create `scripts/fetch-eia-weekly.ps1`:

```powershell
param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,

  [string]$OutputPath = "public/data/eia-weekly.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "SourcePath does not exist: $SourcePath"
}

$rows = Import-Csv -LiteralPath $SourcePath
$required = @("date", "family", "metricId", "actual", "expected", "unit", "source")

foreach ($field in $required) {
  if (-not ($rows[0].PSObject.Properties.Name -contains $field)) {
    throw "Missing required column: $field"
  }
}

$records = foreach ($row in $rows) {
  $actual = [double]$row.actual
  $expected = [double]$row.expected
  [ordered]@{
    date = $row.date
    family = $row.family
    metric = $row.metric
    metricId = $row.metricId
    actual = $actual
    expected = $expected
    unit = $row.unit
    source = $row.source
    surprise = [math]::Round($actual - $expected, 4)
    surpriseQuality = if ($row.surpriseQuality) { $row.surpriseQuality } else { "direct-proxy" }
    expectationMethod = if ($row.expectationMethod) { $row.expectationMethod } else { "previous-change" }
    publishedAt = $row.publishedAt
    note = $row.note
  }
}

$payload = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  source = "User supplied EIA weekly CSV normalized by scripts/fetch-eia-weekly.ps1"
  records = $records
}

$json = $payload | ConvertTo-Json -Depth 8
$directory = Split-Path -Parent $OutputPath
if ($directory -and -not (Test-Path -LiteralPath $directory)) {
  New-Item -ItemType Directory -Path $directory | Out-Null
}

Set-Content -LiteralPath $OutputPath -Value $json -Encoding UTF8
Write-Host "Wrote $($records.Count) EIA records to $OutputPath"
```

- [ ] **Step 2: Add script command to `package.json`**

Add:

```json
"fetch:eia": "powershell -ExecutionPolicy Bypass -File scripts/fetch-eia-weekly.ps1"
```

- [ ] **Step 3: Create a temporary verification CSV and run the script**

Run:

```powershell
$csv = @"
date,family,metric,metricId,actual,expected,unit,source,surpriseQuality,expectationMethod,publishedAt,note
2026-06-03,eia-wpsr,Commercial crude stocks change,crude_stocks_change,-6,-1.2,mb,EIA WPSR,direct-consensus,consensus,2026-06-03T14:30:00Z,verification
"@
$tmp = Join-Path $env:TEMP "eia-weekly-verification.csv"
Set-Content -LiteralPath $tmp -Value $csv -Encoding UTF8
powershell -ExecutionPolicy Bypass -File scripts/fetch-eia-weekly.ps1 -SourcePath $tmp -OutputPath "$env:TEMP\eia-weekly-verification.json"
```

Expected output:

```text
Wrote 1 EIA records to <temp path>
```

- [ ] **Step 4: Commit**

```powershell
git add scripts/fetch-eia-weekly.ps1 package.json
git commit -m "feat: add eia weekly normalization script"
```

---

## Task 11: Visual QA In Browser

**Files:**
- Runtime check only.

- [ ] **Step 1: Run tests and build**

Run:

```powershell
pnpm test
pnpm build
```

Expected:

```text
Test Files  11 passed
Tests       all passed
```

and Vite build completes without TypeScript errors.

- [ ] **Step 2: Open app**

Run dev server if needed:

```powershell
pnpm dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/
```

- [ ] **Step 3: Verify visible app behavior**

Check these items in the browser:

- Chart still defaults to 1M range.
- Data audit shows direct EIA records from the bundled sample.
- The EIA Surprise Lab panel appears in the evidence column.
- Selecting the 2026-06-03 EIA marker shows direct basket quality, basket score, and component rows.
- EIA calendar-proxy marker for 2026-06-03 is not duplicated beside the direct marker.
- Score card evidence tier says `direct` or `mixed` when direct EIA sample records are loaded.
- No console errors are present.

- [ ] **Step 4: Commit final QA notes if artifacts are added**

If screenshots or QA notes are intentionally added:

```powershell
git add outputs
git commit -m "test: capture eia surprise engine qa"
```

Skip this commit if no artifacts are needed.

---

## Self-Review

Spec coverage:

- Direct measured EIA data: Tasks 1, 2, 3, 4, 9, 10.
- Actual vs expected surprise: Tasks 2, 3.
- Basket scoring instead of one metric: Tasks 2, 4, 7.
- Calendar proxies replaced only when direct data exists: Task 5.
- Event-study review of every component: Task 6.
- Data quality and evidence tier: Tasks 8, 9.
- User review on TradingView-style chart remains intact: Tasks 5, 6, 11.

Placeholder scan:

- The plan contains no `TBD`, no `TODO`, no "fill in details", and no missing function names.

Type consistency:

- `EiaMetricId`, `SurpriseQuality`, `FundamentalRecord`, `EventRow`, and `ScoreRow` fields are introduced before use.
- `generateFundamentalEvents`, `mergeDirectEventsWithCalendar`, `buildEiaBasket`, and `buildEiaBasketsByDate` are defined before app integration.

Execution note:

- This plan intentionally avoids claiming official complete EIA history until the user supplies or approves an official data source path. The bundled JSON is sample-only and labeled that way in the UI.
