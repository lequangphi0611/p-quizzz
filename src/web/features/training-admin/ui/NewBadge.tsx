import { newBadgeText } from '../domain/unread.js';
import { visuallyHidden } from './chips.js';

/** What a screen reader says for each kind of badge (PRODUCT.md §7.38d). */
const SPOKEN = { 'Mới': 'Mới — prompt mới', 'Lệnh mới': 'Lệnh mới — sự kiện mới trong prompt đã đọc' } as const;

/**
 * The one "new" mark, the same everywhere (S43): solid brand fill, white bold text, always with words (never only a dot). With `count`
 * it reads "N mới" (from 100 on "99+ mới"), the number of prompts that have something new. `fading` = the 2 seconds are over: it
 * fades and shrinks (instantly with reduced motion, the tokens are 0 then) and its place on the row is given back when it unmounts.
 */
export function NewBadge({ label = 'Mới', count, size = 'sm', fading = false }: { label?: 'Mới' | 'Lệnh mới'; count?: number; size?: 'sm' | 'md'; fading?: boolean }) {
  const spoken = count !== undefined ? `${count} prompt có mục mới` : SPOKEN[label];
  return (
    <span data-new-badge={count !== undefined ? 'count' : label} data-fading={fading || undefined} style={{
      display: 'inline-flex', alignItems: 'center', flex: 'none', height: size === 'md' ? 20 : 18, padding: size === 'md' ? '0 7px' : '0 7px', borderRadius: 999,
      background: 'var(--brand-600)', color: 'var(--paper)', font: '700 11px/1 var(--font-sans)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
      opacity: fading ? 0 : 1, transform: fading ? 'scale(.92)' : 'none', transition: 'opacity var(--dur-slow) var(--ease-standard), transform var(--dur-slow) var(--ease-standard)',
    }}>
      <span aria-hidden="true">{count !== undefined ? newBadgeText(count) : label}</span>
      {!fading && <span style={visuallyHidden}>{spoken}</span>}
    </span>
  );
}
