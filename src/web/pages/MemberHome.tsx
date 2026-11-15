import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { ActiveSession, JoinResponse, MeResponse } from '../../shared/api/index.js';
import { MemberLayout } from '../layouts/MemberLayout.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { Icon } from '../components/ui/Icon.js';
import { Spinner } from '../components/ui/Spinner.js';
import { TextField } from '../components/ui/TextField.js';
import { api, ApiError, clearParticipantToken, getParticipantToken, setCurrentSessionId, setParticipantToken } from '../lib/api.js';
import { decideScreen, type MeState } from '../lib/member-screen.js';
import { useSessionEvents } from '../lib/useSessionEvents.js';

const POLL_MS = 5000;
const center = { display: 'grid', gap: 20, paddingTop: 24 } as const;
const h1 = { font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 } as const;
const meta = { font: 'var(--type-meta)', color: 'var(--text-meta)', margin: 0 } as const;

function CenterCard({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <Card>
      <div style={{ display: 'grid', gap: 14, justifyItems: 'center', textAlign: 'center', padding: '12px 0' }}>
        {icon}
        <h1 style={h1}>{title}</h1>
        {children}
      </div>
    </Card>
  );
}

function JoinForm({ session, onJoined }: { session: ActiveSession; onJoined: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post<JoinResponse>(`/api/sessions/${session.id}/join`, { displayName: name });
      setParticipantToken(session.id, res.token);
      setCurrentSessionId(session.id);
      await onJoined();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không vào được phiên');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={center}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 style={h1}>Vào phiên thi</h1>
        <p style={meta}>Tên này sẽ hiện trên bảng xếp hạng.{session.status === 'running' && ' Phiên đã bắt đầu — sau khi vào, bạn cần chờ mentor duyệt.'}</p>
      </div>
      <TextField label="Tên của bạn" size="lg" value={name} onChange={v => { setName(v); setError(''); }} placeholder="vd. Minh Anh" maxLength={30} autoFocus autoComplete="nickname" error={error} />
      <Button type="submit" size="lg" block icon="log-in" loading={busy} disabled={!name.trim()}>{session.status === 'running' ? 'Xin vào phiên' : 'Vào phòng chờ'}</Button>
    </form>
  );
}

// "/" — decides what a member sees from three facts: is there an active session, do I hold a token, what does /api/me say.
export function MemberHome() {
  const [active, setActive] = useState<ActiveSession | null | undefined>(undefined);
  const [hasToken, setHasToken] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meState, setMeState] = useState<MeState>('idle');
  const activeId = active?.id ?? null;
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;
  const meSeq = useRef(0);
  const meRef = useRef<MeResponse | null>(null);
  meRef.current = me;

  const fetchActive = useCallback(async () => {
    try {
      setActive(await api.get<ActiveSession | null>('/api/sessions/active'));
    } catch { /* keep what we have; the next poll retries */ }
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
  const title = me?.session.title ?? active?.title;
  const name = me && (screen === 'pending' || screen === 'lobby' || screen === 'running') ? me.participant.displayName : undefined;

  const view = (() => {
    switch (screen) {
      case 'loading':
        return <div style={center}><Spinner block label="Đang tải…" /></div>;
      case 'error':
        return <div style={center}><ErrorMessage title="Không tải được phiên" message="Kiểm tra kết nối mạng rồi thử lại." onRetry={() => activeId !== null && void fetchMe(activeId)} /></div>;
      case 'none':
        return <div style={center}><CenterCard icon={<Icon name="clock" size={32} color="var(--text-faint)" />} title="Chưa có phiên thi nào đang mở"><p style={meta}>Trang sẽ tự cập nhật khi mentor mở phiên.</p></CenterCard></div>;
      case 'join':
        return <JoinForm session={active!} onJoined={() => fetchMe(active!.id)} />;
      case 'pending':
        return <div style={center}><CenterCard icon={<Spinner size={28} />} title="Đang chờ mentor duyệt"><p style={meta}>Phiên đã bắt đầu. Mentor sẽ cho bạn vào trong giây lát — màn hình tự chuyển khi được duyệt.</p></CenterCard></div>;
      case 'lobby':
        return (
          <div style={center}>
            <CenterCard icon={<Spinner size={28} />} title="Đang chờ mentor bắt đầu">
              <p style={meta}>Đã có <b style={{ color: 'var(--text-title)' }}>{me!.session.participantCount} người</b> trong phòng chờ. Màn hình sẽ tự chuyển khi phiên bắt đầu.</p>
            </CenterCard>
          </div>
        );
      case 'running':
        return <div style={center}><CenterCard icon={<Icon name="play" size={32} color="var(--correct-600)" />} title="Phiên đã bắt đầu"><p style={meta}>Màn hình làm bài sẽ có ở bước tiếp theo.</p></CenterCard></div>;
      case 'ended':
        return <div style={center}><CenterCard icon={<Icon name="flag" size={32} color="var(--text-faint)" />} title="Phiên thi đã kết thúc" /></div>;
      case 'kicked':
        return (
          <div style={center}>
            <ErrorMessage title="Bạn đã bị mời ra khỏi phiên" message="Bạn có thể vào lại bằng một tên khác." />
            <Button size="lg" block icon="log-in" onClick={() => { if (activeId !== null) clearParticipantToken(activeId); setHasToken(false); setMe(null); setMeState('idle'); }}>
              Vào lại bằng tên khác
            </Button>
          </div>
        );
    }
  })();

  return <MemberLayout sessionTitle={title} displayName={name}>{view}</MemberLayout>;
}
