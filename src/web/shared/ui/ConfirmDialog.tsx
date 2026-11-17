import type { ReactNode } from 'react';
import { Button } from './Button.js';
import { Icon } from './Icon.js';

// Centered confirmation on a scrim. Clicking the scrim cancels. `busy` locks the buttons while the action runs.
// `confirmDisabled` + `disabledReason` explain why the action is not possible yet. size="screen" = projector theme.
export function ConfirmDialog({ open = true, title, children, confirmLabel = 'Xác nhận', cancelLabel = 'Huỷ', tone = 'primary', busy = false, confirmDisabled = false, disabledReason, size = 'md', width, onConfirm, onCancel }: {
  open?: boolean; title: ReactNode; children?: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: 'primary' | 'danger'; busy?: boolean;
  confirmDisabled?: boolean; disabledReason?: ReactNode; size?: 'md' | 'screen'; /** Max width in px of the light dialog (default 420), for forms that need room. */ width?: number; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  const scr = size === 'screen';
  const btnTone = scr ? 'screen' : 'light';
  return (
    <div onClick={e => { if (e.target === e.currentTarget && !busy) onCancel(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, background: scr ? 'var(--screen-scrim)' : 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16, animation: 'pq-fade var(--dur-base) var(--ease-standard)' }}>
      <div role="dialog" aria-modal="true" style={scr
        ? { width: '100%', maxWidth: 920, background: 'var(--screen-panel)', border: '2px solid var(--screen-line-strong)', borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 80px rgba(0,0,0,.6)', padding: 44, color: 'var(--screen-text)', animation: 'pq-pop-in var(--dur-slow) var(--ease-standard)' }
        : { width: '100%', maxWidth: width ?? 420, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: 'var(--paper)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-dialog)', padding: 24, animation: 'pq-pop-in var(--dur-slow) var(--ease-standard)' }}>
        <h3 style={{ margin: 0, font: scr ? '700 44px/1.2 var(--font-sans)' : 'var(--type-h2)', color: scr ? 'var(--screen-text)' : 'var(--text-title)' }}>{title}</h3>
        {children && <div style={{ font: scr ? '400 28px/1.5 var(--font-sans)' : 'var(--type-body)', fontSize: scr ? 28 : 15, color: scr ? 'var(--screen-text)' : 'var(--text-body)', marginTop: scr ? 16 : 8, textWrap: 'pretty' }}>{children}</div>}
        {confirmDisabled && disabledReason && (
          <div style={{ display: 'flex', alignItems: 'center', gap: scr ? 14 : 8, marginTop: scr ? 28 : 16, padding: scr ? '16px 20px' : '10px 12px', borderRadius: 'var(--radius-md)', background: scr ? 'var(--screen-pending-surface)' : 'var(--warn-surface)', color: scr ? 'var(--sun-400)' : 'var(--warn-600)', font: scr ? '600 26px/1.3 var(--font-sans)' : 'var(--type-meta)', fontWeight: 600 }}>
            <Icon name="lock" size={scr ? 28 : 16} /><span style={{ flex: 1 }}>{disabledReason}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: scr ? 16 : 8, marginTop: scr ? 36 : 22 }}>
          <Button variant="ghost" tone={btnTone} size={scr ? 'xl' : 'md'} disabled={busy} onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} tone={btnTone} size={scr ? 'xl' : 'md'} icon={scr && confirmDisabled ? 'lock' : undefined} loading={busy} disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
