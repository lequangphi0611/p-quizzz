import type { TrainingController, TrainingState } from '../application/training-controller.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { needsExportReminder, reportSummary } from '../domain/report.js';
import { DataExportDialog } from './DataExportDialog.js';
import { TeachingEditDialog, TeachingReviewDialog } from './TeachingDialogs.js';

/** The confirmations: Dừng thu (cannot reopen), Kết thúc (deletes everything), Mời ra and Duyệt xoá (delete one person's data). */
export function TrainingDialogs({ state, ctrl }: { state: TrainingState; ctrl: TrainingController }) {
  const { confirm, working, actionError, detail } = state;
  if (state.report) return <ReportDialog state={state} ctrl={ctrl} />;
  if (state.dataExport) return <DataExportDialog state={state} ctrl={ctrl} />;
  if (state.teachingEdit) return <TeachingEditDialog state={state} ctrl={ctrl} />;
  if (state.teachingReview) return <TeachingReviewDialog state={state} ctrl={ctrl} />;
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
        {needsExportReminder(detail) && (
          <div role="note" style={{ display: 'grid', gap: 8, marginTop: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--sun-100)', border: '1px solid var(--sun-200)', color: 'var(--ink-900)' }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Icon name="triangle-alert" size={18} style={{ marginTop: 2, flex: 'none', color: 'var(--sun-ink)' }} />
              <span><b>Bạn chưa xuất báo cáo.</b> Ví dụ đã đánh dấu và ghi chú cũng mất khi kết thúc.</span>
            </span>
            <div><Button variant="secondary" size="sm" icon="download" onClick={() => ctrl.exportBeforeEnding()}>Xuất báo cáo trước</Button></div>
          </div>
        )}
        {error}
      </ConfirmDialog>
    );
  }
  if (confirm.kind === 'purge') {
    return (
      <ConfirmDialog title={`Xoá dữ liệu của ${confirm.name}?`} tone="danger" confirmLabel="Duyệt xoá" busy={working} onConfirm={() => void ctrl.confirm()} onCancel={() => ctrl.cancelConfirm()}>
        <p style={{ margin: 0 }}>{confirm.name} đã bấm "Dừng gửi". Prompt, lệnh và output đã thu của bạn ấy sẽ bị xoá vĩnh viễn và bạn ấy ra khỏi buổi. Không khôi phục được.</p>
        <p style={{ margin: '10px 0 0' }}>Nếu không duyệt, dữ liệu vẫn xem được và chỉ bị xoá khi bạn bấm Kết thúc.</p>
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

/** "Xuất báo cáo": the Markdown the file will carry, then the file. The preview is hidden while "Ẩn nội dung" is on (names, prompts). */
function ReportDialog({ state, ctrl }: { state: TrainingState; ctrl: TrainingController }) {
  const report = state.report!;
  const sum = reportSummary(state.detail.members);
  return (
    <ConfirmDialog title="Xuất báo cáo" width={720} confirmLabel={report.saved ? 'Tải lại file' : 'Tải file .md'} cancelLabel="Đóng" busy={report.saving} confirmDisabled={report.phase !== 'ready'}
      onConfirm={() => void ctrl.downloadReport()} onCancel={() => ctrl.closeReport()}>
      <p style={{ margin: 0 }}>File Markdown gồm tổng hợp lớp và từng bạn (có tên): cờ gợi ý, số liệu, ví dụ bạn đã đánh dấu và ghi chú. <b>Không có output hay nội dung file</b>; chuỗi giống khoá hoặc mật khẩu được che tự động.</p>
      <p style={{ margin: '8px 0 0', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
        Đã đánh dấu {sum.marked} ví dụ · {sum.notes} ghi chú. Bạn tải file về thì app không xoá được nữa; hãy giữ nó ở nơi chỉ bạn xem.
      </p>
      {sum.empty && (
        <div role="note" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--sun-100)', border: '1px solid var(--sun-200)', color: 'var(--ink-900)', font: 'var(--type-meta)', fontWeight: 600 }}>
          <Icon name="info" size={16} style={{ marginTop: 2, flex: 'none', color: 'var(--sun-ink)' }} />
          <span>Bạn chưa đánh dấu ví dụ nào và chưa viết ghi chú. Báo cáo chỉ có số liệu và cờ gợi ý. Đóng hộp thoại này, bấm biểu tượng đánh dấu ở dòng trong dòng thời gian rồi quay lại.</span>
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        {state.hidden ? (
          <div style={{ padding: 16, textAlign: 'center', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', color: 'var(--text-meta)' }}>Nội dung đang ẩn nên không xem trước ở đây. Tải file vẫn được.</div>
        ) : report.phase === 'loading' ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-meta)' }}>Đang dựng báo cáo…</div>
        ) : report.phase === 'error' ? (
          <ErrorMessage message={report.error} onRetry={() => void ctrl.openReport()} />
        ) : (
          <pre aria-label="Xem trước báo cáo" tabIndex={0} style={{ margin: 0, maxHeight: 320, overflow: 'auto', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)', font: '400 12.5px/1.6 var(--font-mono)', color: 'var(--ink-900)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.text}</pre>
        )}
      </div>
      {report.phase === 'ready' && report.error && <div style={{ marginTop: 12 }}><ErrorMessage message={report.error} /></div>}
      {report.saved && <p role="status" style={{ margin: '12px 0 0', color: 'var(--correct-600)', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="check" size={16} />Đã tải file về máy.</p>}
    </ConfirmDialog>
  );
}
