import { TEACHING_LABEL_TEXT, type TeachingLabel } from '../../../../shared/api/index.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { visuallyHidden } from './chips.js';

const base = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 8px', borderRadius: 'var(--radius-sm)', font: 'var(--type-label)', fontSize: 12.5, whiteSpace: 'nowrap', flex: 'none' } as const;

/**
 * "Ví dụ" on a prompt (PRODUCT.md §7.39b). Three looks, each with an icon and words, never colour alone:
 * plain (can be picked), picked (shows the label), locked (the member did not agree: the reason is the tooltip and the reader's text).
 * The locked button is `aria-disabled` rather than `disabled`, so it keeps its focus and tooltip.
 */
export function TeachingButton({ id, label, lockReason, onOpen }: { id: number; label: TeachingLabel | null; lockReason: string | null; onOpen: (id: number) => void }) {
  if (lockReason && label === null) {
    return (
      <button type="button" data-teaching={id} data-teaching-state="locked" aria-disabled="true" title={lockReason}
        style={{ ...base, border: '1px dashed var(--ink-400)', background: 'transparent', color: 'var(--ink-600)', cursor: 'not-allowed' }}>
        <Icon name="lock" size={13} />Không dùng làm ví dụ
        <span style={visuallyHidden}>. Nút Ví dụ bị khoá: {lockReason}</span>
      </button>
    );
  }
  const picked = label !== null;
  return (
    <button type="button" data-teaching={id} data-teaching-state={picked ? 'picked' : 'plain'} aria-haspopup="dialog" onClick={() => onOpen(id)}
      title={picked ? 'Sửa hoặc bỏ ví dụ' : 'Chọn prompt này làm ví dụ'}
      style={{ ...base, cursor: 'pointer', border: `1px solid ${picked ? 'var(--brand-200)' : 'var(--ink-300)'}`, background: picked ? 'var(--brand-050)' : 'var(--paper)', color: picked ? 'var(--brand-700)' : 'var(--text-link)' }}>
      <Icon name={picked ? 'circle-check' : 'library'} size={13} />
      {picked ? `Ví dụ: ${TEACHING_LABEL_TEXT[label]}` : 'Ví dụ'}
    </button>
  );
}
