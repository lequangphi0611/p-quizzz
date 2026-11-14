export type SessionStatus = 'draft' | 'lobby' | 'running' | 'closed' | 'finalized';
const LABELS: Record<SessionStatus, string> = { draft: 'Nháp', lobby: 'Phòng chờ', running: 'Đang thi', closed: 'Đã đóng', finalized: 'Đã chốt' };
export function StatusBadge({ status = 'draft', label, size = 'md' }: { status?: SessionStatus; label?: string; size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: big ? '6px 14px' : '3px 10px', borderRadius: 'var(--radius-pill)', font: 'var(--type-label)', fontSize: big ? 14 : 12, whiteSpace: 'nowrap', background: 'var(--status-' + status + '-surface)', color: 'var(--status-' + status + '-ink)' }}>
      <span style={{ width: big ? 8 : 7, height: big ? 8 : 7, borderRadius: '50%', background: 'currentColor', animation: status === 'running' || status === 'lobby' ? 'pq-pulse 1.6s ease-in-out infinite' : 'none' }} />
      {label || LABELS[status]}
    </span>
  );
}