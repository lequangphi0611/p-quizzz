import { useState } from 'react';
import { formatPoints as formatScore } from '../../../shared/format/points.js';
import { Icon } from '../../../shared/ui/Icon.js';

/** Anonymous essay tile for the projector grid. Deliberately has no name prop — only the shuffled "Bài #n". */
export function EssayCard({ number, excerpt, status, score, maxScore, current = false, lines = 3, onClick }: {
  number: number; excerpt: string; status: 'ungraded' | 'graded'; score?: number | null; maxScore: number; current?: boolean; lines?: number; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const graded = status === 'graded' && score != null;
  const p = graded
    ? { bg: 'var(--screen-correct-surface)', bd: 'var(--screen-correct-border)', fg: 'var(--screen-correct)', icon: 'circle-check', text: <b style={{ fontFamily: 'var(--font-mono)' }}>{formatScore(score)}/{formatScore(maxScore)}</b> }
    : { bg: 'var(--screen-pending-surface)', bd: 'var(--sun-500)', fg: 'var(--sun-400)', icon: 'hourglass', text: 'Chưa chấm' };
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      aria-label={`Bài #${number}, ${graded ? `đã chấm ${formatScore(score)} trên ${formatScore(maxScore)}` : 'chưa chấm'}`}
      style={{ display: 'grid', gap: 12, alignContent: 'start', width: '100%', minWidth: 0, textAlign: 'left', padding: '18px 22px', cursor: 'pointer', borderRadius: 'var(--radius-lg)', color: 'var(--screen-text)',
        background: hover ? 'var(--screen-panel-hover)' : 'var(--screen-panel)', border: '2px solid ' + (current ? 'var(--sun-400)' : hover ? 'var(--screen-hover-line)' : 'var(--screen-line)'),
        transform: hover ? 'translateY(-2px)' : 'none', transition: 'background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast), transform var(--dur-fast) var(--ease-standard)' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ font: '700 30px/1 var(--font-sans)', whiteSpace: 'nowrap', flex: 'none' }}>Bài <span style={{ fontFamily: 'var(--font-mono)' }}>#{number}</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 'var(--radius-pill)', background: p.bg, border: '2px solid ' + p.bd, color: p.fg, font: '600 20px/1 var(--font-sans)', whiteSpace: 'nowrap' }}><Icon name={p.icon} size={20} />{p.text}</span>
      </span>
      <span style={{ font: '400 24px/1.45 var(--font-mono)', color: '#DDE1E7', display: '-webkit-box', WebkitLineClamp: lines, minHeight: lines * 1.45 + 'em', WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{excerpt}</span>
    </button>
  );
}
