import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { InfoBox, InfoRow, PageCard, mText } from '../../../shared/ui/member/member-shell.js';
import { SETTINGS_LOCAL_PATH } from '../domain/removal.js';
import { Callout, Mono, StatusMark } from './parts.js';

/** Screen 5: "Đã nhận tín hiệu". Says briefly what is being sent, and offers to withdraw. The announcement for screen readers is made by the page. */
export function RecordingScreen({ desk, trainingName, displayName, onWithdraw }: { desk: boolean; trainingName: string; displayName: string; onWithdraw: () => void }) {
  return (
    <PageCard desk={desk} center>
      <StatusMark icon="wifi" tone="ok" />
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 style={mText.h1}>Đã nhận tín hiệu</h1>
        <p style={mText.meta}>Claude Code của bạn đang gửi về máy mentor. Cứ làm bài như bình thường.</p>
      </div>
      <InfoBox>
        <InfoRow icon="presentation" k="Buổi" v={trainingName} />
        <InfoRow icon="user" k="Tên của bạn" v={displayName} />
        <InfoRow icon="wifi" k="Trạng thái" v="Đang gửi" />
      </InfoBox>
      <Callout tone="neutral" icon="eye" title="Đang được gửi về máy mentor">
        Prompt bạn gõ; công cụ Claude dùng, câu lệnh hoặc tên file, pass/fail, thời gian; output của lệnh và nội dung thay đổi file (có thể chứa bí mật). <b>Không</b> gửi câu trả lời của Claude. Bạn không xem lại được dữ liệu này.
      </Callout>
      <p style={mText.meta}>Khi mentor bấm "Dừng thu", trang này sẽ hướng dẫn bạn gỡ cấu hình. Bạn cũng có thể dừng gửi bất cứ lúc nào.</p>
      <Button variant="secondary" size="lg" icon="log-out" block={!desk} onClick={onWithdraw}>Dừng gửi</Button>
    </PageCard>
  );
}

/**
 * Screen 6: what "Dừng gửi" does. Said before the button works: nothing new is sent, but what was already sent is NOT deleted now;
 * it waits for the mentor's approval (or the end of the training), and the mentor sees this member's name (PRODUCT.md §7.35j).
 */
export function WithdrawDialog({ open, busy, error, onConfirm, onCancel }: { open: boolean; busy: boolean; error: string | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <ConfirmDialog open={open} title="Dừng gửi dữ liệu?" tone="danger" confirmLabel="Dừng gửi" cancelLabel="Tiếp tục gửi" busy={busy} width={560} onConfirm={onConfirm} onCancel={onCancel}>
      <div style={{ display: 'grid', gap: 12 }}>
        <span>Máy mentor sẽ <b>không nhận thêm</b> dữ liệu nào từ bạn nữa. Không hoàn tác được: bạn không gửi lại được trong buổi này.</span>
        <Callout tone="warn" icon="triangle-alert" title="Dữ liệu đã gửi không bị xoá ngay">
          Dữ liệu bạn đã gửi vẫn nằm trên máy mentor, và chỉ bị xoá khi <b>mentor duyệt xoá</b> hoặc khi mentor bấm "Kết thúc". Mentor biết bạn đã dừng gửi và thấy tên bạn.
        </Callout>
        <span>Sau đó, trang sẽ hướng dẫn bạn gỡ cấu hình khỏi thư mục bài tập <Mono>{SETTINGS_LOCAL_PATH}</Mono>.</span>
        {error && <ErrorMessage message={error} />}
      </div>
    </ConfirmDialog>
  );
}
