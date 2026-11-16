import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { DiscussionAnswer, DiscussionQuestion, DiscussionView, GradeResponse } from '../../shared/api/index.js';
import { Markdown } from '../components/Markdown.js';
import { QuestionNav } from '../components/QuestionNav.js';
import { SaveIndicator } from '../components/SaveIndicator.js';
import { EssayCard } from '../components/screen/EssayCard.js';
import { OptionTally } from '../components/screen/OptionTally.js';
import { ScoreField } from '../components/screen/ScoreField.js';
import { ScreenStage } from '../components/screen/ScreenStage.js';
import { Button } from '../components/ui/Button.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { Icon } from '../components/ui/Icon.js';
import { Spinner } from '../components/ui/Spinner.js';
import { TextField } from '../components/ui/TextField.js';
import { ScreenLayout } from '../layouts/ScreenLayout.js';
import { api, ApiError } from '../lib/api.js';
import { commonMistakeId, nextUngraded, optionLetter, percent, questionIndexFromSearch, questionProgress, splitPapers } from '../lib/discussion-ui.js';
import { formatScore, parseScore } from '../lib/grading-ui.js';

// "/admin/sessions/:id/discuss" — S17. Shown on the projector from the mentor's laptop after the session closes:
// one question at a time, class tallies, answer hidden until the mentor reveals it, anonymous essays graded together.
// No names anywhere: the API sends none, and nothing here asks for them.

type SaveState = 'saved' | 'saving' | 'error' | 'unsaved';
interface Draft { value: string; feedback: string; save: SaveState; error?: string }
const TYPE_LABEL = { single: 'Một đáp án', multi: 'Nhiều đáp án', essay: 'Tự luận' } as const;

const st = {
  meta: { font: '600 22px/1.2 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--screen-meta)', display: 'flex', gap: 14, alignItems: 'center' },
  prompt: { margin: 0, font: '700 var(--fs-screen-question)/1.25 var(--font-sans)', color: 'var(--screen-text)', textWrap: 'pretty', letterSpacing: '-0.01em', overflowWrap: 'anywhere' },
  panel: { background: 'var(--screen-panel)', border: '2px solid var(--screen-line)', borderRadius: 'var(--radius-lg)', padding: '22px 26px' },
  hiddenPanel: { border: '2px dashed var(--screen-line-strong)', borderRadius: 'var(--radius-lg)', padding: '22px 26px', display: 'grid', gap: 18, alignContent: 'start' },
  panelLabel: { font: '700 22px/1.2 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--screen-meta)', display: 'flex', alignItems: 'center', gap: 10 },
  big: { font: '700 var(--fs-screen-stat)/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums' },
  body28: { font: '500 28px/1.35 var(--font-sans)', color: 'var(--screen-text)' },
  reveal: { animation: 'pq-reveal var(--dur-slow) var(--ease-standard)' },
  kbd: { display: 'inline-block', minWidth: 30, textAlign: 'center', font: '600 18px/1 var(--font-mono)', padding: '6px 8px', borderRadius: 'var(--radius-xs)', background: 'var(--screen-panel)', border: '1.5px solid var(--screen-line-strong)', borderBottomWidth: 3, color: '#fff' },
  mono: { fontFamily: 'var(--font-mono)' },
} satisfies Record<string, CSSProperties>;

function QHeader({ q, index }: { q: DiscussionQuestion; index: number }) {
  return <div style={st.meta}><span style={{ color: 'var(--sun-400)' }}>Câu {index + 1}</span><span>·</span><span>{TYPE_LABEL[q.type]}</span><span>·</span><span>{formatScore(q.points)} điểm</span></div>;
}

function RevealButton({ revealed, onToggle, size = 'xxl' }: { revealed: boolean; onToggle: () => void; size?: 'xl' | 'xxl' }) {
  return revealed
    ? <Button tone="screen" variant="secondary" size={size} icon="eye-off" shortcut="Space" onClick={onToggle}>Ẩn đáp án</Button>
    : <Button tone="screen" variant="primary" size={size} icon="eye" shortcut="Space" onClick={onToggle}>Hiện đáp án</Button>;
}

function ChoiceView({ q, index, submitted, revealed, onToggle }: { q: DiscussionQuestion; index: number; submitted: number; revealed: boolean; onToggle: () => void }) {
  const flagged = commonMistakeId(q, submitted);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,800px) minmax(0,1fr)', gap: 64, height: '100%', minHeight: 0 }}>
      <div className="pq-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 28, minHeight: 0, overflow: 'auto' }}>
        <QHeader q={q} index={index} />
        <h1 style={st.prompt}><Markdown inlineOnly size="screen" source={q.prompt} /></h1>
        {q.body && <Markdown size="screen" source={q.body} />}
        {revealed
          ? <div key="exp" style={{ ...st.panel, ...st.reveal, display: 'grid', gap: 12 }}><div style={st.panelLabel}><Icon name="info" size={24} />Giải thích</div>{q.explanation ? <Markdown size="screen" source={q.explanation} /> : <span style={{ ...st.body28, color: 'var(--screen-meta)' }}>Đề không có giải thích cho câu này.</span>}</div>
          : <div key="hid" style={{ ...st.hiddenPanel, gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 14, color: 'var(--screen-meta)', font: '500 26px/1.3 var(--font-sans)' }}><Icon name="eye-off" size={28} />Đáp án và giải thích đang ẩn</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
        <div role="list" aria-label="Lựa chọn của cả lớp" className="pq-scroll" style={{ display: 'grid', gap: 12, overflow: 'auto', minHeight: 0 }}>
          {q.options.map((o, i) => <OptionTally key={o.id} kind={q.type === 'multi' ? 'multi' : 'single'} letter={optionLetter(i)} text={o.text} count={o.count} total={submitted} revealed={revealed} correct={o.isCorrect} flag={flagged === o.id ? 'common' : undefined} />)}
        </div>
        {q.type === 'multi' && (
          <div key={revealed ? 'r' : 'h'} style={{ display: 'flex', alignItems: 'center', gap: 12, font: '500 26px/1.3 var(--font-sans)', color: revealed ? 'var(--screen-text)' : 'var(--screen-meta)', ...(revealed ? st.reveal : null) }}>
            <Icon name={revealed ? 'list-checks' : 'info'} size={28} style={{ color: revealed ? 'var(--sun-400)' : undefined }} />
            {revealed ? 'Phải chọn đúng đủ các đáp án mới có điểm' : 'Mỗi bài có thể chọn nhiều phương án — tỉ lệ tính riêng từng phương án'}
          </div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, paddingTop: 20, borderTop: '2px solid var(--screen-line)' }}>
          <div key={revealed ? 'r' : 'h'} aria-live="polite" style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', ...st.body28 }}>
            {revealed
              ? <><span style={{ ...st.big, color: 'var(--screen-correct)' }}>{q.correctCount}<span style={{ fontSize: 36, color: 'var(--screen-meta)' }}>/{submitted}</span></span><span>làm đúng <b style={st.mono}>({percent(q.correctCount, submitted)}%)</b>{q.type === 'multi' ? ' trọn bộ' : ''}</span><span style={{ color: 'var(--screen-meta)' }}>· <span style={st.mono}>{q.blankCount}</span> bỏ trống</span></>
              : <><span style={st.big}>{submitted}</span><span>bài</span><span style={{ color: 'var(--screen-meta)' }}>· <span style={st.mono}>{q.blankCount}</span> bỏ trống</span></>}
          </div>
          <RevealButton revealed={revealed} onToggle={onToggle} />
        </div>
      </div>
    </div>
  );
}

// The exam format keeps "model answer + rubric" as one Markdown block (docs/exam-format.md), so it is shown as one panel.
function RubricPanel({ q, revealed, onToggle }: { q: DiscussionQuestion; revealed: boolean; onToggle: () => void }) {
  if (!revealed) {
    return (
      <div style={st.hiddenPanel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--screen-meta)', font: '500 26px/1.3 var(--font-sans)' }}><Icon name="eye-off" size={28} />Đáp án mẫu &amp; rubric đang ẩn</div>
        <div><RevealButton revealed={false} onToggle={onToggle} size="xl" /></div>
      </div>
    );
  }
  return (
    <div style={{ ...st.panel, ...st.reveal, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={st.panelLabel}><Icon name="list-checks" size={24} />Đáp án mẫu &amp; rubric</span>
        <Button tone="screen" variant="ghost" size="xl" icon="eye-off" ariaLabel="Ẩn đáp án (Space)" onClick={onToggle} style={{ marginLeft: 'auto' }} />
      </div>
      <div className="pq-scroll" style={{ overflow: 'auto', minHeight: 0 }}>
        {q.explanation ? <Markdown size="screen" source={q.explanation} /> : <span style={{ ...st.body28, color: 'var(--screen-meta)' }}>Đề không có đáp án mẫu cho câu này.</span>}
      </div>
    </div>
  );
}

function EssayList({ q, index, revealed, onToggle, papers, blanks, lastOpened, locked, zeroing, onOpen, onZeroBlanks }: {
  q: DiscussionQuestion; index: number; revealed: boolean; onToggle: () => void; papers: DiscussionAnswer[]; blanks: DiscussionAnswer[]; lastOpened: number | null; locked: boolean; zeroing: boolean;
  onOpen: (i: number) => void; onZeroBlanks: () => void;
}) {
  // Progress counts blanks too (they need a score before finalizing), matching the question nav and the header.
  const all = [...papers, ...blanks];
  const graded = all.filter(p => p.manualScore !== null).length;
  const done = graded === all.length;
  const blanksUngraded = blanks.filter(b => b.manualScore === null).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,720px)', gap: 48, alignItems: 'start', maxHeight: '48%', minHeight: 0 }}>
        <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
          <QHeader q={q} index={index} />
          <h1 style={st.prompt}><Markdown inlineOnly size="screen" source={q.prompt} /></h1>
          {q.body && <Markdown size="screen" source={q.body} />}
          {all.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...st.body28, color: done ? 'var(--screen-correct)' : 'var(--screen-text)' }}>
              <Icon name={done ? 'circle-check' : 'pencil'} size={28} style={{ color: done ? undefined : 'var(--sun-400)' }} />Đã chấm <b style={st.mono}>{graded}/{all.length}</b>
              {!locked && !done && <span style={{ color: 'var(--screen-meta)', fontSize: 24 }}>· mở một bài để chấm</span>}
            </div>
          )}
        </div>
        <RubricPanel q={q} revealed={revealed} onToggle={onToggle} />
      </div>
      <div role="list" aria-label="Bài tự luận ẩn danh" className="pq-scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 16, overflow: 'auto', minHeight: 0, padding: 8, margin: -8, alignContent: 'start' }}>
        {papers.map((p, i) => (
          <div role="listitem" key={p.answerId} style={{ display: 'grid' }}>
            <EssayCard number={i + 1} excerpt={p.textAnswer ?? ''} status={p.manualScore !== null ? 'graded' : 'ungraded'} score={p.manualScore} maxScore={q.points} current={lastOpened === i} onClick={() => onOpen(i)} />
          </div>
        ))}
        {blanks.length > 0 && (
          <div role="listitem" style={{ ...st.hiddenPanel, padding: '18px 22px', gap: 12 }}>
            <span style={{ font: '700 30px/1 var(--font-sans)' }}><span style={st.mono}>{blanks.length}</span> bài bỏ trống</span>
            {blanksUngraded === 0
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 22px/1.3 var(--font-sans)', color: 'var(--screen-correct)', ...st.reveal }}><Icon name="circle-check" size={22} />Đã chấm</span>
              : <span style={{ font: '400 22px/1.3 var(--font-sans)', color: 'var(--screen-meta)' }}>Không có nội dung</span>}
            {blanksUngraded > 0 && !locked && <Button tone="screen" variant="secondary" size="xl" loading={zeroing} onClick={onZeroBlanks} style={{ alignSelf: 'end' }}>Chấm 0 cho {blanksUngraded} bài</Button>}
          </div>
        )}
        {papers.length === 0 && blanks.length === 0 && <span style={{ ...st.body28, color: 'var(--screen-meta)' }}>Không có bài nào cho câu này.</span>}
      </div>
    </div>
  );
}

function PaperView({ q, index, revealed, onToggle, papers, paperIdx, draft, locked, onScore, onFeedback, onCommitScore, onCommitFeedback, onNav, onBack }: {
  q: DiscussionQuestion; index: number; revealed: boolean; onToggle: () => void; papers: DiscussionAnswer[]; paperIdx: number; draft: Draft; locked: boolean;
  onScore: (v: string) => void; onFeedback: (v: string) => void; onCommitScore: (v: string, enter: boolean) => void; onCommitFeedback: () => void; onNav: (d: number) => void; onBack: () => void;
}) {
  const p = papers[paperIdx]!;
  const graded = p.manualScore !== null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,680px)', gap: 40, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Button tone="screen" variant="ghost" size="xl" icon="arrow-left" onClick={onBack}>Danh sách bài</Button>
          <span style={{ font: '800 44px/1 var(--font-sans)', letterSpacing: '-0.01em' }}>Bài <span style={st.mono}>#{paperIdx + 1}</span></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-pill)', font: '600 22px/1 var(--font-sans)', border: '2px solid ' + (graded ? 'var(--screen-correct-border)' : 'var(--sun-500)'), background: graded ? 'var(--screen-correct-surface)' : 'var(--screen-pending-surface)', color: graded ? 'var(--screen-correct)' : 'var(--sun-400)' }}>
            <Icon name={graded ? 'circle-check' : 'hourglass'} size={22} />{graded ? <>Đã chấm <b style={st.mono}>{formatScore(p.manualScore!)}/{formatScore(q.points)}</b></> : 'Chưa chấm'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', font: '600 28px/1.35 var(--font-sans)', color: 'var(--screen-meta)' }}>
          <span style={{ color: 'var(--sun-400)', flex: 'none' }}>Câu {index + 1}</span>
          <span style={{ color: '#DDE1E7', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Markdown inlineOnly size="screen" source={q.prompt} /></span>
        </div>
        <div tabIndex={0} aria-label={`Nội dung bài #${paperIdx + 1}`} className="pq-scroll" style={{ ...st.panel, flex: 1, minHeight: 0, overflow: 'auto', padding: '26px 32px', font: '400 28px/1.6 var(--font-mono)', color: '#fff', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.textAnswer}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <Button tone="screen" variant="secondary" size="xl" icon="chevron-left" shortcut="K" disabled={paperIdx === 0} onClick={() => onNav(-1)}>Bài trước</Button>
          <span style={{ font: '700 30px/1 var(--font-mono)', minWidth: 200, textAlign: 'center' }}>Bài #{paperIdx + 1} <span style={{ color: 'var(--screen-meta)' }}>/ {papers.length}</span></span>
          <Button tone="screen" variant="secondary" size="xl" iconRight="chevron-right" shortcut="J" disabled={paperIdx === papers.length - 1} onClick={() => onNav(1)}>Bài sau</Button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
        <RubricPanel q={q} revealed={revealed} onToggle={onToggle} />
        <div style={{ ...st.panel, marginTop: 'auto', display: 'grid', gap: 18, flex: 'none' }}>
          <ScoreField value={draft.value} max={q.points} error={draft.error} locked={locked} onChange={onScore} onCommit={onCommitScore} />
          {locked
            ? (p.feedback ? <div style={{ display: 'grid', gap: 8 }}><span style={{ font: 'var(--type-label)', fontSize: 22, color: 'var(--screen-meta)' }}>Nhận xét</span><span style={st.body28}>{p.feedback}</span></div> : null)
            : <div onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') onCommitFeedback(); }}><TextField size="screen" label="Nhận xét (tuỳ chọn)" placeholder="Ghi chú ngắn cho bài này" maxLength={2000} value={draft.feedback} onChange={onFeedback} onBlur={onCommitFeedback} /></div>}
          {!locked && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <SaveIndicator size="screen" state={draft.save} onRetry={() => onCommitScore(draft.value, false)} />
              <span style={{ font: '400 20px/1.2 var(--font-sans)', color: 'var(--screen-meta)' }}><kbd style={st.kbd}>Enter</kbd> lưu &amp; sang bài chưa chấm</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StateView({ kind, onRetry, onExit, message }: { kind: 'loading' | 'empty' | 'error'; onRetry: () => void; onExit: () => void; message?: string }) {
  const wrap = { height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center' } as const;
  if (kind === 'loading') return <div style={wrap}><div style={{ display: 'grid', gap: 28, justifyItems: 'center' }}><Spinner size={72} /><span style={{ font: '600 32px/1.3 var(--font-sans)', color: 'var(--screen-text)' }}>Đang tải bài làm…</span></div></div>;
  if (kind === 'empty') {
    return (
      <div style={wrap}><div style={{ display: 'grid', gap: 24, justifyItems: 'center', maxWidth: 1000 }}>
        <span style={{ width: 128, height: 128, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--screen-panel)', border: '2px solid var(--screen-line)', color: 'var(--screen-meta)' }}><Icon name="file-text" size={60} /></span>
        <h1 style={{ ...st.prompt, fontSize: 48 }}>Phiên này không có bài nào để thảo luận</h1>
        <p style={{ margin: 0, font: '400 28px/1.45 var(--font-sans)', color: 'var(--screen-meta)' }}>Không học viên nào nộp bài trước khi phiên đóng.</p>
        <Button tone="screen" variant="secondary" size="xl" icon="arrow-left" onClick={onExit}>Về trang phiên</Button>
      </div></div>
    );
  }
  return (
    <div style={wrap}><div style={{ display: 'grid', gap: 24, justifyItems: 'center', width: 920 }}>
      <span style={{ width: 128, height: 128, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--screen-wrong-surface)', border: '2px solid var(--screen-wrong-border)', color: 'var(--screen-wrong)' }}><Icon name="cloud-off" size={60} /></span>
      <h1 style={{ ...st.prompt, fontSize: 48 }}>Không tải được dữ liệu thảo luận</h1>
      <div style={{ width: '100%', textAlign: 'left' }}><ErrorMessage size="screen" title={message ?? 'Mất kết nối tới máy chủ p-quizzz'} message="Kiểm tra máy mentor vẫn đang chạy app, rồi thử lại." /></div>
      <div style={{ display: 'flex', gap: 16 }}>
        <Button tone="screen" variant="ghost" size="xxl" icon="arrow-left" onClick={onExit}>Về trang phiên</Button>
        <Button tone="screen" size="xxl" icon="refresh-cw" onClick={onRetry}>Thử lại</Button>
      </div>
    </div></div>
  );
}

const draftOf = (a: DiscussionAnswer): Draft => ({ value: a.manualScore === null ? '' : formatScore(a.manualScore), feedback: a.feedback ?? '', save: a.manualScore === null ? 'unsaved' : 'saved' });

export function DiscussionPage() {
  const { id } = useParams();
  const sessionId = Number(id);
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [view, setView] = useState<DiscussionView | null>(null);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string>();
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [mode, setMode] = useState<'list' | 'paper'>('list');
  const [paperIdx, setPaperIdx] = useState(0);
  const [lastOpened, setLastOpened] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [dialog, setDialog] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string>();
  const [zeroing, setZeroing] = useState(false);
  const [fs, setFs] = useState(false);

  const fetchView = useCallback(async () => {
    setLoad('loading');
    try {
      setView(await api.get<DiscussionView>(`/api/admin/sessions/${sessionId}/discussion`));
      setLoad('ready');
    } catch (err) {
      setLoadError(err instanceof ApiError && err.status !== 0 ? err.message : undefined);
      setLoad('error');
    }
  }, [sessionId]);
  useEffect(() => { void fetchView(); }, [fetchView]);

  const qs = view?.questions ?? [];
  const qi = questionIndexFromSearch(search.toString(), qs.length);
  const q = qs[qi];
  const { papers, blanks } = useMemo(() => (q && q.type === 'essay' ? splitPapers(q) : { papers: [], blanks: [] }), [q]);
  const locked = view?.status === 'finalized';
  const remaining = view ? view.total - view.graded : 0;
  const isRevealed = q ? revealed.has(q.id) : false;
  const exit = useCallback(() => { if (document.fullscreenElement) void document.exitFullscreen(); navigate(`/admin/sessions/${sessionId}`); }, [navigate, sessionId]);

  const goQ = useCallback((i: number) => {
    if (qs.length === 0) return;
    const n = Math.max(0, Math.min(qs.length - 1, i));
    setSearch({ q: String(n + 1) }, { replace: true });
    setMode('list'); setLastOpened(null);
  }, [qs.length, setSearch]);
  const toggle = useCallback(() => { if (!q) return; setRevealed(s => { const r = new Set(s); if (r.has(q.id)) r.delete(q.id); else r.add(q.id); return r; }); }, [q]);
  const openPaper = useCallback((i: number) => { setMode('paper'); setPaperIdx(i); setLastOpened(i); }, []);

  // Apply a saved grade to the local view (the server's answer is the truth; progress comes from the server too).
  const applyGrade = useCallback((r: GradeResponse) => {
    setView(v => v && {
      ...v, graded: r.graded, total: r.total,
      questions: v.questions.map(x => ({ ...x, answers: x.answers.map(a => (a.answerId === r.answer.answerId ? { ...a, manualScore: r.answer.manualScore, feedback: r.answer.feedback } : a)) })),
    });
  }, []);

  const draftFor = (a: DiscussionAnswer): Draft => drafts[a.answerId] ?? draftOf(a);
  const patchDraft = (answerId: number, base: Draft, patch: Partial<Draft>) => setDrafts(d => ({ ...d, [answerId]: { ...(d[answerId] ?? base), ...patch } }));

  // Save one paper. Returns true when the server has this score (already or now).
  async function save(a: DiscussionAnswer, value: string, feedback: string): Promise<boolean> {
    const base = draftFor(a);
    if (value.trim() === '') { patchDraft(a.answerId, base, { value, feedback, error: undefined, save: a.manualScore === null ? 'unsaved' : base.save }); return false; }
    const check = parseScore(value, q!.points);
    if (!check.ok) { patchDraft(a.answerId, base, { value, feedback, error: check.message, save: 'unsaved' }); return false; }
    if (check.value === a.manualScore && (feedback.trim() || null) === (a.feedback ?? null)) { patchDraft(a.answerId, base, { value: formatScore(check.value), feedback, error: undefined, save: 'saved' }); return true; }
    patchDraft(a.answerId, base, { value, feedback, error: undefined, save: 'saving' });
    try {
      applyGrade(await api.put<GradeResponse>(`/api/admin/answers/${a.answerId}/grade`, { score: check.value, feedback }));
      patchDraft(a.answerId, base, { value: formatScore(check.value), save: 'saved' });
      return true;
    } catch (err) {
      patchDraft(a.answerId, base, { save: 'error', error: err instanceof ApiError ? err.message : 'Không lưu được' });
      return false;
    }
  }

  async function commitScore(value: string, enter: boolean) {
    const a = papers[paperIdx];
    if (!a || locked) return;
    const ok = await save(a, value, draftFor(a).feedback);
    if (ok && enter) {
      const graded = papers.map((p, i) => (i === paperIdx ? { manualScore: 0 } : p));
      const n = nextUngraded(graded, paperIdx);
      if (n !== null) openPaper(n);
    }
  }
  async function commitFeedback() {
    const a = papers[paperIdx];
    if (!a || locked) return;
    const d = draftFor(a);
    if (d.value.trim() === '') { if ((d.feedback.trim() || null) !== (a.feedback ?? null)) patchDraft(a.answerId, d, { save: 'unsaved' }); return; } // needs a score first
    await save(a, d.value, d.feedback);
  }

  async function zeroBlanks() {
    setZeroing(true);
    try {
      for (const b of blanks.filter(x => x.manualScore === null)) applyGrade(await api.put<GradeResponse>(`/api/admin/answers/${b.answerId}/grade`, { score: 0 }));
    } catch { void fetchView(); } finally { setZeroing(false); }
  }

  async function finalize() {
    setFinalizing(true); setFinalizeError(undefined);
    try {
      await api.post(`/api/admin/sessions/${sessionId}/finalize`);
      setDialog(false);
      setView(v => v && { ...v, status: 'finalized' });
    } catch (err) {
      setFinalizeError(err instanceof ApiError ? err.message : 'Không chốt được');
    } finally { setFinalizing(false); }
  }

  const toggleFs = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.().catch(() => {}); };
  useEffect(() => { const h = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h); }, []);

  // Keyboard: ← → question · Space answer · J K paper · Esc back to the list (the browser uses Esc to leave fullscreen).
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = e => {
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.altKey || e.ctrlKey || e.metaKey) return;
    if (dialog) { if (e.key === 'Escape' && !finalizing) setDialog(false); return; }
    if (load !== 'ready' || !q) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowright') { e.preventDefault(); goQ(qi + 1); }
    else if (k === 'arrowleft') { e.preventDefault(); goQ(qi - 1); }
    else if (k === ' ') { e.preventDefault(); toggle(); }
    else if ((k === 'j' || k === 'k') && q.type === 'essay' && papers.length > 0) {
      if (mode === 'list') openPaper(k === 'j' ? (nextUngraded(papers, -1) ?? 0) : papers.length - 1);
      else { const i = Math.max(0, Math.min(papers.length - 1, paperIdx + (k === 'j' ? 1 : -1))); openPaper(i); }
    } else if (k === 'escape' && mode === 'paper' && !document.fullscreenElement) setMode('list');
  };
  useEffect(() => { const h = (e: KeyboardEvent) => keyRef.current(e); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);

  const empty = load === 'ready' && view !== null && (view.submitted === 0 || qs.length === 0);
  const ready = load === 'ready' && !empty && !!q;

  const meta: ReactNode = ready && view && view.total > 0 && (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, font: '500 22px/1 var(--font-sans)', color: remaining === 0 ? 'var(--screen-correct)' : 'var(--screen-meta)', whiteSpace: 'nowrap' }}>
      <Icon name={remaining === 0 ? 'circle-check' : 'pencil'} size={22} />Đã chấm <b style={{ font: '700 24px/1 var(--font-mono)', color: remaining === 0 ? undefined : '#fff' }}>{view.graded}/{view.total}</b>
    </span>
  );
  const actions = (
    <>
      <Button tone="screen" variant="ghost" size="xl" icon="maximize" onClick={toggleFs}>{fs ? 'Thu nhỏ' : 'Toàn màn hình'}</Button>
      {ready && !locked && <Button tone="screen" variant="secondary" size="xl" icon="flag" onClick={() => { setFinalizeError(undefined); setDialog(true); }}>Chốt kết quả</Button>}
      <Button tone="screen" variant="ghost" size="xl" icon="log-out" onClick={exit}>Thoát</Button>
    </>
  );
  const navMeta = qs.map(x => { if (x.type !== 'essay' || x.answers.length === 0) return null; const p = questionProgress(x); return `${p.graded}/${p.total}`; });
  const navDone = qs.flatMap((x, i) => { if (x.type !== 'essay' || x.answers.length === 0) return []; const p = questionProgress(x); return p.graded === p.total ? [i] : []; });

  let content: ReactNode;
  if (load !== 'ready') content = <StateView kind={load === 'loading' ? 'loading' : 'error'} message={loadError} onRetry={() => void fetchView()} onExit={exit} />;
  else if (!ready) content = <StateView kind="empty" onRetry={() => void fetchView()} onExit={exit} />;
  else if (q!.type !== 'essay') content = <ChoiceView q={q!} index={qi} submitted={view!.submitted} revealed={isRevealed} onToggle={toggle} />;
  else if (mode === 'list' || !papers[paperIdx]) content = <EssayList q={q!} index={qi} revealed={isRevealed} onToggle={toggle} papers={papers} blanks={blanks} lastOpened={lastOpened} locked={locked} zeroing={zeroing} onOpen={openPaper} onZeroBlanks={() => void zeroBlanks()} />;
  else {
    const a = papers[paperIdx]!;
    const d = draftFor(a);
    content = (
      <PaperView q={q!} index={qi} revealed={isRevealed} onToggle={toggle} papers={papers} paperIdx={paperIdx} draft={d} locked={locked}
        onScore={v => patchDraft(a.answerId, d, { value: v, error: undefined, save: 'unsaved' })}
        onFeedback={v => patchDraft(a.answerId, d, { feedback: v, save: 'unsaved' })}
        onCommitScore={(v, enter) => void commitScore(v, enter)} onCommitFeedback={() => void commitFeedback()}
        onNav={dlt => openPaper(Math.max(0, Math.min(papers.length - 1, paperIdx + dlt)))} onBack={() => setMode('list')} />
    );
  }

  const hints: [string, string][] = [['← →', 'câu'], ['Space', 'đáp án'], ...(q?.type === 'essay' ? [['J K', 'bài'] as [string, string]] : []), ['Esc', 'thoát toàn màn hình']];
  return (
    <ScreenStage>
      <ScreenLayout density="compact" examTitle={view?.examTitle} status={view ? view.status : undefined} meta={meta} actions={actions}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {ready && (
            <div style={{ flex: 'none', height: 112, padding: '0 40px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '2px solid var(--screen-line)' }}>
              <Button tone="screen" variant="secondary" size="xl" icon="chevron-left" ariaLabel="Câu trước (←)" disabled={qi === 0} onClick={() => goQ(qi - 1)} />
              <div className="pq-scroll" style={{ minWidth: 0, overflowX: 'auto', padding: '4px 2px' }}>
                <QuestionNav size="screen" count={qs.length} current={qi} meta={navMeta} answered={navDone} onSelect={goQ} />
              </div>
              <Button tone="screen" variant="secondary" size="xl" icon="chevron-right" ariaLabel="Câu sau (→)" disabled={qi === qs.length - 1} onClick={() => goQ(qi + 1)} />
              {locked && <span style={{ marginLeft: 'auto', flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 'var(--radius-pill)', border: '2px solid var(--brand-200)', color: 'var(--brand-200)', font: '600 22px/1 var(--font-sans)' }}><Icon name="lock" size={22} />Đã chốt — chỉ xem</span>}
            </div>
          )}
          <div key={`${load}-${qi}-${mode}`} style={{ flex: 1, minHeight: 0, padding: '32px 40px 76px', animation: 'pq-fade var(--dur-base) var(--ease-standard)' }}>{content}</div>
          {ready && (
            <div aria-hidden="true" style={{ position: 'absolute', right: 40, bottom: 20, display: 'flex', gap: 22, alignItems: 'center', font: '400 20px/1 var(--font-sans)', color: 'var(--screen-meta)' }}>
              {hints.map(([keys, text]) => <span key={keys} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{keys.split(' ').map(x => <kbd key={x} style={st.kbd}>{x}</kbd>)}{text}</span>)}
            </div>
          )}
        </div>
        <ConfirmDialog open={dialog} size="screen" title="Chốt kết quả?" confirmLabel="Chốt kết quả" cancelLabel="Huỷ" busy={finalizing} confirmDisabled={remaining > 0}
          disabledReason={<>Còn <b style={st.mono}>{remaining}</b> bài chưa chấm — chấm xong mới chốt được</>}
          onCancel={() => setDialog(false)} onConfirm={() => void finalize()}>
          Điểm sẽ thành chính thức, bảng xếp hạng bỏ nhãn "Tạm tính" và không sửa điểm được nữa.
          {finalizeError && <div style={{ marginTop: 20 }}><ErrorMessage size="screen" message={finalizeError} /></div>}
        </ConfirmDialog>
      </ScreenLayout>
    </ScreenStage>
  );
}
