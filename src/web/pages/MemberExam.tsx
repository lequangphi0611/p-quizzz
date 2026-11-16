import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { AttemptView, MeResponse, MemberQuestion, SubmitResponse } from '../../shared/api/index.js';
import { AnswerOption } from '../components/AnswerOption.js';
import { Markdown } from '../components/Markdown.js';
import { SaveIndicator } from '../components/SaveIndicator.js';
import { Chip, HeroIcon, InfoBox, InfoRow, MemberPage, NavSheet, OfficialChip, OfflineBanner, PageCard, Progress, ShortcutHelp, SideNav, StripNav, mText, useIsDesk, useShowKeys } from '../components/member/MemberParts.js';
import { Button } from '../components/ui/Button.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { Icon } from '../components/ui/Icon.js';
import { Kbd } from '../components/ui/Kbd.js';
import { Spinner } from '../components/ui/Spinner.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { TextField } from '../components/ui/TextField.js';
import { MemberLayout } from '../layouts/MemberLayout.js';
import { AnswerSaver, type AnswerPayload, type SaveState } from '../lib/answer-saver.js';
import { api, ApiError } from '../lib/api.js';
import { formatPoints, isAnswered } from '../lib/exam-progress.js';
import { WIDE_MIN, questionList, shortcutFor } from '../lib/member-ui.js';
import { useMediaQuery } from '../lib/useMediaQuery.js';

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);
const TYPE: Record<MemberQuestion['type'], [string, string]> = { single: ['circle-dot', 'Một đáp án'], multi: ['square-check', 'Nhiều đáp án'], essay: ['pencil', 'Tự luận'] };
const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

type Session = MeResponse['session'];

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** True while the phone's on-screen keyboard is up (the visual viewport is much shorter than the layout one). */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setOpen(window.innerHeight - vv.height > 150);
    vv.addEventListener('resize', on);
    return () => vv.removeEventListener('resize', on);
  }, []);
  return open;
}

// ── 3 · Start ───────────────────────────────────────────────────────────────────────────────────
function StartScreen({ me, onStart }: { me: MeResponse; onStart: () => Promise<void> }) {
  const desk = useIsDesk();
  const showKeys = useShowKeys();
  const { session } = me;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    if (busy) return;
    setBusy(true); setError('');
    try { await onStart(); } catch (err) { setError(errorText(err, 'Không bắt đầu được')); setBusy(false); }
  }
  const btn = <Button size="lg" block icon="play" loading={busy} onClick={() => void start()}>Bắt đầu làm bài</Button>;
  const stat = (n: ReactNode, l: string) => <div style={{ display: 'grid', gap: 4, padding: '14px 12px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}><span style={{ font: '700 24px/1 var(--font-mono)', color: 'var(--text-title)' }}>{n}</span><span style={mText.meta}>{l}</span></div>;
  const rule = (icon: string, text: ReactNode) => <li key={icon} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Icon name={icon} size={16} style={{ marginTop: 3, color: 'var(--text-meta)' }} /><span>{text}</span></li>;
  return (
    <MemberPage desk={desk} title={session.title} name={me.participant.displayName} maxW={520} footer={desk ? undefined : btn}>
      <PageCard desk={desk}>
        <div style={{ display: 'grid', gap: 6 }}><span style={{ ...mText.label, color: 'var(--correct-600)' }}>Phiên đã bắt đầu</span><h1 style={mText.h1}>{session.title}</h1></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>{stat(session.questionCount, 'câu')}{stat(formatPoints(session.totalPoints), 'điểm')}{stat(1, 'lượt làm')}</div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10, font: 'var(--type-ui)', fontSize: 15, color: 'var(--text-body)' }}>
          {rule('lock', 'Mỗi người làm 1 lần — nộp rồi không làm lại, không sửa được.')}
          {rule('save', 'Bài được lưu liên tục. Tải lại trang hay rớt mạng cũng không mất bài.')}
          {session.hasEssay && rule('pencil', 'Có câu tự luận — mentor chấm sau khi đóng phiên.')}
          {rule('eye-off', 'Đáp án và điểm từng câu chỉ hiện sau khi mentor đóng phiên.')}
        </ul>
        {showKeys && (
          <p style={{ ...mText.meta, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '10px 12px', border: '1px dashed var(--ink-300)', borderRadius: 'var(--radius-md)' }}>
            Mẹo: <Kbd>←</Kbd><Kbd>→</Kbd> chuyển câu, <Kbd>1</Kbd>–<Kbd>9</Kbd> chọn phương án, <Kbd>?</Kbd> xem tất cả phím tắt.
          </p>
        )}
        {error && <ErrorMessage message={error} />}
        {desk && btn}
      </PageCard>
    </MemberPage>
  );
}

// ── 5 & 6 · Result ──────────────────────────────────────────────────────────────────────────────
/**
 * After submitting. While the session runs: "Đã nộp bài" with the automatic score only. Once it is over: the score
 * (official after finalize), the multiple-choice / essay split and "Xem lại bài". `autoSubmitted`: the mentor closed
 * the session while this member was still working, so the attempt was submitted for them.
 */
export function ResultView({ me, ended, autoSubmitted = false, children }: { me: MeResponse; ended: boolean; autoSubmitted?: boolean; children?: ReactNode }) {
  const desk = useIsDesk();
  const nav = useNavigate();
  const { session, attempt, participant } = me;
  const done = attempt.submitted[0] ?? null; // one attempt per session (PRODUCT.md §4.4)
  const official = session.status === 'finalized';
  const reviewable = session.status === 'closed' || session.status === 'finalized';
  const essayMax = done ? Math.max(0, session.totalPoints - done.maxScore) : 0;
  const essayShown = official && done?.essayScore != null;
  const total = done ? done.score + (official ? done.essayScore ?? 0 : 0) : 0;
  const reviewBtn = done && reviewable ? <Button size="lg" block icon="eye" onClick={() => nav(`/review/${done.id}`)}>Xem lại bài</Button> : undefined;

  let card: ReactNode;
  if (!done) {
    card = (
      <PageCard desk={desk} center>
        <HeroIcon name="clock" tone="ink" />
        <h1 style={mText.h1}>Phiên đã kết thúc</h1>
        <p style={mText.meta}>Bạn chưa làm bài trong phiên này.</p>
      </PageCard>
    );
  } else if (!ended) {
    card = (
      <PageCard desk={desk}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><HeroIcon name="circle-check" /><div style={{ display: 'grid', gap: 2 }}><h1 style={mText.h1}>Đã nộp bài</h1><p style={mText.meta}>Lúc {timeOf(done.submittedAt)}</p></div></div>
        <div style={{ display: 'grid', gap: 10, padding: 20, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span style={mText.label}>{essayMax > 0 ? 'Điểm phần trắc nghiệm' : 'Điểm bài làm'}</span><Chip icon="hourglass">Tạm tính</Chip></div>
          <span className="pq-tabular" style={{ font: '700 48px/1 var(--font-mono)', color: 'var(--text-title)' }}>{formatPoints(done.score)}<span style={{ fontSize: 24, color: 'var(--text-meta)' }}> / {formatPoints(done.maxScore)} điểm</span></span>
          {essayMax > 0 && <p style={{ ...mText.meta, display: 'flex', gap: 8 }}><Icon name="pencil" size={15} style={{ marginTop: 2 }} /><span>Còn câu tự luận ({formatPoints(essayMax)} điểm) chờ mentor chấm. Tổng tạm tính <b style={mText.mono}>{formatPoints(done.score)}/{formatPoints(session.totalPoints)}</b>.</span></p>}
        </div>
        <p style={{ ...mText.meta, display: 'flex', gap: 8 }}><Icon name="lock" size={15} style={{ marginTop: 2 }} /><span>Đáp án, lời giải và điểm từng câu sẽ mở khi mentor đóng phiên. Muốn làm lại, nhờ mentor mở phiên mới.</span></p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border-hairline)', flexWrap: 'wrap', ...mText.meta }}><StatusBadge status="running" label="Phiên đang diễn ra" /><span>Trang tự cập nhật khi có kết quả.</span></div>
      </PageCard>
    );
  } else {
    card = (
      <PageCard desk={desk}>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}><StatusBadge status={official ? 'finalized' : 'closed'} label={official ? 'Đã chốt kết quả' : 'Đã đóng'} /><h1 style={mText.h1}>Phiên đã kết thúc</h1></div>
        <div style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><span style={mText.label}>Điểm của bạn</span><OfficialChip official={official} /></div>
          <span className="pq-tabular" style={{ font: '700 64px/1 var(--font-mono)', color: 'var(--text-title)', animation: 'pq-pop-in var(--dur-pop) var(--ease-pop)' }}>{formatPoints(total)}<span style={{ fontSize: 28, color: 'var(--text-meta)' }}> / {formatPoints(session.totalPoints)}</span></span>
        </div>
        {essayMax > 0 && (
          <InfoBox>
            <InfoRow icon="list-checks" k="Trắc nghiệm" v={<span style={mText.mono}>{formatPoints(done.score)} / {formatPoints(done.maxScore)}</span>} />
            <InfoRow icon="pencil" k="Tự luận" v={essayShown ? <span style={mText.mono}>{formatPoints(done.essayScore!)} / {formatPoints(essayMax)}</span> : <Chip tone="ink" icon="hourglass">Chờ chấm</Chip>} />
          </InfoBox>
        )}
        {!official && <p style={mText.meta}>Điểm chính thức có khi mentor chấm xong{essayMax > 0 ? ' tự luận' : ''} và chốt kết quả. Trang tự cập nhật.</p>}
        {desk && reviewBtn}
      </PageCard>
    );
  }

  return (
    <MemberPage desk={desk} title={session.title} name={participant.displayName} maxW={520} footer={desk ? undefined : reviewBtn}>
      {ended && autoSubmitted && done && (
        <div role="status" style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--brand-050)', border: '1px solid var(--brand-200)', color: 'var(--brand-800)', font: 'var(--type-ui)', fontSize: 14 }}>
          <Icon name="info" size={18} style={{ marginTop: 1 }} /><span>Mentor đã đóng phiên khi bạn đang làm. Bài đã được <b>nộp tự động</b> với các câu đã lưu.</span>
        </div>
      )}
      {card}
      {children}
    </MemberPage>
  );
}

// ── 4 · Taking ──────────────────────────────────────────────────────────────────────────────────
type Draft = { selected: number[]; text: string };

function Options({ q, selected, onPick, keys, dimKeys }: { q: MemberQuestion; selected: number[]; onPick: (id: number) => void; keys: boolean; dimKeys: boolean }) {
  // ↑ / ↓ move focus between options (← → stay reserved for changing question).
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };
  return (
    <div role={q.type === 'multi' ? 'group' : 'radiogroup'} aria-label="Phương án" onKeyDown={onKeyDown} style={{ display: 'grid', gap: 10 }}>
      {q.options.map((o, i) => (
        <div key={o.id} style={{ display: 'grid', gridTemplateColumns: keys ? '24px minmax(0,1fr)' : 'minmax(0,1fr)', gap: 12, alignItems: 'center' }}>
          {keys && <span aria-hidden="true" style={{ justifySelf: 'center' }}>{i < 9 && <Kbd active={selected.includes(o.id)} dim={dimKeys}>{i + 1}</Kbd>}</span>}
          <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}><AnswerOption kind={q.type === 'multi' ? 'multi' : 'single'} text={o.text} selected={selected.includes(o.id)} onClick={() => onPick(o.id)} /></div>
        </div>
      ))}
    </div>
  );
}

function TakingView({ me, attemptId, onChanged }: { me: MeResponse; attemptId: number; onChanged: () => Promise<void> }) {
  const desk = useIsDesk();
  const wide = useMediaQuery(`(min-width: ${WIDE_MIN}px)`);
  const showKeys = useShowKeys();
  const online = useOnline();
  const keyboardOpen = useKeyboardOpen();
  const [view, setView] = useState<AttemptView | null>(null);
  const [loadError, setLoadError] = useState('');
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [cur, setCur] = useState(0);
  const [save, setSave] = useState<SaveState>('saved');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [closed, setClosed] = useState(false);
  const [help, setHelp] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [typing, setTyping] = useState(false);
  const saverRef = useRef<AnswerSaver | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const v = await api.get<AttemptView>(`/api/me/attempts/${attemptId}`);
      const d: Record<number, Draft> = {};
      for (const a of v.answers) d[a.questionId] = { selected: a.selectedOptionIds ?? [], text: a.textAnswer ?? '' };
      setDrafts(d);
      setView(v);
    } catch (err) { setLoadError(errorText(err, 'Không tải được bài làm')); }
  }, [attemptId]);
  useEffect(() => { void load(); }, [load]);

  // One saver per attempt. A 409 means the session closed (or the attempt was already submitted): hand over to the parent.
  useEffect(() => {
    let sessionEnded = false;
    const saver = new AnswerSaver(
      async (qid, payload: AnswerPayload) => {
        try { await api.put(`/api/me/attempts/${attemptId}/answers/${qid}`, payload); }
        catch (err) { if (err instanceof ApiError && err.status === 409) { sessionEnded = true; setClosed(true); void onChanged(); } throw err; }
      },
      setSave,
    );
    saverRef.current = saver;
    const back = () => { void saver.retry(); }; // come back online → save what failed
    // After a 409 nothing more can be saved, so don't trap the member with a "leave site?" prompt.
    const beforeUnload = (e: BeforeUnloadEvent) => { if (!sessionEnded && saver.state !== 'saved') e.preventDefault(); };
    window.addEventListener('online', back);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('online', back); window.removeEventListener('beforeunload', beforeUnload); void saver.flushAll().finally(() => saver.dispose()); };
  }, [attemptId, onChanged]);

  const questions = view?.questions ?? [];
  const total = questions.length;
  const q = questions[cur];
  const answeredIdx = useMemo(() => questions.flatMap((x, i) => (isAnswered({ selectedOptionIds: drafts[x.id]?.selected, textAnswer: drafts[x.id]?.text }) ? [i] : [])), [questions, drafts]);
  const unansweredIdx = useMemo(() => questions.flatMap((_, i) => (answeredIdx.includes(i) ? [] : [i])), [questions, answeredIdx]);

  const setChoice = (questionId: number, ids: number[]) => {
    setDrafts(d => ({ ...d, [questionId]: { selected: ids, text: d[questionId]?.text ?? '' } }));
    saverRef.current?.queue(questionId, { selectedOptionIds: ids });
  };
  const pick = (question: MemberQuestion, id: number) => {
    const sel = drafts[question.id]?.selected ?? [];
    setChoice(question.id, question.type === 'single' ? [id] : sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  };
  const setText = (questionId: number, text: string) => {
    setDrafts(d => ({ ...d, [questionId]: { selected: d[questionId]?.selected ?? [], text } }));
    saverRef.current?.queue(questionId, { textAnswer: text }, true);
  };
  const go = useCallback((i: number) => { if (i < 0 || i >= total) return; void saverRef.current?.flushAll(); setCur(i); }, [total]); // don't leave typed text on the debounce

  // New question: back to the top, focus its heading (screen readers read "Câu 3/4").
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (mainRef.current) mainRef.current.scrollTop = 0; else window.scrollTo(0, 0);
    headRef.current?.focus({ preventScroll: true });
  }, [cur]);

  // Keyboard shortcuts (PRODUCT.md §7.18): off while typing, with an overlay open, or with Ctrl/Alt/⌘.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = e => {
    const t = e.target as HTMLElement | null;
    const inField = !!t?.closest?.('input,textarea,select,[contenteditable="true"]');
    const a = shortcutFor({ key: e.key, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, inField, overlay: confirming || help || sheet });
    if (!a || !q) return;
    if (a.kind === 'close') { if (help) setHelp(false); else if (sheet) setSheet(false); return; } // the confirm dialog handles its own Esc
    if (a.kind === 'blur') { t?.blur(); return; }
    e.preventDefault();
    if (a.kind === 'prev') go(cur - 1);
    else if (a.kind === 'next') go(cur + 1);
    else if (a.kind === 'help') setHelp(true);
    else if (a.kind === 'pick' && q.type !== 'essay') { const o = q.options[a.index]; if (o) pick(q, o.id); }
  };
  useEffect(() => { const h = (e: KeyboardEvent) => keyRef.current(e); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);

  async function submit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      if (!(await saverRef.current!.flushAll())) throw new Error('unsaved');
      await api.post<SubmitResponse>(`/api/me/attempts/${attemptId}/submit`);
      await onChanged();
    } catch (err) {
      setConfirming(false);
      setSubmitError(err instanceof ApiError ? err.message : 'Còn câu chưa lưu được. Kiểm tra mạng rồi thử nộp lại.');
      setSubmitting(false);
    }
  }

  const title = me.session.title;
  const name = me.participant.displayName;
  if (loadError || !view || !q) {
    const body = loadError ? <ErrorMessage message={loadError} onRetry={() => void load()} /> : <Spinner block label="Đang tải bài làm…" />;
    return <MemberPage desk={desk} title={title} name={name} maxW={520}>{body}</MemberPage>;
  }

  const sel = drafts[q.id]?.selected ?? [];
  const text = drafts[q.id]?.text ?? '';
  const saveState = online ? save : 'offline';
  const saveEl = <SaveIndicator state={saveState} onRetry={() => void saverRef.current?.retry()} />;
  const left = unansweredIdx.length;
  const dialog = (
    <ConfirmDialog open={confirming} title="Nộp bài?" confirmLabel="Nộp bài" cancelLabel="Làm tiếp" busy={submitting} confirmDisabled={!online} disabledReason="Đang mất kết nối — chờ có mạng rồi nộp."
      onCancel={() => setConfirming(false)} onConfirm={() => void submit()}>
      {left > 0 ? <><b>Còn {left} câu chưa trả lời</b> ({questionList(unansweredIdx)}). </> : 'Bạn đã trả lời tất cả các câu. '}Sau khi nộp, bạn không sửa được bài nữa.
    </ConfirmDialog>
  );
  const notices = (
    <>
      {closed && <ErrorMessage tone="warning" message="Phiên thi đã đóng — không lưu thêm được nữa." />}
      {submitError && <ErrorMessage message={submitError} />}
    </>
  );

  const qhead = (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, ...mText.label }}>
        <span style={{ color: 'var(--brand-700)' }}>Câu {cur + 1}/{total}</span><span aria-hidden="true">·</span><span>{formatPoints(q.points)} điểm</span><span aria-hidden="true">·</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name={TYPE[q.type][0]} size={13} />{TYPE[q.type][1]}</span>
        {!desk && <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>{saveEl}</span>}
      </div>
      <h2 ref={headRef} tabIndex={-1} data-pq-focus="" style={{ margin: 0, font: desk ? '600 22px/1.4 var(--font-sans)' : 'var(--type-question)', color: 'var(--text-title)', maxWidth: '72ch', textWrap: 'pretty', outline: 'none', boxShadow: 'none', overflowWrap: 'anywhere' }}>
        <Markdown inlineOnly source={q.prompt} />
      </h2>
    </div>
  );
  const answer = q.type === 'essay' ? (
    <div onFocusCapture={() => setTyping(true)} onBlurCapture={() => setTyping(false)} style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <TextField key={`essay-${q.id}`} label="Câu trả lời của bạn" multiline mono rows={desk ? 20 : 10} value={text} onChange={v => setText(q.id, v)} placeholder="Viết câu trả lời… có thể dán code nhiều dòng." spellCheck={false} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', ...mText.meta }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{showKeys && typing ? <><Icon name="info" size={14} />Phím tắt tạm tắt khi đang gõ · <Kbd>Esc</Kbd> để thoát ô</> : 'Tự động lưu khi bạn gõ'}</span>
        <span style={mText.mono}>{text ? text.split('\n').length : 0} dòng · {text.length} ký tự</span>
      </div>
    </div>
  ) : (
    <div style={{ display: 'grid', gap: 12, maxWidth: desk ? 800 : undefined }}>
      {q.type === 'multi' && <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, font: 'var(--type-ui)', fontSize: 14, fontWeight: 600, color: 'var(--brand-700)' }}><Icon name="list-checks" size={16} />Chọn tất cả đáp án đúng</p>}
      <Options q={q} selected={sel} onPick={id => pick(q, id)} keys={showKeys} dimKeys={typing} />
    </div>
  );
  const content = (
    <div key={q.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: desk ? 24 : 18, minWidth: 0, animation: 'pq-reveal var(--dur-base) var(--ease-standard)' }}>
      {qhead}
      {q.body && <div style={{ minWidth: 0 }}><Markdown source={q.body} /></div>}
      {answer}
      {notices}
    </div>
  );

  if (desk) {
    const sidebar = (
      <>
        <div style={{ padding: '20px 20px 12px', display: 'grid', gap: 12 }}><span style={mText.label}>Tiến độ</span><Progress done={answeredIdx.length} total={total} /></div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px' }}><SideNav questions={questions} current={cur} answered={answeredIdx} onSelect={go} /></div>
        <div style={{ padding: '16px 20px 18px', borderTop: '1px solid var(--border-hairline)', display: 'grid', gap: 10 }}>
          <Button size="lg" block icon="send" onClick={() => setConfirming(true)}>Nộp bài</Button>
          <button type="button" onClick={() => setHelp(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 32, background: 'none', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', font: 'var(--type-meta)', color: 'var(--text-meta)' }}><Icon name="info" size={14} />Phím tắt <Kbd>?</Kbd></button>
        </div>
      </>
    );
    const pad = wide ? '0 48px' : '0 24px';
    return (
      <MemberLayout variant="wide" sessionTitle={title} displayName={name} status={<StatusBadge status="running" label="Đang làm bài" />} headerEnd={saveEl} banner={!online && <OfflineBanner />} sidebar={sidebar} compact={!wide} mainRef={mainRef}>
        <div style={{ flex: 1, padding: wide ? '40px 48px' : '28px 24px 32px' }}><div style={{ maxWidth: 960, margin: '0 auto' }}>{content}</div></div>
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--paper)', borderTop: '1px solid var(--border-hairline)', padding: '12px 0' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: pad, boxSizing: 'content-box', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button variant="secondary" icon="chevron-left" shortcut={showKeys ? '←' : undefined} disabled={cur === 0} onClick={() => go(cur - 1)}>Câu trước</Button>
            <span style={{ flex: 1 }} />
            <Button variant="secondary" iconRight="chevron-right" shortcut={showKeys ? '→' : undefined} disabled={cur === total - 1} onClick={() => go(cur + 1)}>Câu sau</Button>
          </div>
        </div>
        {dialog}
        {help && <ShortcutHelp onClose={() => setHelp(false)} />}
      </MemberLayout>
    );
  }

  const last = cur === total - 1;
  const footer = keyboardOpen ? undefined : (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto minmax(0,1fr)', gap: 8 }}>
      <Button variant="secondary" size="lg" icon="chevron-left" ariaLabel="Câu trước" disabled={cur === 0} onClick={() => go(cur - 1)} style={{ padding: '0 14px' }}>Trước</Button>
      <Button variant={last ? 'secondary' : 'primary'} size="lg" iconRight="chevron-right" ariaLabel="Câu sau" disabled={last} onClick={() => go(cur + 1)} style={{ padding: '0 14px' }}>Sau</Button>
      <Button variant={last ? 'primary' : 'secondary'} size="lg" icon="send" block onClick={() => setConfirming(true)} style={{ padding: '0 14px' }}>Nộp bài</Button>
    </div>
  );
  return (
    <MemberLayout sessionTitle={title} displayName={name} footer={footer}>
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        {!online && <OfflineBanner compact />}
        <StripNav count={total} current={cur} answered={answeredIdx} onSelect={go} onOpenAll={() => setSheet(true)} />
        {content}
      </div>
      {sheet && <NavSheet count={total} current={cur} answered={answeredIdx} onSelect={go} onClose={() => setSheet(false)} onSubmit={() => setConfirming(true)} />}
      {dialog}
      {help && <ShortcutHelp onClose={() => setHelp(false)} />}
    </MemberLayout>
  );
}

// ── Entry: the "active + running" step of the member flow ───────────────────────────────────────
export function MemberExam({ me, onChanged, leaderboard }: { me: MeResponse; onChanged: () => Promise<void>; leaderboard?: ReactNode }) {
  const start = async () => { await api.post('/api/me/attempts'); await onChanged(); };
  const { attempt } = me;
  if (attempt.current) return <TakingView key={attempt.current.id} me={me} attemptId={attempt.current.id} onChanged={onChanged} />;
  if (attempt.submitted.length > 0) return <ResultView me={me} ended={false}>{leaderboard}</ResultView>;
  return <StartScreen me={me} onStart={start} />;
}

export type { Session };
