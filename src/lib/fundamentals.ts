import {
  EIA_METRIC_DEFINITIONS,
  EIA_METRIC_DEFINITIONS_BY_ID,
  isEiaMetricId
} from './eiaMetrics';
import type {
  EiaMetricId,
  EventRow,
  EventWindow,
  EvidenceProvenance,
  FundamentalRecord,
  SourceStatus,
  SurpriseQuality
} from './types';

const EIA_SOURCE_URL = 'https://www.eia.gov/petroleum/supply/weekly/';
const EIA_WINDOWS: EventWindow[] = [
  'event-day',
  '1d',
  '3d',
  '5d',
  'next-week'
];

const metricOrder = new Map<EiaMetricId, number>(
  EIA_METRIC_DEFINITIONS.map((definition, index) => [definition.id, index])
);

function metricKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const metricAliases = new Map<string, EiaMetricId>();

for (const definition of EIA_METRIC_DEFINITIONS) {
  metricAliases.set(metricKey(definition.id), definition.id);
  metricAliases.set(metricKey(definition.label), definition.id);
}

const aliasEntries: Array<[string, EiaMetricId]> = [
  ['crude stocks', 'crude_stocks_change'],
  ['commercial crude stocks', 'crude_stocks_change'],
  ['commercial crude oil inventories', 'crude_stocks_change'],
  ['cushing stocks', 'cushing_stocks_change'],
  ['cushing crude stocks', 'cushing_stocks_change'],
  ['gasoline stocks', 'gasoline_stocks_change'],
  ['distillate stocks', 'distillate_stocks_change'],
  ['refinery utilization', 'refinery_utilization_change'],
  ['crude production', 'crude_production_change'],
  ['net imports', 'net_imports_change'],
  ['spr stocks', 'spr_stocks_change'],
  ['strategic petroleum reserve stocks', 'spr_stocks_change'],
  ['product supplied', 'product_supplied_change']
];

for (const [alias, metricId] of aliasEntries) {
  metricAliases.set(metricKey(alias), metricId);
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function isEvidenceProvenance(value: string | undefined): value is EvidenceProvenance {
  return value === 'official' || value === 'imported' || value === 'user' || value === 'sample';
}

function isSurpriseQuality(value: string | undefined): value is SurpriseQuality {
  return isEvidenceProvenance(value) || value === 'mixed';
}

function inferProvenanceFromSource(source: string): EvidenceProvenance | undefined {
  const normalized = source.toLowerCase();

  if (normalized.includes('sample') || normalized.includes('synthetic') || normalized.includes('demo')) return 'sample';
  if (normalized.includes('official')) return 'official';
  if (normalized.includes('import')) return 'imported';
  if (normalized.includes('user') || normalized.includes('manual')) return 'user';

  return undefined;
}

function recordProvenance(record: FundamentalRecord): EvidenceProvenance | undefined {
  if (isEvidenceProvenance(record.provenance)) return record.provenance;
  if (isEvidenceProvenance(record.sourceKind)) return record.sourceKind;
  if (record.surpriseQuality && record.surpriseQuality !== 'mixed') {
    return isEvidenceProvenance(record.surpriseQuality) ? record.surpriseQuality : undefined;
  }

  return inferProvenanceFromSource(record.source);
}

function recordQuality(record: FundamentalRecord): SurpriseQuality {
  if (isSurpriseQuality(record.surpriseQuality)) return record.surpriseQuality;

  return recordProvenance(record) ?? 'user';
}

function provenancePriority(record: FundamentalRecord): number {
  switch (recordProvenance(record)) {
    case 'official':
      return 4;
    case 'imported':
    case 'user':
      return 3;
    case 'sample':
      return 1;
    default:
      return 2;
  }
}

function resolveMetricId(record: FundamentalRecord): EiaMetricId | undefined {
  if (isEiaMetricId(record.metricId)) return record.metricId;

  return metricAliases.get(metricKey(record.metric));
}

function normalizedRecord(record: FundamentalRecord, metricId: EiaMetricId): FundamentalRecord {
  const definition = EIA_METRIC_DEFINITIONS_BY_ID[metricId];
  const provenance = recordProvenance(record);

  return {
    ...record,
    metricId,
    metric: record.metric || definition.label,
    unit: definition.unit,
    surprise: round(record.actual - record.expected),
    surpriseQuality: recordQuality(record),
    provenance: provenance ?? record.provenance,
    sourceKind: record.sourceKind ?? provenance
  };
}

function metricSortValue(record: FundamentalRecord): number {
  return record.metricId ? metricOrder.get(record.metricId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
}

function dedupeRecords(records: FundamentalRecord[]): FundamentalRecord[] {
  const byDateMetric = new Map<string, FundamentalRecord>();

  for (const record of records) {
    const key = `${record.date}|${record.metricId}`;
    const existing = byDateMetric.get(key);

    if (!existing || provenancePriority(record) > provenancePriority(existing)) {
      byDateMetric.set(key, record);
    }
  }

  return Array.from(byDateMetric.values()).sort(
    (a, b) => a.date.localeCompare(b.date) || metricSortValue(a) - metricSortValue(b)
  );
}

export function normalizeFundamentalRecords(records: FundamentalRecord[]): FundamentalRecord[] {
  const normalized = records.flatMap((record) => {
    if (record.family !== 'eia-wpsr') return [];

    const metricId = resolveMetricId(record);

    return metricId ? [normalizedRecord(record, metricId)] : [];
  });

  return dedupeRecords(normalized);
}

export function signedSurprise(record: FundamentalRecord): number | null {
  const metricId = resolveMetricId(record);
  if (!metricId) return null;

  const definition = EIA_METRIC_DEFINITIONS_BY_ID[metricId];
  const rawSurprise = round(record.actual - record.expected);
  const signed = definition.bullishWhen === 'higher' ? rawSurprise : -rawSurprise;

  return round(signed);
}

function normalizedSignedSurprise(record: FundamentalRecord): number | null {
  if (!record.metricId) return null;

  const signed = signedSurprise(record);
  if (signed === null) return null;

  return signed / EIA_METRIC_DEFINITIONS_BY_ID[record.metricId].normalizationScale;
}

function basketLabel(score: number): string {
  if (score >= 0.15) return 'bullish';
  if (score <= -0.15) return 'bearish';
  return 'neutral';
}

function basketQuality(records: FundamentalRecord[]): SurpriseQuality {
  const qualities = new Set(records.map(recordQuality));

  return qualities.size === 1 ? Array.from(qualities)[0] : 'mixed';
}

function basketProvenance(records: FundamentalRecord[]): EvidenceProvenance | 'mixed' | undefined {
  const provenances = records.map(recordProvenance);
  const knownProvenances = provenances.filter((value): value is EvidenceProvenance => value !== undefined);

  if (knownProvenances.length === 0) return undefined;

  const uniqueProvenances = new Set(knownProvenances);

  return uniqueProvenances.size === 1 && knownProvenances.length === records.length
    ? knownProvenances[0]
    : 'mixed';
}

function isSampleRecord(record: FundamentalRecord): boolean {
  return recordProvenance(record) === 'sample';
}

function sourceStatusForEligibleRecords(records: FundamentalRecord[]): SourceStatus {
  if (records.some((record) => {
    const provenance = recordProvenance(record);
    return provenance === 'official' || provenance === 'imported';
  })) {
    return 'direct';
  }

  return records.length > 0 ? 'manual' : 'calendar-proxy';
}

function buildBasketFromNormalized(date: string, records: FundamentalRecord[]): EventRow | null {
  const rows = records.filter((record) => record.date === date && record.metricId);
  if (rows.length === 0) return null;
  const eligibleRows = rows.filter((record) => !isSampleRecord(record));

  const weighted = eligibleRows.reduce(
    (state, record) => {
      const metricId = record.metricId as EiaMetricId;
      const normalizedSigned = normalizedSignedSurprise(record);
      if (normalizedSigned === null) return state;

      const definition = EIA_METRIC_DEFINITIONS_BY_ID[metricId];

      return {
        score: state.score + normalizedSigned * definition.basketWeight,
        weight: state.weight + definition.basketWeight
      };
    },
    { score: 0, weight: 0 }
  );

  const score = weighted.weight > 0 ? round(weighted.score / weighted.weight) : undefined;
  const quality = basketQuality(rows);
  const provenance = basketProvenance(rows);
  const qualityNote = eligibleRows.length === rows.length
    ? `${rows.length} normalized EIA metrics; score uses signed surprises scaled by metric units before weighting.`
    : `${eligibleRows.length} of ${rows.length} normalized EIA metrics eligible for scoring; sample metrics are excluded from score and direct metric count.`;

  const event: EventRow = {
    id: `eia-wpsr-${date}-basket`,
    date,
    family: 'eia-wpsr',
    label: 'EIA WPSR surprise basket',
    sourceStatus: sourceStatusForEligibleRecords(eligibleRows),
    sourceUrl: EIA_SOURCE_URL,
    releaseTime: '10:30 ET',
    qualityNote,
    supportedWindows: EIA_WINDOWS,
    excludeFromCoreStats: eligibleRows.length === 0,
    evidenceQuality: quality,
    evidenceProvenance: provenance,
    metricCount: eligibleRows.length
  };

  return score === undefined
    ? event
    : {
        ...event,
        magnitude: Math.abs(score),
        basketScore: score,
        basketLabel: basketLabel(score)
      };
}

export function buildEiaBasket(date: string, records: FundamentalRecord[]): EventRow | null {
  return buildBasketFromNormalized(date, normalizeFundamentalRecords(records));
}

export function buildEiaBasketsByDate(records: FundamentalRecord[]): EventRow[] {
  const normalized = normalizeFundamentalRecords(records);
  const dates = Array.from(new Set(normalized.map((record) => record.date))).sort();

  return dates.flatMap((date) => {
    const basket = buildBasketFromNormalized(date, normalized);

    return basket ? [basket] : [];
  });
}
