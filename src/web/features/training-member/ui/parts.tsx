import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../../../shared/ui/Icon.js';
import { mText } from '../../../shared/ui/member/member-shell.js';
import type { ConsentItem } from '../domain/consent-copy.js';

// Small building blocks of the training screens. No data from the server is ever rendered through them except names and titles.

export type Tone = 'info' | 'warn' | 'wrong' | 'ok' | 'neutral';

const TONES: Record<Tone, { bg: string; border: string; ink: string }> = {
  info: { bg: 'var(--brand-050)', border: 'var(--brand-200)', ink: 'var(--brand-700)' },
  warn: { bg: 'var(--warn-surface)', border: 'var(--warn-border)', ink: 'var(--warn-600)' },
  wrong: { bg: 'var(--wrong-surface)', border: 'var(--wrong-border)', ink: 'var(--wrong-600)' },
  ok: { bg: 'var(--correct-surface)', border: 'var(--correct-border)', ink: 'var(--correct-600)' },
  neutral: { bg: 'var(--surface-sunken)', border: 'var(--border-hairline)', ink: 'var(--ink-700)' },
};

/** A note that must not be missed: icon + words, never colour alone. `alert` makes a screen reader read it out when it appears. */
export function Callout({ tone = 'info', icon, title, children, alert = false, style }: { tone?: Tone; icon: string; title?: ReactNode; children?: ReactNode; alert?: boolean; style?: CSSProperties }) {
  const t = TONES[tone];
  return (
    <div role={alert ? 'alert' : undefined} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius-md)', background: t.bg, border: `1px solid ${t.border}`, minWidth: 0, width: '100%', boxSizing: 'border-box', ...style }}>
      <Icon name={icon} size={20} color={t.ink} style={{ marginTop: 2 }} />
      <div style={{ minWidth: 0, textAlign: 'left', font: 'var(--type-body)', fontSize: 15, color: 'var(--ink-800)', textWrap: 'pretty' }}>
        {title && <strong style={{ display: 'block', marginBottom: 4, font: 'var(--type-ui)', fontWeight: 700, fontSize: 16, color: t.ink }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

/** One numbered step of the install / removal guide. */
export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
      <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--brand-600)', color: '#fff', font: '700 16px/1 var(--font-sans)' }}>{n}</span>
      <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
        <h2 id={`step-${n}`} style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-title)', paddingTop: 4 }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

/** A list of "icon, bold lead, text" lines (the consent screen's facts). */
export function FactList({ items, label }: { items: readonly ConsentItem[]; label: string }) {
  return (
    <ul aria-label={label} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
      {items.map(i => (
        <li key={i.lead} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 10, alignItems: 'start', font: 'var(--type-body)', fontSize: 15, color: 'var(--text-body)' }}>
          <Icon name={i.icon} size={18} color="var(--ink-600)" style={{ marginTop: 3 }} />
          <span style={{ textWrap: 'pretty' }}><strong style={{ color: 'var(--text-title)' }}>{i.lead}</strong> {i.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Vertical stack with a gap. */
export const Stack = ({ children, gap = 16, center = false }: { children: ReactNode; gap?: number; center?: boolean }) => <div style={{ display: 'grid', gap, ...(center ? { justifyItems: 'center' } : null) }}>{children}</div>;

export const Heading = ({ children }: { children: ReactNode }) => <h2 style={{ margin: 0, font: 'var(--type-h2)', fontSize: 17, color: 'var(--text-title)' }}>{children}</h2>;

/** Inline code (file names, commands) inside running text. */
export const Mono = ({ children }: { children: ReactNode }) => (
  <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92em', padding: '1px 6px', borderRadius: 'var(--radius-xs)', background: 'var(--ink-100)', color: 'var(--ink-900)', overflowWrap: 'anywhere' }}>{children}</code>
);

export const Paragraph = ({ children }: { children: ReactNode }) => <p style={{ margin: 0, font: 'var(--type-body)', fontSize: 15, color: 'var(--text-body)', textWrap: 'pretty' }}>{children}</p>;

/** The big circle at the top of a status screen. */
export function StatusMark({ icon, tone }: { icon: string; tone: Tone }) {
  const t = TONES[tone];
  return <span aria-hidden="true" style={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', background: t.bg, color: t.ink, border: `1px solid ${t.border}`, flex: 'none' }}><Icon name={icon} size={32} /></span>;
}

export { mText };
