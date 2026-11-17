import { Button } from './Button.js';
import { ConnectionStatus } from './ConnectionStatus.js';
import { Icon } from './Icon.js';

const clock = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export interface RejoinRequestView {
  id: number;
  requestedAt: number;
  claimantName: string;
  holderName: string;
  /** Mentor-only; null in a free session. */
  holderEmail: string | null;
  holderOnline: boolean;
  holderLastSeenAt: number | null;
}

/**
 * Someone says "that email/name is me". The mentor sees who holds the seat now (and whether they are still connected)
 * and who is asking, then answers. Three outcomes (PRODUCT.md §7.23c): let them back in KEEPING the work, "this is an
 * impostor" (the holder loses the attempt; hard to press by mistake: it is a quiet link, and a dialog confirms), reject.
 * Never answered by itself, even when the holder has dropped off.
 */
export function RejoinRequestCard({ request: r, layout, busy, onKeep, onImpostor, onReject }: {
  request: RejoinRequestView; layout: 'bell' | 'block'; busy: boolean; onKeep: () => void; onImpostor: () => void; onReject: () => void;
}) {
  const facts = (
    <div style={{ display: 'grid', gap: 4, minWidth: 0, font: 'var(--type-meta)' }}>
      <span>Người xin: <strong style={{ color: 'var(--text-title)', overflowWrap: 'anywhere' }}>“{r.claimantName}”</strong></span>
      <span style={{ overflowWrap: 'anywhere' }}>Đang giữ chỗ: <strong style={{ color: 'var(--text-title)' }}>{r.holderName}</strong>{r.holderEmail && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}> · {r.holderEmail}</span>}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><ConnectionStatus online={r.holderOnline} lastSeenAt={r.holderLastSeenAt} /><span style={{ color: 'var(--text-faint)' }}>Xin lúc {clock(r.requestedAt)}</span></span>
      {r.holderOnline && <span style={{ display: 'inline-flex', gap: 6, color: 'var(--sun-ink)' }}><Icon name="triangle-alert" size={14} style={{ marginTop: 2 }} />Người giữ chỗ vẫn đang online. Hỏi trực tiếp trước khi cho vào lại.</span>}
    </div>
  );
  const actions = (
    <div style={{ display: 'grid', gap: 8, justifyItems: layout === 'bell' ? 'start' : 'end' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button size="sm" icon="door-open" disabled={busy} onClick={onKeep}>Cho vào lại, giữ bài</Button>
        <Button size="sm" variant="secondary" icon="x" disabled={busy} onClick={onReject}>Từ chối</Button>
      </div>
      <button type="button" onClick={onImpostor} disabled={busy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, padding: 0, color: 'var(--wrong-600)', font: 'var(--type-meta)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.55 : 1 }}>
        <Icon name="shield-alert" size={14} />Đây là mạo danh…
      </button>
    </div>
  );
  if (layout === 'bell') return <div style={{ display: 'grid', gap: 10 }}>{facts}{actions}</div>;
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center' }}>
      <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--type-meta)', fontWeight: 700, color: 'var(--sun-ink)' }}><Icon name="door-open" size={14} />Yêu cầu vào lại</span>
        {facts}
      </div>
      {actions}
    </div>
  );
}
