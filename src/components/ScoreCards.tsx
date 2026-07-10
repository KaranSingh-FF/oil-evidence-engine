import { Activity, BarChart3, Gauge, ShieldAlert } from 'lucide-react';
import { factorLabels } from '../lib/events';
import type { ScoreRow, StrategyLabel } from '../lib/types';

interface ScoreCardsProps {
  scores: ScoreRow[];
}

const labelClass: Record<StrategyLabel, string> = {
  'confirm-long': 'positive',
  'confirm-short': 'negative',
  'volatility-expected': 'volatility',
  avoid: 'avoid',
  'no-edge': 'neutral'
};

function evidenceLabel(score: ScoreRow): string {
  return `${score.evidenceTier} evidence | ${score.directEvidenceShare}% direct`;
}

export function ScoreCards({ scores }: ScoreCardsProps) {
  const top = scores.slice(0, 4);
  const best = top[0];

  return (
    <section className="score-panel">
      <div className="panel-heading">
        <BarChart3 size={18} />
        <h2>Pattern Score</h2>
      </div>

      {best ? (
        <div className="summary-score">
          <span className={`strategy-label ${labelClass[best.label]}`}>{best.label.replace(/-/g, ' ')}</span>
          <span className={`evidence-pill ${best.evidenceTier}`}>{evidenceLabel(best)}</span>
          <strong>{factorLabels[best.family]}</strong>
          <p>
            {best.sampleSize} samples | {best.directionHitRate}% positive | {best.confidenceScore}/100 confidence
          </p>
        </div>
      ) : (
        <div className="empty-state">No scored factors for the current filters.</div>
      )}

      <div className="metric-grid">
        {top.map((score) => (
          <article key={`${score.family}-${score.market}-${score.window}`} className="metric-tile">
            <div className="metric-title">
              <span>{factorLabels[score.family]}</span>
              <span className={`dot ${labelClass[score.label]}`} />
            </div>
            <dl>
              <div>
                <dt>Sample Quality</dt>
                <dd>
                  {score.sampleSize} / {score.excludedAbnormal} excl.
                </dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{score.evidenceTier} {score.directEvidenceShare}%</dd>
              </div>
              <div>
                <dt>Direction</dt>
                <dd>{score.directionHitRate}%</dd>
              </div>
              <div>
                <dt>Avg Move</dt>
                <dd>{score.meanReturn}%</dd>
              </div>
              <div>
                <dt>ATR Proxy</dt>
                <dd>{score.averageAtrMultiple}x</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{score.confidenceScore}/100</dd>
              </div>
              <div>
                <dt>Max adverse</dt>
                <dd>{score.maxAdverseReturn}%</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="score-footer">
        <span>
          <Gauge size={15} /> Conservative thresholds
        </span>
        <span>
          <Activity size={15} /> Filter layer only
        </span>
        <span>
          <ShieldAlert size={15} /> News excluded by default
        </span>
      </div>
    </section>
  );
}
