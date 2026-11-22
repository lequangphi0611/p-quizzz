import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../shared/ui/Icon.js';
type NavKey = 'exams' | 'sessions' | 'groups' | 'trainings';
const NAV: [NavKey, string, string][] = [['exams', 'Đề thi', 'library'], ['sessions', 'Phiên thi', 'list-checks'], ['groups', 'Nhóm', 'users'], ['trainings', 'Buổi training AI', 'code']];
export function AdminLayout({ children, active = 'exams', onNavigate, onLogout, onOpenScreen, notifications, strip }: { children?: ReactNode; active?: NavKey; onNavigate?: (key: NavKey) => void; onLogout?: () => void; onOpenScreen?: () => void; notifications?: ReactNode; strip?: ReactNode }) {
  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-page)' }}>
      <header style={{ background: 'var(--ink-900)', color: '#fff' }}>
        <div style={{ maxWidth: 'var(--admin-max)', margin: '0 auto', height: 'var(--admin-nav-h)', padding: '0 var(--gutter-desk)', display: 'flex', alignItems: 'center', gap: 28 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ font: '800 20px/1 var(--font-sans)', letterSpacing: '-0.03em' }}>p-quizzz</span><span style={{ font: 'var(--type-label)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)' }}>Mentor</span></span>
          <nav style={{ display: 'flex', gap: 4, height: '100%' }}>
            {NAV.map(([k, l, ic]) => (
              <button key={k} onClick={() => onNavigate && onNavigate(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 14px', height: '100%', background: 'none', border: 0, borderBottom: '3px solid ' + (active === k ? 'var(--sun-400)' : 'transparent'), color: active === k ? '#fff' : 'var(--ink-400)', font: 'var(--type-ui)', fontWeight: 600, cursor: 'pointer' }}><Icon name={ic} size={16} />{l}</button>
            ))}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            {notifications}
            <button onClick={onOpenScreen} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'none', border: 0, borderRadius: 'var(--radius-sm)', color: 'var(--ink-300)', font: 'var(--type-meta)', fontWeight: 500, cursor: 'pointer' }}><Icon name="presentation" size={16} />Màn hình chiếu</button>
            <button onClick={onLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'none', border: 0, borderRadius: 'var(--radius-sm)', color: 'var(--ink-300)', font: 'var(--type-meta)', fontWeight: 500, cursor: 'pointer' }}><Icon name="log-out" size={16} />Đăng xuất</button>
          </div>
        </div>
      </header>
      {strip}
      <main style={{ maxWidth: 'var(--admin-max)', margin: '0 auto', padding: '28px var(--gutter-desk) 48px', boxSizing: 'border-box' }}>{children}</main>
    </div>
  );
}