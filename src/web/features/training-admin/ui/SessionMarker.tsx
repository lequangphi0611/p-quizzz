import { formatClock } from '../../../shared/format/date.js';
import { dayMonth } from '../domain/days.js';

/**
 * A Claude Code session on the timeline: a small, lowercase marker on the day's rail ("Phiên Claude Code 2 · mở lúc 09:55") that
 * is not clickable. A session that runs past midnight is repeated at the top of the next day as "· tiếp từ 23/11". `rail` is false
 * when the day has no rail (a single day), and then there is no dot.
 */
export function SessionMarker({ index, openedAt, continuedFrom, rail = true }: { index: number; openedAt: number; continuedFrom?: number; rail?: boolean }) {
  return (
    <div role="separator" aria-label={`Phiên Claude Code ${index}`} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, minHeight: 24 }}>
      {rail && <span aria-hidden="true" style={{ position: 'absolute', left: -28, top: 6, width: 12, height: 12, boxSizing: 'border-box', borderRadius: '50%', background: 'var(--surface-page)', border: '2px solid var(--ink-500)' }} />}
      <span style={{ font: '600 12px/1.3 var(--font-sans)', color: 'var(--ink-800)', whiteSpace: 'nowrap' }}>
        Phiên Claude Code {index}
        <span style={{ fontWeight: 400, color: 'var(--ink-600)' }}> · {continuedFrom !== undefined ? `tiếp từ ${dayMonth(continuedFrom)}` : `mở lúc ${formatClock(openedAt)}`}</span>
      </span>
      <span aria-hidden="true" style={{ flex: 1, borderTop: '1px dashed var(--ink-300)' }} />
    </div>
  );
}
