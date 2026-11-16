import type { SessionDetail, SessionParticipantInfo } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';

/** Members waiting for the mentor to let them in (always in the lobby; latecomers while running). */
export function PendingCard({ status, pending, working, onApprove, onApproveAll, onReject }: {
  status: SessionDetail['status']; pending: SessionParticipantInfo[]; working: boolean;
  onApprove: (id: number) => void; onApproveAll: () => void; onReject: (p: SessionParticipantInfo) => void;
}) {
  return (
    <Card title={`Chờ duyệt · ${pending.length}`} subtitle={status === 'lobby' ? 'Duyệt để học viên vào phòng chờ' : 'Vào trễ khi phiên đang chạy'}>
      <div style={{ display: 'grid', gap: 8 }}>
        {pending.length > 1 && <Button size="sm" icon="users" disabled={working} onClick={onApproveAll}>Duyệt tất cả ({pending.length})</Button>}
        {pending.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ font: 'var(--type-ui)', fontWeight: 600, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{p.displayName}</span>
            <Button size="sm" icon="user-check" disabled={working} onClick={() => onApprove(p.id)}>Duyệt</Button>
            <Button size="sm" variant="ghost" icon="user-x" disabled={working} onClick={() => onReject(p)}>Từ chối</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
