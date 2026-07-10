import { describe, expect, it } from 'vitest';
import { EIA_METRIC_DEFINITIONS, getEiaMetricDefinition } from './eiaMetrics';
import {
  buildEiaBasket,
  buildEiaBasketsByDate,
  normalizeFundamentalRecords,
  signedSurprise
} from './fundamentals';
import type { EiaMetricId, FundamentalRecord } from './types';

const metricIds: EiaMetricId[] = [
  'crude_stocks_change',
  'cushing_stocks_change',
  'gasoline_stocks_change',
  'distillate_stocks_change',
  'refinery_utilization_change',
  'crude_production_change',
  'net_imports_change',
  'spr_stocks_change',
  'product_supplied_change'
];

function record(overrides: Partial<FundamentalRecord> = {}): FundamentalRecord {
  return {
    date: '2026-06-03',
    family: 'eia-wpsr',
    metric: 'commercial crude stocks',
    metricId: 'crude_stocks_change',
    actual: 0,
    expected: 0,
    unit: 'mb',
    source: 'synthetic fixture',
    surprise: 0,
    ...overrides
  };
}

function officialRecord(overrides: Partial<FundamentalRecord> = {}): FundamentalRecord {
  return record({
    source: 'official fixture',
    provenance: 'official',
    surpriseQuality: 'official',
    ...overrides
  });
}

function definition(metricId: EiaMetricId) {
  const found = EIA_METRIC_DEFINITIONS.find((item) => item.id === metricId);
  if (!found) throw new Error(`Missing definition for ${metricId}`);
  return found;
}

function expectedBasketScore(records: FundamentalRecord[]): number {
  const weighted = records.reduce(
    (state, item) => {
      const metricId = item.metricId as EiaMetricId;
      const def = definition(metricId);
      const rawSurprise = item.actual - item.expected;
      const signed = def.bullishWhen === 'higher' ? rawSurprise : -rawSurprise;

      return {
        score: state.score + (signed / def.normalizationScale) * def.basketWeight,
        weight: state.weight + def.basketWeight
      };
    },
    { score: 0, weight: 0 }
  );

  return Number((weighted.score / weighted.weight).toFixed(4));
}

describe('EIA metric definitions', () => {
  it('defines the canonical weekly petroleum metrics with basket math metadata', () => {
    expect(EIA_METRIC_DEFINITIONS.map((item) => item.id)).toEqual(metricIds);
    expect(new Set(EIA_METRIC_DEFINITIONS.map((item) => item.id)).size).toBe(metricIds.length);

    for (const item of EIA_METRIC_DEFINITIONS) {
      expect(item.unit.length).toBeGreaterThan(0);
      expect(['higher', 'lower']).toContain(item.bullishWhen);
      expect(item.basketWeight).toBeGreaterThan(0);
      expect(item.normalizationScale).toBeGreaterThan(0);
    }

    expect(definition('crude_stocks_change')).toMatchObject({ unit: 'mb', bullishWhen: 'lower' });
    expect(definition('crude_production_change')).toMatchObject({ unit: 'kbd', bullishWhen: 'lower' });
    expect(definition('refinery_utilization_change')).toMatchObject({ unit: 'pct', bullishWhen: 'higher' });
  });

  it('does not resolve inherited object keys as EIA metrics', () => {
    expect(getEiaMetricDefinition('toString')).toBeUndefined();
  });
});

describe('EIA fundamental normalization', () => {
  it('filters records that do not map to a known EIA metric', () => {
    const normalized = normalizeFundamentalRecords([
      record({ metricId: 'crude_stocks_change' }),
      record({
        metric: 'mystery metric',
        metricId: 'unknown_metric' as EiaMetricId,
        actual: 10,
        expected: 0
      })
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0].metricId).toBe('crude_stocks_change');
  });

  it('filters known metric ids from non-EIA families before basket creation', () => {
    const nonEia = record({
      family: 'api-wsb',
      metricId: 'crude_stocks_change',
      source: 'imported API fixture',
      provenance: 'imported',
      actual: -4,
      expected: 0
    });

    expect(normalizeFundamentalRecords([nonEia])).toEqual([]);
    expect(buildEiaBasketsByDate([nonEia])).toEqual([]);
  });

  it('recalculates raw surprise as actual minus expected', () => {
    const normalized = normalizeFundamentalRecords([
      record({ actual: 2.1, expected: -1, surprise: 999 })
    ]);

    expect(normalized[0]).toMatchObject({
      actual: 2.1,
      expected: -1,
      surprise: 3.1,
      unit: 'mb'
    });
  });

  it('signs bullish surprises from each metric definition direction', () => {
    const [crudeBuild, refineryBeat] = normalizeFundamentalRecords([
      record({ metricId: 'crude_stocks_change', actual: 2, expected: -1 }),
      record({
        metric: 'refinery utilization',
        metricId: 'refinery_utilization_change',
        actual: 1.5,
        expected: 0.5,
        unit: 'pct'
      })
    ]);

    expect(signedSurprise(crudeBuild)).toBe(-3);
    expect(signedSurprise(refineryBeat)).toBe(1);
  });

  it('dedupes by date and metric id, preferring sourced rows over samples', () => {
    const sample = record({
      actual: -1,
      expected: 0,
      provenance: 'sample',
      surpriseQuality: 'sample'
    });
    const official = record({
      actual: -5,
      expected: 0,
      provenance: 'official',
      surpriseQuality: 'official',
      source: 'official synthetic fixture'
    });

    const normalized = normalizeFundamentalRecords([sample, official]);
    const basket = buildEiaBasket('2026-06-03', [sample, official]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      actual: -5,
      surprise: -5,
      provenance: 'official',
      surpriseQuality: 'official'
    });
    expect(basket?.metricCount).toBe(1);
    expect(basket?.basketScore).toBe(expectedBasketScore([official]));
  });
});

describe('EIA basket scoring', () => {
  it('scores baskets from normalized signed surprise instead of raw mixed units', () => {
    const inputs = [
      officialRecord({ metricId: 'crude_stocks_change', actual: -5, expected: 0 }),
      officialRecord({
        metric: 'product supplied',
        metricId: 'product_supplied_change',
        actual: 250,
        expected: 0,
        unit: 'kbd'
      })
    ];

    const basket = buildEiaBasket('2026-06-03', inputs);

    expect(basket).toMatchObject({
      date: '2026-06-03',
      family: 'eia-wpsr',
      basketScore: expectedBasketScore(inputs),
      basketLabel: 'bullish',
      metricCount: 2
    });
  });

  it('scores mixed official and sample baskets from eligible non-sample rows only', () => {
    const official = officialRecord({
      metricId: 'crude_stocks_change',
      actual: -5,
      expected: 0
    });
    const sample = record({
      metric: 'gasoline stocks',
      metricId: 'gasoline_stocks_change',
      actual: -100,
      expected: 0,
      provenance: 'sample',
      surpriseQuality: 'sample'
    });

    const officialOnly = buildEiaBasket('2026-06-03', [official]);
    const mixed = buildEiaBasket('2026-06-03', [official, sample]);

    expect(mixed?.basketScore).toBe(officialOnly?.basketScore);
    expect(mixed).toMatchObject({
      evidenceQuality: 'mixed',
      evidenceProvenance: 'mixed',
      sourceStatus: 'direct',
      excludeFromCoreStats: false,
      basketScore: expectedBasketScore([official]),
      metricCount: 1
    });
    expect(mixed).not.toHaveProperty('evidenceSourceKind');
    expect(mixed?.supportedWindows).not.toContain('intraday-30m-4h');
  });

  it('keeps aggregate evidence provenance separate from aggregate evidence quality', () => {
    const basket = buildEiaBasket('2026-06-03', [
      officialRecord({
        metricId: 'crude_stocks_change',
        actual: -5,
        expected: 0,
        surpriseQuality: 'mixed'
      })
    ]);

    expect(basket).toMatchObject({
      evidenceQuality: 'mixed',
      evidenceProvenance: 'official'
    });
    expect(basket).not.toHaveProperty('evidenceSourceKind');
  });

  it('marks all-sample baskets as calendar proxy and excluded without direct metric count', () => {
    const basket = buildEiaBasket('2026-06-03', [
      record({
        metricId: 'crude_stocks_change',
        actual: -5,
        expected: 0,
        provenance: 'sample',
        surpriseQuality: 'sample'
      }),
      record({
        metric: 'gasoline stocks',
        metricId: 'gasoline_stocks_change',
        actual: -1,
        expected: 0,
        provenance: 'sample',
        surpriseQuality: 'sample'
      })
    ]);

    expect(basket).toMatchObject({
      evidenceQuality: 'sample',
      evidenceProvenance: 'sample',
      sourceStatus: 'calendar-proxy',
      excludeFromCoreStats: true,
      metricCount: 0
    });
    expect(basket).not.toHaveProperty('evidenceSourceKind');
    expect(basket?.basketScore).toBeUndefined();
    expect(basket?.basketLabel).toBeUndefined();
    expect(basket?.magnitude).toBeUndefined();
  });

  it('builds one deduped basket per report date', () => {
    const baskets = buildEiaBasketsByDate([
      officialRecord({ date: '2026-06-03', metricId: 'crude_stocks_change', actual: -5, expected: 0 }),
      officialRecord({ date: '2026-06-03', metricId: 'crude_stocks_change', actual: -3, expected: 0 }),
      officialRecord({
        date: '2026-06-10',
        metric: 'net imports',
        metricId: 'net_imports_change',
        actual: -500,
        expected: 0,
        unit: 'kbd'
      }),
      record({
        date: '2026-06-10',
        metric: 'unknown',
        metricId: 'unknown_metric' as EiaMetricId,
        actual: 1000,
        expected: 0
      })
    ]);

    expect(baskets.map((basket) => [basket.date, basket.metricCount])).toEqual([
      ['2026-06-03', 1],
      ['2026-06-10', 1]
    ]);
    expect(baskets[0].basketScore).toBe(expectedBasketScore([
      officialRecord({ date: '2026-06-03', metricId: 'crude_stocks_change', actual: -5, expected: 0 })
    ]));
  });
});
