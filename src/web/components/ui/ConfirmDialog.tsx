import type { ReactNode } from 'react';
import { Button } from './Button.js';

// Centered confirmation on a scrim. Clicking the scrim cancels. `busy` locks the buttons while the action runs.
export function ConfirmDialog({ open = true, title, children, confirmLabel = 'Xác nhận', cancelLabel = 'Huỷ', tone = 'primary', busy = false, onConfirm, onCancel }: {
  open?: boolean; title: ReactNode; children?: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: 'primary' | 'danger'; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div onClick={e => { if (e.target === e.currentTarget && !busy) onCancel(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 420, background: 'var(--paper)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-dialog)', padding: 24, animation: 'pq-pop-in var(--dur-slow) var(--ease-standard)' }}>
        <h3 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-title)' }}>{title}</h3>
        {children && <div style={{ font: 'var(--type-body)', fontSize: 15, color: 'var(--text-body)', marginTop: 8 }}>{children}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
