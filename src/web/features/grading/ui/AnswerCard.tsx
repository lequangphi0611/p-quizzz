import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { GradingAnswer } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Kbd } from '../../../shared/ui/Kbd.js';
import { SaveIndicator } from '../../../shared/ui/SaveIndicator.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { formatPoints as F } from '../../../shared/format/points.js';
import { gradingErrorText } from '../application/grading-controller.js';
import { planCardSave } from '../domain/card-save.js';
import { isBlank } from '../domain/grading-ui.js';
import { flaggedLines, gradeSource, isFlagged, startsCollapsed } from '../domain/ai-ui.js';
import { AiCriteria, Pill, aig } from './ai-parts.js';

export interface AnswerCardActions {
  /** Saves a typed grade. `aiUse` = edited from the suggestion. Rejects with the server error. */
  save: (answerId: number, score: number, feedback: string, aiUse?: 'edited') => Promise<void>;
  accept: (answerId: number) => Promise<void>;
  undo: (answerId: number) => Promise<void>;
  retry: (answerId: number) => void;
  ack: (answerId: number, read: boolean) => void;
}

/** The answer, line by line; lines the AI flagged are highlighted (PRODUCT.md §7.28e). */
function AnswerLines({ text, flagged, collapsed }: { text: string; flagged: Set<number>; collapsed: boolean }) {
  return (
    <div style={{ maxHeight: collapsed ? 160 : undefined, overflow: 'hidden', display: 'grid', alignContent: 'start' }}>
      {text.split('\n').map((line, i) => {
        const f = flagged.has(i + 1);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', gap: 8, padding: '1px 0', background: f ? 'var(--warn-surface)' : undefined, boxShadow: f ? '0 0 0 1px var(--warn-border)' : undefined, borderRadius: 4 }}>
            <span aria-hidden="true" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', gap: 2, paddingTop: 2, font: '400 12px/1.6 var(--font-mono)', color: f ? 'var(--warn-600)' : 'var(--ink-400)', userSelect: 'none' }}>
              {f && <Icon name="shield-alert" size={11} />}{i + 1}
            </span>
            <span style={{ font: 'var(--type-code)', color: f ? 'var(--warn-600)' : 'var(--text-body)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minHeight: 22, fontWeight: f ? 500 : 400 }}>
              {f && <span style={aig.sr}>Dòng bị đánh dấu nghi ngờ: </span>}{line}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * One member's answer: the AI suggestion (never a score until confirmed) and the mentor's score box.
 * Typed grades save when focus leaves the card; "Dùng gợi ý" saves in one tap and offers "Hoàn tác" until the card is left.
 */
export function AnswerCard({ answer, index, points, showName, locked, pinned, acked, actions }: {
  answer: GradingAnswer; index: number; points: number; showName: boolean; locked: boolean; pinned: boolean; acked: boolean; actions: AnswerCardActions;
}) {
  const sug = answer.aiSuggestion;
  const graded = answer.manualScore !== null;
  const blank = isBlank(answer);
  const ok = sug?.status === 'done' && sug.score !== null ? sug : null;
  const flag = ok && isFlagged(answer) ? ok : null;

  const [score, setScore] = useState(graded ? F(answer.manualScore!) : '');
  const [feedback, setFeedback] = useState(answer.feedback ?? '');
  const [draft, setDraft] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [justAccepted, setJustAccepted] = useState(false);
  const [open, setOpen] = useState(locked);
  const [full, setFull] = useState(false);
  const scoreRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const hid = useId();

  // Follow the server (bulk "0 for blanks", undo, another tab) unless the mentor is editing.
  useEffect(() => {
    if (draft) return;
    setScore(answer.manualScore === null ? '' : F(answer.manualScore));
    setFeedback(answer.feedback ?? '');
  }, [answer.manualScore, answer.feedback, draft]);

  const canAccept = !!ok && !graded && !draft && !locked && (!flag || acked);
  const canEdit = !!ok && !graded && !draft && !locked;

  async function run(fn: () => Promise<void>) {
    setSaving(true);
    setError('');
    try { await fn(); } catch (err) { setError(gradingErrorText(err, 'Không lưu được điểm')); } finally { setSaving(false); }
  }

  async function save() {
    if (locked || saving) return;
    const plan = planCardSave(answer, score, feedback, points);
    if (plan.kind === 'nothing') { if (draft && score.trim() === '') setDraft(false); return; }
    if (plan.kind === 'invalid') { setError(plan.message); return; }
    if (plan.kind === 'restore') { setScore(plan.score); setError(plan.message); return; }
    const fromAi = draft || sug?.used != null;
    await run(async () => {
      await actions.save(answer.answerId, plan.score, feedback, fromAi ? 'edited' : undefined);
      setDraft(false);
      setJustAccepted(false);
    });
  }

  function accept() {
    if (!canAccept) return;
    // The button disappears once saved: keep focus on the card so leaving it later hides "Hoàn tác".
    void run(async () => { await actions.accept(answer.answerId); setJustAccepted(true); cardRef.current?.focus(); });
  }

  function edit() {
    if (!canEdit) return;
    setScore(F(ok!.score!));
    setFeedback(ok!.feedback ?? '');
    setDraft(true);
    setTimeout(() => scoreRef.current?.querySelector('input')?.select(), 0);
  }

  function undo() {
    void run(async () => { await actions.undo(answer.answerId); setJustAccepted(false); });
  }

  function onKey(e: KeyboardEvent) {
    const t = (e.target as HTMLElement).tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'd' && canAccept) { e.preventDefault(); accept(); }
    else if (k === 'e' && canEdit) { e.preventDefault(); edit(); }
    else if (k === 'r' && ok) { e.preventDefault(); setOpen(v => !v); }
  }

  const collapsed = startsCollapsed(answer) && !full;
  const lineCount = (answer.textAnswer ?? '').split('\n').length;
  const deviation = graded && ok ? answer.manualScore! - ok.score! : 0;
  const source = gradeSource(answer);
  const reasonsId = `${hid}-r`;

  let aiBlock = null;
  if (blank) aiBlock = <p style={{ ...aig.meta, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="info" size={14} />AI không chấm bài bỏ trống.</p>;
  else if (sug?.status === 'queued' && !graded) aiBlock = <p style={{ ...aig.meta, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="hourglass" size={14} />Đang chờ AI · chấm tay bài này thì AI sẽ bỏ qua</p>;
  else if (sug?.status === 'running' && !graded) aiBlock = <p style={{ ...aig.meta, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--ink-700)' }}><Icon name="loader-circle" size={14} spin />AI đang đọc bài này…</p>;
  else if (sug?.status === 'failed' && !graded)
    aiBlock = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--wrong-surface)', border: '1px solid var(--wrong-border)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--type-meta)', color: 'var(--wrong-600)', fontWeight: 600, flex: 1, minWidth: 0 }}><Icon name="circle-alert" size={15} />AI lỗi: {sug.error ?? 'Không rõ lý do'}</span>
        {!locked && <Button size="sm" variant="secondary" icon="rotate-ccw" onClick={() => actions.retry(answer.answerId)}>Thử lại</Button>}
      </div>
    );
  else if (ok && !graded)
    aiBlock = (
      <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 'var(--radius-md)', border: '1.5px dashed var(--ink-400)', background: 'var(--ink-050)', animation: 'pq-reveal var(--dur-slow) var(--ease-standard)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkles" size={15} color="var(--ink-700)" />
          <span style={{ ...aig.label, color: 'var(--ink-700)' }}>Gợi ý của AI</span>
          <span style={{ ...aig.meta, fontSize: 12 }}>· chưa phải điểm</span>
          <span style={{ marginLeft: 'auto', font: '700 18px/1 var(--font-mono)', color: 'var(--ink-800)' }}>{F(ok.score!)}<span style={{ fontSize: 13, color: 'var(--text-meta)', fontWeight: 500 }}>/{F(points)}</span></span>
        </div>
        {ok.feedback && (
          <div style={{ display: 'grid', gap: 3 }}>
            <span style={{ ...aig.meta, fontSize: 12 }}>Nhận xét gợi ý (học viên thấy nếu bạn dùng)</span>
            <p style={{ margin: 0, font: 'var(--type-ui)', fontSize: 14, fontWeight: 400, color: 'var(--text-body)', textWrap: 'pretty' }}>{ok.feedback}</p>
          </div>
        )}
        {ok.criteria.length > 0 && (
          <div style={{ borderTop: '1px solid var(--ink-200)', paddingTop: 8, display: 'grid', gap: 8 }}>
            <button type="button" aria-expanded={open} aria-controls={reasonsId} onClick={() => setOpen(v => !v)} style={{ ...aig.linkBtn, color: 'var(--ink-800)', justifyContent: 'flex-start' }}>
              <Icon name="chevron-down" size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-base) var(--ease-standard)' }} />Lý do theo tiêu chí
              <span style={{ ...aig.mono, fontWeight: 500, color: 'var(--text-meta)', marginLeft: 6 }}>{ok.criteria.map(c => F(c.score)).join(' + ')}</span>
              <span style={{ marginLeft: 'auto' }}><Kbd dim>R</Kbd></span>
            </button>
            {open && <div id={reasonsId} style={{ animation: 'pq-fade var(--dur-base) var(--ease-standard)' }}><AiCriteria criteria={ok.criteria} /></div>}
          </div>
        )}
        {!locked && draft && <p style={{ ...aig.meta, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--ink-700)' }}><Icon name="pencil" size={13} />Đã đưa vào ô bên dưới: chỉnh rồi lưu.</p>}
        {!locked && !draft && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size="sm" variant="secondary" icon={canAccept ? 'check' : 'lock'} shortcut="D" disabled={!canAccept} loading={saving} onClick={accept}>Dùng gợi ý</Button>
            <Button size="sm" variant="ghost" icon="pencil" shortcut="E" onClick={edit}>Sửa rồi lưu</Button>
          </div>
        )}
        {flag && !acked && !locked && !draft && <p style={{ ...aig.meta, display: 'flex', gap: 6, alignItems: 'flex-start', color: 'var(--warn-600)' }}><Icon name="lock" size={13} style={{ marginTop: 2 }} />Đánh dấu "Đã đọc toàn bộ bài" để dùng gợi ý.</p>}
      </div>
    );
  else if (ok && graded)
    aiBlock = (
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
          <Icon name="sparkles" size={13} />AI gợi ý <b style={{ ...aig.mono, color: 'var(--ink-700)' }}>{F(ok.score!)}</b>
          {deviation !== 0 && <span>· bạn chấm {deviation > 0 ? 'cao' : 'thấp'} hơn <span style={aig.mono}>{F(Math.abs(deviation))}</span></span>}
          {ok.criteria.length > 0 && <button type="button" aria-expanded={open} aria-controls={reasonsId} onClick={() => setOpen(v => !v)} style={{ ...aig.linkBtn, fontWeight: 500, marginLeft: 4 }}>{open ? 'Ẩn lý do' : 'Xem lý do'}</button>}
        </div>
        {open && ok.criteria.length > 0 && <div id={reasonsId} style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--ink-050)', border: '1px dashed var(--ink-300)' }}><AiCriteria criteria={ok.criteria} compact /></div>}
      </div>
    );

  const saveState = saving ? 'saving' : draft ? 'unsaved' : graded ? 'saved' : null;

  return (
    <article
      ref={cardRef} tabIndex={-1} data-grading-card={answer.answerId} aria-labelledby={hid} onKeyDown={onKey}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { setJustAccepted(false); void save(); } }}
      style={{ background: 'var(--paper)', border: flag && !graded ? '2px solid var(--warn-600)' : '1px solid ' + (graded ? 'var(--correct-border)' : 'var(--border-hairline)'), borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', minWidth: 0 }}
    >
      {flag && (
        <div role="note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 20px', background: 'var(--warn-surface)', borderBottom: '1px solid var(--warn-border)', color: 'var(--warn-600)', font: 'var(--type-meta)' }}>
          <Icon name="shield-alert" size={18} style={{ marginTop: 1, flex: 'none' }} />
          <span style={{ minWidth: 0 }}><b>Nghi ngờ{graded ? ' · đã chấm sau khi đọc bài' : ''}.</b> {flag.suspiciousReason}</span>
          {pinned && <span style={{ marginLeft: 'auto', flex: 'none', ...aig.label, color: 'var(--warn-600)' }}>Ghim lên đầu</span>}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: 20 }}>
        <div style={{ flex: '1 1 420px', display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 id={hid} style={{ margin: 0, font: '700 16px/1.3 var(--font-sans)', color: 'var(--text-title)' }}>
              Bài <span style={aig.mono}>#{index + 1}</span>{showName && <span style={{ fontWeight: 500, color: 'var(--text-meta)' }}> · {answer.displayName}</span>}
            </h3>
            {graded ? <Pill kind="graded" icon="circle-check">Đã chấm · {F(answer.manualScore!)}/{F(points)}</Pill> : <Pill kind="todo" icon="hourglass">Chưa chấm</Pill>}
            {ok && !graded && <Pill kind="ai" icon="sparkles">AI gợi ý {F(ok.score!)}/{F(points)}</Pill>}
            {flag && !graded && <Pill kind="flag" icon="shield-alert">Nghi ngờ</Pill>}
            {sug?.status === 'failed' && !graded && <Pill kind="err" icon="circle-alert">AI lỗi</Pill>}
          </div>
          {blank ? (
            <p style={{ margin: 0, padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', font: 'var(--type-code)', fontStyle: 'italic', color: 'var(--text-meta)' }}>(Bỏ trống)</p>
          ) : (
            <div style={{ padding: '10px 14px 10px 6px', borderRadius: 'var(--radius-md)', background: 'var(--ink-050)', border: '1px solid var(--ink-200)', display: 'grid', gap: 6 }}>
              <AnswerLines text={answer.textAnswer!} flagged={flaggedLines(answer)} collapsed={collapsed} />
              {startsCollapsed(answer) && (
                <button type="button" aria-expanded={full} onClick={() => setFull(v => !v)} style={{ ...aig.linkBtn, marginLeft: 36, justifySelf: 'start' }}>
                  <Icon name="chevron-down" size={14} style={{ transform: full ? 'rotate(180deg)' : 'none' }} />{full ? 'Thu gọn bài' : `Xem toàn bộ bài · ${lineCount} dòng`}
                </button>
              )}
            </div>
          )}
          {flag && !graded && !locked && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid ' + (acked ? 'var(--ink-300)' : 'var(--warn-border)'), background: acked ? 'var(--paper)' : 'var(--warn-surface)', font: 'var(--type-ui)', fontSize: 14, color: 'var(--text-title)', cursor: 'pointer', justifySelf: 'start' }}>
              <input type="checkbox" checked={acked} onChange={e => actions.ack(answer.answerId, e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand-600)', margin: 0 }} />
              Đã đọc toàn bộ bài, câu nhắm vào người chấm không tính điểm
            </label>
          )}
        </div>

        <div style={{ flex: '1 1 300px', maxWidth: 400, display: 'grid', gap: 14, alignContent: 'start', minWidth: 0 }}>
          {aiBlock}
          <div style={{ display: 'grid', gap: 10, padding: draft ? 12 : 0, margin: draft ? -12 : 0, borderRadius: 'var(--radius-md)', background: draft ? 'var(--brand-050)' : undefined, transition: 'background var(--dur-base) var(--ease-standard)' }}>
            {ok && !graded && !locked && !draft && <span style={{ ...aig.label, fontSize: 11 }}>Hoặc chấm tay</span>}
            {draft && <span style={{ ...aig.label, fontSize: 11, color: 'var(--brand-700)' }}>Đang sửa từ gợi ý · chưa lưu</span>}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <div ref={scoreRef} style={{ width: 96 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void save(); } }}>
                <TextField label="Điểm" mono value={score} placeholder="—" disabled={locked} inputMode="text" onChange={v => { setScore(v); setError(''); }} />
              </div>
              <span style={{ font: '500 15px/40px var(--font-mono)', color: 'var(--text-meta)' }}>/ {F(points)}</span>
              <span style={{ marginLeft: 'auto', paddingBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                {justAccepted && !locked && <button type="button" onClick={undo} style={aig.linkBtn}><Icon name="rotate-ccw" size={13} />Hoàn tác</button>}
                {!locked && !draft && saveState && <SaveIndicator state={saveState} />}
                {!locked && draft && <Button size="sm" icon="save" shortcut="Enter" loading={saving} onClick={() => void save()}>Lưu điểm</Button>}
                {locked && <span style={{ ...aig.meta, display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon name="lock" size={13} />Đã chốt</span>}
              </span>
            </div>
            <TextField label="Nhận xét (tuỳ chọn)" multiline rows={2} value={feedback} disabled={locked} placeholder="Học viên sẽ thấy nhận xét này" onChange={v => { setFeedback(v); setError(''); }} />
            {source && <span style={{ ...aig.meta, fontSize: 12, display: 'inline-flex', gap: 5, alignItems: 'center' }}><Icon name="sparkles" size={12} />{source === 'ai' ? 'Điểm và nhận xét lấy từ gợi ý AI' : 'Sửa từ gợi ý AI'} · chỉ bạn thấy dòng này</span>}
          </div>
          {error && <ErrorMessage message={error} />}
        </div>
      </div>
    </article>
  );
}
