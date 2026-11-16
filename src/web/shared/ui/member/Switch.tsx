import type { ReactNode } from 'react';

export function Switch({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 4px', background: 'none', border: 0, cursor: 'pointer', font: 'var(--type-ui)', fontSize: 14, color: 'var(--text-body)' }}>
      <span aria-hidden="true" style={{ width: 36, height: 20, borderRadius: 99, background: on ? 'var(--brand-600)' : 'var(--ink-300)', position: 'relative', transition: 'background var(--dur-fast)', flex: 'none' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left var(--dur-fast) var(--ease-standard)' }} />
      </span>
      {children}
    </button>
  );
}
