import type { ReactNode } from 'react';
import { useJoinHost } from '../../../shared/room/join-url.js';
import { formatRoomCode } from '../../../shared/room/room-code.js';
import { ScreenLayout } from '../../../shared/ui/screen/ScreenLayout.js';
import { ScreenStage } from '../../../shared/ui/screen/ScreenStage.js';
import { useScreen } from '../application/use-screen.js';
import { Ended, Lobby, Running, Waiting } from './ScreenParts.js';

// "/screen" — public, read-only, needs no interaction: it follows the active session (else the one that just ended)
// and switches by itself when the mentor opens the next one.
export function ScreenPage() {
  const { state, gateway } = useScreen();
  const { latest, names, board, roomCode, roomHidden } = state;
  const join = useJoinHost(() => gateway.getJoinHosts());

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
