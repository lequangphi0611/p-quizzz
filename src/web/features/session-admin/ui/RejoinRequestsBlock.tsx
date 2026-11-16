import type { SessionDetail } from '../../../../shared/api/index.js';
import { Card } from '../../../shared/ui/Card.js';
import { RejoinRequestCard } from '../../../shared/ui/RejoinRequestCard.js';

/** Requests to take over a seat, on the session page: they block someone from the room, so they come first. */
export function RejoinRequestsBlock({ detail, working, onKeep, onImpostor, onReject }: {
  detail: SessionDetail; working: boolean; onKeep: (id: number) => void; onImpostor: (id: number) => void; onReject: (id: number) => void;
}) {
  if (detail.rejoinRequests.length === 0) return null;
  const byId = new Map(detail.participants.map(p => [p.id, p]));
  return (
    <Card tone="sunken" title={`Xin vào lại · ${detail.rejoinRequests.length}`} subtitle="Có người nhập email/tên đã có người vào và nói đó là họ. Không ai tự được duyệt." style={{ border: '1px solid var(--sun-300)', background: 'var(--sun-100)' }}>
      <div style={{ display: 'grid', gap: 16 }}>
        {detail.rejoinRequests.map(r => {
          const holder = byId.get(r.participantId);
          return (
            <RejoinRequestCard key={r.id} layout="block" busy={working}
              request={{ id: r.id, requestedAt: r.requestedAt, claimantName: r.claimantName, holderName: holder?.displayName ?? '—', holderEmail: holder?.email ?? null, holderOnline: holder?.connection.online ?? false, holderLastSeenAt: holder?.connection.lastSeenAt ?? null }}
              onKeep={() => onKeep(r.id)} onImpostor={() => onImpostor(r.id)} onReject={() => onReject(r.id)} />
          );
        })}
      </div>
    </Card>
  );
}
