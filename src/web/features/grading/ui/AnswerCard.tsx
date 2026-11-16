import { useState } from 'react';
import type { GradingAnswer } from '../../../../shared/api/index.js';
import { ErrorMessage } from '../../../components/ui/ErrorMessage.js';
import { Icon } from '../../../components/ui/Icon.js';
import { TextField } from '../../../components/ui/TextField.js';
import { formatPoints } from '../../../shared/format/points.js';
import { gradingErrorText } from '../application/grading-controller.js';
import { planCardSave } from '../domain/card-save.js';
import { isBlank } from '../domain/grading-ui.js';

const mono = { font: 'var(--type-code)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const;

// One member's answer with its score box. Saves when focus leaves the card, so Tab-ing through feels like a form.
export function AnswerCard({ answer, points, label, locked, onSave }: {
  answer: GradingAnswer; points: number; label: string; locked: boolean; onSave: (answerId: number, score: number, feedback: string) => Promise<void>;
}) {
  const [score, setScore] = useState(answer.manualScore === null ? '' : formatPoints(answer.manualScore));
  const [feedback, setFeedback] = useState(answer.feedback ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (locked || saving) return;
    const plan = planCardSave(answer, score, feedback, points);
    if (plan.kind === 'nothing') return;
    if (plan.kind === 'invalid') { setError(plan.message); return; }
    if (plan.kind === 'restore') { setScore(plan.score); setError(plan.message); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(answer.answerId, plan.score, feedback);
    } catch (err) {
      setError(gradingErrorText(err, 'Không lưu được điểm'));
    } finally {
      setSaving(false);
    }
  }

  const graded = answer.manualScore !== null;
  return (
    <article
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void save(); }}
      style={{ background: 'var(--surface-card)', border: '1px solid ' + (graded ? 'var(--correct-border)' : 'var(--border-hairline)'), borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: 16, display: 'grid', gap: 12 }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ font: 'var(--type-ui)', fontWeight: 700, color: 'var(--text-title)' }}>{label}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--type-label)', color: graded ? 'var(--correct-600)' : 'var(--text-faint)' }}>
          <Icon name={graded ? 'circle-check' : 'clock'} size={14} />{graded ? 'Đã chấm' : 'Chưa chấm'}
        </span>
      </header>
      <div style={{ ...mono, background: 'var(--ink-050)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-md)', padding: '12px 14px', color: 'var(--ink-900)' }}>
        {isBlank(answer) ? <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>(Bỏ trống)</span> : answer.textAnswer}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' }}>Điểm</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              inputMode="decimal" value={score} disabled={locked} aria-label={`Điểm của ${label}`} aria-invalid={error !== ''}
              onChange={e => { setScore(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              style={{ width: 88, height: 44, padding: '0 12px', font: 'var(--type-score)', fontSize: 18, textAlign: 'right', border: '1.5px solid ' + (error ? 'var(--wrong-500)' : 'var(--border-strong)'), borderRadius: 'var(--radius-md)', background: locked ? 'var(--ink-050)' : 'var(--paper)' }}
            />
            <span className="pq-tabular" style={{ font: 'var(--type-ui)', color: 'var(--text-meta)' }}>/ {formatPoints(points)}</span>
          </span>
        </label>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <TextField label="Nhận xét (tuỳ chọn)" multiline rows={2} value={feedback} onChange={v => { setFeedback(v); setError(''); }} />
        </div>
      </div>
      {error && <ErrorMessage message={error} />}
      {saving && <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Đang lưu…</span>}
    </article>
  );
}
