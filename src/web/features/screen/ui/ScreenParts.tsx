import type { LeaderboardResponse, RosterCounts } from '../../../../shared/api/index.js';
import type { SessionStartInfo } from '../../../../shared/session-start.js';
import { countReasonOf, formatClockTime, startRuleOf, type StartNotice } from '../../../shared/format/start.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { COUNT_REASON, GoRing, JoinedStat, NoSchedule, NoticeStack, ReadyMeter, StartClock, WhoLine } from '../../../shared/ui/start/StartParts.js';
import { LeaderboardView } from '../../../shared/leaderboard/LeaderboardView.js';
import { formatRoomCode } from '../../../shared/room/room-code.js';
import { countdownLevel, formatCountdown, formatMinutes } from '../../../shared/format/countdown.js';

const label = { font: '600 32px/1.2 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--screen-meta)' } as const;
const chip = { padding: '14px 24px', borderRadius: 'var(--radius-lg)', background: 'var(--screen-panel)', border: '1px solid var(--screen-line)', font: '600 36px/1.2 var(--font-sans)', color: '#fff', animation: 'pq-pop-in var(--dur-pop) var(--ease-pop)' } as const;

function JoinAddress({ host }: { host: string }) {
  return <span style={{ font: '700 var(--fs-screen-hero)/1 var(--font-mono)', color: 'var(--sun-400)', wordBreak: 'break-all' }}>{host}</span>;
}

const pjLabel = { font: '600 28px/1.2 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--screen-meta)' } as const;

/**
 * The lobby on the projector (PRODUCT.md §7.31h, Design System 7 P9): how to join on the left; on the right the start
 * (scheduled time or "Chờ mentor bắt đầu"), "Sẵn sàng X/Y" and who decides. Counts only: never who is not ready.
 */
export function Lobby({ names, host, roomCode, roomHidden, roster, limitMinutes = null, start = null, leftMs = null, notices = [], changed = false }: {
  names: string[]; host: string; roomCode: string | null; roomHidden: boolean; roster: RosterCounts | null; limitMinutes?: number | null;
  start?: SessionStartInfo | null; leftMs?: number | null; notices?: StartNotice[]; changed?: boolean;
}) {
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateRows: notices.length ? 'auto minmax(0,1fr)' : 'minmax(0,1fr)', gap: 32 }}>
      {notices.length > 0 && <NoticeStack size="screen" items={notices} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,740px)', gap: 64, minHeight: 0 }}>
        <div style={{ display: 'grid', gap: 48, alignContent: 'start', minWidth: 0 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <span style={pjLabel}>Mở trình duyệt và vào</span>
            <span style={{ font: '700 72px/1 var(--font-mono)', color: 'var(--sun-400)', wordBreak: 'break-all' }}>{host}</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={pjLabel}>Mã phòng</span>
              {roomCode
                ? <span style={{ font: '700 104px/1 var(--font-mono)', color: '#fff', letterSpacing: '0.08em' }}>{formatRoomCode(roomCode)}</span>
                : <span style={{ font: '600 40px/1.2 var(--font-sans)', color: 'var(--screen-meta)' }}>{roomHidden ? 'Hỏi mentor mã phòng' : '…'}</span>}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 20, paddingTop: 32, borderTop: '2px solid var(--screen-line)', minHeight: 0 }}>
            {roster ? <JoinedStat size="screen" joined={roster.joinedCount} total={roster.rosterSize} /> : <span style={pjLabel}>Trong phòng · {names.length}</span>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, overflow: 'hidden' }}>{names.map(n => <span key={n} style={{ ...chip, padding: roster ? '10px 20px' : '14px 24px', font: `600 ${roster ? 28 : 32}px/1.2 var(--font-sans)` }}>{n}</span>)}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 36, alignContent: 'start', padding: 40, borderRadius: 'var(--radius-xl)', background: 'var(--screen-panel)', border: '1px solid var(--screen-line)', minWidth: 0 }}>
          {start?.scheduledAt != null
            ? <StartClock size="screen" at={start.scheduledAt} leftMs={leftMs} changed={changed} limitMinutes={limitMinutes} />
            : <NoSchedule size="screen" limited={limitMinutes !== null} />}
          {start && (
            <div style={{ display: 'grid', gap: 20 }}>
              <ReadyMeter size="screen" ready={start.ready.count} total={start.ready.total} />
              <WhoLine size="screen" rule={startRuleOf(start)} at={start.scheduledAt} leftMs={leftMs} min={start.readyMin} timeShown={start.scheduledAt !== null} />
            </div>
          )}
          {limitMinutes !== null && <span style={{ font: '500 30px/1.3 var(--font-sans)', color: 'var(--screen-meta)' }}>Thời gian làm bài: <b style={{ color: '#fff' }}>{formatMinutes(limitMinutes)}</b></span>}
        </div>
      </div>
    </div>
  );
}

/** The 10-second countdown fills the projector (Design System 7 P10): one big digit, and why it runs. */
export function StartCountdown({ start, leftMs, limitMinutes, reduced }: { start: SessionStartInfo; leftMs: number | null; limitMinutes: number | null; reduced: boolean }) {
  const n = Math.ceil((leftMs ?? 0) / 1000);
  const reasonKind = countReasonOf(start);
  const [icon, text] = COUNT_REASON[reasonKind];
  return (
    <div role="region" aria-label="Đếm ngược bắt đầu" style={{ height: '100%', display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 36, textAlign: 'center' }}>
      <span style={{ font: '700 44px/1.1 var(--font-sans)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: '#fff' }}>{n > 0 ? 'Bắt đầu sau' : 'Vào bài'}</span>
      <GoRing n={n} d={500} tone="screen" reduced={reduced} center={n > 0 ? undefined : 'Bắt đầu'} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 18, padding: '14px 32px', borderRadius: 'var(--radius-pill)', background: 'var(--brand-500)', color: '#fff', font: '700 44px/1.2 var(--font-sans)' }}>
        <Icon name={icon} size={40} />{text}{reasonKind === 'early' && start.scheduledAt !== null ? ` — giờ hẹn là ${formatClockTime(start.scheduledAt)}` : ''}
      </span>
      <span style={{ font: '400 32px/1.3 var(--font-sans)', color: 'var(--screen-meta)' }}>Câu 1 hiện trên máy học viên khi về 0{limitMinutes !== null ? ` · giờ làm bài ${formatMinutes(limitMinutes)} tính từ lúc đó` : ''}</span>
    </div>
  );
}

// One clock for the whole room (PRODUCT.md §7.27h): amber for the last 5 minutes, red for the last one. Never anyone's own time.
function ScreenClock({ ms }: { ms: number }) {
  const level = countdownLevel(ms);
  const color = level === 'normal' ? '#fff' : level === 'soon' ? 'var(--sun-400)' : 'var(--wrong-500)';
  return (
    <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
      <span style={label}>{level === 'up' ? 'Hết giờ' : 'Còn lại'}</span>
      <span role="timer" className="pq-tabular" style={{ font: '700 var(--fs-screen-hero)/1 var(--font-mono)', color }}>{formatCountdown(ms)}</span>
    </div>
  );
}

export function Running({ board, total, timeLeft = null }: { board: LeaderboardResponse | null; total: number; timeLeft?: number | null }) {
  const submitted = board?.hidden ? board.submitted.length : board?.entries.length ?? 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: 56, height: '100%' }}>
      <div style={{ display: 'grid', gap: 56, alignContent: 'start' }}>
        {timeLeft !== null && <ScreenClock ms={timeLeft} />}
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <span style={label}>Đã nộp</span>
          <span className="pq-tabular" style={{ font: '700 var(--fs-screen-hero)/1 var(--font-mono)', color: '#fff' }}>{submitted}<span style={{ color: 'var(--screen-meta)', fontSize: 56 }}>/{total}</span></span>
        </div>
      </div>
      <LeaderboardView size="screen" limit={10} entries={board?.entries ?? []} provisional={board?.provisional ?? true} hidden={board?.hidden} submitted={board?.submitted} />
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
