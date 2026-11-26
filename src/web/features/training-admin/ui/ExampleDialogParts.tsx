import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { TEACHING_LABEL_TEXT, TEACHING_LABELS, TEACHING_TOPICS, TEACHING_TOPIC_TEXT, type TeachingLabel, type TeachingTopic } from '../../../../shared/api/index.js';
import { useReducedMotion } from '../../../shared/hooks/useStartNotices.js';
import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { draftBasisText, quoteSegments, type FieldOrigin } from '../domain/example-draft.js';

// The pieces of the example dialog (S45). The dialog itself is in `ExampleDialog.tsx`.

const tag = { display: 'inline-flex', alignItems: 'center', gap: 4, font: '600 12px/1 var(--font-sans)', color: 'var(--ink-600)' } as const;
const labelText = { font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' } as const;
const dashed = { border: '1.5px dashed var(--ink-400)', background: 'var(--ink-050)' } as const;

/** The dashed look of "the AI wrote this" for a text box, the solid one for "yours". */
const boxOf = (origin: FieldOrigin, focus: boolean): CSSProperties => ({
  ...(origin === 'ai' ? dashed : { border: '1.5px solid var(--border-strong)', background: 'var(--paper)' }),
  ...(focus ? { borderColor: 'var(--border-focus)', boxShadow: '0 0 0 3px var(--brand-100)' } : {}),
});

/** "Nguyên nháp AI" (still the draft word for word) or "Bạn đã sửa": drawn beside the label, hidden from screen readers (the box says it by `aria-describedby`). */
function OriginTag({ origin }: { origin: FieldOrigin }) {
  if (origin === 'none') return null;
  return <span aria-hidden="true" data-origin={origin} style={tag}><Icon name={origin === 'ai' ? 'sparkles' : 'pencil'} size={13} />{origin === 'ai' ? 'Nguyên nháp AI' : 'Bạn đã sửa'}</span>;
}

const visuallyHidden = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const;

/** A text box of the dialog: label, the origin tag, the box (dashed while it is the draft word for word) and an optional hint. */
export function DraftTextField({ label, value, origin, placeholder, hint, maxLength, disabled, onChange }: {
  label: string; value: string; origin: FieldOrigin; placeholder?: string; hint?: string; maxLength: number; disabled: boolean; onChange: (v: string) => void;
}) {
  const id = useId();
  const [focus, setFocus] = useState(false);
  const describedBy = [origin === 'ai' ? `${id}-origin` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor={id} style={labelText}>{label}</label>
        <span style={{ flexGrow: 1 }} />
        <OriginTag origin={origin} />
      </div>
      <textarea id={id} rows={3} value={value} placeholder={placeholder} maxLength={maxLength} disabled={disabled} aria-describedby={describedBy} data-origin={origin}
        onChange={e => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 'var(--radius-md)', font: 'var(--type-body)', fontSize: 15, color: 'var(--text-title)', resize: 'vertical', outline: 'none', transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)', ...boxOf(origin, focus) }} />
      {origin === 'ai' && <span id={`${id}-origin`} style={visuallyHidden}>Nguyên nháp AI, chưa sửa</span>}
      {hint && <span id={`${id}-hint`} style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>{hint}</span>}
    </div>
  );
}

/** The topic: a select, dashed while it is the draft's. */
export function DraftTopicField({ value, origin, disabled, onChange }: { value: TeachingTopic; origin: FieldOrigin; disabled: boolean; onChange: (t: TeachingTopic) => void }) {
  const id = useId();
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor={id} style={labelText}>Chủ đề</label>
        <span style={{ flexGrow: 1 }} />
        <OriginTag origin={origin} />
      </div>
      <select id={id} value={value} disabled={disabled} data-origin={origin} aria-describedby={origin === 'ai' ? `${id}-origin` : undefined}
        onChange={e => onChange(e.target.value as TeachingTopic)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ height: 44, padding: '0 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-title)', font: 'var(--type-body)', outline: 'none', ...boxOf(origin, focus) }}>
        {TEACHING_TOPICS.map(t => <option key={t} value={t}>{TEACHING_TOPIC_TEXT[t]}</option>)}
      </select>
      {origin === 'ai' && <span id={`${id}-origin`} style={visuallyHidden}>Nguyên nháp AI, chưa sửa</span>}
    </div>
  );
}

/**
 * Tốt / Chưa tốt. Nothing is chosen until the mentor chooses (arrow keys and 1 / 2 choose too); the label the AI suggested only has a dashed
 * outline and the words "AI gợi ý" in its name. A radio group: the chosen one (else the first) is the tab stop.
 */
export function LabelToggle({ value, suggested, disabled, onChange }: { value: TeachingLabel | ''; suggested: TeachingLabel | null; disabled: boolean; onChange: (l: TeachingLabel) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + TEACHING_LABELS.length) % TEACHING_LABELS.length;
    onChange(TEACHING_LABELS[next]!);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Nhãn" style={{ display: 'inline-flex', alignSelf: 'flex-start', gap: 2, padding: 3, borderRadius: 'var(--radius-md)', background: 'var(--ink-100)' }}>
      {TEACHING_LABELS.map((l, i) => {
        const on = value === l;
        const hint = suggested === l && !on;
        const stop = value === '' ? i === 0 : on;
        return (
          <button key={l} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} aria-keyshortcuts={String(i + 1)} tabIndex={stop ? 0 : -1} disabled={disabled}
            aria-label={hint ? `${TEACHING_LABEL_TEXT[l]}, AI gợi ý` : undefined} data-label={l} data-suggested={hint ? '' : undefined}
            onClick={() => onChange(l)} onKeyDown={e => onKey(e, i)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 16px', border: 0, borderRadius: 8, font: '500 15px/1 var(--font-sans)', cursor: disabled ? 'default' : 'pointer',
              background: on ? 'var(--paper)' : 'transparent', color: on ? 'var(--ink-900)' : 'var(--ink-700)', fontWeight: on ? 700 : 500,
              boxShadow: on ? 'var(--shadow-card), inset 0 0 0 1px var(--ink-300)' : 'none', outline: hint ? '1.5px dashed var(--ink-500)' : undefined, outlineOffset: hint ? -3 : undefined }}>
            <Icon name={l === 'good' ? 'circle-check' : 'triangle-alert'} size={16} />
            {TEACHING_LABEL_TEXT[l]}
            {on && <Icon name="check" size={14} />}
            <kbd aria-hidden="true" style={{ font: '600 10px/1 var(--font-mono)', padding: '3px 5px', border: '1px solid var(--ink-300)', borderRadius: 4, color: 'var(--ink-600)' }}>{i + 1}</kbd>
          </button>
        );
      })}
    </div>
  );
}

/** The words next to "Nhãn (bắt buộc)": what the AI suggests (and that clicking chooses), or that the mentor chose. */
export function labelTagOf(value: TeachingLabel | '', suggested: TeachingLabel | null, hasDraft: boolean): { icon: string; text: string } | null {
  if (value !== '') return hasDraft ? { icon: 'pencil', text: 'Bạn đã chọn' } : null;
  return suggested ? { icon: 'sparkles', text: `AI gợi ý: ${TEACHING_LABEL_TEXT[suggested]} · bấm để chọn` } : null;
}

/** The prompt, the words the AI flagged marked (a `<mark>`; nothing is marked when they are not found in it). */
export function PromptBlock({ prompt, quote, hidden }: { prompt: string; quote: string; hidden: boolean }) {
  if (hidden) return <div style={{ flexShrink: 0, padding: 16, textAlign: 'center', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', color: 'var(--text-meta)' }}>Nội dung đang ẩn. Nhấn H để hiện lại.</div>;
  return (
    <blockquote aria-label="Prompt được chọn" style={{ flexShrink: 0, margin: 0, maxHeight: 120, overflow: 'auto', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', borderLeft: '3px solid var(--brand-300, var(--brand-600))', font: '400 14px/1.5 var(--font-sans)', color: 'var(--ink-900)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {quoteSegments(prompt, quote).map((seg, i) => seg.mark
        ? <mark key={i} data-suspicious-quote style={{ background: 'var(--warn-surface)', color: 'var(--warn-600)', boxShadow: '0 0 0 1px var(--warn-border)', borderRadius: 3, padding: '0 2px' }}>{seg.text}</mark>
        : <span key={i}>{seg.text}</span>)}
    </blockquote>
  );
}

/** Seconds since `since` (ISO time), counted up once a second. */
function useElapsedSeconds(since: string | undefined): number {
  const start = since ? Date.parse(since) : NaN;
  const at = () => (Number.isNaN(start) ? 0 : Math.max(0, Math.floor((Date.now() - start) / 1000)));
  const [n, setN] = useState(at);
  useEffect(() => {
    setN(at());
    const t = setInterval(() => setN(at()), 1000);
    return () => clearInterval(t);
  }, [since]); // eslint-disable-line react-hooks/exhaustive-deps
  return n;
}

/** "AI đang viết nháp": a dashed block with the seconds so far and a bar that has no end. The fields stay open to type in. */
export function WritingBlock({ since }: { since: string | undefined }) {
  const seconds = useElapsedSeconds(since);
  const reduced = useReducedMotion();
  return (
    <div role="status" data-draft-writing style={{ flexShrink: 0, display: 'grid', gap: 8, padding: '12px 14px', borderRadius: 'var(--radius-md)', ...dashed }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name={reduced ? 'hourglass' : 'loader-circle'} spin={!reduced} size={16} color="var(--ink-700)" />
        <b style={{ fontSize: 14, color: 'var(--text-title)' }}>AI đang viết nháp</b>
        <span style={{ font: '500 13px/1 var(--font-mono)', color: 'var(--text-meta)' }}>{seconds} giây</span>
      </div>
      <div aria-hidden="true" style={{ height: 4, borderRadius: 99, background: 'var(--ink-200)', overflow: 'hidden' }}><div className="pq-indet" style={{ width: '40%', height: '100%', borderRadius: 99, background: 'var(--ink-600)' }} /></div>
      <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Thường mất 10–60 giây. Bạn có thể đóng hộp thoại, nháp vẫn chạy và nút trên prompt sẽ báo khi xong.</span>
    </div>
  );
}

/** "Nháp của AI, đọc và sửa trước khi lưu", how many examples it read, and the two moves on a draft. They come first in the Tab order. */
export function DraftBanner({ sampleCount, busy, onRegenerate, onDiscard }: { sampleCount: number | null; busy: boolean; onRegenerate: () => void; onDiscard: () => void }) {
  const basis = draftBasisText(sampleCount);
  return (
    <div data-draft-banner style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 14px', borderRadius: 'var(--radius-md)', ...dashed }}>
      <Icon name="sparkles" size={16} color="var(--ink-700)" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto', minWidth: 0 }}>
        <span style={{ fontSize: 14, color: 'var(--text-title)' }}><b>Nháp của AI</b>, đọc và sửa trước khi lưu</span>
        {basis && <span style={{ font: 'var(--type-meta)', fontSize: 12, color: 'var(--text-meta)' }}>{basis}</span>}
      </div>
      <Button variant="ghost" size="sm" icon="rotate-ccw" disabled={busy} onClick={onRegenerate}>Viết lại nháp</Button>
      <Button variant="ghost" size="sm" icon="trash-2" disabled={busy} onClick={onDiscard}>Bỏ nháp</Button>
    </div>
  );
}

/** The warning for a prompt the AI flagged: the reason, and that the label is not suggested. */
export function SuspectAlert({ reason }: { reason: string }) {
  return (
    <div role="alert" data-suspect-alert style={{ flexShrink: 0, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--warn-surface)', border: '1px solid var(--warn-border)', color: 'var(--warn-600)', font: 'var(--type-meta)', fontSize: 14 }}>
      <Icon name="shield-alert" size={18} style={{ marginTop: 1 }} />
      <span><b>Nghi ngờ:</b> {reason.replace(/\.$/, '')}. AI không chọn sẵn nhãn cho prompt này; đọc prompt rồi tự chọn.</span>
    </div>
  );
}

/** "Đã đọc kỹ prompt, ...": the tick that unlocks "Lưu" for a flagged prompt. */
export function ReadTick({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void }): ReactNode {
  return (
    <label style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--warn-border)', background: 'var(--warn-surface)', font: 'var(--type-ui)', fontSize: 14, color: 'var(--text-title)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} style={{ width: 18, height: 18, margin: 0, accentColor: 'var(--brand-600)' }} />
      Đã đọc kỹ prompt, câu nhắm vào người đánh giá không ảnh hưởng nhãn
    </label>
  );
}
