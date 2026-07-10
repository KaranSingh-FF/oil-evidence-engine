import { describe, expect, it } from 'vitest';
import { isSampleFundamental } from './fundamentalActivity';
import type { FundamentalRecord } from './types';

function fundamentalRecord(overrides: Partial<FundamentalRecord> = {}): FundamentalRecord {
  return {
    date: '2026-06-03',
    family: 'eia-wpsr',
    metric: 'Commercial crude stocks',
    actual: 2.1,
    expected: -1,
    unit: 'mb',
    source: 'EIA WPSR',
    surprise: 3.1,
    ...overrides
  };
}

describe('fundamental activity classification', () => {
  it('keeps explicit imported metadata active even when the source text contains demo', () => {
    expect(isSampleFundamental(fundamentalRecord({
      provenance: 'imported',
      source: 'Official demo import label'
    }))).toBe(false);
  });

  it.each(['demo feed', 'sample feed', 'synthetic feed'])(
    'treats source text containing %s as review-only when metadata is absent',
    (source) => {
      expect(isSampleFundamental(fundamentalRecord({ source }))).toBe(true);
    }
  );

  it('treats explicit sample metadata as review-only', () => {
    expect(isSampleFundamental(fundamentalRecord({
      provenance: 'sample',
      source: 'EIA WPSR'
    }))).toBe(true);
  });
});
