export type MarketId = 'wti' | 'brent' | 'spread';

export type EventWindow = 'event-day' | '1d' | '3d' | '5d' | 'next-week' | 'intraday-30m-4h';

export type Timeframe = 'daily' | 'weekly' | 'intraday';

export type FactorFamily =
  | 'eia-wpsr'
  | 'api-wsb'
  | 'cftc-cot'
  | 'rig-count'
  | 'monthly-outlooks'
  | 'opec-meetings'
  | 'macro-usd'
  | 'roll-expiry'
  | 'spreads-refinery'
  | 'seasonality'
  | 'brent-physical'
  | 'brent-dubai'
  | 'shipping-risk'
  | 'abnormal-news';

export type SourceStatus = 'calendar-proxy' | 'direct' | 'manual' | 'news-annotation';

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

export type EvidenceProvenance = 'official' | 'imported' | 'user' | 'sample';

export type SurpriseQuality = EvidenceProvenance | 'mixed';

export type BullishDirection = 'higher' | 'lower';

export type EvidenceTier = 'direct' | 'mixed' | 'proxy';

export interface EiaMetricDefinition {
  id: EiaMetricId;
  label: string;
  unit: string;
  bullishWhen: BullishDirection;
  basketWeight: number;
  normalizationScale: number;
}

export type StrategyLabel =
  | 'confirm-long'
  | 'confirm-short'
  | 'volatility-expected'
  | 'avoid'
  | 'no-edge';

export type RegimeFilter =
  | 'all'
  | 'high-volatility'
  | 'low-volatility'
  | 'wti-uptrend'
  | 'wti-downtrend'
  | 'spread-wide'
  | 'spread-tight';

export type VolatilityRegime = 'high' | 'low';
export type TrendRegime = 'wti-uptrend' | 'wti-downtrend';
export type SpreadRegime = 'wide' | 'tight';

export interface DailyPriceRow {
  date: string;
  wti: number;
  brent: number;
  spread: number;
}

export interface PriceDataset {
  generatedAt: string;
  source: string;
  rows: DailyPriceRow[];
}

export interface EventRow {
  id: string;
  date: string;
  family: FactorFamily;
  label: string;
  sourceStatus: SourceStatus;
  sourceUrl: string;
  releaseTime?: string;
  qualityNote: string;
  supportedWindows: EventWindow[];
  excludeFromCoreStats: boolean;
  magnitude?: number;
  evidenceQuality?: SurpriseQuality;
  evidenceProvenance?: EvidenceProvenance | 'mixed';
  basketScore?: number;
  basketLabel?: string;
  metricCount?: number;
}

export interface DashboardFilters {
  market: MarketId;
  window: EventWindow;
  selectedFactors: FactorFamily[];
  excludeAbnormal: boolean;
  timeframe: Timeframe;
  timezone: string;
  regimeFilter?: RegimeFilter;
}

export interface WindowReturn {
  startDate: string;
  endDate: string;
  startValue: number;
  endValue: number;
  returnPct: number;
}

export interface ScoreRow {
  family: FactorFamily;
  market: MarketId;
  window: EventWindow;
  sampleSize: number;
  directEvidenceShare: number;
  evidenceTier: EvidenceTier;
  excludedAbnormal: number;
  meanReturn: number;
  medianReturn: number;
  directionHitRate: number;
  averageAbsReturn: number;
  averageAtrMultiple: number;
  label: StrategyLabel;
  confidenceScore: number;
  maxAdverseReturn: number;
  abnormalShare: number;
  recencyBias: number;
}

export interface ResearchReport {
  summary: string;
  strongestPatterns: string[];
  weakPatterns: string[];
  abnormalNotes: string[];
  dataQuality: string[];
}

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
  expectationMethod?: string;
  publishedAt?: string;
  provenance?: EvidenceProvenance;
  sourceKind?: EvidenceProvenance;
  note?: string;
}

export interface IntradayCandle {
  timestamp: string;
  date: string;
  market: MarketId;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface NewsAnnotation {
  eventId: string;
  category: string;
  headline: string;
  note: string;
  sourceUrl?: string;
}

export interface RegimeProfile {
  date: string;
  volatility: VolatilityRegime;
  trend: TrendRegime;
  spread: SpreadRegime;
  absoluteMovePct: number;
  trendDistancePct: number;
  spreadZScore: number;
}

export interface EventStudyWindow {
  window: EventWindow;
  startDate: string;
  endDate: string;
  startValue: number;
  endValue: number;
  returnPct: number;
}

export interface EventStudyOccurrence {
  eventId: string;
  date: string;
  returnPct: number | null;
  abnormal: boolean;
  fundamentalSurprise?: number;
  basketScore?: number;
  basketLabel?: string;
  componentCount?: number;
  note?: string;
}

export interface EventStudyStats {
  sampleSize: number;
  positiveRate: number;
  meanReturn: number;
  medianReturn: number;
}

export interface EventStudy {
  selectedEvent: EventRow;
  market: MarketId;
  windows: EventStudyWindow[];
  occurrences: EventStudyOccurrence[];
  patternStats: EventStudyStats;
  newsAnnotations: NewsAnnotation[];
  fundamental: FundamentalRecord | null;
  fundamentalComponents: FundamentalRecord[];
}

export interface ImportedDataSummary {
  fundamentalRecords: number;
  directFamilies: FactorFamily[];
  intradayCandles: number;
  intradayMarkets: MarketId[];
  firstIntradayDate?: string;
  latestIntradayDate?: string;
}
