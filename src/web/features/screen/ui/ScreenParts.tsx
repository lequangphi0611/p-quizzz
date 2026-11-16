import type { LeaderboardResponse } from '../../../../shared/api/index.js';
import { LeaderboardView } from '../../../shared/leaderboard/LeaderboardView.js';
import { formatRoomCode } from '../../../shared/room/room-code.js';

const label = { font: '600 32px/1.2 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--screen-meta)' } as const;
const chip = { padding: '14px 24px', borderRadius: 'var(--radius-lg)', background: 'var(--screen-panel)', border: '1px solid var(--screen-line)', font: '600 36px/1.2 var(--font-sans)', color: '#fff', animation: 'pq-pop-in var(--dur-pop) var(--ease-pop)' } as const;

function JoinAddress({ host }: { host: string }) {
  return <span style={{ font: '700 var(--fs-screen-hero)/1 var(--font-mono)', color: 'var(--sun-400)', wordBreak: 'break-all' }}>{host}</span>;
}

export function Lobby({ names, host, roomCode, roomHidden }: { names: string[]; host: string; roomCode: string | null; roomHidden: boolean }) {
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

export function Running({ board, total }: { board: LeaderboardResponse | null; total: number }) {
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

export function Ended({ board }: { board: LeaderboardResponse | null }) {
  const entries = board?.entries ?? [];
  return <LeaderboardView size="screen" entries={entries} provisional={board?.provisional ?? true} columns={entries.length > 8 ? 2 : 1} limit={16} />;
}

export function Waiting({ host }: { host: string }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeContent: 'center', gap: 40, textAlign: 'center' }}>
      <span style={{ font: '800 var(--fs-screen-title)/1.1 var(--font-sans)', color: '#fff' }}>Chờ mentor mở phiên thi</span>
      <div style={{ display: 'grid', gap: 16 }}><span style={label}>Địa chỉ để vào</span><JoinAddress host={host} /></div>
    </div>
  );
}
