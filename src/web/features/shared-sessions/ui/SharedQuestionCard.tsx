import type { SharedQuestion } from '../../../../shared/api/index.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Markdown } from '../../../shared/ui/Markdown.js';
import { tallyOf } from '../domain/shared-view.js';
import { ClassTally } from './ClassTally.js';

const TYPE_LABEL = { single: 'Một đáp án', multi: 'Nhiều đáp án', essay: 'Tự luận' } as const;
const label = { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--text-meta)' } as const;
const fmt = (n: number) => String(n).replace('.', ',');

// One question of a shared session: prompt, the key, the class's counts and the explanation (shown at once).
export function SharedQuestionCard({ q, index, submitted }: { q: SharedQuestion; index: number; submitted: number }) {
  const tally = tallyOf(q, submitted);
  return (
    <article aria-labelledby={`cau-${index + 1}-tieu-de`} style={{ minWidth: 0, background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: 20, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', font: 'var(--type-label)', color: 'var(--text-meta)' }}>
        <span id={`cau-${index + 1}-tieu-de`} tabIndex={-1} style={{ color: 'var(--brand-700)', outline: 'none' }}>Câu {index + 1}</span><span>·</span><span>{fmt(q.points)} điểm</span><span>·</span><span>{TYPE_LABEL[q.type]}</span>
      </header>
      <h3 style={{ margin: 0, font: 'var(--type-question)', color: 'var(--text-title)', textWrap: 'pretty' }}><Markdown inlineOnly source={q.prompt} /></h3>
      {q.body && <div style={{ minWidth: 0, overflowX: 'auto' }}><Markdown source={q.body} /></div>}
      {q.type === 'multi' && <div style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Chọn tất cả đáp án đúng</div>}

      {q.type !== 'essay' && (tally ? <ClassTally tally={tally} /> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {[...q.options].sort((a, b) => a.position - b.position).map((o, i) => (
            <li key={o.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid ' + (o.isCorrect ? 'var(--correct-border)' : 'var(--border-hairline)'), background: o.isCorrect ? 'var(--correct-surface)' : 'var(--paper)' }}>
              <b style={{ fontFamily: 'var(--font-mono)', color: o.isCorrect ? 'var(--correct-600)' : 'var(--ink-700)' }}>{String.fromCharCode(65 + i)}</b>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}><Markdown inlineOnly source={o.text} /></span>
              {o.isCorrect && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--type-label)', color: 'var(--correct-600)', whiteSpace: 'nowrap' }}><Icon name="circle-check" size={14} />Đáp án đúng</span>}
            </li>
          ))}
        </ul>
      ))}

      {q.type === 'essay' && <p style={{ margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Câu tự luận chỉ có đáp án mẫu và tiêu chí chấm, không kèm bài làm của ai.</p>}

      {q.explanation && (
        <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'grid', gap: 6, minWidth: 0, overflowX: 'auto' }}>
          <div style={label}>{q.type === 'essay' ? 'Đáp án mẫu / tiêu chí chấm' : 'Giải thích'}</div>
          <Markdown source={q.explanation} />
        </div>
      )}
    </article>
  );
}
