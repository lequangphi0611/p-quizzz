import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../components/ui/Icon.js';
export function MemberLayout({ children, sessionTitle, displayName, footer }: { children?: ReactNode; sessionTitle?: string; displayName?: string; footer?: ReactNode }) {
  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--paper)', borderBottom: '1px solid var(--border-hairline)' }}>
        <div style={{ maxWidth: 'var(--member-max)', margin: '0 auto', height: 52, padding: '0 var(--gutter-phone)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ font: '800 18px/1 var(--font-sans)', letterSpacing: '-0.03em', color: 'var(--brand-600)' }}>p-quizzz</span>
          {sessionTitle && <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>· {sessionTitle}</span>}
          {displayName && <span style={{ marginLeft: 'auto', flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--sun-100)', color: 'var(--sun-ink)', font: 'var(--type-label)', fontSize: 13 }}><Icon name="user" size={14} />{displayName}</span>}
        </div>
      </header>
      <main style={{ flex: 1, width: '100%', maxWidth: 'var(--member-max)', margin: '0 auto', padding: '20px var(--gutter-phone) 32px', boxSizing: 'border-box' }}>{children}</main>
      {footer && <footer style={{ position: 'sticky', bottom: 0, background: 'var(--paper)', borderTop: '1px solid var(--border-hairline)' }}><div style={{ maxWidth: 'var(--member-max)', margin: '0 auto', padding: '12px var(--gutter-phone)' }}>{footer}</div></footer>}
    </div>
  );
}