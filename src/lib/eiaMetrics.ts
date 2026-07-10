import type { EiaMetricDefinition, EiaMetricId } from './types';

export const EIA_METRIC_DEFINITIONS: EiaMetricDefinition[] = [
  {
    id: 'crude_stocks_change',
    label: 'Commercial crude stocks change',
    unit: 'mb',
    bullishWhen: 'lower',
    basketWeight: 1.5,
    normalizationScale: 5
  },
  {
    id: 'cushing_stocks_change',
    label: 'Cushing crude stocks change',
    unit: 'mb',
    bullishWhen: 'lower',
    basketWeight: 0.7,
    normalizationScale: 2
  },
  {
    id: 'gasoline_stocks_change',
    label: 'Gasoline stocks change',
    unit: 'mb',
    bullishWhen: 'lower',
    basketWeight: 1,
    normalizationScale: 3
  },
  {
    id: 'distillate_stocks_change',
    label: 'Distillate stocks change',
    unit: 'mb',
    bullishWhen: 'lower',
    basketWeight: 0.9,
    normalizationScale: 2
  },
  {
    id: 'refinery_utilization_change',
    label: 'Refinery utilization change',
    unit: 'pct',
    bullishWhen: 'higher',
    basketWeight: 0.8,
    normalizationScale: 2
  },
  {
    id: 'crude_production_change',
    label: 'Crude production change',
    unit: 'kbd',
    bullishWhen: 'lower',
    basketWeight: 0.7,
    normalizationScale: 200
  },
  {
    id: 'net_imports_change',
    label: 'Net imports change',
    unit: 'kbd',
    bullishWhen: 'lower',
    basketWeight: 0.8,
    normalizationScale: 500
  },
  {
    id: 'spr_stocks_change',
    label: 'Strategic Petroleum Reserve stocks change',
    unit: 'mb',
    bullishWhen: 'higher',
    basketWeight: 0.3,
    normalizationScale: 2
  },
  {
    id: 'product_supplied_change',
    label: 'Product supplied change',
    unit: 'kbd',
    bullishWhen: 'higher',
    basketWeight: 1,
    normalizationScale: 500
  }
];

export const EIA_METRIC_DEFINITIONS_BY_ID = Object.fromEntries(
  EIA_METRIC_DEFINITIONS.map((definition) => [definition.id, definition])
) as Record<EiaMetricId, EiaMetricDefinition>;

export function isEiaMetricId(value: string | undefined): value is EiaMetricId {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(EIA_METRIC_DEFINITIONS_BY_ID, value);
}

export function getEiaMetricDefinition(
  metricId: string | undefined
): EiaMetricDefinition | undefined {
  return isEiaMetricId(metricId) ? EIA_METRIC_DEFINITIONS_BY_ID[metricId] : undefined;
}
