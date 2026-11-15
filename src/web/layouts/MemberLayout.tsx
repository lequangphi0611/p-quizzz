import { useState, type ReactNode, type Ref, type UIEventHandler } from 'react';
import { Icon } from '../components/ui/Icon.js';

export function NameChip({ name }: { name: string }) {
  return (
    <span title={name} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--sun-100)', color: 'var(--sun-ink)', font: 'var(--type-label)', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      <Icon name="user" size={14} />{name}
    </span>
  );
}

const wordmark = (size: number) => <span style={{ font: `800 ${size}px/1 var(--font-sans)`, letterSpacing: '-0.03em', color: 'var(--brand-600)', flex: 'none' }}>p-quizzz</span>;

/**
 * Member frame. `narrow` (default): one 640px column — phones and tablets. `wide` (desktop, S18): 56px header with
 * status and save state, optional sidebar (296px, `compact` = 264px), main area that scrolls on its own, skip link.
 */
export function MemberLayout({ children, sessionTitle, displayName, footer, variant = 'narrow', status, headerEnd, banner, sidebar, compact = false, mainRef, onMainScroll }: {
  children?: ReactNode; sessionTitle?: string; displayName?: string; footer?: ReactNode;
  variant?: 'narrow' | 'wide'; status?: ReactNode; headerEnd?: ReactNode; banner?: ReactNode; sidebar?: ReactNode; compact?: boolean;
  mainRef?: Ref<HTMLElement>; onMainScroll?: UIEventHandler<HTMLElement>;
}) {
  const [skip, setSkip] = useState(false);
  if (variant === 'wide') {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--surface-page)', minWidth: 0, position: 'relative' }}>
        <a href="#noi-dung" onFocus={() => setSkip(true)} onBlur={() => setSkip(false)}
          onClick={e => { e.preventDefault(); (document.querySelector('[data-pq-focus]') as HTMLElement | null)?.focus(); }}
          style={{ position: 'absolute', left: 16, top: skip ? 8 : -60, zIndex: 20, padding: '10px 14px', background: 'var(--paper)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-raised)', font: 'var(--type-ui)', fontWeight: 600 }}>Đến nội dung chính</a>
        <header style={{ flex: 'none', height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', background: 'var(--paper)', borderBottom: '1px solid var(--border-hairline)', minWidth: 0 }}>
          {wordmark(20)}
          {sessionTitle && <span aria-hidden="true" style={{ width: 1, height: 20, background: 'var(--ink-200)', flex: 'none' }} />}
          {sessionTitle && <span style={{ font: 'var(--type-ui)', fontWeight: 600, color: 'var(--text-title)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{sessionTitle}</span>}
          {status && <span style={{ flex: 'none' }}>{status}</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, flex: 'none' }}>{headerEnd}{displayName && <NameChip name={displayName} />}</div>
        </header>
        {banner}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {sidebar && <aside style={{ flex: 'none', width: compact ? 264 : 296, background: 'var(--paper)', borderRight: '1px solid var(--border-hairline)', minHeight: 0, display: 'flex', flexDirection: 'column' }}>{sidebar}</aside>}
          <main id="noi-dung" ref={mainRef} onScroll={onMainScroll} style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>{children}</main>
        </div>
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--paper)', borderBottom: '1px solid var(--border-hairline)' }}>
        <div style={{ maxWidth: 'var(--member-max)', margin: '0 auto', height: 52, padding: '0 var(--gutter-phone)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {wordmark(18)}
          {sessionTitle && <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>· {sessionTitle}</span>}
          {displayName && <span style={{ marginLeft: 'auto' }}><NameChip name={displayName} /></span>}
        </div>
      </header>
      <main id="noi-dung" style={{ flex: 1, width: '100%', maxWidth: 'var(--member-max)', margin: '0 auto', padding: '20px var(--gutter-phone) 32px', boxSizing: 'border-box', minWidth: 0 }}>{children}</main>
      {footer && <footer style={{ position: 'sticky', bottom: 0, background: 'var(--paper)', borderTop: '1px solid var(--border-hairline)', paddingBottom: 'env(safe-area-inset-bottom)' }}><div style={{ maxWidth: 'var(--member-max)', margin: '0 auto', padding: '12px var(--gutter-phone)' }}>{footer}</div></footer>}
    </div>
  );
}
