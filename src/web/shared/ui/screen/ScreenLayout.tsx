import type { ReactNode } from 'react';
import { StatusBadge } from '../../../components/ui/StatusBadge.js';

type Status = 'lobby' | 'running' | 'closed' | 'finalized';
// Projector frame, designed at 1920×1080 (callers scale the stage). density="compact" = 88px top bar for
// the discussion screen, with `meta` after the status and `actions` on the right.
export function ScreenLayout({ children, examTitle, status, joinUrl, meta, actions, density = 'default' }: { children?: ReactNode; examTitle?: string; status?: Status; joinUrl?: string; meta?: ReactNode; actions?: ReactNode; density?: 'default' | 'compact' }) {
  if (density === 'compact') {
    return (
      <div data-theme="screen" style={{ width: '100%', height: '100%', boxSizing: 'border-box', background: 'var(--screen-bg)', color: 'var(--screen-text)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <header style={{ flex: 'none', height: 88, padding: '0 40px', display: 'flex', alignItems: 'center', gap: 20, borderBottom: '2px solid var(--screen-line)' }}>
          <span style={{ font: '800 32px/1 var(--font-sans)', letterSpacing: '-0.03em', color: 'var(--sun-400)', flex: 'none' }}>p-quizzz</span>
          <span aria-hidden="true" style={{ width: 2, height: 32, background: 'var(--screen-line-strong)', flex: 'none' }} />
          {examTitle && <span style={{ font: '700 28px/1.1 var(--font-sans)', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{examTitle}</span>}
          {status && <StatusBadge status={status} size="screen" />}
          {meta}
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>{actions}</span>
        </header>
        <main style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</main>
      </div>
    );
  }
  return (
    <div data-theme="screen" style={{ width: '100%', height: '100%', minHeight: 1080, boxSizing: 'border-box', background: 'var(--screen-bg)', color: 'var(--screen-text)', fontFamily: 'var(--font-sans)', padding: '48px 72px', display: 'flex', flexDirection: 'column', gap: 40 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <span style={{ font: '800 36px/1 var(--font-sans)', letterSpacing: '-0.03em', color: 'var(--sun-400)' }}>p-quizzz</span>
        {examTitle && <span style={{ font: '700 36px/1.1 var(--font-sans)', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{examTitle}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          {meta}
          {joinUrl && <span style={{ font: '700 32px/1 var(--font-mono)', color: 'var(--screen-meta)' }}>{joinUrl}</span>}
          {status && <StatusBadge status={status} size="lg" />}
          {actions}
        </span>
      </header>
      <main style={{ flex: 1, minHeight: 0 }}>{children}</main>
    </div>
  );
}
