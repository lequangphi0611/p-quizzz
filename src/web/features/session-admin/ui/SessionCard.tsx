import type { SessionSummary } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { SessionSlot } from '../../../shared/ui/SessionSlot.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import { formatRoomCode } from '../../../shared/room/room-code.js';

/** One open session on the overview: slot, the mentor's name for it, the exam, room code, how many are in, and its two shortcuts. */
export function SessionCard({ session: s, onControl, onScreen }: { session: SessionSummary; onControl: () => void; onScreen: () => void }) {
  return (
    <article aria-label={`Phiên ${s.name}`} style={{ display: 'grid', gap: 14, padding: 20, background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <SessionSlot n={s.slot} size={28} />
        <h2 style={{ margin: 0, flex: 1, minWidth: 0, font: 'var(--type-h2)', fontSize: 18, color: 'var(--text-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>{s.name}</h2>
        <StatusBadge status={s.status} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="file-text" size={14} />{s.examTitle}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="hash" size={14} /><span className="pq-tabular" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-title)', fontWeight: 700 }}>{s.roomCode ? formatRoomCode(s.roomCode) : '—'}</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="users" size={14} /><span className="pq-tabular" style={{ fontFamily: 'var(--font-mono)' }}>{s.participantCount}</span> người</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button size="sm" icon="chevron-right" onClick={onControl}>Điều khiển</Button>
        <Button size="sm" variant="secondary" icon="presentation" onClick={onScreen}>Màn chiếu</Button>
      </div>
    </article>
  );
}
