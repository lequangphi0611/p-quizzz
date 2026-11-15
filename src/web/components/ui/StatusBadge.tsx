export type SessionStatus = 'draft' | 'lobby' | 'running' | 'closed' | 'finalized';
const LABELS: Record<SessionStatus, string> = { draft: 'Nháp', lobby: 'Phòng chờ', running: 'Đang thi', closed: 'Đã đóng', finalized: 'Đã chốt' };
const SZ = { md: { p: '3px 10px', fs: 12, dot: 7, gap: 6 }, lg: { p: '6px 14px', fs: 14, dot: 8, gap: 6 }, screen: { p: '8px 18px', fs: 20, dot: 12, gap: 10 } };
export function StatusBadge({ status = 'draft', label, size = 'md' }: { status?: SessionStatus; label?: string; size?: 'md' | 'lg' | 'screen' }) {
  const s = SZ[size];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: s.gap, padding: s.p, borderRadius: 'var(--radius-pill)', font: 'var(--type-label)', fontSize: s.fs, whiteSpace: 'nowrap', flex: 'none', background: 'var(--status-' + status + '-surface)', color: 'var(--status-' + status + '-ink)' }}>
      <span style={{ width: s.dot, height: s.dot, borderRadius: '50%', background: 'currentColor', animation: status === 'running' || status === 'lobby' ? 'pq-pulse 1.6s ease-in-out infinite' : 'none' }} />
      {label || LABELS[status]}
    </span>
  );
}
