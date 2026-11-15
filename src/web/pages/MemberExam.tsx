import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { AttemptView, MeResponse, SubmitResponse } from '../../shared/api/index.js';
import { AnswerOption } from '../components/AnswerOption.js';
import { Markdown } from '../components/Markdown.js';
import { QuestionNav } from '../components/QuestionNav.js';
import { SaveIndicator } from '../components/SaveIndicator.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { Icon } from '../components/ui/Icon.js';
import { Spinner } from '../components/ui/Spinner.js';
import { TextField } from '../components/ui/TextField.js';
import { MemberLayout } from '../layouts/MemberLayout.js';
import { AnswerSaver, type AnswerPayload, type SaveState } from '../lib/answer-saver.js';
import { api, ApiError } from '../lib/api.js';
import { formatPoints, headlineAttempt, isAnswered } from '../lib/exam-progress.js';

const stack = { display: 'grid', gap: 16 } as const;
const label = { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--text-faint)' } as const;
const meta = { font: 'var(--type-meta)', color: 'var(--text-meta)', margin: 0 } as const;
const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

type Session = MeResponse['session'];

// ── Start ───────────────────────────────────────────────────────────────────────────────────────
function StartCard({ session, retake, onStart }: { session: Session; retake: boolean; onStart: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await onStart(); } catch (err) { setError(errorText(err, 'Không bắt đầu được')); setBusy(false); }
  }
  const rows: [string, ReactNode][] = [
    ['list', <>{session.questionCount} câu hỏi · {formatPoints(session.totalPoints)} điểm</>],
    session.hasEssay
      ? ['lock', <>Có câu tự luận — chỉ được làm <b>1 lượt</b></>]
      : ['rotate-ccw', <>Được làm lại nhiều lần — tính <b>lượt điểm cao nhất</b></>],
    ['save', <>Bài làm được lưu liên tục, F5 không mất bài</>],
  ];
  return (
    <div style={stack}>
      <Card tone="sunken">
        <div style={{ display: 'grid', gap: 10, font: 'var(--type-ui)', color: 'var(--text-body)' }}>
          {rows.map(([icon, text]) => <span key={icon} style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icon name={icon} />{text}</span>)}
        </div>
      </Card>
      {error && <ErrorMessage message={error} />}
      <Button size="lg" block icon="play" loading={busy} onClick={start}>{retake ? 'Làm lại' : 'Bắt đầu làm bài'}</Button>
    </div>
  );
}

// ── Result ──────────────────────────────────────────────────────────────────────────────────────
export function ResultView({ me, ended, onStart, children }: { me: MeResponse; ended: boolean; onStart: () => Promise<void>; children?: ReactNode }) {
  const { session, attempt } = me;
  const nav = useNavigate();
  const best = headlineAttempt(attempt.submitted);
  // The answer key opens once the session is over; until then retakes are still possible.
  const reviewable = session.status === 'closed' || session.status === 'finalized';
  const essayPoints = best ? Math.max(0, session.totalPoints - best.maxScore) : 0;
  return (
    <div style={stack}>
      {ended && (
        <ErrorMessage tone="warning" title="Phiên thi đã đóng" message={best ? 'Bài của bạn đã được nộp.' : 'Bạn chưa làm bài trong phiên này.'} />
      )}
      {best && (
        <Card>
          <div style={{ display: 'grid', gap: 6, justifyItems: 'center', textAlign: 'center', padding: '8px 0' }}>
            <span style={label}>{attempt.submitted.length > 1 ? 'Điểm cao nhất' : 'Điểm lượt vừa nộp'}</span>
            <span className="pq-tabular" style={{ font: '700 48px/1 var(--font-mono)', color: 'var(--text-title)' }}>
              {formatPoints(best.score)}<span style={{ fontSize: 24, color: 'var(--text-faint)' }}>/{formatPoints(best.maxScore)}</span>
            </span>
            {essayPoints > 0 && <p style={meta}>Chưa gồm câu tự luận ({formatPoints(essayPoints)} điểm) — mentor sẽ chấm sau khi đóng phiên.</p>}
          </div>
        </Card>
      )}
      {attempt.submitted.length > 1 && (
        <Card title="Các lượt đã làm">
          <div style={{ display: 'grid', gap: 6 }}>
            {attempt.submitted.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--type-ui)' }}>
                <span>Lượt {a.attemptNo}</span>
                <span className="pq-tabular" style={{ fontFamily: 'var(--font-mono)' }}>{formatPoints(a.score)}/{formatPoints(a.maxScore)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {reviewable && attempt.submitted.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {attempt.submitted.map(a => (
            <Button key={a.id} size="lg" block variant={attempt.submitted.length === 1 ? 'primary' : 'secondary'} icon="eye" onClick={() => nav(`/review/${a.id}`)}>
              {attempt.submitted.length === 1 ? 'Xem lại bài' : `Xem lại lượt ${a.attemptNo}`}
            </Button>
          ))}
        </div>
      )}
      {!ended && attempt.canStartNew && <StartCard session={session} retake onStart={onStart} />}
      {!ended && !attempt.canStartNew && best && session.hasEssay && <p style={{ ...meta, textAlign: 'center' }}>Đề có tự luận chỉ làm được 1 lượt.</p>}
      {children}
    </div>
  );
}

// ── Taking ──────────────────────────────────────────────────────────────────────────────────────
type Draft = { selected: number[]; text: string };

function TakingView({ me, attemptId, onChanged }: { me: MeResponse; attemptId: number; onChanged: () => Promise<void> }) {
  const [view, setView] = useState<AttemptView | null>(null);
  const [loadError, setLoadError] = useState('');
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [cur, setCur] = useState(0);
  const [save, setSave] = useState<SaveState>('saved');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [closed, setClosed] = useState(false);
  const saverRef = useRef<AnswerSaver | null>(null);

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
    const saver = new AnswerSaver(
      async (qid, payload: AnswerPayload) => {
        try { await api.put(`/api/me/attempts/${attemptId}/answers/${qid}`, payload); }
        catch (err) { if (err instanceof ApiError && err.status === 409) { setClosed(true); void onChanged(); } throw err; }
      },
      setSave,
    );
    saverRef.current = saver;
    const online = () => { void saver.retry(); }; // come back online → save what failed
    const beforeUnload = (e: BeforeUnloadEvent) => { if (saver.state !== 'saved') e.preventDefault(); };
    window.addEventListener('online', online);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('online', online); window.removeEventListener('beforeunload', beforeUnload); void saver.flushAll().finally(() => saver.dispose()); };
  }, [attemptId, onChanged]);

  const questions = view?.questions ?? [];
  const q = questions[cur];
  const answeredIdx = useMemo(() => questions.flatMap((x, i) => (isAnswered({ selectedOptionIds: drafts[x.id]?.selected, textAnswer: drafts[x.id]?.text }) ? [i] : [])), [questions, drafts]);

  const setChoice = (questionId: number, ids: number[]) => {
    setDrafts(d => ({ ...d, [questionId]: { selected: ids, text: d[questionId]?.text ?? '' } }));
    saverRef.current?.queue(questionId, { selectedOptionIds: ids });
  };
  const setText = (questionId: number, text: string) => {
    setDrafts(d => ({ ...d, [questionId]: { selected: d[questionId]?.selected ?? [], text } }));
    saverRef.current?.queue(questionId, { textAnswer: text }, true);
  };
  const go = (i: number) => { void saverRef.current?.flushAll(); setCur(i); }; // don't leave typed text waiting on the debounce

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

  if (loadError) return <ErrorMessage message={loadError} onRetry={() => void load()} />;
  if (!view || !q) return <Spinner block label="Đang tải bài làm…" />;

  const sel = drafts[q.id]?.selected ?? [];
  const unanswered = questions.length - answeredIdx.length;
  const last = cur === questions.length - 1;

  return (
    <div style={stack}>
      <QuestionNav count={questions.length} current={cur} answered={answeredIdx} onSelect={go} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={label}>Câu {cur + 1}/{questions.length} · {formatPoints(q.points)} điểm</span>
        <SaveIndicator state={save} onRetry={() => void saverRef.current?.retry()} />
      </div>
      {closed && <ErrorMessage tone="warning" message="Phiên thi đã đóng — không lưu thêm được nữa." />}

      <div key={`prompt-${q.id}`} style={{ display: 'grid', gap: 10 }}>
        <div style={{ font: 'var(--type-question)', color: 'var(--text-title)' }}><Markdown inlineOnly source={q.prompt} /></div>
        {q.body && <Markdown source={q.body} />}
      </div>
      {q.type === 'multi' && <p style={{ ...meta, fontWeight: 600, color: 'var(--brand-700)' }}>Chọn tất cả đáp án đúng</p>}

      {q.type === 'essay' ? (
        <TextField key={`essay-${q.id}`} multiline mono rows={8} value={drafts[q.id]?.text ?? ''} onChange={t => setText(q.id, t)} placeholder="Viết câu trả lời…" hint="Tự động lưu sau 0,5 giây" spellCheck={false} />
      ) : (
        <div style={{ display: 'grid', gap: 8 }} role={q.type === 'multi' ? 'group' : 'radiogroup'}>
          {q.options.map(o => (
            <AnswerOption key={o.id} kind={q.type === 'multi' ? 'multi' : 'single'} text={o.text} selected={sel.includes(o.id)}
              onClick={() => setChoice(q.id, q.type === 'single' ? [o.id] : sel.includes(o.id) ? sel.filter(x => x !== o.id) : [...sel, o.id])} />
          ))}
        </div>
      )}

      {submitError && <ErrorMessage message={submitError} />}

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface-page)', paddingTop: 8, display: 'flex', gap: 8 }}>
        <Button variant="secondary" size="lg" icon="chevron-left" disabled={cur === 0} onClick={() => go(cur - 1)}>Trước</Button>
        {last
          ? <Button size="lg" icon="send" style={{ flex: 1 }} onClick={() => setConfirming(true)}>Nộp bài</Button>
          : <Button size="lg" iconRight="chevron-right" style={{ flex: 1 }} onClick={() => go(cur + 1)}>Câu sau</Button>}
      </div>

      <ConfirmDialog open={confirming} title="Nộp bài?" confirmLabel="Nộp bài" busy={submitting} onCancel={() => setConfirming(false)} onConfirm={submit}>
        {unanswered > 0 ? <>Bạn còn <b>{unanswered} câu</b> chưa trả lời. Sau khi nộp sẽ không sửa được nữa.</> : 'Sau khi nộp sẽ không sửa được nữa.'}
      </ConfirmDialog>
    </div>
  );
}

// ── Entry: the "active + running" step of the member flow ───────────────────────────────────────
export function MemberExam({ me, onChanged, leaderboard }: { me: MeResponse; onChanged: () => Promise<void>; leaderboard?: ReactNode }) {
  const start = async () => { await api.post('/api/me/attempts'); await onChanged(); };
  const { attempt, session } = me;
  let body: ReactNode;
  if (attempt.current) body = <TakingView key={attempt.current.id} me={me} attemptId={attempt.current.id} onChanged={onChanged} />;
  else if (attempt.submitted.length > 0) body = <ResultView me={me} ended={false} onStart={start}>{leaderboard}</ResultView>;
  else body = (
    <div style={{ ...stack, paddingTop: 8 }}>
      <div style={{ display: 'grid', gap: 6 }}><span style={label}>Phiên đã bắt đầu</span><h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>{session.title}</h1></div>
      <StartCard session={session} retake={false} onStart={start} />
    </div>
  );
  return <MemberLayout sessionTitle={session.title} displayName={me.participant.displayName}>{body}</MemberLayout>;
}
