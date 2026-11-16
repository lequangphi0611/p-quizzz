import { useEffect, useState, type FormEvent } from 'react';
import { ROOM_CODE_LENGTH, type ActiveSession } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { cleanRoomCode, formatRoomCode } from '../../../shared/room/room-code.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { PageCard, mText } from '../../../shared/ui/member/member-shell.js';
import type { MemberHomeController } from '../application/member-home-controller.js';
import { classifyJoinError } from '../domain/join-error.js';

// ── 1 · Join ────────────────────────────────────────────────────────────────────────────────────
export function JoinForm({ desk, session, linkRoom, ctrl }: { desk: boolean; session: ActiveSession; linkRoom: string; ctrl: MemberHomeController }) {
  const [room, setRoom] = useState(() => linkRoom || ctrl.recallRoom(session.id));
  const [prefilled, setPrefilled] = useState(() => !!linkRoom);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [nameError, setNameError] = useState('');
  const [lockedFor, setLockedFor] = useState(0); // seconds left after too many wrong codes (server 429)
  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setTimeout(() => setLockedFor(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lockedFor]);
  const locked = lockedFor > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || locked || !name.trim() || room.length !== ROOM_CODE_LENGTH) return;
    setBusy(true);
    setRoomError('');
    setNameError('');
    try {
      await ctrl.join(session.id, name, room);
      window.history.replaceState(null, '', '/'); // the code in the address bar has done its job
      await ctrl.joined(session.id);
    } catch (err) {
      const failure = classifyJoinError(err instanceof ApiError ? err.status : null, err instanceof ApiError ? err.message : '');
      if (failure.kind === 'locked') setLockedFor(failure.seconds);
      else if (failure.kind === 'room') setRoomError('Mã phòng không đúng. Kiểm tra lại mã trên màn chiếu.');
      else setNameError(failure.message);
      setBusy(false);
    }
  }

  const running = session.status === 'running';
  return (
    <PageCard desk={desk}>
      <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 20 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <h1 style={mText.h1}>Vào phòng thi</h1>
          <p style={mText.meta}>Nhập mã phòng mentor đưa và tên của bạn. Tên sẽ hiện trên bảng xếp hạng.{running && ' Phiên đã bắt đầu — sau khi vào, bạn cần chờ mentor duyệt.'}</p>
        </div>
        {locked && <ErrorMessage message={`Bạn nhập sai quá nhiều lần, thử lại sau ${lockedFor} giây.`} />}
        <TextField label="Mã phòng" size="lg" mono inputMode="numeric" value={formatRoomCode(room)} disabled={locked}
          onChange={v => { setRoom(cleanRoomCode(v)); setRoomError(''); setPrefilled(false); }}
          placeholder="6 chữ số" maxLength={7} autoComplete="off" autoFocus={room.length !== ROOM_CODE_LENGTH} error={roomError}
          hint={roomError ? undefined : prefilled && room.length === ROOM_CODE_LENGTH ? 'Đã điền sẵn từ đường link' : '6 chữ số'} />
        <TextField label="Tên của bạn" size="lg" value={name} disabled={locked} onChange={v => { setName(v); setNameError(''); }} placeholder="vd. Minh Anh" maxLength={30} autoFocus={room.length === ROOM_CODE_LENGTH} autoComplete="nickname" error={nameError} />
        <Button type="submit" size="lg" block icon={locked ? 'clock' : 'log-in'} loading={busy} disabled={locked || !name.trim() || room.length !== ROOM_CODE_LENGTH}>
          {locked ? `Thử lại sau ${lockedFor} giây` : running ? 'Xin vào phiên' : 'Vào phòng'}
        </Button>
      </form>
    </PageCard>
  );
}
