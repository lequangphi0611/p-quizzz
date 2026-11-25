import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../../shared/ui/Icon.js';

export interface ExportMenuItem {
  key: string;
  title: string;
  /** How sensitive the file is: said in words next to the title. */
  badge: string;
  description: string;
  onSelect: () => void;
}

/**
 * One "Xuất" button with a menu of the three files (report, raw data, examples), each with its sensitivity and one line about what it holds
 * (PRODUCT.md §7.39j). A menu button pattern: Enter / Space / ↓ open it, ↑ ↓ Home End move, Enter picks, Esc closes and gives the focus back.
 */
export function ExportMenu({ items }: { items: readonly ExportMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const close = (focusTrigger: boolean) => { setOpen(false); if (focusTrigger) trigger.current?.focus(); };
  const focusItem = (i: number) => refs.current[(i + items.length) % items.length]?.focus();

  useEffect(() => { if (open) focusItem(0); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  function onMenuKey(e: React.KeyboardEvent) {
    const at = refs.current.findIndex(el => el === document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(at + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(at - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(items.length - 1); }
    else if (e.key === 'Tab') setOpen(false);
  }

  return (
    <div ref={root} style={{ position: 'relative' }}>
      <span style={{ display: 'contents' }} onKeyDown={e => { if (!open && e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}>
        <TriggerButton refEl={trigger} open={open} menuId={menuId} onToggle={() => setOpen(o => !o)} />
      </span>
      {open && (
        <div id={menuId} role="menu" aria-label="Xuất" onKeyDown={onMenuKey}
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 30, width: 380, display: 'grid', gap: 2, padding: 6, background: 'var(--paper)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-dialog)' }}>
          {items.map((it, i) => (
            <button key={it.key} ref={el => { refs.current[i] = el; }} type="button" role="menuitem" data-export-item={it.key} onClick={() => { close(false); it.onSelect(); }}
              style={{ display: 'grid', gap: 3, textAlign: 'left', padding: '10px 12px', border: 0, borderRadius: 'var(--radius-md)', background: 'transparent', cursor: 'pointer', font: 'inherit', color: 'var(--text-title)' }}
              onMouseEnter={e => e.currentTarget.focus()}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ font: 'var(--type-ui)', fontWeight: 700, fontSize: 15 }}>{it.title}</span>
                <span style={{ padding: '1px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--ink-300)', background: 'var(--ink-100)', font: 'var(--type-label)', fontSize: 12, color: 'var(--ink-800)' }}>{it.badge}</span>
              </span>
              <span style={{ font: 'var(--type-meta)', fontSize: 13, color: 'var(--text-meta)' }}>{it.description}</span>
            </button>
          ))}
        </div>
      )}
      <style>{'[data-export-item]:focus-visible,[data-export-item]:focus{outline:2px solid var(--border-focus);background:var(--ink-100)!important}'}</style>
    </div>
  );
}

/** The shared `Button` has no ref and no aria-haspopup, so the trigger is its own button in the same look. */
function TriggerButton({ refEl, open, menuId, onToggle }: { refEl: React.RefObject<HTMLButtonElement | null>; open: boolean; menuId: string; onToggle: () => void }) {
  return (
    <button ref={refEl} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={onToggle}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
        color: 'var(--ink-900)', background: open ? 'var(--ink-100)' : 'var(--paper)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', boxShadow: '0 2px 0 var(--ink-200)' }}>
      <Icon name="download" size={16} />Xuất<Icon name="chevron-down" size={16} />
    </button>
  );
}

