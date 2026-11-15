import { useMemo, useState } from 'react';
import { useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';
import type { GradeResponse, GradingAnswer, GradingQuestion, GradingView, SessionDetail } from '../../shared/api/index.js';
import { Markdown } from '../components/Markdown.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { Icon } from '../components/ui/Icon.js';
import { TextField } from '../components/ui/TextField.js';
import { api, ApiError } from '../lib/api.js';
import { answerLabel, formatScore, isBlank, parseScore } from '../lib/grading-ui.js';

interface Data { grading: GradingView; session: SessionDetail }
export const gradingLoader = async ({ params }: LoaderFunctionArgs): Promise<Data> => {
  const [grading, session] = await Promise.all([
    api.get<GradingView>(`/api/admin/sessions/${params.id}/grading`),
    api.get<SessionDetail>(`/api/admin/sessions/${params.id}`),
  ]);
  return { grading, session };
};

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);
const mono = { font: 'var(--type-code)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const;

// One member's answer with its score box. Saves when focus leaves the card, so Tab-ing through feels like a form.
function AnswerCard({ answer, points, label, locked, onSaved }: {
  answer: GradingAnswer; points: number; label: string; locked: boolean; onSaved: (r: GradeResponse) => void;
}) {
  const [score, setScore] = useState(answer.manualScore === null ? '' : formatScore(answer.manualScore));
  const [feedback, setFeedback] = useState(answer.feedback ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const check = parseScore(score, points);
  const dirty = (answer.manualScore === null ? score.trim() !== '' : !(check.ok && check.value === answer.manualScore)) || feedback.trim() !== (answer.feedback ?? '');

  async function save() {
    if (locked || saving || !dirty) return;
    if (!check.ok) { if (score.trim() !== '') setError(check.message); return; } // feedback alone waits for a score
    setSaving(true);
    setError('');
    try {
      const r = await api.put<GradeResponse>(`/api/admin/answers/${answer.answerId}/grade`, { score: check.value, feedback });
      onSaved(r);
    } catch (err) {
      setError(errorText(err, 'Không lưu được điểm'));
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
            <span className="pq-tabular" style={{ font: 'var(--type-ui)', color: 'var(--text-meta)' }}>/ {formatScore(points)}</span>
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

function QuestionChips({ questions, current, onSelect }: { questions: GradingQuestion[]; current: number; onSelect: (i: number) => void }) {
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

export function Grading() {
  const { grading: initial, session } = useLoaderData() as Data;
  const nav = useNavigate();
  const [view, setView] = useState(initial);
  const [cur, setCur] = useState(0);
  // Names stay hidden until the mentor chooses to show them: grading should not depend on who wrote the answer.
  const [blind, setBlind] = useState(true);
  const [error, setError] = useState('');
  const [zeroing, setZeroing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const locked = view.status === 'finalized';
  const q = view.questions[cur];
  const done = view.graded === view.total;
  const blankUngraded = useMemo(() => (q ? q.answers.filter(a => a.manualScore === null && isBlank(a)) : []), [q]);

  // Merge one graded answer into the view and refresh the counters from the server's answer.
  const applySaved = (r: GradeResponse) =>
    setView(v => ({
      ...v,
      graded: r.graded,
      total: r.total,
      questions: v.questions.map(x => ({ ...x, answers: x.answers.map(a => (a.answerId === r.answer.answerId ? r.answer : a)) })),
    }));

  async function zeroBlanks() {
    setZeroing(true);
    setError('');
    try {
      for (const a of blankUngraded) applySaved(await api.put<GradeResponse>(`/api/admin/answers/${a.answerId}/grade`, { score: 0 }));
    } catch (err) {
      setError(errorText(err, 'Không chấm được các bài bỏ trống'));
    } finally {
      setZeroing(false);
    }
  }

  async function finalize() {
    setFinalizing(true);
    setError('');
    try {
      await api.post(`/api/admin/sessions/${session.id}/finalize`);
      nav(`/admin/sessions/${session.id}`);
    } catch (err) {
      setError(errorText(err, 'Không chốt được kết quả'));
      setConfirming(false);
      setFinalizing(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <button onClick={() => nav(`/admin/sessions/${session.id}`)} style={{ justifySelf: 'start', display: 'inline-flex', gap: 6, alignItems: 'center', background: 'none', border: 0, padding: 0, color: 'var(--text-meta)', font: 'var(--type-meta)', cursor: 'pointer' }}>
        <Icon name="arrow-left" size={14} />Phiên thi
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>Chấm tự luận</h1>
          <div style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>{session.exam.title}</div>
        </div>
        <span aria-live="polite" className="pq-tabular" style={{ padding: '4px 12px', borderRadius: 'var(--radius-pill)', font: 'var(--type-label)', fontSize: 13, background: done ? 'var(--correct-surface)' : 'var(--ink-100)', color: done ? 'var(--correct-600)' : 'var(--ink-700)' }}>
          Đã chấm {view.graded}/{view.total}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {locked
            ? <span style={{ font: 'var(--type-label)', color: 'var(--brand-700)', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={14} />Đã chốt — chỉ xem</span>
            : <Button icon="flag" disabled={!done} onClick={() => setConfirming(true)}>Chốt kết quả</Button>}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {!locked && !done && view.total > 0 && <p style={{ margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Cần chấm đủ {view.total - view.graded} bài còn lại (bài bỏ trống cũng cần điểm, thường là 0) mới chốt được.</p>}

      {!q ? (
        <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>{view.total === 0 && view.questions.length > 0 ? 'Chưa có ai nộp bài tự luận.' : 'Đề này không có câu tự luận.'}</p></Card>
      ) : (
        <>
          <QuestionChips questions={view.questions} current={cur} onSelect={setCur} />

          <div style={{ position: 'sticky', top: 0, zIndex: 4 }}>
            <Card tone="brand" title={<>Câu {q.position} · {formatScore(q.points)} điểm</>}>
              <div style={{ display: 'grid', gap: 10, maxHeight: '38vh', overflow: 'auto' }}>
                <div style={{ font: 'var(--type-question)', color: 'var(--text-title)' }}><Markdown inlineOnly source={q.prompt} /></div>
                {q.body && <Markdown source={q.body} />}
                {q.explanation && (
                  <div style={{ background: 'var(--paper)', border: '1px solid var(--brand-200)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                    <div style={{ font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--brand-700)', marginBottom: 4 }}>Đáp án mẫu & rubric</div>
                    <Markdown source={q.explanation} />
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: 'var(--type-ui)', cursor: 'pointer' }}>
              <input type="checkbox" checked={blind} onChange={e => setBlind(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand-600)' }} />
              Ẩn tên (chấm khách quan){blind ? '' : ' — đang hiện tên'}
            </label>
            {!locked && blankUngraded.length > 0 && (
              <Button size="sm" variant="secondary" icon="check" loading={zeroing} onClick={zeroBlanks}>Chấm 0 cho {blankUngraded.length} bài bỏ trống</Button>
            )}
          </div>

          {q.answers.length === 0 ? (
            <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>Chưa có bài nào cho câu này.</p></Card>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {q.answers.map((a, i) => (
                // Re-mount when the server's score/feedback changes (e.g. the bulk "0 for blanks"), so the inputs follow it.
                <AnswerCard key={`${a.answerId}:${a.manualScore}:${a.feedback ?? ''}`} answer={a} points={q.points} label={answerLabel(a, i, blind)} locked={locked} onSaved={applySaved} />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog open={confirming} title="Chốt kết quả?" confirmLabel="Chốt kết quả" busy={finalizing} onCancel={() => setConfirming(false)} onConfirm={finalize}>
        Điểm sẽ thành chính thức, bảng xếp hạng bỏ nhãn "Tạm tính" và không sửa điểm được nữa.
      </ConfirmDialog>
    </div>
  );
}
