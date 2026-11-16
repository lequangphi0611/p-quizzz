import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { ScreenSessionItem } from '../../../../shared/api/index.js';
import { useJoinHost } from '../../../shared/room/join-url.js';
import { formatRoomCode } from '../../../shared/room/room-code.js';
import { SessionSlot } from '../../../shared/ui/SessionSlot.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import { ScreenLayout } from '../../../shared/ui/screen/ScreenLayout.js';
import { ScreenStage } from '../../../shared/ui/screen/ScreenStage.js';
import { useScreen, useScreenGateway } from '../application/use-screen.js';
import { decideScreenTarget } from '../domain/screen-target.js';
import { Ended, Lobby, Running, Waiting } from './ScreenParts.js';

// "/screen/:sessionId" — public, read-only, needs no interaction: it follows that one session (several may be open at
// once). It shows the exam title only, never the mentor's session name.
export function ScreenPage() {
  const id = Number(useParams().sessionId);
  return Number.isInteger(id) && id > 0 ? <SessionScreen sessionId={id} /> : <ScreenChooser />;
}

function SessionScreen({ sessionId }: { sessionId: number }) {
  const { state, gateway } = useScreen(sessionId);
  const { session, names, board, roomCode, roomHidden } = state;
  const join = useJoinHost(() => gateway.getJoinHosts());

  const status = session?.status;
  let body: ReactNode = null;
  if (session === null) body = <Waiting host={join.host} />;
  else if (status === 'lobby') body = <Lobby names={names} host={join.host} roomCode={roomCode} roomHidden={roomHidden} />;
  else if (status === 'running') body = <Running board={board} total={names.length} />;
  else if (status === 'closed' || status === 'finalized') body = <Ended board={board} />;

  return (
    <ScreenStage>
      <ScreenLayout
        examTitle={session?.title}
        status={status === 'lobby' || status === 'running' || status === 'closed' || status === 'finalized' ? status : undefined}
        joinUrl={status === 'running' ? (roomCode ? `${join.host} · ${formatRoomCode(roomCode)}` : join.host) : status === 'closed' || status === 'finalized' ? join.host : undefined}
      >
        {body}
      </ScreenLayout>
    </ScreenStage>
  );
}

// "/screen" with no session in the address (the mentor's machine): the only open session opens by itself, several ask
// which one to show, and with none open the session that ended last shows its results.
function ScreenChooser() {
  const gateway = useScreenGateway();
  const nav = useNavigate();
  const join = useJoinHost(() => gateway.getJoinHosts());
  const [choices, setChoices] = useState<ScreenSessionItem[] | null>(null);
  const [none, setNone] = useState(false);

  useEffect(() => {
    let live = true;
    const look = async () => {
      try {
        const target = decideScreenTarget(await gateway.listSessions());
        if (!live) return;
        if (target.kind === 'go') nav(`/screen/${target.sessionId}`, { replace: true });
        else if (target.kind === 'choose') { setChoices(target.sessions); setNone(false); }
        else { setChoices(null); setNone(true); }
      } catch { if (live) { setChoices(null); setNone(true); } } // not the mentor's machine, or the server is down
    };
    void look();
    const t = setInterval(look, 5000); // waits for the mentor to open a session
    return () => { live = false; clearInterval(t); };
  }, [gateway, nav]);

  return (
    <ScreenStage>
      <ScreenLayout examTitle={choices ? 'Chọn phiên để chiếu' : undefined}>
        {choices ? (
          <div style={{ display: 'grid', gap: 24, alignContent: 'start', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {choices.map(s => (
              <button key={s.id} type="button" onClick={() => nav(`/screen/${s.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '28px 32px', borderRadius: 'var(--radius-lg)', background: 'var(--screen-panel)', border: '1px solid var(--screen-line-strong)', color: '#fff', cursor: 'pointer', textAlign: 'left', font: '700 40px/1.2 var(--font-sans)' }}>
                <SessionSlot n={s.slot} size={48} />
                <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 8 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ font: '500 28px/1.2 var(--font-sans)', color: 'var(--screen-meta)' }}>{s.title}</span>
                </span>
                <StatusBadge status={s.status} size="screen" />
              </button>
            ))}
          </div>
        ) : none ? <Waiting host={join.host} /> : null}
      </ScreenLayout>
    </ScreenStage>
  );
}
