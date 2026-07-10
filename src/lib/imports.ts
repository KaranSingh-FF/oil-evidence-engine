import { getEiaMetricDefinition } from './eiaMetrics';
import type {
  EvidenceProvenance,
  FactorFamily,
  FundamentalRecord,
  ImportedDataSummary,
  IntradayCandle,
  MarketId,
  SurpriseQuality
} from './types';

type CsvRow = Record<string, string>;

const validMarkets = new Set<MarketId>(['wti', 'brent', 'spread']);
const validFamilies = new Set<string>([
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
]);
const validEvidenceProvenances = new Set<string>(['official', 'imported', 'user', 'sample']);
const validSurpriseQualities = new Set<string>(['official', 'imported', 'user', 'sample', 'mixed']);

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function parseNumber(value: string | undefined, field: string): number {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    throw new Error(`Missing required number: ${field}`);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return parsed;
}

function dateFromTimestamp(timestamp: string): string {
  const match = timestamp.match(/^\d{4}-\d{2}-\d{2}/);
  if (!match) throw new Error(`Invalid timestamp: ${timestamp}`);
  return match[0];
}

function optionalField(row: CsvRow, field: string): string | undefined {
  const value = row[field]?.trim();
  return value ? value : undefined;
}

function parseFamily(value: string | undefined): FactorFamily {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!validFamilies.has(normalized)) {
    throw new Error(`Invalid family: ${value?.trim() ?? ''}`);
  }

  return normalized as FactorFamily;
}

function parseOptionalUnionField<T extends string>(
  row: CsvRow,
  field: string,
  validValues: ReadonlySet<string>
): T | undefined {
  const value = optionalField(row, field);
  if (!value) return undefined;

  const normalized = value.toLowerCase();
  if (!validValues.has(normalized)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }

  return normalized as T;
}

function normalizeKnownProvenance(value: string | undefined): EvidenceProvenance | undefined {
  const normalized = value?.trim().toLowerCase();

  return normalized && validEvidenceProvenances.has(normalized)
    ? normalized as EvidenceProvenance
    : undefined;
}

function resolvedRecordProvenance(record: FundamentalRecord): EvidenceProvenance | undefined {
  const provenance = normalizeKnownProvenance(record.provenance);
  if (provenance) return provenance;

  const sourceKind = normalizeKnownProvenance(record.sourceKind);
  if (sourceKind) return sourceKind;

  if (record.surpriseQuality !== 'mixed') {
    const surpriseQuality = normalizeKnownProvenance(record.surpriseQuality);
    if (surpriseQuality) return surpriseQuality;
  }

  const source = record.source.toLowerCase();
  if (source.includes('sample') || source.includes('synthetic') || source.includes('demo')) {
    return 'sample';
  }

  return undefined;
}

export function parseFundamentalCsv(text: string): FundamentalRecord[] {
  return parseCsv(text).map((row) => {
    const actual = parseNumber(row.actual, 'actual');
    const expected = parseNumber(row.expected, 'expected');
    const metricId = optionalField(row, 'metricId');
    const metricDefinition = metricId ? getEiaMetricDefinition(metricId) : undefined;
    const surpriseQuality = parseOptionalUnionField<SurpriseQuality>(
      row,
      'surpriseQuality',
      validSurpriseQualities
    );
    const provenance = parseOptionalUnionField<EvidenceProvenance>(
      row,
      'provenance',
      validEvidenceProvenances
    );
    const sourceKind = parseOptionalUnionField<EvidenceProvenance>(
      row,
      'sourceKind',
      validEvidenceProvenances
    );

    if (metricId && !metricDefinition) {
      throw new Error(`Unknown EIA metric id: ${metricId}`);
    }

    return {
      date: row.date,
      family: parseFamily(row.family),
      ...(metricDefinition ? { metricId: metricDefinition.id } : {}),
      metric: row.metric || metricDefinition?.label || '',
      actual,
      expected,
      unit: row.unit || metricDefinition?.unit || '',
      source: row.source || '',
      ...(surpriseQuality ? { surpriseQuality } : {}),
      ...(optionalField(row, 'expectationMethod')
        ? { expectationMethod: optionalField(row, 'expectationMethod') }
        : {}),
      ...(optionalField(row, 'publishedAt') ? { publishedAt: optionalField(row, 'publishedAt') } : {}),
      ...(provenance ? { provenance } : {}),
      ...(sourceKind ? { sourceKind } : {}),
      note: row.note || undefined,
      surprise: Number((actual - expected).toFixed(4))
    };
  });
}

export function parseIntradayCsv(text: string): IntradayCandle[] {
  return parseCsv(text).map((row) => {
    const market = row.market as MarketId;
    if (!validMarkets.has(market)) {
      throw new Error(`Invalid market: ${row.market}`);
    }

    return {
      timestamp: row.timestamp,
      date: dateFromTimestamp(row.timestamp),
      market,
      open: parseNumber(row.open, 'open'),
      high: parseNumber(row.high, 'high'),
      low: parseNumber(row.low, 'low'),
      close: parseNumber(row.close, 'close'),
      volume: row.volume ? parseNumber(row.volume, 'volume') : undefined
    };
  });
}

export function summarizeImportedDatasets({
  fundamentals,
  intradayCandles
}: {
  fundamentals: FundamentalRecord[];
  intradayCandles: IntradayCandle[];
}): ImportedDataSummary {
  const directFamilies = Array.from(new Set(
    fundamentals
      .filter((record) => resolvedRecordProvenance(record) !== 'sample')
      .map((record) => record.family)
  )).sort();
  const intradayMarkets = Array.from(new Set(intradayCandles.map((record) => record.market))).sort();
  const intradayDates = intradayCandles.map((record) => record.date).sort();

  return {
    fundamentalRecords: fundamentals.length,
    directFamilies,
    intradayCandles: intradayCandles.length,
    intradayMarkets,
    firstIntradayDate: intradayDates[0],
    latestIntradayDate: intradayDates[intradayDates.length - 1]
  };
}
