import { describe, expect, it } from 'vitest';
import datasetPayload from '../../public/data/prices.json';
import type { PriceDataset } from './types';

function loadDataset(): PriceDataset & { latestDate?: string } {
  return datasetPayload as PriceDataset & { latestDate?: string };
}

describe('bundled FRED price data', () => {
  it('keeps daily rows sorted, finite, and internally consistent', () => {
    const dataset = loadDataset();

    expect(dataset.source).toContain('FRED');
    expect(dataset.rows.length).toBeGreaterThan(1000);
    expect(dataset.latestDate).toBe(dataset.rows[dataset.rows.length - 1].date);

    for (let index = 0; index < dataset.rows.length; index += 1) {
      const row = dataset.rows[index];
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isFinite(row.wti)).toBe(true);
      expect(Number.isFinite(row.brent)).toBe(true);
      expect(row.spread).toBe(Number((row.brent - row.wti).toFixed(4)));

      if (index > 0) {
        expect(dataset.rows[index - 1].date < row.date).toBe(true);
      }
    }
  });
});
