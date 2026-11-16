import { Icon } from './Icon.js';

const clock = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * Is a member's browser still talking to the server? Icon AND words, never colour alone (PRODUCT.md §7.23b). Mentor only.
 * `lastSeenAt` null with `online` false = the server has not heard from them since it started.
 */
export function ConnectionStatus({ online, lastSeenAt }: { online: boolean; lastSeenAt: number | null }) {
  if (online) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--correct-600)', whiteSpace: 'nowrap' }}><Icon name="wifi" size={14} />Online</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--sun-ink)', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <Icon name="wifi-off" size={14} />{lastSeenAt === null ? 'Chưa thấy kết nối' : `Ngắt từ ${clock(lastSeenAt)}`}
    </span>
  );
}
