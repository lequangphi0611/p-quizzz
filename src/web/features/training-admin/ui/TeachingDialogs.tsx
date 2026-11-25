import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { TEACHING_COMMENT_MAX, TEACHING_LABEL_TEXT, TEACHING_LABELS, TEACHING_TEXT_MAX, TEACHING_TOPICS, TEACHING_TOPIC_TEXT, type TeachingTopic } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { TextField } from '../../../shared/ui/TextField.js';
import type { TrainingController, TrainingState } from '../application/training-controller.js';
import { FIELD_NAME, NAME_PLACEHOLDER, editedFieldCount, highlightSegments, itemStatus, nameHits, reviewedCount, suspectedNames, teachingFormError, isDirty, type ReviewItem } from '../domain/teaching.js';

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

const C = { ink: 'var(--ink-900)', meta: 'var(--text-meta)', line: 'var(--border-hairline)', soft: 'var(--ink-100)', brand: 'var(--brand-600)', ok: 'var(--correct-600)', warn: 'var(--warn-600)' } as const;

/**
 * "Rà & xuất ví dụ" (PRODUCT.md §7.39j): the examples listed by topic on the left, one at a time on the right. Each is marked reviewed on its
 * own ("Đã rà ví dụ này, sang tiếp"); the file is offered only when none is left. With "Ẩn nội dung" on, nothing is drawn.
 */
export function TeachingReviewDialog({ state, ctrl }: { state: TrainingState; ctrl: TrainingController }) {
  const r = state.teachingReview!;
  const hidden = state.hidden;
  const names = state.detail.members.map(m => m.displayName);
  const total = r.items.length;
  const done = reviewedCount(r.items);
  const left = total - done;
  const at = r.items.findIndex(i => i.eventId === r.selectedId);
  const item = at >= 0 ? r.items[at]! : null;
  const busy = r.saving || r.items.some(i => i.saving);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Opened from the keyboard (the menu): the focus goes into the dialog, so Esc and Tab work from the first key.
  useEffect(() => { dialogRef.current?.focus({ preventScroll: true }); }, []);
  const canDownload = r.phase === 'ready' && total > 0 && left === 0 && !hidden && !busy;
  const titleId = useId();
  const button = (primary: boolean, off: boolean) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px', borderRadius: 10, font: 'var(--type-ui)', fontSize: 15, fontWeight: 600, cursor: off ? 'not-allowed' : 'pointer',
    border: primary ? 0 : off ? `1px solid ${C.line}` : '1px solid var(--border-strong)', background: primary ? (off ? C.soft : C.brand) : 'var(--paper)', color: primary ? (off ? 'var(--ink-500)' : 'var(--paper)') : off ? 'var(--ink-500)' : C.ink,
  }) as const;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={e => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); ctrl.closeTeachingReview(); } }}
        style={{ width: 'min(1180px, 100%)', height: 'min(920px, calc(100vh - 32px))', display: 'flex', flexDirection: 'column', background: 'var(--paper)', borderRadius: 20, boxShadow: 'var(--shadow-dialog)', overflow: 'hidden', outline: 'none' }}>
        <div style={{ padding: '20px 28px 14px', borderBottom: `1px solid ${C.line}`, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h1 id={titleId} style={{ margin: 0, font: 'var(--type-h1)', fontSize: 24, color: C.ink }}>Rà &amp; xuất ví dụ</h1>
            {r.phase === 'ready' && total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, color: C.meta }}>Đã rà</span>
                <span style={{ font: '500 15px/1 var(--font-mono)', color: C.ink }}>{done} / {total}</span>
                <div role="progressbar" aria-label="Đã rà" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} style={{ width: 200, height: 8, borderRadius: 99, background: C.soft, overflow: 'hidden' }}>
                  <div style={{ width: `${total === 0 ? 0 : (done / total) * 100}%`, height: '100%', background: C.brand }} />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 14, color: C.ink }}>
            <b>Tìm và sửa:</b>
            {['Tên người', 'Tên dự án, tên file riêng', 'Đường dẫn trong lệnh (tên người dùng máy)', 'Văn phong nhận ra người viết'].map(t => <span key={t} style={{ padding: '4px 10px', borderRadius: 99, background: C.soft }}>{t}</span>)}
            <span style={{ color: C.meta }}>· Ô xám = app đã tự che</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {r.phase === 'loading' ? <Body><div role="status" style={{ color: C.meta }}>Đang tải các ví dụ…</div></Body>
            : r.phase === 'error' ? <Body><ErrorMessage message={r.error} onRetry={() => void ctrl.openTeachingReview()} /></Body>
            : total === 0 ? <Body><div role="status" style={{ ...note, background: 'var(--surface-sunken)', color: 'var(--text-body)', fontWeight: 600 }}><Icon name="info" size={16} style={{ marginTop: 2, flex: 'none' }} /><span>Chưa có ví dụ nào. Đóng màn này, bấm "Làm ví dụ" ở một prompt rồi quay lại.</span></div></Body>
            : hidden ? <Body><div style={hiddenBox}>Nội dung đang ẩn nên không rà ở đây. Nhấn H (hoặc nút "Hiện nội dung") để hiện, rà xong mới tải được file.</div></Body>
            : (
              <>
                <ReviewNav items={r.items} selectedId={r.selectedId} names={names} onSelect={id => ctrl.selectReviewItem(id)} />
                {item && <ReviewPane key={item.eventId} item={item} n={at + 1} names={names} ctrl={ctrl} />}
              </>
            )}
        </div>

        <div style={{ padding: '14px 28px', borderTop: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {r.phase === 'ready' && total > 0 && !hidden && (
            <>
              <button type="button" style={button(false, at <= 0 || busy)} disabled={at <= 0 || busy} onClick={() => ctrl.stepReview(-1)}>Trước</button>
              <button type="button" data-mark-reviewed style={button(true, !item || item.reviewed || r.saving)} disabled={!item || item.reviewed || r.saving} onClick={() => item && void ctrl.markReviewed(item.eventId)}>
                <Icon name="check" size={16} />{item?.reviewed ? 'Đã rà ví dụ này' : left > 1 ? 'Đã rà ví dụ này, sang tiếp' : 'Đã rà ví dụ này'}
              </button>
            </>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 13, color: C.meta, maxWidth: 320, textAlign: 'right' }}>File đã tải không thu hồi hay xoá được, kể cả sau khi Kết thúc.</span>
          <button type="button" style={{ ...button(false, busy), border: 0, background: 'none' }} disabled={busy} onClick={() => ctrl.closeTeachingReview()}>Đóng</button>
          <button type="button" data-download style={button(true, !canDownload)} disabled={!canDownload} title={left > 0 ? `Còn ${left} ví dụ chưa rà` : undefined} onClick={() => void ctrl.downloadTeaching()}>
            {r.saving ? 'Đang tải…' : r.saved ? 'Tải lại file .md' : left > 0 && total > 0 ? `Tải file .md · còn ${left} chưa rà` : 'Tải file .md'}
          </button>
        </div>
        {(r.saveError || r.saved) && (
          <div style={{ padding: '0 28px 14px' }}>
            {r.saveError && <ErrorMessage message={r.saveError} />}
            {r.saved && <p role="status" style={{ margin: 0, color: 'var(--correct-600)', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="check" size={16} />Đã tải file về máy. Xoá file khi xong việc.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

const Body = ({ children }: { children: React.ReactNode }) => <div style={{ flex: 1, padding: 28, overflow: 'auto' }}>{children}</div>;

/** The examples by topic; each says where it stands: not reviewed, reviewed, names suspected, fields edited. */
function ReviewNav({ items, selectedId, names, onSelect }: { items: readonly ReviewItem[]; selectedId: number | null; names: readonly string[]; onSelect: (id: number) => void }) {
  return (
    <nav aria-label="Danh sách ví dụ" style={{ width: 280, flex: 'none', borderRight: `1px solid ${C.line}`, background: 'var(--ink-050)', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
      {TEACHING_TOPICS.map(topic => {
        const inTopic = items.map((it, i) => ({ it, n: i + 1 })).filter(x => x.it.topic === topic);
        if (inTopic.length === 0) return null;
        return (
          <div key={topic} style={{ display: 'grid', gap: 6 }}>
            <div style={{ font: '600 12px/1.3 var(--font-sans)', letterSpacing: '.06em', textTransform: 'uppercase', color: C.meta, padding: '6px 8px 0' }}>{TEACHING_TOPIC_TEXT[topic]}</div>
            {inTopic.map(({ it, n }) => {
              const hits = nameHits(it, names);
              const st = itemStatus(it, hits);
              const on = it.eventId === selectedId;
              const color = st.tone === 'warn' ? C.warn : st.tone === 'ok' ? C.ok : C.meta;
              return (
                <button key={it.eventId} type="button" data-review-nav={it.eventId} aria-current={on ? 'true' : undefined} onClick={() => onSelect(it.eventId)}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: 10, borderRadius: 10, cursor: 'pointer', font: 'inherit', color: 'var(--text-body)', background: on ? 'var(--brand-050)' : 'transparent', border: on ? '1px solid var(--brand-500)' : '1px solid transparent' }}>
                  <Icon name={st.tone === 'warn' ? 'triangle-alert' : it.reviewed ? 'circle-check' : 'circle-dot'} size={18} color={color} style={{ flex: 'none', marginTop: 2 }} />
                  <span style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Ví dụ {n} · {TEACHING_LABEL_TEXT[it.label]}</span>
                    <span style={{ fontSize: 13, color }}>{st.text}</span>
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function ReviewPane({ item, n, names, ctrl }: { item: ReviewItem; n: number; names: readonly string[]; ctrl: TrainingController }) {
  const hits = nameHits(item, names);
  const suspects = suspectedNames(hits);
  const promptOrContextEdited = item.promptDraft !== item.defaultPrompt || item.contextDraft !== item.defaultContext;
  const dirty = isDirty(item);
  const status = item.saving ? 'Đang lưu…' : dirty ? 'Chưa lưu' : editedFieldCount(item) > 0 ? 'Đã lưu bản sửa' : '';
  return (
    <section data-review-item={item.eventId} style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>Ví dụ {n}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, background: C.soft, color: 'var(--ink-700)', fontSize: 13, fontWeight: 600 }}>
          <Icon name={item.label === 'good' ? 'circle-check' : 'rotate-ccw'} size={14} />{TEACHING_LABEL_TEXT[item.label]}
        </span>
        <span style={{ fontSize: 13, color: C.meta }}>{TEACHING_TOPIC_TEXT[item.topic]}</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: C.meta }}>Của {item.memberName} · chỉ bạn thấy, không có trong file</span>
      </div>

      {suspects.map(name => (
        <div key={name} role="alert" data-name-warning style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 10, background: 'var(--warn-surface)', border: '1px solid var(--warn-border)', fontSize: 14, color: 'var(--sun-ink)' }}>
          <span style={{ flex: '1 1 260px' }}>Có thể là tên một bạn trong lớp: <b>“{name}”</b> trong {hits.filter(h => h.name === name).map(h => FIELD_NAME[h.field]).join(', ')} (đánh dấu bên dưới).</span>
          <button type="button" onClick={() => ctrl.replaceReviewName(item.eventId, name)} style={{ height: 36, padding: '0 14px', borderRadius: 10, border: 0, background: C.brand, color: 'var(--paper)', font: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Thay bằng “{NAME_PLACEHOLDER}”</button>
          <button type="button" onClick={() => ctrl.dismissReviewName(item.eventId, name)} style={{ height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--paper)', color: C.ink, font: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Không phải tên</button>
        </div>
      ))}

      <HighlightedField label="Prompt trong file" value={item.promptDraft} names={suspects} edited={item.promptDraft !== item.defaultPrompt} onChange={v => ctrl.editReviewPrompt(item.eventId, v)} onBlur={() => void ctrl.commitReviewItem(item.eventId)} />
      <HighlightedField label="Bối cảnh: lệnh Claude chạy trong lượt này (mỗi lệnh một dòng)" mono value={item.contextDraft} names={suspects} edited={item.contextDraft !== item.defaultContext} onChange={v => ctrl.editReviewContext(item.eventId, v)} onBlur={() => void ctrl.commitReviewItem(item.eventId)}
        hint="Lệnh in cả đường dẫn: kiểm tra đường dẫn và tên người dùng máy. App đã tự thay thư mục người dùng (vd. /home/<tên máy>) bằng ~." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <HighlightedField label="Nhận xét" value={item.commentDraft} names={suspects} edited={item.commentDraft !== item.initialComment} onChange={v => ctrl.editReviewComment(item.eventId, v)} onBlur={() => void ctrl.commitReviewItem(item.eventId)} />
        <HighlightedField label="Phiên bản tốt hơn" value={item.betterDraft} names={suspects} edited={item.betterDraft !== item.initialBetter} onChange={v => ctrl.editReviewBetter(item.eventId, v)} onBlur={() => void ctrl.commitReviewItem(item.eventId)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13, color: C.meta }}>
        <button type="button" disabled={!promptOrContextEdited || item.saving} onClick={() => ctrl.resetReviewItem(item.eventId)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--paper)', font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--ink-700)', opacity: !promptOrContextEdited ? 0.5 : 1, cursor: promptOrContextEdited ? 'pointer' : 'not-allowed' }}>
          <Icon name="rotate-ccw" size={14} />Khôi phục bản app đã che
        </button>
        {item.error ? (
          <span role="alert" style={{ color: 'var(--wrong-600)', fontWeight: 600 }}>
            Chưa lưu được: {item.error}{' '}
            <button type="button" onClick={() => void ctrl.commitReviewItem(item.eventId)} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 700, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>Thử lại</button>
          </span>
        ) : <span role="status">{status}</span>}
        {item.reviewed && (
          <button type="button" disabled={item.saving} onClick={() => void ctrl.unmarkReviewed(item.eventId)} style={{ marginLeft: 'auto', background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}>Bỏ "đã rà"</button>
        )}
      </div>
    </section>
  );
}

/**
 * A text box that draws its suspected names with a yellow mark and the parts the app masked as grey chips. The marks live on a layer
 * behind the real textarea (same font and padding, transparent text), so typing, selection and the caret are the browser's own.
 */
function HighlightedField({ label, value, onChange, onBlur, names, mono = false, edited, hint }: {
  label: string; value: string; onChange: (v: string) => void; onBlur: () => void; names: readonly string[]; mono?: boolean; edited: boolean; hint?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focus, setFocus] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  const segments = highlightSegments(value, names);
  const hasMasked = segments.some(seg => seg.kind === 'masked');
  const text = { padding: '12px 14px', margin: 0, boxSizing: 'border-box', width: '100%', font: mono ? '400 14px/1.7 var(--font-mono)' : '400 16px/1.5 var(--font-sans)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const;
  return (
    <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: C.ink }}>
        {label}
        {edited && <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'var(--brand-100)', color: 'var(--brand-700)' }}>Đã sửa</span>}
      </span>
      <div style={{ position: 'relative', borderRadius: 10, border: focus ? '2px solid var(--brand-500)' : '1px solid var(--border-strong)', margin: focus ? -1 : 0, background: 'var(--paper)' }}>
        <div aria-hidden="true" style={{ ...text, position: 'absolute', inset: 0, color: 'transparent', pointerEvents: 'none', overflow: 'hidden' }}>
          {segments.map((seg, i) => seg.kind === 'plain' ? <span key={i}>{seg.text}</span>
            : seg.kind === 'name' ? <mark key={i} style={{ background: 'var(--sun-200)', borderBottom: '2px solid var(--sun-ink)', padding: 0, color: 'transparent' }}>{seg.text}</mark>
            : <span key={i} data-masked style={{ background: 'var(--ink-200)', borderRadius: 4 }}>{seg.text}</span>)}
          {'\u200b'}
        </div>
        <textarea ref={ref} value={value} rows={mono ? 3 : 2} spellCheck={false} onChange={e => onChange(e.target.value)}
          onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); onBlur(); }}
          style={{ ...text, position: 'relative', display: 'block', background: 'transparent', border: 0, outline: 'none', resize: 'none', overflow: 'hidden', color: 'var(--text-body)' }} />
      </div>
      {(hint || hasMasked) && <span style={{ fontSize: 13, color: C.meta }}>{[hint, hasMasked ? 'Phần xám là chỗ app đã tự che.' : ''].filter(Boolean).join(' ')}</span>}
    </label>
  );
}
