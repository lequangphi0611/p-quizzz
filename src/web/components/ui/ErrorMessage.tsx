import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon.js';
export function ErrorMessage({ title, message, onRetry, retryLabel = 'Thử lại', tone = 'error' }: { title?: ReactNode; message: ReactNode; onRetry?: () => void; retryLabel?: string; tone?: 'error' | 'warning' }) {
  const warn = tone === 'warning';
  return (
    <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: warn ? 'var(--warn-surface)' : 'var(--wrong-surface)', border: '1px solid ' + (warn ? 'var(--warn-border)' : 'var(--wrong-border)'), color: warn ? 'var(--warn-600)' : 'var(--wrong-600)' }}>
      <Icon name={warn ? 'triangle-alert' : 'circle-alert'} size={18} style={{ marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0, font: 'var(--type-meta)', fontSize: 14 }}>
        {title && <div style={{ fontWeight: 600 }}>{title}</div>}
        <div style={{ color: 'var(--ink-800)' }}>{message}</div>
      </div>
      {onRetry && <button onClick={onRetry} style={{ flex: 'none', background: 'none', border: 0, padding: '2px 4px', font: 'var(--type-label)', fontSize: 13, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>{retryLabel}</button>}
    </div>
  );
}