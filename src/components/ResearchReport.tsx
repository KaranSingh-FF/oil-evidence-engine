import { FileText } from 'lucide-react';
import type { ResearchReport } from '../lib/types';

interface ResearchReportProps {
  report: ResearchReport;
}

export function ResearchReportPanel({ report }: ResearchReportProps) {
  return (
    <section className="report-panel">
      <div className="panel-heading">
        <FileText size={18} />
        <h2>Research Notes</h2>
      </div>
      <p className="report-summary">{report.summary}</p>
      <div className="report-columns">
        <article>
          <h3>Strongest patterns</h3>
          <ul>
            {report.strongestPatterns.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Weak or noisy</h3>
          <ul>
            {report.weakPatterns.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Abnormal history</h3>
          <ul>
            {report.abnormalNotes.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Data quality</h3>
          <ul>
            {report.dataQuality.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
