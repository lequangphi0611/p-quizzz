import type { CSSProperties, ReactNode } from 'react';
type Tone = 'default' | 'sunken' | 'brand';
export interface CardProps { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode; tone?: Tone; padding?: number | string; style?: CSSProperties }
const TONES: Record<Tone, { bg: string; border: string }> = { default: { bg: 'var(--surface-card)', border: 'var(--border-hairline)' }, sunken: { bg: 'var(--surface-sunken)', border: 'transparent' }, brand: { bg: 'var(--brand-050)', border: 'var(--brand-200)' } };
export function Card({ title, subtitle, actions, children, tone = 'default', padding = 20, style }: CardProps) {
  const t = TONES[tone];
  return (
    <section style={{ background: t.bg, border: '1px solid ' + t.border, borderRadius: 'var(--radius-lg)', boxShadow: tone === 'default' ? 'var(--shadow-card)' : 'none', padding, ...style }}>
      {(title || actions) && (
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: children ? 14 : 0 }}>
          <div style={{ minWidth: 0 }}>
            {title && <h3 style={{ margin: 0, font: 'var(--type-h2)', fontSize: 17, color: 'var(--text-title)' }}>{title}</h3>}
            {subtitle && <div style={{ font: 'var(--type-meta)', color: 'var(--text-meta)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8, flex: 'none' }}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}