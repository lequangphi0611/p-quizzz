import { useLoaderData, useNavigate } from 'react-router';
import { Markdown } from '../../../components/Markdown.js';
import { Button } from '../../../components/ui/Button.js';
import { Card } from '../../../components/ui/Card.js';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../components/ui/ErrorMessage.js';
import { Icon } from '../../../components/ui/Icon.js';
import { formatPoints } from '../../../shared/format/points.js';
import type { GradingData } from '../application/grading-loader.js';
import { useGrading } from '../application/grading-context.js';
import { answerLabel } from '../domain/grading-ui.js';
import { AnswerCard } from './AnswerCard.js';
import { QuestionChips } from './QuestionChips.js';

const back = { justifySelf: 'start', display: 'inline-flex', gap: 6, alignItems: 'center', background: 'none', border: 0, padding: 0, color: 'var(--text-meta)', font: 'var(--type-meta)', cursor: 'pointer' } as const;

// "/admin/sessions/:id/grading" — the mentor grades essay answers, one question at a time.
export function GradingPage() {
  const { grading, session } = useLoaderData() as GradingData;
  const nav = useNavigate();
  const { state, ctrl } = useGrading(session.id, grading);
  const { view, cur, blind, error, zeroing, confirming, finalizing } = state;
  const q = ctrl.question;
  const { locked, done, blankUngraded } = ctrl;

  async function finalize() { if (await ctrl.finalize()) nav(`/admin/sessions/${session.id}`); }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <button onClick={() => nav(`/admin/sessions/${session.id}`)} style={back}><Icon name="arrow-left" size={14} />Phiên thi</button>

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
            : <Button icon="flag" disabled={!done} onClick={() => ctrl.askFinalize()}>Chốt kết quả</Button>}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {!locked && !done && view.total > 0 && <p style={{ margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Cần chấm đủ {view.total - view.graded} bài còn lại (bài bỏ trống cũng cần điểm, thường là 0) mới chốt được.</p>}

      {!q ? (
        <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>{view.total === 0 && view.questions.length > 0 ? 'Chưa có ai nộp bài tự luận.' : 'Đề này không có câu tự luận.'}</p></Card>
      ) : (
        <>
          <QuestionChips questions={view.questions} current={cur} onSelect={i => ctrl.select(i)} />

          <div style={{ position: 'sticky', top: 0, zIndex: 4 }}>
            <Card tone="brand" title={<>Câu {q.position} · {formatPoints(q.points)} điểm</>}>
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
              <input type="checkbox" checked={blind} onChange={e => ctrl.setBlind(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand-600)' }} />
              Ẩn tên (chấm khách quan){blind ? '' : ' — đang hiện tên'}
            </label>
            {!locked && blankUngraded.length > 0 && (
              <Button size="sm" variant="secondary" icon="check" loading={zeroing} onClick={() => void ctrl.zeroBlanks()}>Chấm 0 cho {blankUngraded.length} bài bỏ trống</Button>
            )}
          </div>

          {q.answers.length === 0 ? (
            <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>Chưa có bài nào cho câu này.</p></Card>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {q.answers.map((a, i) => (
                // Re-mount when the server's score/feedback changes (e.g. the bulk "0 for blanks"), so the inputs follow it.
                <AnswerCard key={`${a.answerId}:${a.manualScore}:${a.feedback ?? ''}`} answer={a} points={q.points} label={answerLabel(a, i, blind)} locked={locked} onSave={(id, score, fb) => ctrl.grade(id, score, fb)} />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog open={confirming} title="Chốt kết quả?" confirmLabel="Chốt kết quả" busy={finalizing} onCancel={() => ctrl.cancelFinalize()} onConfirm={() => void finalize()}>
        Điểm sẽ thành chính thức, bảng xếp hạng bỏ nhãn "Tạm tính" và không sửa điểm được nữa.
      </ConfirmDialog>
    </div>
  );
}
