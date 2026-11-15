import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ROOM_CODE_LENGTH, type ActiveSession, type JoinResponse, type MeResponse } from '../../shared/api/index.js';
import { HeroIcon, InfoBox, InfoRow, MemberPage, PageCard, mText, useIsDesk } from '../components/member/MemberParts.js';
import { Button } from '../components/ui/Button.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { Spinner } from '../components/ui/Spinner.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { TextField } from '../components/ui/TextField.js';
import { NameChip } from '../layouts/MemberLayout.js';
import { api, ApiError, clearParticipantToken, getCurrentSessionId, getParticipantToken, setCurrentSessionId, setParticipantToken } from '../lib/api.js';
import { decideScreen, type MeState } from '../lib/member-screen.js';
import { retrySecondsFrom } from '../lib/member-ui.js';
import { useSessionEvents } from '../lib/useSessionEvents.js';
import { Leaderboard } from '../components/Leaderboard.js';
import { cleanRoomCode, formatRoomCode, recallRoomCode, rememberRoomCode, roomFromSearch } from '../lib/room-code.js';
import { MemberExam, ResultView } from './MemberExam.js';

const POLL_MS = 5000;

// ── 1 · Join ────────────────────────────────────────────────────────────────────────────────────
function JoinForm({ desk, session, linkRoom, onJoined }: { desk: boolean; session: ActiveSession; linkRoom: string; onJoined: () => Promise<void> }) {
  const [room, setRoom] = useState(() => linkRoom || recallRoomCode(session.id));
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
      const res = await api.post<JoinResponse>(`/api/sessions/${session.id}/join`, { displayName: name, roomCode: room });
      setParticipantToken(session.id, res.token);
      setCurrentSessionId(session.id);
      rememberRoomCode(session.id, room);
      window.history.replaceState(null, '', '/'); // the code in the address bar has done its job
      await onJoined();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Không vào được phiên';
      if (err instanceof ApiError && err.status === 429) setLockedFor(retrySecondsFrom(err.message) || 30);
      else if (err instanceof ApiError && (err.status === 403 || /mã phòng/i.test(err.message))) setRoomError('Mã phòng không đúng. Kiểm tra lại mã trên màn chiếu.');
      else if (err instanceof ApiError && err.status === 409) setNameError(`${message}. Thêm họ hoặc một chữ để phân biệt.`);
      else setNameError(message);
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

// "/" — decides what a member sees from three facts: is there an active session, do I hold a token, what does /api/me say.
export function MemberHome() {
  const [active, setActive] = useState<ActiveSession | null | undefined>(undefined);
  const [hasToken, setHasToken] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meState, setMeState] = useState<MeState>('idle');
  const [linkRoom] = useState(() => roomFromSearch(window.location.search)); // from a join link: /?room=482913
  // The session whose state we follow: the active one, else the one this browser last joined (so the result
  // stays on screen after the mentor closes the session).
  const [remembered, setRemembered] = useState<number | null>(() => {
    const id = Number(getCurrentSessionId());
    return id > 0 && getParticipantToken(id) ? id : null;
  });
  const activeId = active ? active.id : active === null ? remembered : null;
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;
  const meSeq = useRef(0);
  const meRef = useRef<MeResponse | null>(null);
  meRef.current = me;

  const [activeError, setActiveError] = useState(false); // the very first load failed: show "Mất kết nối" instead of spinning
  const fetchActive = useCallback(async () => {
    try {
      setActive(await api.get<ActiveSession | null>('/api/sessions/active'));
      setActiveError(false);
    } catch { setActiveError(true); /* keep what we have; the next poll retries */ }
  }, []);

  const fetchMe = useCallback(async (sessionId: number) => {
    const n = ++meSeq.current;
    if (!getParticipantToken(sessionId)) {
      setHasToken(false); setMe(null); setMeState('idle');
      return;
    }
    setHasToken(true);
    setCurrentSessionId(sessionId);
    try {
      const r = await api.get<MeResponse>('/api/me');
      if (n !== meSeq.current) return;
      setMe(r); setMeState('ok');
    } catch (err) {
      if (n !== meSeq.current) return;
      if (err instanceof ApiError && err.status === 401) { // unknown token (e.g. server DB was reset): start over
        clearParticipantToken(sessionId);
        setRemembered(r => (r === sessionId ? null : r));
        setHasToken(false); setMe(null); setMeState('idle');
      } else if (err instanceof ApiError && err.status === 403) {
        setMeState('kicked');
      } else if (!meRef.current) {
        setMeState('error');
      }
    }
  }, []);

  // Poll as a safety net; SSE (below) makes changes show up immediately.
  useEffect(() => {
    void fetchActive();
    const t = setInterval(() => {
      void fetchActive();
      if (activeIdRef.current !== null) void fetchMe(activeIdRef.current);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [fetchActive, fetchMe]);

  useEffect(() => {
    setMe(null); setMeState('idle');
    if (activeId !== null) void fetchMe(activeId);
  }, [activeId, fetchMe]);

  useSessionEvents(activeId, {
    session: () => { void fetchActive(); if (activeId !== null) void fetchMe(activeId); },
    participants: () => { if (activeId !== null) void fetchMe(activeId); },
  });

  const screen = decideScreen({ active, hasToken, me, meState });
  const refreshMe = useCallback(async () => { if (activeIdRef.current !== null) await fetchMe(activeIdRef.current); }, [fetchMe]);
  const title = me?.session.title ?? active?.title;
  const name = me && (screen === 'pending' || screen === 'lobby') ? me.participant.displayName : undefined;
  const desk = useIsDesk();

  // "Bài đã được nộp tự động": this browser saw the member working, then the session closed under them.
  const wasTaking = useRef(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  useEffect(() => {
    if (screen === 'running' && me?.attempt.current) wasTaking.current = true;
    else if (screen === 'ended' && wasTaking.current) { setAutoSubmitted(true); wasTaking.current = false; }
    else if (screen === 'running') wasTaking.current = false;
  }, [screen, me]);

  if (screen === 'running') {
    return <MemberExam me={me!} onChanged={refreshMe} leaderboard={<Leaderboard sessionId={me!.session.id} highlightName={me!.participant.displayName} />} />;
  }
  if (screen === 'ended') {
    return <ResultView me={me!} ended autoSubmitted={autoSubmitted}><Leaderboard sessionId={me!.session.id} highlightName={me!.participant.displayName} /></ResultView>;
  }

  const page = (body: React.ReactNode, opts: { maxW?: number; status?: React.ReactNode } = {}) => (
    <MemberPage desk={desk} title={title} name={name} maxW={opts.maxW ?? 440} status={opts.status}>{body}</MemberPage>
  );
  switch (screen) {
    case 'loading':
      if (activeError) return page(<ConnLost onRetry={() => void fetchActive()} desk={desk} />);
      return page(<PageCard desk={desk} center><Spinner block label="Đang kết nối tới máy mentor…" /><span style={{ ...mText.meta, ...mText.mono }}>{window.location.host}</span></PageCard>);
    case 'error':
      return page(<ConnLost onRetry={() => activeId !== null && void fetchMe(activeId)} desk={desk} />);
    case 'none':
      return page(
        <PageCard desk={desk} center>
          <HeroIcon name="clock" tone="ink" />
          <h1 style={mText.h1}>Chưa có phiên nào đang mở</h1>
          <p style={mText.meta}>Khi mentor mở phiên, trang này tự chuyển sang ô nhập mã phòng. Bạn không cần tải lại.</p>
          <Button variant="secondary" size="lg" icon="refresh-cw" block={!desk} onClick={() => void fetchActive()}>Kiểm tra lại</Button>
        </PageCard>,
      );
    case 'join':
      return page(<JoinForm desk={desk} session={active!} linkRoom={linkRoom} onJoined={async () => { setRemembered(active!.id); await fetchMe(active!.id); }} />);
    case 'pending':
    case 'lobby': {
      const pending = screen === 'pending';
      const inLobby = me!.session.status === 'lobby'; // pending before the start: the mentor lets people into the room first
      return page(
        <PageCard desk={desk} center>
          <StatusBadge status={pending && !inLobby ? 'running' : 'lobby'} label={pending && !inLobby ? 'Phiên đang diễn ra' : 'Phòng chờ'} />
          <HeroIcon name={pending ? 'hourglass' : 'users'} tone={pending ? 'warn' : 'brand'} />
          <div style={{ display: 'grid', gap: 6 }}>
            <h1 style={mText.h1}>{pending ? 'Chờ mentor duyệt' : 'Chờ mentor bắt đầu'}</h1>
            <p style={mText.meta}>{pending ? (inLobby ? 'Mentor sẽ duyệt tên bạn để vào phòng. Giữ trang này mở — màn hình tự chuyển khi được duyệt.' : 'Phiên đã bắt đầu trước khi bạn vào. Mentor cần duyệt thì bạn mới làm bài được.') : 'Giữ trang này mở — màn hình tự chuyển khi phiên bắt đầu.'}</p>
          </div>
          <InfoBox>
            <InfoRow icon="file-text" k="Đề" v={me!.session.title} />
            <InfoRow icon="user" k="Tên của bạn" v={<NameChip name={me!.participant.displayName} />} />
            {!pending && <InfoRow icon="users" k="Đã vào phòng" v={<span style={mText.mono}>{me!.session.participantCount} người</span>} />}
          </InfoBox>
          {pending && <Spinner label="Đang chờ duyệt…" />}
        </PageCard>,
        { maxW: 480 },
      );
    }
    case 'kicked':
      return page(
        <PageCard desk={desk} center>
          <HeroIcon name="user-x" tone="ink" />
          <h1 style={mText.h1}>Bạn đã được mời ra khỏi phiên</h1>
          <p style={mText.meta}>Mentor đã mời bạn ra khỏi phiên{title ? ` “${title}”` : ''}. Nếu có nhầm lẫn, hãy báo mentor. Bạn có thể xin vào lại bằng cách nhập tên và mã phòng lần nữa.</p>
          <Button variant="secondary" size="lg" icon="arrow-left" block={!desk} onClick={() => { if (activeId !== null) clearParticipantToken(activeId); setHasToken(false); setMe(null); setMeState('idle'); }}>
            Về trang vào phòng
          </Button>
        </PageCard>,
      );
  }
}

// ── 8 · Cannot reach the mentor's machine ───────────────────────────────────────────────────────
function ConnLost({ desk, onRetry }: { desk: boolean; onRetry: () => void }) {
  return (
    <PageCard desk={desk} center>
      <HeroIcon name="wifi-off" tone="wrong" />
      <h1 style={mText.h1}>Mất kết nối tới máy mentor</h1>
      <p style={mText.meta}>Kiểm tra máy bạn đang dùng chung mạng Wi‑Fi / LAN với mentor. Bài đã lưu không bị mất.</p>
      <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--ink-100)', font: 'var(--type-code)', fontSize: 13, color: 'var(--ink-800)' }}>{window.location.host}</span>
      <Button size="lg" icon="refresh-cw" block={!desk} onClick={onRetry}>Thử lại</Button>
      <span style={mText.meta}>Trang tự thử lại sau 5 giây</span>
    </PageCard>
  );
}
