import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import { Markdown } from '../../../shared/ui/Markdown.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Kbd } from '../../../shared/ui/Kbd.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import { formatPoints as F } from '../../../shared/format/points.js';
import type { GradingData } from '../application/grading-loader.js';
import { useGrading } from '../application/grading-context.js';
import { aiCounts, finalizeBlockers, stripMode, visibleAnswers, type AnswerFilter } from '../domain/ai-ui.js';
import { AnswerCard, type AnswerCardActions } from './AnswerCard.js';
import { AiStrip, QuestionChips, aig } from './ai-parts.js';

const back = { justifySelf: 'start', display: 'inline-flex', gap: 6, alignItems: 'center', background: 'none', border: 0, padding: 0, color: 'var(--text-meta)', font: 'var(--type-meta)', cursor: 'pointer' } as const;

const POLL_MS = 3000;

// "/admin/sessions/:id/grading" — the mentor grades essay answers, one question at a time, with optional AI suggestions
// (PRODUCT.md §4.5, §7.28; design "AI chấm nháp").
export function GradingPage() {
  const { grading, session } = useLoaderData() as GradingData;
  const nav = useNavigate();
  const { state, ctrl } = useGrading(session.id, grading);
  const { view, cur, blind, error, zeroing, confirming, finalizing, filter, kept, acks, aiBusy, live } = state;
  const q = ctrl.question;
  const { locked, done } = ctrl;
  const final = view.status === 'finalized';
  const listRef = useRef<HTMLDivElement>(null);
  const [showModel, setShowModel] = useState(false);

  // While the AI works, refresh every few seconds (no SSE event for it, docs/architecture.md §5).
  const polling = ctrl.polling;
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => void ctrl.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [polling, ctrl]);

  async function finalize() { if (await ctrl.finalize()) nav(`/admin/sessions/${session.id}`); }

  const actions: AnswerCardActions = {
    save: (id, score, fb, aiUse) => ctrl.grade(id, score, fb, aiUse),
    accept: id => ctrl.accept(id),
    undo: id => ctrl.undo(id),
    retry: id => void ctrl.retryAi([id]),
    ack: (id, read) => ctrl.setAck(id, read),
  };

  // J / K: next / previous card (off while typing).
  function onListKey(e: KeyboardEvent) {
    const t = (e.target as HTMLElement).tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k !== 'j' && k !== 'k') return;
    const cards = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-grading-card]') ?? [])];
    const i = cards.findIndex(c => c.contains(document.activeElement));
    const next = cards[Math.max(0, Math.min(cards.length - 1, i + (k === 'j' ? 1 : -1)))];
    if (next) { e.preventDefault(); next.focus(); }
  }

  const c = q ? aiCounts(q) : null;
  const mode = q && c ? stripMode(view, q, c) : 'off';
  const aiOn = view.aiGrader.available;
  const { left, suggestedOnly } = finalizeBlockers(view);
  const rows = q ? visibleAnswers(q.answers, filter, kept) : [];
  const showFilters = aiOn && !!c && c.sent > 0 && !final;

  const fBtn = (k: AnswerFilter, label: string, n: number, icon?: string) => (
    <button key={k} type="button" aria-pressed={filter === k} onClick={() => ctrl.setFilter(k)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 'var(--radius-sm)', border: 0, background: filter === k ? 'var(--paper)' : 'transparent', boxShadow: filter === k ? 'var(--shadow-card)' : 'none', font: 'var(--type-meta)', fontWeight: 600, color: filter === k ? 'var(--text-title)' : 'var(--ink-700)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {icon && <Icon name={icon} size={13} />}{label}<span style={{ ...aig.mono, fontWeight: 500, color: 'var(--text-meta)' }}>{n}</span>
    </button>
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 4, minWidth: 0, flex: '1 1 320px' }}>
          <button onClick={() => nav(`/admin/sessions/${session.id}`)} style={back}><Icon name="arrow-left" size={14} />Phiên thi · {session.exam.title}</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>Chấm tự luận</h1>
            <StatusBadge status={final ? 'finalized' : 'closed'} label={final ? 'Đã chốt kết quả' : 'Đã đóng'} />
          </div>
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 6, flex: 'none', maxWidth: 560 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span aria-live="polite" style={{ font: 'var(--type-ui)', fontWeight: 600, color: done ? 'var(--correct-600)' : 'var(--text-title)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              {done && view.total > 0 && <Icon name="circle-check" size={16} />}Đã chấm <span style={aig.mono}>{view.graded}/{view.total}</span>
            </span>
            {locked
              ? <span style={{ font: 'var(--type-label)', color: 'var(--brand-700)', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={14} />Đã chốt, chỉ xem</span>
              : <Button icon="flag" disabled={!done} onClick={() => ctrl.askFinalize()}>Chốt kết quả</Button>}
          </div>
          {!locked && left > 0 && (
            <span style={{ ...aig.meta, display: 'inline-flex', gap: 5, alignItems: 'center', textAlign: 'right' }}>
              <Icon name="lock" size={13} />
              {suggestedOnly === left
                ? <span>Còn <b style={aig.mono}>{left}</b> bài AI đã gợi ý nhưng bạn chưa xác nhận</span>
                : <span>Còn <b style={aig.mono}>{left}</b> bài chưa chấm (bài bỏ trống cũng cần điểm){suggestedOnly > 0 && <> · trong đó <b style={aig.mono}>{suggestedOnly}</b> bài AI đã gợi ý nhưng bạn chưa xác nhận</>}</span>}
            </span>
          )}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {!q || !c ? (
        <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>{view.total === 0 && view.questions.length > 0 ? 'Chưa có ai nộp bài tự luận.' : 'Đề này không có câu tự luận.'}</p></Card>
      ) : (
        <>
          <QuestionChips questions={view.questions} current={cur} onSelect={i => ctrl.select(i)} ai={aiOn} />

          <section aria-label={`Câu ${q.position}`} style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--paper)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-raised)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'grid', gap: 12, maxHeight: '34vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', minWidth: 0 }}>
                <span style={{ font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--brand-700)', whiteSpace: 'nowrap' }}>Câu {q.position} · {F(q.points)} điểm</span>
                <h2 style={{ margin: 0, font: 'var(--type-question)', fontSize: 17, color: 'var(--text-title)', minWidth: 0 }}><Markdown inlineOnly source={q.prompt} /></h2>
              </div>
              {q.body && <Markdown source={q.body} />}
              {q.rubric ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  <span style={{ ...aig.label, display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="key-round" size={13} />Đáp án mẫu &amp; rubric</span>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                    {q.rubric.criteria.map((r, i) => (
                      <li key={i} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--ink-050)', border: '1px solid var(--ink-200)', font: 'var(--type-meta)', color: 'var(--text-body)' }}>
                        <span style={{ ...aig.mono, fontWeight: 700, fontSize: 12, color: 'var(--ink-700)', lineHeight: 1.45 }}>T{i + 1}<br /><span style={{ fontWeight: 500, color: 'var(--text-meta)' }}>{F(r.points)}đ</span></span>
                        <span style={{ minWidth: 0 }}><Markdown inlineOnly source={r.text} /></span>
                      </li>
                    ))}
                  </ol>
                  {q.rubric.model && (
                    <div>
                      <button type="button" aria-expanded={showModel} onClick={() => setShowModel(v => !v)} style={aig.linkBtn}>
                        <Icon name="chevron-down" size={14} style={{ transform: showModel ? 'rotate(180deg)' : 'none' }} />{showModel ? 'Ẩn đáp án mẫu' : 'Xem đáp án mẫu'}
                      </button>
                      {showModel && <div style={{ marginTop: 6 }}><Markdown source={q.rubric.model} /></div>}
                    </div>
                  )}
                </div>
              ) : q.explanation ? (
                <div style={{ background: 'var(--paper)', border: '1px solid var(--brand-200)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                  <div style={{ ...aig.label, color: 'var(--brand-700)', marginBottom: 4, display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="key-round" size={13} />Đáp án mẫu &amp; rubric</div>
                  <Markdown source={q.explanation} />
                </div>
              ) : (
                <p style={{ ...aig.meta, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="key-round" size={13} />Đáp án mẫu &amp; rubric: đề chưa có cho câu này.</p>
              )}
            </div>
            <AiStrip mode={mode} c={c} busy={aiBusy} onRun={() => void ctrl.runAi()} onStop={() => void ctrl.stopAi()} onRetry={() => void ctrl.retryAi()} onShowFlagged={() => ctrl.setFilter('flag')} />
            <div role="status" aria-live="polite" style={aig.sr}>{live}</div>
          </section>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {showFilters ? (
              <div role="group" aria-label="Lọc bài" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 'var(--radius-md)', background: 'var(--ink-100)' }}>
                {fBtn('all', 'Tất cả', c.total)}
                {fBtn('todo', 'Chờ xác nhận', c.sugPending, 'sparkles')}
                {c.flagPending > 0 && fBtn('flag', 'Nghi ngờ', c.flagPending, 'shield-alert')}
                {c.errPending > 0 && fBtn('err', 'Lỗi', c.errPending, 'circle-alert')}
              </div>
            ) : <span style={aig.meta}>{c.total} bài · thứ tự đã trộn</span>}
            <span style={{ flex: 1 }} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: 'var(--type-ui)', fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={blind} onChange={e => ctrl.setBlind(e.target.checked)} style={{ width: 18, height: 18, margin: 0, accentColor: 'var(--brand-600)' }} />
              Ẩn tên (chấm khách quan){blind ? '' : ' (đang hiện tên)'}
            </label>
            {!locked && c.blankUngraded > 0 && (
              <Button size="sm" variant="secondary" icon="check" loading={zeroing} onClick={() => void ctrl.zeroBlanks()}>Chấm 0 cho {c.blankUngraded} bài bỏ trống</Button>
            )}
          </div>

          {q.answers.length === 0 ? (
            <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>Chưa có bài nào cho câu này.</p></Card>
          ) : (
            <div ref={listRef} onKeyDown={onListKey} style={{ display: 'grid', gap: 16 }}>
              {rows.map(r => (
                <AnswerCard key={`${q.id}:${r.answer.answerId}`} answer={r.answer} index={r.index} points={q.points} showName={!blind} locked={locked}
                  pinned={r.pinned && filter === 'all'} acked={acks.has(r.answer.answerId)} actions={actions} />
              ))}
              {rows.length === 0 && <p style={{ ...aig.meta, padding: 24, textAlign: 'center' }}>Không còn bài nào trong bộ lọc này.</p>}
            </div>
          )}

          {aiOn && !final && q.hasRubric && (
            <p style={{ ...aig.meta, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Kbd>J</Kbd><Kbd>K</Kbd> bài sau / trước</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Kbd>D</Kbd> dùng gợi ý</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Kbd>E</Kbd> sửa rồi lưu</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Kbd>R</Kbd> mở lý do</span>
              <span>· phím tắt tắt khi đang gõ trong ô</span>
            </p>
          )}
        </>
      )}

      <ConfirmDialog open={confirming} title="Chốt kết quả?" confirmLabel="Chốt kết quả" busy={finalizing} onCancel={() => ctrl.cancelFinalize()} onConfirm={() => void finalize()}>
        Điểm sẽ thành chính thức, bảng xếp hạng bỏ nhãn "Tạm tính" và không sửa điểm được nữa.
      </ConfirmDialog>
    </div>
  );
}
