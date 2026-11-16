import { Button } from '../../../shared/ui/Button.js';
import { HeroIcon, PageCard, mText } from '../../../shared/ui/member/member-shell.js';

// ── 8 · Cannot reach the mentor's machine ───────────────────────────────────────────────────────
export function ConnLost({ desk, onRetry }: { desk: boolean; onRetry: () => void }) {
  return (
    <PageCard desk={desk} center>
      <HeroIcon name="wifi-off" tone="wrong" />
      <h1 style={mText.h1}>Mất kết nối tới máy mentor</h1>
      <p style={mText.meta}>Kiểm tra máy bạn đang dùng chung mạng Wi‑Fi / LAN với mentor. Bài đã lưu không bị mất.</p>
      <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--ink-100)', font: 'var(--type-code)', fontSize: 13, color: 'var(--ink-800)' }}>{window.location.host}</span>
      <Button size="lg" icon="refresh-cw" block={!desk} onClick={onRetry}>Thử lại</Button>
      <span style={mText.meta}>Trang tự thử lại sau 5 giây</span>
    </PageCard>
  );
}
