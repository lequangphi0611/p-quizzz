import type { ReactNode } from 'react';

// Key chip, e.g. <Kbd>←</Kbd>. `active` highlights it (the picked option's number), `dim` fades it while shortcuts are off.
export function Kbd({ children, active = false, dim = false }: { children: ReactNode; active?: boolean; dim?: boolean }) {
  return (
    <kbd style={{ display: 'inline-grid', placeItems: 'center', minWidth: 22, height: 22, padding: '0 6px', boxSizing: 'border-box', borderRadius: 'var(--radius-xs)', borderStyle: 'solid', borderColor: active ? 'var(--brand-500)' : 'var(--ink-300)', borderWidth: '1px 1px 2px', background: active ? 'var(--brand-050)' : 'var(--paper)', font: '600 12px/1 var(--font-mono)', color: active ? 'var(--brand-700)' : 'var(--ink-700)', opacity: dim ? 0.5 : 1, flex: 'none' }}>
      {children}
    </kbd>
  );
}
