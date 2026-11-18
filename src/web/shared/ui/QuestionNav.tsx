import { useEffect, useRef, useState } from 'react';

function ScreenCell({ i, label, cur, done, meta, onSelect }: { i: number; label: string; cur: boolean; done: boolean; meta?: string | null; onSelect: (i: number) => void }) {
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (cur) ref.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [cur]); // keep the current question visible in a long, scrolling strip
  return (
    <button ref={ref} type="button" onClick={() => onSelect(i)} aria-current={cur ? 'step' : undefined} aria-label={'Câu ' + label + (meta ? ', đã chấm ' + meta : '')}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ flex: 'none', minWidth: 80, height: 80, padding: meta ? '0 18px' : 0, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 'var(--radius-md)', cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
        background: cur ? 'var(--sun-400)' : hover ? 'var(--screen-panel-hover)' : 'var(--screen-panel)', color: cur ? 'var(--ink-900)' : 'var(--screen-text)',
        border: '2px solid ' + (cur ? 'var(--sun-400)' : hover ? 'var(--screen-hover-line)' : 'var(--screen-line-strong)'), boxShadow: cur ? '0 3px 0 var(--sun-500)' : 'none', transition: 'background var(--dur-fast), border-color var(--dur-fast)' }}>
      <span style={{ font: '700 32px/1 var(--font-mono)' }}>{label}</span>
      {meta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '600 18px/1 var(--font-mono)', color: cur ? 'var(--ink-800)' : done ? 'var(--screen-correct)' : 'var(--screen-meta)' }}>{done && <span className="pq-icon pq-icon-check" style={{ fontSize: 16 }} />}{meta}</span>}
    </button>
  );
}

// Row of numbered buttons: current question filled, answered ones tinted. `current` and `answered` are 0-based.
// size="screen": projector cells; `meta[i]` adds a small second line (e.g. grading progress "2/5").
// `labels[i]` is the number shown on cell i (default i + 1), e.g. the exam number when the cells are reordered.
export function QuestionNav({ count, current, answered, meta = [], labels = [], size = 'md', onSelect }: { count: number; current: number; answered: number[]; meta?: (string | null | undefined)[]; labels?: (number | string)[]; size?: 'md' | 'screen'; onSelect: (index: number) => void }) {
  const done = new Set(answered);
  const label = (i: number) => String(labels[i] ?? i + 1);
  if (size === 'screen') {
    return (
      <nav aria-label="Danh sách câu" style={{ display: 'flex', flexWrap: 'nowrap', gap: 12, alignItems: 'center', width: 'max-content' }}>{/* one row; the caller scrolls it sideways (a wrapped second row overflowed the fixed-height bar and covered the header) */}
        {Array.from({ length: count }, (_, i) => <ScreenCell key={i} i={i} label={label(i)} cur={i === current} done={done.has(i)} meta={meta[i]} onSelect={onSelect} />)}
      </nav>
    );
  }
  return (
    <nav aria-label="Danh sách câu" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {Array.from({ length: count }, (_, i) => {
        const cur = i === current;
        const isDone = done.has(i);
        return (
          <button
            key={i} type="button" onClick={() => onSelect(i)} aria-current={cur ? 'step' : undefined}
            aria-label={`Câu ${label(i)}${isDone ? ', đã trả lời' : ''}`}
            style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', font: 'var(--type-score)', fontSize: 14, cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
              background: cur ? 'var(--brand-600)' : isDone ? 'var(--brand-100)' : 'var(--paper)', color: cur ? '#fff' : isDone ? 'var(--brand-700)' : 'var(--ink-600)',
              border: '1.5px solid ' + (cur ? 'var(--brand-600)' : isDone ? 'var(--brand-200)' : 'var(--border-strong)'), boxShadow: cur ? 'var(--shadow-press)' : 'none' }}
          >{label(i)}</button>
        );
      })}
    </nav>
  );
}
