import { TEACHING_LABEL_TEXT, type TeachingLabel } from '../../../../shared/api/index.js';
import { Icon } from '../../../shared/ui/Icon.js';

const base = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 8px', borderRadius: 'var(--radius-sm)', font: 'var(--type-label)', fontSize: 12.5, whiteSpace: 'nowrap', flex: 'none', cursor: 'pointer' } as const;

/**
 * "Làm ví dụ" on a prompt (PRODUCT.md §7.39b, §7.39j). Three looks, each with an icon and words, never colour alone: not picked,
 * "Ví dụ: Tốt" (green) and "Ví dụ: Chưa tốt" (neutral grey, not red: the label is about the prompt). A member who did not agree gets
 * no button at all (the lock is a chip in the member's header).
 */
export function TeachingButton({ id, label, onOpen }: { id: number; label: TeachingLabel | null; onOpen: (id: number) => void }) {
  const look = label === 'good'
    ? { icon: 'circle-check', border: 'var(--correct-border)', bg: 'var(--correct-surface)', fg: 'var(--correct-600)' }
    : label === 'needs_work'
      ? { icon: 'rotate-ccw', border: 'var(--ink-300)', bg: 'var(--ink-100)', fg: 'var(--ink-800)' }
      : { icon: 'graduation-cap', border: 'var(--ink-300)', bg: 'var(--paper)', fg: 'var(--text-link)' };
  return (
    <button type="button" data-teaching={id} data-teaching-state={label ?? 'plain'} aria-haspopup="dialog" onClick={() => onOpen(id)}
      title={label ? 'Sửa hoặc bỏ ví dụ' : 'Chọn prompt này làm ví dụ'}
      style={{ ...base, border: `1px solid ${look.border}`, background: look.bg, color: look.fg }}>
      <Icon name={look.icon} size={14} />
      {label ? `Ví dụ: ${TEACHING_LABEL_TEXT[label]}` : 'Làm ví dụ'}
    </button>
  );
}

/** The chip at the top of a member's timeline when they did not agree: why no prompt has the "Làm ví dụ" button. */
export function NoTeachingChip() {
  return (
    <span data-no-teaching title="Bạn này không đồng ý cho dùng làm ví dụ" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 'var(--radius-pill)', border: '1px dashed var(--ink-400)', color: 'var(--ink-700)', font: 'var(--type-label)', fontSize: 12 }}>
      <Icon name="lock" size={13} />Không dùng làm ví dụ
    </span>
  );
}
