import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { HeroIcon, InfoBox, InfoRow, PageCard, mText } from '../../../shared/ui/member/member-shell.js';
import type { RejoinState } from '../domain/member-screen.js';

// ── 2 · The email/name already has someone behind it ───────────────────────────────────────────────
// Shown instead of a dead-end error: "that is me" asks the mentor; "not me" goes back to the form. It never says
// anything about the person already inside (PRODUCT.md §7.23a).
export function TakenConfirm({ desk, kind, typed, busy, error, onAsk, onBack }: {
  desk: boolean; kind: 'email' | 'name'; typed: string; busy: boolean; error: string; onAsk: () => void; onBack: () => void;
}) {
  const what = kind === 'email' ? 'email' : 'tên';
  return (
    <PageCard desk={desk} center>
      <HeroIcon name="user-check" tone="warn" />
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 style={mText.h1}>{kind === 'email' ? 'Email này đã có người vào' : 'Tên này đã có người dùng'}</h1>
        <p style={mText.meta}>Đã có người vào bằng {what} này. Nếu đó là bạn (ví dụ lỡ đóng trình duyệt hoặc đổi máy), hãy xin mentor cho vào lại.</p>
      </div>
      <InfoBox><InfoRow icon={kind === 'email' ? 'mail' : 'user'} k={`Bạn đã nhập`} v={<span style={{ ...mText.mono, overflowWrap: 'anywhere' }}>{typed}</span>} /></InfoBox>
      {error && <ErrorMessage message={error} />}
      <div style={{ display: 'grid', gap: 10, width: '100%' }}>
        <Button size="lg" block icon="door-open" loading={busy} onClick={onAsk}>Đúng là tôi, xin vào lại</Button>
        <Button size="lg" block variant="secondary" disabled={busy} onClick={onBack}>Không phải tôi, nhập lại</Button>
      </div>
      <p style={mText.meta}>Mentor xem và quyết định. Bài đang làm dở vẫn được giữ.</p>
    </PageCard>
  );
}

// ── 3 · Waiting for the mentor ───────────────────────────────────────────────────────────────────────
export function RejoinWait({ desk, state, offline, title, onCancel, onBack }: {
  desk: boolean; state: RejoinState; offline: boolean; title: string | undefined; onCancel: () => void; onBack: () => void;
}) {
  if (state === 'rejected') {
    return (
      <PageCard desk={desk} center>
        <HeroIcon name="user-x" tone="ink" />
        <div style={{ display: 'grid', gap: 6 }}>
          <h1 style={mText.h1}>Mentor chưa cho bạn vào lại</h1>
          <p style={mText.meta}>Hãy kiểm tra lại email hoặc tên, hoặc nói trực tiếp với mentor. Bạn có thể nhập lại và gửi yêu cầu mới.</p>
        </div>
        <Button size="lg" block={!desk} variant="secondary" icon="arrow-left" onClick={onBack}>Nhập lại</Button>
      </PageCard>
    );
  }
  if (state === 'expired') {
    return (
      <PageCard desk={desk} center>
        <HeroIcon name="clock" tone="ink" />
        <div style={{ display: 'grid', gap: 6 }}>
          <h1 style={mText.h1}>Yêu cầu đã hết hiệu lực</h1>
          <p style={mText.meta}>Phiên{title ? ` “${title}”` : ''} đã đóng trước khi mentor trả lời.</p>
        </div>
        <Button size="lg" block={!desk} variant="secondary" icon="arrow-left" onClick={onBack}>Về trang vào phòng</Button>
      </PageCard>
    );
  }
  return (
    <PageCard desk={desk} center>
      <HeroIcon name="hourglass" tone="warn" />
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 style={mText.h1}>Đang chờ mentor cho vào lại</h1>
        <p style={mText.meta}>Giữ trang này mở: màn hình tự chuyển khi mentor đồng ý. Bài đang làm dở sẽ được giữ nguyên.</p>
      </div>
      {offline ? <ErrorMessage tone="warning" message="Mất kết nối tới máy của mentor. Yêu cầu vẫn được giữ, trang sẽ tự thử lại." /> : <Spinner label="Đang chờ mentor…" />}
      <Button size="lg" block={!desk} variant="ghost" onClick={onCancel}>Huỷ yêu cầu</Button>
    </PageCard>
  );
}

// ── 4 · This device was replaced ───────────────────────────────────────────────────────────────────
export function Replaced({ desk, onLeave }: { desk: boolean; onLeave: () => void }) {
  return (
    <PageCard desk={desk} center>
      <HeroIcon name="shield-alert" tone="warn" />
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 style={mText.h1}>Bài của bạn đang được mở ở thiết bị khác</h1>
        <p style={mText.meta}>Mentor đã cho bạn vào lại trên thiết bị đó. Trang này đã dừng để bài không bị ghi ở hai nơi.</p>
      </div>
      <ErrorMessage tone="warning" message="Nếu không phải bạn mở, hãy báo mentor ngay." />
      <Button size="lg" block={!desk} variant="secondary" icon="arrow-left" onClick={onLeave}>Về trang vào phòng</Button>
    </PageCard>
  );
}
