import type { GradingQuestion } from '../../../../shared/api/index.js';

export function QuestionChips({ questions, current, onSelect }: { questions: GradingQuestion[]; current: number; onSelect: (i: number) => void }) {
  return (
    <nav aria-label="Chọn câu tự luận" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {questions.map((q, i) => {
        const done = q.answers.filter(a => a.manualScore !== null).length;
        const cur = i === current;
        return (
          <button key={q.id} type="button" aria-current={cur ? 'step' : undefined} onClick={() => onSelect(i)}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', font: 'var(--type-ui)', fontWeight: 600, background: cur ? 'var(--brand-600)' : 'var(--paper)', color: cur ? '#fff' : 'var(--ink-800)', border: '1.5px solid ' + (cur ? 'var(--brand-600)' : 'var(--border-strong)') }}>
            Câu {q.position} <span className="pq-tabular" style={{ opacity: 0.8, fontWeight: 500 }}>· {done}/{q.answers.length}</span>
          </button>
        );
      })}
    </nav>
  );
}
