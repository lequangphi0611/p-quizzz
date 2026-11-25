import { useId } from 'react';
import { TEACHING_COMMENT_MAX, TEACHING_LABEL_TEXT, TEACHING_LABELS, TEACHING_TEXT_MAX, TEACHING_TOPICS, TEACHING_TOPIC_TEXT, type TeachingTopic } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { TextField } from '../../../shared/ui/TextField.js';
import type { TrainingController, TrainingState } from '../application/training-controller.js';
import { FIELD_NAME, isDirty, nameHits, teachingCountText, teachingFormError, type ReviewItem } from '../domain/teaching.js';

const note = { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--radius-md)', font: 'var(--type-meta)' } as const;
const hiddenBox = { padding: 16, textAlign: 'center', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', color: 'var(--text-meta)' } as const;

/** "Ví dụ" of one prompt: label (required), topic, comment (required), a better version (optional), or drop the example. */
export function TeachingEditDialog({ state, ctrl }: { state: TrainingState; ctrl: TrainingController }) {
  const e = state.teachingEdit!;
  const topicId = useId();
  const problem = teachingFormError(e.form);
  const ready = e.phase === 'ready';
  return (
    <ConfirmDialog title="Ví dụ" width={640} confirmLabel="Lưu ví dụ" cancelLabel="Đóng" busy={e.saving} confirmDisabled={!ready || problem !== ''} disabledReason={ready ? problem : undefined}
      onConfirm={() => void ctrl.saveTeaching()} onCancel={() => ctrl.closeTeaching()}>
      <p style={{ margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
        Nhãn và nhận xét là của <b>ví dụ</b>, không phải của {state.hidden ? 'bạn ấy' : e.memberName}. Bạn ấy không thấy, và không vào số liệu, cờ hay báo cáo.
      </p>
      <div style={{ marginTop: 12 }}>
        {state.hidden ? <div style={hiddenBox}>Nội dung đang ẩn. Nhấn H để hiện lại.</div> : (
          <blockquote aria-label="Prompt được chọn" style={{ margin: 0, maxHeight: 120, overflow: 'auto', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', borderLeft: '3px solid var(--brand-300, var(--brand-600))', font: '400 14px/1.5 var(--font-sans)', color: 'var(--ink-900)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.prompt}</blockquote>
        )}
      </div>

      {e.phase === 'loading' && <div role="status" style={{ marginTop: 16, color: 'var(--text-meta)' }}>Đang tải ví dụ…</div>}
      {e.phase === 'error' && <div style={{ marginTop: 16 }}><ErrorMessage message={e.error} onRetry={() => ctrl.retryTeaching()} /></div>}
      {ready && (
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            <legend style={{ padding: 0, marginBottom: 6, font: 'var(--type-label)', color: 'var(--text-title)' }}>Nhãn (bắt buộc)</legend>
            <div>
              <SegmentedControl ariaLabel="Nhãn" items={TEACHING_LABELS.map(l => ({ value: l, label: TEACHING_LABEL_TEXT[l], icon: l === 'good' ? 'circle-check' : 'triangle-alert' }))}
                value={(e.form.label || null) as never} disabled={e.saving} onChange={l => ctrl.setTeachingForm({ label: l })} />
            </div>
          </fieldset>
          <label htmlFor={topicId} style={{ display: 'grid', gap: 6, font: 'var(--type-label)', color: 'var(--text-title)' }}>
            Chủ đề
            <select id={topicId} value={e.form.topic} disabled={e.saving} onChange={ev => ctrl.setTeachingForm({ topic: ev.target.value as TeachingTopic })}
              style={{ height: 40, padding: '0 10px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-strong)', background: 'var(--paper)', color: 'var(--text-title)', font: 'var(--type-body)' }}>
              {TEACHING_TOPICS.map(t => <option key={t} value={t}>{TEACHING_TOPIC_TEXT[t]}</option>)}
            </select>
          </label>
          <TextField label="Nhận xét (bắt buộc)" multiline rows={3} maxLength={TEACHING_COMMENT_MAX} value={e.form.comment} disabled={e.saving}
            hint="Nói về cách viết prompt trong tình huống này, không nói về người viết." onChange={v => ctrl.setTeachingForm({ comment: v })} />
          <TextField label="Phiên bản tốt hơn (tuỳ chọn)" multiline rows={3} maxLength={TEACHING_TEXT_MAX} value={e.form.betterPrompt} disabled={e.saving}
            onChange={v => ctrl.setTeachingForm({ betterPrompt: v })} />
        </div>
      )}
      {e.error && ready && <div style={{ marginTop: 12 }}><ErrorMessage message={e.error} /></div>}
      {e.exists && ready && (
        <div style={{ marginTop: 14 }}>
          <Button variant="ghost" size="sm" icon="trash-2" disabled={e.saving} onClick={() => void ctrl.removeTeaching()}>Bỏ ví dụ này</Button>
        </div>
      )}
    </ConfirmDialog>
  );
}

/**
 * "Xuất ví dụ": every example with its prompt and its context to rewrite (already masked), the "đã rà" tick, then the file.
 * The mentor reviews what would leave the app, so with "Ẩn nội dung" on nothing is drawn and the file is not offered.
 */
export function TeachingReviewDialog({ state, ctrl }: { state: TrainingState; ctrl: TrainingController }) {
  const r = state.teachingReview!;
  const tick = useId();
  const hidden = state.hidden;
  const ready = r.phase === 'ready';
  const canDownload = ready && r.items.length > 0 && r.reviewed && !hidden;
  const reason = !ready || r.items.length === 0 ? undefined : hidden ? 'Nội dung đang ẩn: nhấn H để hiện rồi rà trước khi tải' : !r.reviewed ? 'Tick "Tôi đã rà…" ở cuối để tải file' : undefined;
  return (
    <ConfirmDialog title="Xuất ví dụ" width={860} confirmLabel={r.saved ? 'Tải lại file' : 'Tải file .md'} cancelLabel="Đóng" busy={r.saving} confirmDisabled={!canDownload} disabledReason={reason}
      onConfirm={() => void ctrl.downloadTeaching()} onCancel={() => ctrl.closeTeachingReview()}>
      <p style={{ margin: 0 }}>
        Một file Markdown <b>không có tên, ngày giờ, số phiên, output hay nội dung file</b>: mỗi ví dụ có nhãn, prompt, danh sách lệnh của lượt đó, nhận xét và phiên bản tốt hơn. Ví dụ xếp theo chủ đề rồi theo nhãn, thứ tự xáo trộn.
      </p>
      <div role="note" style={{ ...note, marginTop: 12, background: 'var(--sun-100)', border: '1px solid var(--sun-200)', color: 'var(--ink-900)', fontWeight: 600 }}>
        <Icon name="triangle-alert" size={16} style={{ marginTop: 2, flex: 'none', color: 'var(--sun-ink)' }} />
        <span>Chuỗi giống khoá hoặc mật khẩu được che tự động nhưng có thể sót. Hãy đọc từng ví dụ (cả nhận xét) và sửa tên dự án, tên người, tên file riêng, văn phong nhận ra người viết. Lệnh trong bối cảnh in cả đường dẫn: kiểm tra đường dẫn và tên người dùng máy (vd. /home/ten-ban/…). File đã tải thì app không thu hồi hay xoá được, kể cả sau khi Kết thúc.</span>
      </div>

      <div style={{ marginTop: 14 }} aria-live="polite">
        {r.phase === 'loading' ? <div role="status" style={{ padding: 16, textAlign: 'center', color: 'var(--text-meta)' }}>Đang tải các ví dụ…</div>
          : r.phase === 'error' ? <ErrorMessage message={r.error} onRetry={() => void ctrl.openTeachingReview()} />
          : r.items.length === 0 ? (
            <div role="status" style={{ ...note, background: 'var(--surface-sunken)', color: 'var(--text-body)', fontWeight: 600 }}>
              <Icon name="info" size={16} style={{ marginTop: 2, flex: 'none' }} />
              <span>Chưa có ví dụ nào. Đóng hộp thoại này, bấm "Ví dụ" ở một prompt rồi quay lại.</span>
            </div>
          ) : hidden ? <div style={hiddenBox}>Nội dung đang ẩn nên không rà ở đây. Nhấn H (hoặc nút "Hiện nội dung") để hiện, rà xong mới tải được file.</div>
          : (
            <>
              <p style={{ margin: '0 0 8px', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>{teachingCountText(r.items.length)}. Bản sửa được lưu khi bạn rời ô nhập và giữ tới khi Kết thúc.</p>
              <ol aria-label="Các ví dụ" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12, maxHeight: '48vh', overflowY: 'auto' }}>
                {r.items.map((item, i) => <ReviewCard key={item.eventId} item={item} n={i + 1} ctrl={ctrl} disabled={r.saving} names={state.detail.members.map(m => m.displayName)} />)}
              </ol>
            </>
          )}
      </div>

      {ready && r.items.length > 0 && !hidden && (
        <label htmlFor={tick} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, font: 'var(--type-ui)', fontSize: 15, color: 'var(--text-title)', cursor: 'pointer' }}>
          <input id={tick} type="checkbox" checked={r.reviewed} disabled={r.saving} onChange={ev => ctrl.setTeachingReviewed(ev.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--brand-600)' }} />
          Tôi đã rà, không còn chi tiết nhận ra người viết
        </label>
      )}
      {r.saveError && <div style={{ marginTop: 12 }}><ErrorMessage message={r.saveError} /></div>}
      {r.saved && <p role="status" style={{ margin: '12px 0 0', color: 'var(--correct-600)', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="check" size={16} />Đã tải file về máy. Xoá file khi xong việc.</p>}
    </ConfirmDialog>
  );
}

function ReviewCard({ item, n, ctrl, disabled, names }: { item: ReviewItem; n: number; ctrl: TrainingController; disabled: boolean; names: readonly string[] }) {
  const hits = nameHits(item, names);
  const edited = item.promptDraft !== item.defaultPrompt || item.contextDraft !== item.defaultContext;
  const status = item.error ? item.error : item.saving ? 'Đang lưu…' : isDirty(item) ? 'Chưa lưu' : edited ? 'Đã lưu bản sửa' : 'Bản gốc (đã che bí mật)';
  return (
    <li data-review-item={item.eventId} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hairline)', background: 'var(--paper)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', font: 'var(--type-label)', color: 'var(--text-title)' }}>
        <span>Ví dụ {n}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--ink-100)', border: '1px solid var(--ink-300)', fontSize: 12 }}>
          <Icon name={item.label === 'good' ? 'circle-check' : 'triangle-alert'} size={12} />{TEACHING_LABEL_TEXT[item.label]}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-meta)' }}>{TEACHING_TOPIC_TEXT[item.topic]}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: 'var(--text-meta)' }}>Của {item.memberName} (chỉ bạn thấy, không có trong file)</span>
      </div>
      {hits.length > 0 && (
        <div role="alert" data-name-warning style={{ ...note, background: 'var(--wrong-surface)', border: '1px solid var(--wrong-border)', color: 'var(--wrong-600)', fontWeight: 600 }}>
          <Icon name="triangle-alert" size={16} style={{ marginTop: 2, flex: 'none' }} />
          <span>Có tên một bạn trong lớp: {hits.map(h => `"${h.name}" trong ${FIELD_NAME[h.field]}`).join('; ')}. Hãy sửa trước khi tải, tên gõ trong nội dung vẫn vào file.</span>
        </div>
      )}
      <TextField label="Prompt trong file" multiline rows={3} maxLength={TEACHING_TEXT_MAX} value={item.promptDraft} disabled={disabled}
        onChange={v => ctrl.editReviewPrompt(item.eventId, v)} onBlur={() => void ctrl.commitReviewItem(item.eventId)} />
      <TextField label="Bối cảnh: các lệnh Claude chạy trong lượt này (mỗi lệnh một dòng)" multiline mono rows={3} maxLength={TEACHING_TEXT_MAX} value={item.contextDraft} disabled={disabled}
        onChange={v => ctrl.editReviewContext(item.eventId, v)} onBlur={() => void ctrl.commitReviewItem(item.eventId)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="secondary" size="sm" icon="rotate-ccw" disabled={disabled || !edited} onClick={() => ctrl.resetReviewItem(item.eventId)}>Về bản gốc</Button>
        <span role={item.error ? 'alert' : 'status'} style={{ font: 'var(--type-meta)', fontSize: 13, color: item.error ? 'var(--wrong-600)' : 'var(--text-meta)' }}>{status}</span>
      </div>
      <div style={{ font: 'var(--type-meta)', fontSize: 13, color: 'var(--text-body)' }}>
        <b>Nhận xét:</b> <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.comment}</span>
        {item.betterPrompt && <><br /><b>Phiên bản tốt hơn:</b> <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.betterPrompt}</span></>}
      </div>
    </li>
  );
}
