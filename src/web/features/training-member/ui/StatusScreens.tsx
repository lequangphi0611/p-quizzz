import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { PageCard, mText } from '../../../shared/ui/member/member-shell.js';
import { Mono, Stack, StatusMark } from './parts.js';

/** Screen 9: the training is over, or the server no longer has this member's data. Back to the first page. */
export function EndedScreen({ desk, onHome }: { desk: boolean; onHome: () => void }) {
  return (
    <PageCard desk={desk} center>
      <StatusMark icon="door-open" tone="neutral" />
      <div style={{ display: 'grid', gap: 8 }}>
        <h1 style={mText.h1}>Buổi training đã kết thúc</h1>
        <p style={{ ...mText.meta, fontSize: 15 }}>Buổi này không còn dữ liệu của bạn: mentor đã kết thúc buổi và xoá dữ liệu, hoặc đã duyệt xoá dữ liệu sau khi bạn dừng gửi, hoặc đã mời bạn ra.</p>
      </div>
      <p style={mText.meta}>Nếu cấu hình vẫn còn trong thư mục bài tập, hãy xoá các mục hook gửi tới máy mentor khỏi <Mono>.claude/settings.local.json</Mono>.</p>
      <Button size="lg" icon="arrow-left" block={!desk} onClick={onHome}>Về trang đầu</Button>
    </PageCard>
  );
}

/** No token and the room code does not lead to an open training (or there is no code). One neutral message, as for exam rooms. */
export function LostScreen({ desk, message, onHome }: { desk: boolean; message: string; onHome: () => void }) {
  return (
    <PageCard desk={desk} center>
      <StatusMark icon="circle-alert" tone="warn" />
      <div style={{ display: 'grid', gap: 8 }}>
        <h1 style={mText.h1}>Không vào được buổi training</h1>
        <p style={{ ...mText.meta, fontSize: 15 }}>{message}</p>
      </div>
      <Button size="lg" icon="arrow-left" block={!desk} onClick={onHome}>Nhập lại mã phòng</Button>
    </PageCard>
  );
}

/** Screen 9b: nothing is known yet and the mentor's machine cannot be reached. It retries by itself. */
export function OfflineScreen({ desk, host, onRetry }: { desk: boolean; host: string; onRetry: () => void }) {
  return (
    <PageCard desk={desk} center>
      <StatusMark icon="wifi-off" tone="wrong" />
      <div style={{ display: 'grid', gap: 8 }}>
        <h1 style={mText.h1}>Mất kết nối tới máy mentor</h1>
        <p style={{ ...mText.meta, fontSize: 15 }}>Kiểm tra máy bạn đang dùng chung mạng Wi‑Fi / LAN với mentor. Những gì bạn đã làm không bị mất.</p>
      </div>
      <Mono>{host}</Mono>
      <Button size="lg" icon="refresh-cw" block={!desk} onClick={onRetry}>Thử lại</Button>
      <span style={mText.meta}>Trang tự thử lại sau 3 giây</span>
    </PageCard>
  );
}

export function LoadingScreen({ host }: { host: string }) {
  return (
    <Stack gap={8} center>
      <Spinner block label="Đang kết nối tới máy mentor…" />
      <span style={{ ...mText.meta, ...mText.mono, textAlign: 'center' }}>{host}</span>
    </Stack>
  );
}

/** Connection to the mentor's machine was lost while a screen is up: the screen stays, this bar says why it may be out of date. */
export function OfflineBanner() {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--warn-surface)', border: '1px solid var(--warn-border)', color: 'var(--warn-600)', font: 'var(--type-ui)', fontSize: 14, fontWeight: 600 }}>
      <Icon name="wifi-off" size={18} />
      <span>Mất kết nối tới máy mentor. Trang đang tự thử lại; thông tin dưới đây có thể chưa mới nhất.</span>
    </div>
  );
}
