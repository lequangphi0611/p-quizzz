import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ActiveSession, LeaderboardResponse, PublicParticipant, ScreenRoom } from '../../shared/api/index.js';
import { LeaderboardView } from '../components/Leaderboard.js';
import { ScreenStage } from '../shared/ui/screen/ScreenStage.js';
import { ScreenLayout } from '../shared/ui/screen/ScreenLayout.js';
import { api, ApiError } from '../lib/api.js';
import { useJoinHost } from '../lib/join-url.js';
import { formatRoomCode } from '../lib/room-code.js';
import { useSessionEvents } from '../shared/events/use-session-events.js';

const POLL_MS = 5000;

const label = { font: '600 32px/1.2 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--screen-meta)' } as const;
const chip = { padding: '14px 24px', borderRadius: 'var(--radius-lg)', background: 'var(--screen-panel)', border: '1px solid var(--screen-line)', font: '600 36px/1.2 var(--font-sans)', color: '#fff', animation: 'pq-pop-in var(--dur-pop) var(--ease-pop)' } as const;

function JoinAddress({ host }: { host: string }) {
  return <span style={{ font: '700 var(--fs-screen-hero)/1 var(--font-mono)', color: 'var(--sun-400)', wordBreak: 'break-all' }}>{host}</span>;
}

function Lobby({ names, host, roomCode, roomHidden }: { names: string[]; host: string; roomCode: string | null; roomHidden: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 48, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 96, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <span style={label}>Mở trình duyệt và vào</span>
          <JoinAddress host={host} />
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <span style={label}>Mã phòng</span>
          {roomCode
            ? <span style={{ font: '700 var(--fs-screen-hero)/1 var(--font-mono)', color: '#fff', letterSpacing: '0.08em' }}>{formatRoomCode(roomCode)}</span>
            : <span style={{ font: '600 40px/1.2 var(--font-sans)', color: 'var(--screen-meta)' }}>{roomHidden ? 'Hỏi mentor mã phòng' : '…'}</span>}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 24, alignContent: 'start', minHeight: 0 }}>
        <span style={label}>Đã vào · <span style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{names.length}</span></span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, overflow: 'hidden' }}>{names.map(n => <span key={n} style={chip}>{n}</span>)}</div>
      </div>
    </div>
  );
}

function Running({ board, total }: { board: LeaderboardResponse | null; total: number }) {
  const submitted = board?.entries.length ?? 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: 56, height: '100%' }}>
      <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <span style={label}>Đã nộp</span>
        <span className="pq-tabular" style={{ font: '700 var(--fs-screen-hero)/1 var(--font-mono)', color: '#fff' }}>{submitted}<span style={{ color: 'var(--screen-meta)', fontSize: 56 }}>/{total}</span></span>
      </div>
      <LeaderboardView size="screen" limit={10} entries={board?.entries ?? []} provisional={board?.provisional ?? true} />
    </div>
  );
}

function Ended({ board }: { board: LeaderboardResponse | null }) {
  const entries = board?.entries ?? [];
  return <LeaderboardView size="screen" entries={entries} provisional={board?.provisional ?? true} columns={entries.length > 8 ? 2 : 1} limit={16} />;
}

function Waiting({ host }: { host: string }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeContent: 'center', gap: 40, textAlign: 'center' }}>
      <span style={{ font: '800 var(--fs-screen-title)/1.1 var(--font-sans)', color: '#fff' }}>Chờ mentor mở phiên thi</span>
      <div style={{ display: 'grid', gap: 16 }}><span style={label}>Địa chỉ để vào</span><JoinAddress host={host} /></div>
    </div>
  );
}

// "/screen" — public, read-only, needs no interaction: it follows the active session (else the one that just ended)
// and switches by itself when the mentor opens the next one.
export function ScreenPage() {
  const [latest, setLatest] = useState<ActiveSession | null | undefined>(undefined);
  const [names, setNames] = useState<string[]>([]);
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomHidden, setRoomHidden] = useState(false); // this machine is not the mentor's: the server will not hand out the code
  const join = useJoinHost();
  const idRef = useRef<number | null>(null);
  idRef.current = latest?.id ?? null;
  const seq = useRef(0);

  const fetchLatest = useCallback(async () => {
    try { setLatest(await api.get<ActiveSession | null>('/api/sessions/latest')); } catch { /* keep showing what we have */ }
  }, []);

  const fetchData = useCallback(async () => {
    const id = idRef.current;
    if (id === null) return;
    const n = ++seq.current;
    try {
      const [p, b] = await Promise.all([api.get<PublicParticipant[]>(`/api/sessions/${id}/participants`), api.get<LeaderboardResponse>(`/api/sessions/${id}/leaderboard`)]);
      if (n !== seq.current || idRef.current !== id) return;
      setNames(p.map(x => x.displayName));
      setBoard(b);
    } catch { /* the next event or poll refreshes */ }
    try {
      const r = await api.get<ScreenRoom>('/api/screen/room');
      if (idRef.current === id) { setRoomCode(r.roomCode); setRoomHidden(false); }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) { setRoomCode(null); setRoomHidden(true); }
    }
  }, []);

  useEffect(() => {
    void fetchLatest();
    const t = setInterval(() => { void fetchLatest(); void fetchData(); }, POLL_MS);
    return () => clearInterval(t);
  }, [fetchLatest, fetchData]);

  // A different session (the mentor opened the next one): drop the old data and load the new.
  const id = latest?.id ?? null;
  useEffect(() => { setNames([]); setBoard(null); setRoomCode(null); void fetchData(); }, [id, fetchData]);

  useSessionEvents(id, {
    session: () => { void fetchLatest(); void fetchData(); },
    participants: () => { void fetchData(); },
    leaderboard: () => { void fetchData(); },
  });

  const status = latest?.status;
  let body: ReactNode = null;
  if (latest === null) body = <Waiting host={join.host} />;
  else if (status === 'lobby') body = <Lobby names={names} host={join.host} roomCode={roomCode} roomHidden={roomHidden} />;
  else if (status === 'running') body = <Running board={board} total={names.length} />;
  else if (status === 'closed' || status === 'finalized') body = <Ended board={board} />;

  return (
    <ScreenStage>
      <ScreenLayout
        examTitle={latest?.title}
        status={status === 'lobby' || status === 'running' || status === 'closed' || status === 'finalized' ? status : undefined}
        joinUrl={status === 'running' ? (roomCode ? `${join.host} · ${formatRoomCode(roomCode)}` : join.host) : status === 'closed' || status === 'finalized' ? join.host : undefined}
      >
        {body}
      </ScreenLayout>
    </ScreenStage>
  );
}
