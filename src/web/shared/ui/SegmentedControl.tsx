import { useRef, type ReactNode } from 'react';
import { Icon } from './Icon.js';
import { SessionSlot } from './SessionSlot.js';

export interface SegmentedItem<V extends string | number> {
  value: V;
  label: ReactNode;
  icon?: string;
  /** Show the session slot chip before the label. */
  slot?: number | null;
  /** A count after the label (e.g. unread). 0 or undefined = none. */
  count?: number;
}

/**
 * Choose one of a few options. A radio group (arrow keys move and select, only the selected one is a tab stop), so it works
 * from the keyboard and reads correctly in a screen reader. Colour is never the only sign of the selection: it is also
 * `aria-checked` and bold with a check/underline.
 */
export function SegmentedControl<V extends string | number>({ items, value, onChange, ariaLabel, size = 'md', disabled = false }: {
  items: readonly SegmentedItem<V>[]; value: V; onChange: (v: V) => void; ariaLabel: string; size?: 'sm' | 'md'; disabled?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const h = size === 'sm' ? 28 : 36;
  function onKey(e: React.KeyboardEvent, i: number) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + items.length) % items.length;
    onChange(items[next]!.value);
    refs.current[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 2, padding: 2, background: 'var(--ink-100)', borderRadius: 'var(--radius-md, 10px)' }}>
      {items.map((it, i) => {
        const on = it.value === value;
        return (
          <button key={String(it.value)} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} disabled={disabled}
            tabIndex={on ? 0 : -1} onClick={() => onChange(it.value)} onKeyDown={e => onKey(e, i)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: h, padding: '0 12px', border: 0, borderRadius: 'var(--radius-sm)', cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
              background: on ? 'var(--paper)' : 'transparent', color: on ? 'var(--ink-900)' : 'var(--ink-700)', boxShadow: on ? 'var(--shadow-card)' : 'none', font: 'var(--type-ui)', fontSize: size === 'sm' ? 13 : 14, fontWeight: on ? 700 : 500, opacity: disabled ? 0.55 : 1 }}>
            {it.slot !== undefined && <SessionSlot n={it.slot} size={16} />}
            {it.icon && <Icon name={it.icon} size={15} />}
            {it.label}
            {it.count ? <span style={{ minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 'var(--radius-pill)', background: 'var(--sun-400)', color: 'var(--ink-900)', font: '700 11px/18px var(--font-sans)', textAlign: 'center' }}>{it.count > 99 ? '99+' : it.count}</span> : null}
            {on && <Icon name="check" size={13} />}
          </button>
        );
      })}
    </div>
  );
}
