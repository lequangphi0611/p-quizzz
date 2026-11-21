import { useEffect, useState, type FormEvent } from 'react';
import { ROOM_CODE_LENGTH } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { cleanRoomCode, formatRoomCode } from '../../../shared/room/room-code.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { InfoBox, InfoRow, PageCard, mText } from '../../../shared/ui/member/member-shell.js';
import { selectRoom, selectTrainingRoom, type MemberHomeController, type MemberHomeState } from '../application/member-home-controller.js';
import { classifyJoinError, classifyRoomLookupError } from '../domain/join-error.js';
import { TakenConfirm } from './RejoinPanels.js';

// ── 1 · Join ────────────────────────────────────────────────────────────────────────────────────
// Step 1: the room code (several sessions may be open, so the code is how the server knows which one).
// Step 2, once the code found a session: the member's name.
export function JoinForm({ desk, state, linkRoom, ctrl, onTraining }: {
  desk: boolean; state: MemberHomeState; linkRoom: string; ctrl: MemberHomeController;
  /** The code opens an AI training (S36): the page moves to that training's own route, carrying the code. */
  onTraining: (trainingId: number, roomCode: string) => void;
}) {
  const [code, setCode] = useState(() => linkRoom || state.lookup?.code || '');
  const [prefilled, setPrefilled] = useState(() => !!linkRoom);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  // The email/name already has someone behind it: offer to ask the mentor instead of a dead end (PRODUCT.md §7.23).
  const [taken, setTaken] = useState<{ kind: 'email' | 'name' } | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const [lockedFor, setLockedFor] = useState(0); // seconds left after too many wrong codes (server 429)
  const room = selectRoom(state);
  const trainingRoom = selectTrainingRoom(state);
  const needsEmail = room?.access === 'roster';
  const lookupFailure = state.lookup?.status === 'error' && state.lookup.code === code ? classifyRoomLookupError(state.lookup.error!.status, state.lookup.error!.message) : null;

  // Look the room up as soon as the code is complete (a join link arrives complete).
  useEffect(() => { void ctrl.lookUpRoom(code); }, [code, ctrl]);
  // A training's code leaves for its own page (the consent step is there), so the exam form never shows for it.
  useEffect(() => { if (trainingRoom && state.lookup?.code === code) onTraining(trainingRoom.id, code); }, [trainingRoom, state.lookup?.code, code]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (lookupFailure?.kind === 'locked') setLockedFor(lookupFailure.seconds); }, [state.lookup]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setTimeout(() => setLockedFor(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lockedFor]);
  const locked = lockedFor > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || locked || !room || !name.trim() || (needsEmail && !email.trim())) return;
    setBusy(true);
    setNameError('');
    setEmailError('');
    try {
      await ctrl.join(room.id, name, code, needsEmail ? email : undefined);
      window.history.replaceState(null, '', '/'); // the code in the address bar has done its job
      await ctrl.joined(room.id);
    } catch (err) {
      const failure = classifyJoinError(err instanceof ApiError ? err.status : null, err instanceof ApiError ? err.message : '', err instanceof ApiError ? err.code : undefined);
      if (failure.kind === 'locked') setLockedFor(failure.seconds);
      else if (failure.kind === 'room') { setNameError(''); ctrl.clearRoom(); setCode(''); } // the room closed or the code changed under us
      else if (failure.kind === 'taken' && (!needsEmail || /email/i.test(failure.message))) setTaken({ kind: needsEmail ? 'email' : 'name' });
      else if (failure.kind === 'taken') setNameError(`${failure.message}. Thêm họ hoặc một chữ để phân biệt.`); // same name, other email: choose another name
      else if (failure.kind === 'email') setEmailError(failure.message);
      else setNameError(failure.message);
      setBusy(false);
    }
  }

  const running = room?.status === 'running';
  const roomError = lookupFailure && lookupFailure.kind !== 'locked' ? lookupFailure.message : '';

  async function ask() {
    if (!room || asking) return;
    setAsking(true);
    setAskError('');
    try {
      await ctrl.requestRejoin(room.id, name, code, needsEmail ? email : undefined);
      window.history.replaceState(null, '', '/');
    } catch (err) {
      const e = err instanceof ApiError ? err : null;
      if (e?.status === 429) { setLockedFor(30); setTaken(null); }
      else setAskError(e?.message ?? 'Không gửi được yêu cầu');
      setAsking(false);
    }
  }

  if (taken) {
    return <TakenConfirm desk={desk} kind={taken.kind} typed={taken.kind === 'email' ? email.trim() : name.trim()} busy={asking} error={askError} onAsk={() => void ask()} onBack={() => { setTaken(null); setAskError(''); setBusy(false); }} />;
  }
  return (
    <PageCard desk={desk}>
      <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 20 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <h1 style={mText.h1}>Vào phòng thi</h1>
          <p style={mText.meta}>Nhập mã phòng mentor đưa, rồi tên của bạn{needsEmail ? ' và email' : ''}. Tên sẽ hiện trên bảng xếp hạng.{running && ' Phiên đã bắt đầu — sau khi vào, bạn cần chờ mentor duyệt.'}</p>
        </div>
        {locked && <ErrorMessage message={`Bạn nhập sai quá nhiều lần, thử lại sau ${lockedFor} giây.`} />}
        <TextField label="Mã phòng" size="lg" mono inputMode="numeric" value={formatRoomCode(code)} disabled={locked}
          onChange={v => { setCode(cleanRoomCode(v)); setPrefilled(false); setNameError(''); }}
          placeholder="6 chữ số" maxLength={7} autoComplete="off" autoFocus={code.length !== ROOM_CODE_LENGTH} error={roomError}
          hint={roomError ? undefined : state.lookup?.status === 'checking' ? 'Đang tìm phòng…' : trainingRoom ? 'Đây là buổi training AI, đang chuyển trang…' : prefilled && code.length === ROOM_CODE_LENGTH ? 'Đã điền sẵn từ đường link' : '6 chữ số'} />
        {room && (
          <>
            <InfoBox><InfoRow icon="file-text" k="Đề" v={room.title} /></InfoBox>
            <TextField label="Tên của bạn" size="lg" value={name} disabled={locked} onChange={v => { setName(v); setNameError(''); }} placeholder="vd. Minh Anh" maxLength={30} autoFocus autoComplete="nickname" error={nameError}
              hint={needsEmail ? 'Hiện trên màn chiếu và bảng xếp hạng.' : undefined} />
            {needsEmail && (
              <TextField label="Email" size="lg" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={254}
                value={email} disabled={locked} onChange={v => { setEmail(v); setEmailError(''); }} placeholder="ten@gmail.com" error={emailError}
                hint="Email chỉ để xác nhận bạn thuộc lớp. Chỉ mentor thấy, không hiện cho ai khác." />
            )}
          </>
        )}
        <Button type="submit" size="lg" block icon={locked ? 'clock' : 'log-in'} loading={busy} disabled={locked || !room || !name.trim() || (needsEmail && !email.trim())}>
          {locked ? `Thử lại sau ${lockedFor} giây` : running ? 'Xin vào phiên' : 'Vào phòng'}
        </Button>
      </form>
    </PageCard>
  );
}
