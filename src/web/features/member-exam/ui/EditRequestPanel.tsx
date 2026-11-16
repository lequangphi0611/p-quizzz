import { useEffect, useRef, useState } from 'react';
import type { AttemptView, MeResponse } from '../../../../shared/api/index.js';
import { MAX_EDIT_REASON_LENGTH } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { SaveIndicator } from '../../../shared/ui/SaveIndicator.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { mText, PageCard, useIsDesk } from '../../../shared/ui/member/member-shell.js';
import { Markdown } from '../../../shared/ui/Markdown.js';
import { AnswerSaver, type SaveState } from '../application/answer-saver.js';
import { useExamGateway } from '../application/exam-gateway-context.js';
import { errorText } from '../application/taking-controller.js';
import { checkReason, editPanelMode } from '../domain/edit-request.js';
import { ApiError } from '../../../shared/api-client/http-client.js';

/**
 * Under the "Đã nộp bài" card (PRODUCT.md §7.21): ask the mentor to reopen the essays, wait for the answer, edit the
 * essays once approved. Choice questions and the automatic score never change.
 */
export function EditRequestPanel({ me, onChanged }: { me: MeResponse; onChanged: () => Promise<void> }) {
  const desk = useIsDesk();
  const mode = editPanelMode(me);
  const done = me.attempt.submitted[0];
  if (mode === 'none' || !done) return null;

  let body;
  if (mode === 'editing') body = <EssayEditor attemptId={done.id} onChanged={onChanged} />;
  else if (mode === 'waiting') body = <Note icon="hourglass" title="Đã gửi yêu cầu sửa bài" text={`Chờ mentor trả lời. Lý do của bạn: “${done.editRequest?.reason ?? ''}”`} />;
  else if (mode === 'done') body = <Note icon="circle-check" title="Bạn đã sửa bài tự luận" text="Mỗi bài chỉ được mở lại một lần. Bản sửa của bạn đã được lưu." />;
  else body = <AskForm attemptId={done.id} retry={mode === 'retry'} onChanged={onChanged} />;

  return <PageCard desk={desk}>{body}</PageCard>;
}

function Note({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div role="status" style={{ display: 'flex', gap: 10 }}>
      <Icon name={icon} size={18} style={{ marginTop: 2 }} />
      <div style={{ display: 'grid', gap: 4 }}><b style={mText.label}>{title}</b><span style={{ ...mText.meta, overflowWrap: 'anywhere' }}>{text}</span></div>
    </div>
  );
}

function AskForm({ attemptId, retry, onChanged }: { attemptId: number; retry: boolean; onChanged: () => Promise<void> }) {
  const gateway = useExamGateway();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const checked = checkReason(reason);
    if (!checked.ok) { setError(checked.error); return; }
    setBusy(true); setError('');
    try { await gateway.requestEdit(attemptId, checked.reason); await onChanged(); }
    catch (err) { setError(errorText(err, 'Không gửi được yêu cầu. Thử lại.')); setBusy(false); }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {retry && <ErrorMessage tone="warning" message="Mentor đã từ chối yêu cầu trước. Bạn có thể gửi lại kèm lý do rõ hơn." />}
      {!open ? (
        <>
          <p style={mText.meta}>Cần bổ sung bài tự luận? Gửi yêu cầu để mentor mở lại <b>phần tự luận</b> (chỉ một lần; trắc nghiệm và điểm tự động không đổi).</p>
          <Button variant="secondary" icon="pencil" onClick={() => setOpen(true)}>{retry ? 'Gửi lại yêu cầu sửa bài' : 'Xin sửa bài tự luận'}</Button>
        </>
      ) : (
        <>
          <TextField label="Lý do xin sửa bài" multiline rows={3} value={reason} onChange={setReason} maxLength={MAX_EDIT_REASON_LENGTH} placeholder="Ví dụ: em quên ý cuối của câu 3." hint={`${reason.length}/${MAX_EDIT_REASON_LENGTH}`} error={error || undefined} autoFocus />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button icon="send" loading={busy} disabled={busy} onClick={() => void send()}>Gửi yêu cầu</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { setOpen(false); setError(''); }}>Huỷ</Button>
          </div>
        </>
      )}
    </div>
  );
}

/** The essays of an approved edit: autosave like the exam screen; "Xong" closes the window for good. */
function EssayEditor({ attemptId, onChanged }: { attemptId: number; onChanged: () => Promise<void> }) {
  const gateway = useExamGateway();
  const [view, setView] = useState<AttemptView | null>(null);
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [save, setSave] = useState<SaveState>('saved');
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const saver = useRef<AnswerSaver | null>(null);
  const changed = useRef(onChanged);
  changed.current = onChanged;

  useEffect(() => {
    const s = new AnswerSaver(
      async (questionId, payload) => {
        try { await gateway.saveAnswer(attemptId, questionId, payload); }
        catch (err) { if (err instanceof ApiError && err.status === 409) { setError('Phiên đã đóng hoặc việc sửa bài đã kết thúc — không lưu thêm được.'); void changed.current(); } throw err; }
      },
      setSave,
    );
    saver.current = s;
    let live = true;
    gateway.getAttempt(attemptId).then(v => { if (live) { setView(v); setTexts(Object.fromEntries(v.answers.filter(a => a.textAnswer !== null).map(a => [a.questionId, a.textAnswer!]))); } }, err => { if (live) setError(errorText(err, 'Không tải được bài làm')); });
    return () => { live = false; void s.flushAll().finally(() => s.dispose()); };
  }, [gateway, attemptId]);

  const finish = async () => {
    setFinishing(true); setError('');
    try {
      if (!(await saver.current!.flushAll())) throw new Error('unsaved');
      await gateway.finishEdit(attemptId);
      await changed.current();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Còn phần chưa lưu được. Kiểm tra mạng rồi thử lại.'); setFinishing(false); }
  };

  if (!view) return error ? <ErrorMessage message={error} /> : <Spinner block label="Đang mở bài…" />;
  const essays = view.questions.filter(q => q.type === 'essay');
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={mText.label}>Sửa bài tự luận</b>
        <SaveIndicator state={save} onRetry={() => void saver.current?.retry()} />
      </div>
      <p style={mText.meta}>Mentor đã mở lại phần tự luận. Chỉ sửa được một lần: bấm “Xong” khi đã sửa xong.</p>
      {essays.map((q, i) => (
        <div key={q.id} style={{ display: 'grid', gap: 8 }}>
          <b style={mText.label}>Câu tự luận {i + 1}</b>
          <div style={{ font: 'var(--type-body)' }}><Markdown inlineOnly source={q.prompt} /></div>
          {q.body && <Markdown source={q.body} />}
          <TextField multiline mono rows={10} spellCheck={false} value={texts[q.id] ?? ''} onChange={text => { setTexts(t => ({ ...t, [q.id]: text })); saver.current?.queue(q.id, { textAnswer: text }, true); }} />
        </div>
      ))}
      {error && <ErrorMessage message={error} />}
      <Button icon="check" loading={finishing} disabled={finishing} onClick={() => void finish()}>Xong, lưu bài</Button>
    </div>
  );
}
