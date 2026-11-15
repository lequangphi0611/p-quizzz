// Row of numbered buttons: current question filled, answered ones tinted. `current` and `answered` are 0-based.
export function QuestionNav({ count, current, answered, onSelect }: { count: number; current: number; answered: number[]; onSelect: (index: number) => void }) {
  const done = new Set(answered);
  return (
    <nav aria-label="Danh sách câu" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {Array.from({ length: count }, (_, i) => {
        const cur = i === current;
        const isDone = done.has(i);
        return (
          <button
            key={i} type="button" onClick={() => onSelect(i)} aria-current={cur ? 'step' : undefined}
            aria-label={`Câu ${i + 1}${isDone ? ', đã trả lời' : ''}`}
            style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', font: 'var(--type-score)', fontSize: 14, cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
              background: cur ? 'var(--brand-600)' : isDone ? 'var(--brand-100)' : 'var(--paper)', color: cur ? '#fff' : isDone ? 'var(--brand-700)' : 'var(--ink-600)',
              border: '1.5px solid ' + (cur ? 'var(--brand-600)' : isDone ? 'var(--brand-200)' : 'var(--border-strong)'), boxShadow: cur ? 'var(--shadow-press)' : 'none' }}
          >{i + 1}</button>
        );
      })}
    </nav>
  );
}
