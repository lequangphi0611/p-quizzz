import type { TrainingController, TrainingState } from '../application/training-controller.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';

/** The three confirmations: Dừng thu (cannot reopen), Kết thúc (deletes everything), Mời ra (deletes one person's data). */
export function TrainingDialogs({ state, ctrl }: { state: TrainingState; ctrl: TrainingController }) {
  const { confirm, working, actionError, detail } = state;
  if (!confirm) return null;
  const error = actionError ? <div style={{ marginTop: 12 }}><ErrorMessage message={actionError} /></div> : null;

  if (confirm.kind === 'stop') {
    return (
      <ConfirmDialog title="Dừng thu?" confirmLabel="Dừng thu" busy={working} width={480} onConfirm={() => void ctrl.confirm()} onCancel={() => ctrl.cancelConfirm()}>
        <p style={{ margin: 0 }}>Máy chủ sẽ không nhận thêm prompt hay lệnh nào nữa, và mã phòng hết hiệu lực. <b>Không mở thu lại được.</b></p>
        <p style={{ margin: '10px 0 0' }}>Dữ liệu đã thu vẫn xem được cho tới khi bạn bấm Kết thúc. Học viên sẽ được hướng dẫn gỡ đoạn cấu hình khỏi máy của họ.</p>
        {error}
      </ConfirmDialog>
    );
  }
  if (confirm.kind === 'end') {
    return (
      <ConfirmDialog title="Kết thúc và xoá dữ liệu?" tone="danger" confirmLabel="Kết thúc và xoá" busy={working} width={480} onConfirm={() => void ctrl.confirm()} onCancel={() => ctrl.cancelConfirm()}>
        <p style={{ margin: 0 }}>Toàn bộ prompt, lệnh và output của {detail.members.length} học viên sẽ bị <b>xoá vĩnh viễn</b>. Chỉ còn tên buổi, thời gian và số người. Không khôi phục được.</p>
        <p style={{ margin: '10px 0 0' }}>Hãy xem lại những gì cần góp ý trước khi bấm.</p>
        {error}
      </ConfirmDialog>
    );
  }
  return (
    <ConfirmDialog title={`Mời ${confirm.name} ra khỏi buổi?`} tone="danger" confirmLabel="Mời ra và xoá" busy={working} onConfirm={() => void ctrl.confirm()} onCancel={() => ctrl.cancelConfirm()}>
      <p style={{ margin: 0 }}>Dữ liệu đã thu của {confirm.name} (prompt, lệnh, output) sẽ bị xoá vĩnh viễn. Bạn ấy cần gỡ đoạn cấu hình khỏi máy của mình nếu chưa gỡ.</p>
      {error}
    </ConfirmDialog>
  );
}
