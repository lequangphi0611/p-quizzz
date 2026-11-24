import { useId } from 'react';
import type { DataExportState, TrainingController, TrainingState } from '../application/training-controller.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { describeDays, formatBytes, type ExportMode } from '../domain/export.js';

const MODES = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'day', label: 'Một ngày' },
  { value: 'range', label: 'Từ ngày đến ngày' },
] as const satisfies readonly { value: ExportMode; label: string }[];

const SCOPES = [
  { value: 'all', label: 'Cả lớp' },
  { value: 'some', label: 'Chọn bạn' },
] as const;

const note = { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--radius-md)', font: 'var(--type-meta)' } as const;

const dateInput = {
  height: 40, padding: '0 10px', boxSizing: 'border-box', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', background: 'var(--paper)', color: 'var(--text-title)', font: 'var(--type-body)',
} as const;

/**
 * "Xuất dữ liệu để phân tích" (PRODUCT.md §7.36): the raw data of some days as a zip, one Markdown file per member, for the mentor's own AI.
 * Said up front, because it is not the report: it has the output and the file changes, and it leaves the machine when the mentor takes it elsewhere.
 */
export function DataExportDialog({ state, ctrl }: { state: TrainingState; ctrl: TrainingController }) {
  const d = state.dataExport!;
  const summary = d.summary;
  const days = useId();
  const ready = d.phase === 'ready' && !d.error && summary !== null && summary.eventCount > 0 && !summary.tooLarge;
  return (
    <ConfirmDialog title="Xuất dữ liệu để phân tích" width={720} confirmLabel={d.saved ? 'Tải lại file' : 'Tải file .zip'} cancelLabel="Đóng" busy={d.saving} confirmDisabled={!ready}
      onConfirm={() => void ctrl.downloadDataExport()} onCancel={() => ctrl.closeDataExport()}>
      <p style={{ margin: 0 }}>
        Một file <b>.zip</b>: <code>00-tong-quan.md</code> (cách dùng và các prompt phân tích gợi ý) và <b>mỗi bạn một file Markdown</b> có tên. Bạn đưa cả zip, hoặc file của vài bạn, vào AI của bạn để hỏi. App không gọi AI ở bước này.
      </p>
      <div role="note" style={{ ...note, marginTop: 12, background: 'var(--sun-100)', border: '1px solid var(--sun-200)', color: 'var(--ink-900)', fontWeight: 600 }}>
        <Icon name="triangle-alert" size={16} style={{ marginTop: 2, flex: 'none', color: 'var(--sun-ink)' }} />
        <span>
          Khác báo cáo: đây là <b>dữ liệu thô</b>, có cả <b>output lệnh và nội dung file thay đổi</b>. Chuỗi giống khoá hoặc mật khẩu được che tự động nhưng có thể sót. Các bạn đã được báo ở màn đồng ý. Khi bạn đưa file vào dịch vụ AI nào, dữ liệu rời máy bạn và app không xoá được, kể cả sau khi Kết thúc.
        </span>
      </div>

      <fieldset style={{ border: 0, margin: '16px 0 0', padding: 0, display: 'grid', gap: 10 }}>
        <legend id={days} style={{ padding: 0, marginBottom: 8, font: 'var(--type-label)', color: 'var(--text-title)' }}>Khoảng thời gian</legend>
        <div>
          <SegmentedControl ariaLabel="Khoảng thời gian" items={MODES} value={d.mode} disabled={d.saving} onChange={m => ctrl.setDataExportMode(m)} />
        </div>
        {d.mode !== 'today' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', font: 'var(--type-label)', color: 'var(--text-title)' }}>
              {d.mode === 'range' ? 'Từ ngày' : 'Ngày'}
              <input type="date" value={d.from} disabled={d.saving} onChange={e => ctrl.setDataExportFrom(e.target.value)} style={dateInput} />
            </label>
            {d.mode === 'range' && (
              <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', font: 'var(--type-label)', color: 'var(--text-title)' }}>
                Đến ngày
                <input type="date" value={d.to} min={d.from || undefined} disabled={d.saving} onChange={e => ctrl.setDataExportTo(e.target.value)} style={dateInput} />
              </label>
            )}
          </div>
        )}
        <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Tính theo ngày trên máy này (máy mentor), từ 00:00 đến hết ngày cuối.</span>
      </fieldset>

      <MemberScope state={state} d={d} ctrl={ctrl} />

      <div aria-live="polite" style={{ marginTop: 16 }}>
        {d.error ? (
          <ErrorMessage message={d.error} onRetry={d.phase === 'error' ? () => ctrl.retryDataExport() : undefined} />
        ) : summary === null ? (
          <div style={{ color: 'var(--text-meta)' }}>Đang đếm…</div>
        ) : summary.eventCount === 0 ? (
          <div role="status" style={{ ...note, background: 'var(--surface-sunken)', color: 'var(--text-body)', fontWeight: 600 }}>
            <Icon name="info" size={16} style={{ marginTop: 2, flex: 'none' }} />
            <span>Không có dữ liệu trong khoảng này. Chọn ngày khác hoặc thêm bạn.</span>
          </div>
        ) : summary.tooLarge ? (
          <ErrorMessage message={`Dữ liệu quá lớn (khoảng ${formatBytes(summary.approxBytes)}). Chọn ít ngày hoặc ít bạn hơn.`} />
        ) : (
          <div role="status" style={{ ...note, background: 'var(--surface-sunken)', color: 'var(--text-body)', opacity: d.phase === 'loading' ? 0.6 : 1 }}>
            <Icon name="file-text" size={16} style={{ marginTop: 2, flex: 'none' }} />
            <span><b>{summary.memberCount} bạn · {summary.eventCount} sự kiện</b> · {describeDays(summary)} · khoảng {formatBytes(summary.approxBytes)} trước khi nén</span>
          </div>
        )}
      </div>
      {d.saveError && <div style={{ marginTop: 12 }}><ErrorMessage message={d.saveError} /></div>}
      {d.saved && <p role="status" style={{ margin: '12px 0 0', color: 'var(--correct-600)', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="check" size={16} />Đã tải file về máy. Xoá file khi xong việc.</p>}
    </ConfirmDialog>
  );
}

/** "Cả lớp" or a list of members to tick. Members who stopped sending are in the list, as in the file (§7.35e). */
function MemberScope({ state, d, ctrl }: { state: TrainingState; d: DataExportState; ctrl: TrainingController }) {
  const members = state.detail.members;
  return (
    <fieldset style={{ border: 0, margin: '16px 0 0', padding: 0, display: 'grid', gap: 10 }}>
      <legend style={{ padding: 0, marginBottom: 8, font: 'var(--type-label)', color: 'var(--text-title)' }}>Những bạn nào</legend>
      <div>
        <SegmentedControl ariaLabel="Những bạn nào" items={SCOPES} value={d.memberIds === null ? 'all' : 'some'} disabled={d.saving} onChange={v => ctrl.setDataExportAllMembers(v === 'all')} />
      </div>
      {d.memberIds !== null && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-md)' }}>
          {members.map(m => (
            <li key={m.id}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', cursor: 'pointer', font: 'var(--type-body)', color: 'var(--text-body)' }}>
                <input type="checkbox" checked={d.memberIds!.includes(m.id)} disabled={d.saving} onChange={() => ctrl.toggleDataExportMember(m.id)} style={{ width: 18, height: 18 }} />
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{m.displayName}{m.stoppedSending ? ' (đã dừng gửi)' : ''}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
