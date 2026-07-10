import { describe, expect, it } from 'vitest';
import {
  parseFundamentalCsv,
  parseIntradayCsv,
  summarizeImportedDatasets
} from './imports';

describe('fundamental and intraday imports', () => {
  it('parses actual-vs-expected fundamental records and calculates surprise', () => {
    const records = parseFundamentalCsv(
      'date,family,metric,actual,expected,unit,source,note\n' +
        '2026-06-03,eia-wpsr,commercial crude stocks,2.1,-1.0,mb,EIA weekly,large build\n'
    );

    expect(records).toEqual([
      {
        date: '2026-06-03',
        family: 'eia-wpsr',
        metric: 'commercial crude stocks',
        actual: 2.1,
        expected: -1,
        unit: 'mb',
        source: 'EIA weekly',
        note: 'large build',
        surprise: 3.1
      }
    ]);
  });

  it('parses extended EIA metric metadata with canonical label and unit fallbacks', () => {
    const records = parseFundamentalCsv(
      'date,family,metricId,metric,actual,expected,unit,source,surpriseQuality,expectationMethod,publishedAt,provenance,sourceKind,note\n' +
        '2026-06-03,eia-wpsr,crude_stocks_change,,2.1,-1.0,,EIA WPSR,official,survey,2026-06-03T14:30:00Z,official,official,reported build\n'
    );

    expect(records).toEqual([
      {
        date: '2026-06-03',
        family: 'eia-wpsr',
        metricId: 'crude_stocks_change',
        metric: 'Commercial crude stocks change',
        actual: 2.1,
        expected: -1,
        unit: 'mb',
        source: 'EIA WPSR',
        surpriseQuality: 'official',
        expectationMethod: 'survey',
        publishedAt: '2026-06-03T14:30:00Z',
        provenance: 'official',
        sourceKind: 'official',
        note: 'reported build',
        surprise: 3.1
      }
    ]);
  });

  it('rejects unknown extended EIA metric ids', () => {
    expect(() =>
      parseFundamentalCsv(
        'date,family,metricId,actual,expected,source,provenance\n' +
          '2026-06-03,eia-wpsr,not_a_metric,2.1,-1.0,EIA WPSR,official\n'
      )
    ).toThrow('Unknown EIA metric id: not_a_metric');
  });

  it('rejects blank required fundamental numeric cells with field names', () => {
    expect(() =>
      parseFundamentalCsv(
        'date,family,metric,actual,expected,unit,source\n' +
          '2026-06-03,eia-wpsr,commercial crude stocks,,-1.0,mb,EIA weekly\n'
      )
    ).toThrow('Missing required number: actual');

    expect(() =>
      parseFundamentalCsv(
        'date,family,metric,actual,expected,unit,source\n' +
          '2026-06-03,eia-wpsr,commercial crude stocks,2.1,,mb,EIA weekly\n'
      )
    ).toThrow('Missing required number: expected');
  });

  it('normalizes capitalized sample metadata fields while parsing fundamentals', () => {
    const records = parseFundamentalCsv(
      'date,family,metric,actual,expected,unit,source,surpriseQuality,provenance,sourceKind\n' +
        '2026-06-03,eia-wpsr,commercial crude stocks,2.1,-1.0,mb,Sample feed,Sample,Sample,Sample\n'
    );

    expect(records[0]).toMatchObject({
      surpriseQuality: 'sample',
      provenance: 'sample',
      sourceKind: 'sample'
    });
  });

  it('rejects unknown fundamental family and metadata values', () => {
    expect(() =>
      parseFundamentalCsv(
        'date,family,metric,actual,expected,unit,source\n' +
          '2026-06-03,unknown-family,commercial crude stocks,2.1,-1.0,mb,EIA weekly\n'
      )
    ).toThrow('Invalid family: unknown-family');

    expect(() =>
      parseFundamentalCsv(
        'date,family,metric,actual,expected,unit,source,surpriseQuality\n' +
          '2026-06-03,eia-wpsr,commercial crude stocks,2.1,-1.0,mb,EIA weekly,dubious\n'
      )
    ).toThrow('Invalid surpriseQuality: dubious');

    expect(() =>
      parseFundamentalCsv(
        'date,family,metric,actual,expected,unit,source,provenance\n' +
          '2026-06-03,eia-wpsr,commercial crude stocks,2.1,-1.0,mb,EIA weekly,broker\n'
      )
    ).toThrow('Invalid provenance: broker');

    expect(() =>
      parseFundamentalCsv(
        'date,family,metric,actual,expected,unit,source,sourceKind\n' +
          '2026-06-03,eia-wpsr,commercial crude stocks,2.1,-1.0,mb,EIA weekly,manual\n'
      )
    ).toThrow('Invalid sourceKind: manual');
  });

  it('parses broker or TradingView intraday OHLCV candles without deriving missing bars', () => {
    const candles = parseIntradayCsv(
      'timestamp,market,open,high,low,close,volume\n' +
        '2026-06-03T14:30:00Z,wti,70,72,69,71,1200\n'
    );

    expect(candles).toEqual([
      {
        timestamp: '2026-06-03T14:30:00Z',
        date: '2026-06-03',
        market: 'wti',
        open: 70,
        high: 72,
        low: 69,
        close: 71,
        volume: 1200
      }
    ]);
  });

  it('rejects blank required intraday open and close cells with field names', () => {
    expect(() =>
      parseIntradayCsv(
        'timestamp,market,open,high,low,close,volume\n' +
          '2026-06-03T14:30:00Z,wti,,72,69,71,1200\n'
      )
    ).toThrow('Missing required number: open');

    expect(() =>
      parseIntradayCsv(
        'timestamp,market,open,high,low,close,volume\n' +
          '2026-06-03T14:30:00Z,wti,70,72,69,,1200\n'
      )
    ).toThrow('Missing required number: close');
  });

  it('summarizes import coverage for the data audit panel', () => {
    const summary = summarizeImportedDatasets({
      fundamentals: parseFundamentalCsv(
        'date,family,metric,actual,expected,unit,source\n2026-06-03,eia-wpsr,crude,2,-1,mb,EIA'
      ),
      intradayCandles: parseIntradayCsv(
        'timestamp,market,open,high,low,close\n2026-06-03T14:30:00Z,wti,70,72,69,71'
      )
    });

    expect(summary.fundamentalRecords).toBe(1);
    expect(summary.directFamilies).toEqual(['eia-wpsr']);
    expect(summary.intradayCandles).toBe(1);
    expect(summary.intradayMarkets).toEqual(['wti']);
  });

  it('excludes sample-only fundamentals from direct families while counting records', () => {
    const summary = summarizeImportedDatasets({
      fundamentals: parseFundamentalCsv(
        'date,family,metric,actual,expected,unit,source,surpriseQuality,provenance,sourceKind\n' +
          '2026-06-03,eia-wpsr,crude,2,-1,mb,Sample feed,sample,sample,sample\n' +
          '2026-06-04,api-wsb,crude,3,1,mb,API import,imported,imported,imported\n'
      ),
      intradayCandles: []
    });

    expect(summary.fundamentalRecords).toBe(2);
    expect(summary.directFamilies).toEqual(['api-wsb']);
  });

  it('excludes minimal sample-source fundamentals from direct families', () => {
    const summary = summarizeImportedDatasets({
      fundamentals: parseFundamentalCsv(
        'date,family,metric,actual,expected,unit,source\n' +
          '2026-06-03,eia-wpsr,crude,2,-1,mb,Sample feed\n'
      ),
      intradayCandles: []
    });

    expect(summary.fundamentalRecords).toBe(1);
    expect(summary.directFamilies).toEqual([]);
  });
});
