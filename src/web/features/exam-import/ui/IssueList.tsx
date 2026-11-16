import type { ExamIssue } from '../../../../shared/exam-format/index.js';
import { Card } from '../../../shared/ui/Card.js';

export function IssueList({ title, issues, tone, onPick }: { title: string; issues: ExamIssue[]; tone: 'error' | 'warning'; onPick: (line: number) => void }) {
  if (issues.length === 0) return null;
  const color = tone === 'error' ? 'var(--wrong-600)' : 'var(--warn-600)';
  return (
    <Card title={`${title} (${issues.length})`}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {issues.map((it, i) => (
          <li key={i}>
            <button type="button" onClick={() => onPick(it.line)} style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px', background: 'var(--surface-sunken)', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', font: 'var(--type-ui)', color: 'var(--ink-800)' }}>
              <span className="pq-tabular" style={{ flex: 'none', fontWeight: 700, color }}>Dòng {it.line}</span>
              <span>{it.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
