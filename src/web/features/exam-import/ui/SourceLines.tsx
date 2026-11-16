import { useMemo } from 'react';
import type { ExamIssue } from '../../../../shared/exam-format/index.js';
import { splitSourceLines } from '../domain/exam-summary.js';

const issueLines = (issues: ExamIssue[]) => new Set(issues.map(i => i.line));

// A numbered, read-only view of the source. Error lines are red, warning lines amber; `focus` is outlined.
export function SourceLines({ source, errors, warnings, focus }: { source: string; errors: ExamIssue[]; warnings: ExamIssue[]; focus: number | null }) {
  const errorLines = useMemo(() => issueLines(errors), [errors]);
  const warnLines = useMemo(() => issueLines(warnings), [warnings]);
  const lines = useMemo(() => splitSourceLines(source), [source]);
  return (
    <div style={{ maxHeight: 520, overflow: 'auto', background: 'var(--paper)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', font: 'var(--type-code)', fontSize: 13 }}>
      {lines.map((text, i) => {
        const n = i + 1;
        const bad = errorLines.has(n);
        const warn = !bad && warnLines.has(n);
        return (
          <div key={n} id={`pq-line-${n}`} style={{ display: 'flex', background: bad ? 'var(--wrong-surface)' : warn ? 'var(--warn-surface)' : 'transparent', boxShadow: focus === n ? 'inset 0 0 0 2px var(--wrong-500)' : 'none' }}>
            <span className="pq-tabular" style={{ flex: 'none', width: 48, padding: '0 10px', textAlign: 'right', color: bad ? 'var(--wrong-600)' : 'var(--text-faint)', userSelect: 'none', borderRight: '1px solid var(--border-hairline)' }}>{n}</span>
            <span style={{ padding: '0 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: 0, color: bad ? 'var(--wrong-600)' : 'var(--ink-800)' }}>{text || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}
