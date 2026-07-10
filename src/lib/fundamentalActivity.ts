import type { EvidenceProvenance, FundamentalRecord, SurpriseQuality } from './types';

type ActivityMetadata = EvidenceProvenance | SurpriseQuality | undefined;

function hasSampleMarker(value: string | undefined): boolean {
  const normalized = value?.toLowerCase() ?? '';

  return normalized.includes('sample')
    || normalized.includes('demo')
    || normalized.includes('synthetic');
}

function isActiveMetadata(value: ActivityMetadata): boolean {
  return value === 'official' || value === 'imported' || value === 'user';
}

export function isSampleFundamental(record: FundamentalRecord): boolean {
  const metadata = [record.provenance, record.sourceKind, record.surpriseQuality];

  if (metadata.some((value) => value === 'sample')) return true;
  if (metadata.some(isActiveMetadata)) return false;

  return hasSampleMarker(record.source) || hasSampleMarker(record.note);
}

export function markFundamentalsAsSample(records: FundamentalRecord[]): FundamentalRecord[] {
  return records.map((record) => ({
    ...record,
    provenance: 'sample',
    sourceKind: 'sample',
    surpriseQuality: 'sample'
  }));
}
