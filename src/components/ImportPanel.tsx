import { type ChangeEvent, useRef, useState } from 'react';
import { AlertTriangle, FileUp, Upload } from 'lucide-react';
import { parseFundamentalCsv, parseIntradayCsv } from '../lib/imports';
import type { FundamentalRecord, IntradayCandle } from '../lib/types';

interface ImportPanelProps {
  fundamentals: FundamentalRecord[];
  intradayCandles: IntradayCandle[];
  onFundamentalsLoaded: (records: FundamentalRecord[]) => void;
  onIntradayLoaded: (candles: IntradayCandle[]) => void;
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file.'));
    reader.onabort = () => reject(new Error('File read was canceled.'));
    reader.readAsText(file);
  });
}

function formatImportError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Unable to read file.';
}

export function ImportPanel({
  fundamentals,
  intradayCandles,
  onFundamentalsLoaded,
  onIntradayLoaded
}: ImportPanelProps) {
  const [fundamentalsError, setFundamentalsError] = useState<string | null>(null);
  const [intradayError, setIntradayError] = useState<string | null>(null);
  const fundamentalsReadId = useRef(0);
  const intradayReadId = useRef(0);

  const loadFundamentals = async (file: File | undefined, readId: number) => {
    if (!file) return;

    setFundamentalsError(null);
    try {
      const records = parseFundamentalCsv(await readTextFile(file));
      if (readId !== fundamentalsReadId.current) return;
      onFundamentalsLoaded(records);
      setFundamentalsError(null);
    } catch (error) {
      if (readId !== fundamentalsReadId.current) return;
      setFundamentalsError(`Fundamentals import failed: ${formatImportError(error)}`);
    }
  };

  const loadIntraday = async (file: File | undefined, readId: number) => {
    if (!file) return;

    setIntradayError(null);
    try {
      const candles = parseIntradayCsv(await readTextFile(file));
      if (readId !== intradayReadId.current) return;
      onIntradayLoaded(candles);
      setIntradayError(null);
    } catch (error) {
      if (readId !== intradayReadId.current) return;
      setIntradayError(`Intraday import failed: ${formatImportError(error)}`);
    }
  };

  const handleFundamentalsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    const readId = fundamentalsReadId.current + 1;
    fundamentalsReadId.current = readId;
    event.currentTarget.value = '';
    void loadFundamentals(file, readId);
  };

  const handleIntradayChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    const readId = intradayReadId.current + 1;
    intradayReadId.current = readId;
    event.currentTarget.value = '';
    void loadIntraday(file, readId);
  };

  return (
    <section className="import-panel">
      <div className="panel-heading">
        <Upload size={18} />
        <h2>Direct EIA Imports</h2>
      </div>

      <div className="import-grid">
        <div className="import-block">
          <label className="import-drop">
            <FileUp size={18} />
            <span>EIA fundamentals CSV</span>
            <strong>{fundamentals.length} rows</strong>
            <input
              type="file"
              accept=".csv,text/csv"
              title="date,family,metricId,metric,actual,expected,unit,source,surpriseQuality,provenance,sourceKind,expectationMethod,publishedAt,note"
              onChange={handleFundamentalsChange}
            />
          </label>
          {fundamentalsError ? (
            <div className="import-error" role="alert">
              <AlertTriangle size={15} />
              <span>{fundamentalsError}</span>
            </div>
          ) : null}
        </div>

        <div className="import-block">
          <label className="import-drop">
            <FileUp size={18} />
            <span>Intraday OHLCV CSV</span>
            <strong>{intradayCandles.length} candles</strong>
            <input
              type="file"
              accept=".csv,text/csv"
              title="timestamp,market,open,high,low,close,volume"
              onChange={handleIntradayChange}
            />
          </label>
          {intradayError ? (
            <div className="import-error" role="alert">
              <AlertTriangle size={15} />
              <span>{intradayError}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
