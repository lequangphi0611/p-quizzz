import type { CSSProperties, ReactNode } from 'react';
import { StatusBadge } from '../components/ui/StatusBadge.js';
export function ScreenLayout({ children, examTitle, status, joinUrl }: { children?: ReactNode; examTitle?: string; status?: 'lobby' | 'running' | 'closed' | 'finalized'; joinUrl?: string }) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 1080, boxSizing: 'border-box', background: 'var(--screen-bg)', color: 'var(--screen-text)', fontFamily: 'var(--font-sans)', padding: '48px 72px', display: 'flex', flexDirection: 'column', gap: 40 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <span style={{ font: '800 36px/1 var(--font-sans)', letterSpacing: '-0.03em', color: 'var(--sun-400)' }}>p-quizzz</span>
        {examTitle && <span style={{ font: '700 36px/1.1 var(--font-sans)', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{examTitle}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          {joinUrl && <span style={{ font: '700 32px/1 var(--font-mono)', color: 'var(--screen-meta)' }}>{joinUrl}</span>}
          {status && <StatusBadge status={status} size="lg" />}
        </span>
      </header>
      <main style={{ flex: 1, minHeight: 0 }}>{children}</main>
    </div>
  );
}