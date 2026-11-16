import type { ReactNode } from 'react';
import { Icon } from './Icon.js';
export function ErrorMessage({ title, message, onRetry, retryLabel = 'Thử lại', tone = 'error', size = 'md' }: { title?: ReactNode; message: ReactNode; onRetry?: () => void; retryLabel?: string; tone?: 'error' | 'warning'; size?: 'md' | 'screen' }) {
  const warn = tone === 'warning';
  const scr = size === 'screen';
  const c = scr
    ? { bg: warn ? 'var(--screen-pending-surface)' : 'var(--screen-wrong-surface)', bd: warn ? 'var(--sun-500)' : 'var(--screen-wrong-border)', fg: warn ? 'var(--sun-400)' : 'var(--screen-wrong)', body: 'var(--screen-text)' }
    : { bg: warn ? 'var(--warn-surface)' : 'var(--wrong-surface)', bd: warn ? 'var(--warn-border)' : 'var(--wrong-border)', fg: warn ? 'var(--warn-600)' : 'var(--wrong-600)', body: 'var(--ink-800)' };
  return (
    <div role="alert" style={{ display: 'flex', gap: scr ? 14 : 10, alignItems: 'flex-start', padding: scr ? '14px 18px' : '12px 14px', borderRadius: 'var(--radius-md)', background: c.bg, border: (scr ? 2 : 1) + 'px solid ' + c.bd, color: c.fg, animation: scr ? 'pq-reveal var(--dur-base) var(--ease-standard)' : undefined }}>
      <Icon name={warn ? 'triangle-alert' : 'circle-alert'} size={scr ? 28 : 18} style={{ marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0, font: scr ? '500 26px/1.35 var(--font-sans)' : 'var(--type-meta)', fontSize: scr ? 26 : 14 }}>
        {title && <div style={{ fontWeight: 600 }}>{title}</div>}
        <div style={{ color: title ? c.body : scr ? c.fg : c.body, fontWeight: scr && !title ? 600 : undefined }}>{message}</div>
      </div>
      {onRetry && <button onClick={onRetry} style={{ flex: 'none', background: 'none', border: 0, padding: '2px 4px', font: 'var(--type-label)', fontSize: scr ? 24 : 13, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>{retryLabel}</button>}
    </div>
  );
}
