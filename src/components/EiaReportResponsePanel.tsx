import { AlertTriangle, FileText, Info } from 'lucide-react';
import { factorLabels } from '../lib/events';
import { buildReportResponses, type ReportResponseRow } from '../lib/reportResponses';
import type { DailyPriceRow, EventRow, FundamentalRecord } from '../lib/types';

interface ReportResponsePanelProps {
  rows: DailyPriceRow[];
  events: EventRow[];
  fundamentals: FundamentalRecord[];
}

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'n/a';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function moveClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'flat';
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

function signalClass(tone: ReportResponseRow['tone']): string {
  if (tone === 'bullish') return 'positive';
  if (tone === 'bearish') return 'negative';
  if (tone === 'neutral') return 'neutral';
  return 'proxy';
}

function sourceStatusLabel(status: ReportResponseRow['event']['sourceStatus']): string {
  if (status === 'calendar-proxy') return 'proxy timing';
  if (status === 'direct') return 'direct surprise';
  if (status === 'manual') return 'manual direct';
  return 'news note';
}

export function ReportResponsePanel({ rows, events, fundamentals }: ReportResponsePanelProps) {
  const responses = buildReportResponses(rows, events, fundamentals);
  const directCount = responses.filter((row) => row.event.sourceStatus === 'direct' || row.event.sourceStatus === 'manual').length;
  const proxyCount = responses.filter((row) => row.event.sourceStatus === 'calendar-proxy').length;
  const reportCount = new Set(responses.map((row) => row.event.family)).size;
  const latestPriceDate = rows[rows.length - 1]?.date;
  const latestLedgerDate = responses[0]?.event.date;

  return (
    <section className="report-response-panel">
      <div className="panel-heading report-response-heading">
        <div>
          <FileText size={18} />
          <h2>All Report Response Ledger</h2>
        </div>
        <span>
          {responses.length} releases | {reportCount} reports | {directCount} direct
          {latestLedgerDate ? ` | latest ${latestLedgerDate}` : ''}
        </span>
      </div>

      <div className={`ledger-integrity-note ${proxyCount ? 'warn' : 'good'}`}>
        {proxyCount ? <AlertTriangle size={16} /> : <Info size={16} />}
        <span>
          {proxyCount
            ? `${proxyCount} rows are proxy timing rows. They show WTI/Brent settlement response after recurring public release windows, not actual report surprise. Latest response row is ${latestLedgerDate ?? 'n/a'} because aligned price data currently ends ${latestPriceDate ?? 'n/a'}. Import official dated actual-vs-expected data before using those rows as tradable patterns.`
            : `Every row in the current ledger has direct/manual evidence through ${latestLedgerDate ?? 'n/a'}; settlement responses are still daily 1D/3D moves unless intraday release-time candles are imported.`}
        </span>
      </div>

      <div className="response-table-wrap">
        <table className="response-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th>Report</th>
              <th>Report detail</th>
              <th>WTI 1D</th>
              <th>WTI 3D</th>
              <th>Brent 1D</th>
              <th>Brent 3D</th>
              <th>Read</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((row) => (
              <tr key={row.event.id}>
                <td>
                  <strong>{row.event.date}</strong>
                  <span>{row.event.releaseTime ?? 'public'}</span>
                </td>
                <td>
                  <strong>{factorLabels[row.event.family]}</strong>
                  <span>{sourceStatusLabel(row.event.sourceStatus)}</span>
                </td>
                <td>
                  <em className={`report-signal ${signalClass(row.tone)}`}>{row.reportRead}</em>
                  {row.event.sourceUrl ? (
                    <a href={row.event.sourceUrl} target="_blank" rel="noreferrer">
                      source link
                    </a>
                  ) : (
                    <span>manual/derived</span>
                  )}
                </td>
                <td className="response-detail">{row.componentSummary}</td>
                <td className={moveClass(row.wti1d?.returnPct)}>{pct(row.wti1d?.returnPct)}</td>
                <td className={moveClass(row.wti3d?.returnPct)}>{pct(row.wti3d?.returnPct)}</td>
                <td className={moveClass(row.brent1d?.returnPct)}>{pct(row.brent1d?.returnPct)}</td>
                <td className={moveClass(row.brent3d?.returnPct)}>{pct(row.brent3d?.returnPct)}</td>
                <td>{row.verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
