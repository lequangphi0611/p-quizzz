import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { InfoBox, InfoRow, PageCard, mText } from '../../../shared/ui/member/member-shell.js';
import { buildRemovalPrompt, ingestUrl, SETTINGS_LOCAL_PATH } from '../domain/removal.js';
import { CodeBlock } from './CodeBlock.js';
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
      <p style={mText.meta}>Khi mentor bấm "Dừng thu", trang này sẽ hướng dẫn bạn gỡ cấu hình.</p>
      <Button variant="secondary" size="lg" icon="log-out" block={!desk} onClick={onWithdraw}>Rút lại đồng ý</Button>
    </PageCard>
  );
}

/** Screen 6: what withdrawing deletes, and what is left for the member to do (the hooks stay on their machine until removed). */
export function WithdrawDialog({ open, host, busy, error, onConfirm, onCancel }: { open: boolean; host: string; busy: boolean; error: string | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <ConfirmDialog open={open} title="Rút lại đồng ý?" tone="danger" confirmLabel="Rút lại và xoá dữ liệu của tôi" cancelLabel="Giữ lại" busy={busy} width={560} onConfirm={onConfirm} onCancel={onCancel}>
      <div style={{ display: 'grid', gap: 12 }}>
        <span>Dữ liệu của bạn trên máy mentor (mọi prompt, lệnh và output đã gửi) sẽ bị <b>xoá ngay</b> và bạn ra khỏi buổi training. Không hoàn tác được.</span>
        <Callout tone="warn" icon="triangle-alert" title="Sau đó, hãy gỡ cấu hình khỏi máy bạn">
          Cấu hình vẫn nằm trong <Mono>{SETTINGS_LOCAL_PATH}</Mono> của thư mục bài tập cho tới khi bạn xoá. Nhờ Claude Code gỡ bằng câu dưới đây, hoặc tự xoá các mục hook có địa chỉ <Mono>{ingestUrl(host)}</Mono>.
        </Callout>
        <CodeBlock label="Câu nhờ Claude Code gỡ cấu hình" code={buildRemovalPrompt(host)} maxHeight={170} />
        {error && <ErrorMessage message={error} />}
      </div>
    </ConfirmDialog>
  );
}
