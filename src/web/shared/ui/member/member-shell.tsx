import type { CSSProperties, ReactNode } from 'react';
import { Card } from '../../../shared/ui/Card.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { DESK_MIN } from './breakpoints.js';
import { MemberLayout } from './MemberLayout.js';

// Frame and small building blocks shared by the member screens (S18, design "member-v2").

export const mText = {
  label: { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--text-meta)' },
  h1: { margin: 0, font: 'var(--type-h1)', color: 'var(--text-title)', textWrap: 'pretty' },
  meta: { margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)', textWrap: 'pretty' },
  mono: { fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' },
} satisfies Record<string, CSSProperties>;

export const useIsDesk = () => useMediaQuery(`(min-width: ${DESK_MIN}px)`);
/** Show key chips only with a real pointer + hover (a keyboard is likely). */
export const useShowKeys = () => useMediaQuery('(hover: hover) and (pointer: fine)');

/** Simple centred screens: a card in the wide shell on desktop, the narrow column on phones. */
export function MemberPage({ desk, title, name, status, maxW = 480, footer, children }: { desk: boolean; title?: string; name?: string; status?: ReactNode; maxW?: number; footer?: ReactNode; children: ReactNode }) {
  if (desk) {
    return (
      <MemberLayout variant="wide" sessionTitle={title} displayName={name} status={status}>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '48px 32px' }}><div style={{ width: '100%', maxWidth: maxW, display: 'grid', gap: 20, minWidth: 0 }}>{children}</div></div>
      </MemberLayout>
    );
  }
  return <MemberLayout sessionTitle={title} displayName={name} footer={footer}><div style={{ display: 'grid', gap: 20, paddingTop: 4, minWidth: 0 }}>{children}</div></MemberLayout>;
}

export function PageCard({ desk, children, center = false }: { desk: boolean; children: ReactNode; center?: boolean }) {
  return <Card padding={desk ? 32 : 20}><div style={{ display: 'grid', gap: center ? 14 : 20, ...(center ? { justifyItems: 'center', textAlign: 'center', gridTemplateColumns: 'minmax(0, 1fr)' } : null) }}>{children}</div></Card>;
}

export function HeroIcon({ name, tone = 'brand' }: { name: string; tone?: 'brand' | 'ink' | 'warn' | 'wrong' }) {
  const t = { brand: ['var(--brand-050)', 'var(--brand-600)'], ink: ['var(--ink-100)', 'var(--ink-700)'], warn: ['var(--warn-surface)', 'var(--warn-600)'], wrong: ['var(--wrong-surface)', 'var(--wrong-600)'] }[tone];
  return <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: t[0], color: t[1], flex: 'none' }}><Icon name={name} size={28} /></span>;
}

export function Chip({ tone = 'warn', icon, children }: { tone?: 'warn' | 'brand' | 'ink'; icon?: string; children: ReactNode }) {
  const t = { warn: ['var(--warn-surface)', 'var(--warn-600)', 'var(--warn-border)'], brand: ['var(--brand-100)', 'var(--brand-700)', 'var(--brand-200)'], ink: ['var(--ink-100)', 'var(--ink-700)', 'var(--ink-300)'] }[tone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: t[0], color: t[1], border: '1px solid ' + t[2], font: 'var(--type-label)', whiteSpace: 'nowrap' }}>{icon && <Icon name={icon} size={13} />}{children}</span>;
}

/** "Tạm tính" until the mentor finalizes, then "Chính thức". */
export const OfficialChip = ({ official }: { official: boolean }) => (official ? <Chip tone="brand" icon="circle-check">Chính thức</Chip> : <Chip icon="hourglass">Tạm tính</Chip>);

export function InfoRow({ icon, k, v }: { icon: string; k: string; v: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, font: 'var(--type-ui)', fontSize: 14 }}>
      <Icon name={icon} size={16} style={{ color: 'var(--text-meta)' }} /><span style={{ color: 'var(--text-meta)', flex: 'none' }}>{k}</span>
      <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text-title)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  );
}

export const InfoBox = ({ children }: { children: ReactNode }) => <div style={{ width: '100%', display: 'grid', gap: 10, padding: 16, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', textAlign: 'left', boxSizing: 'border-box' }}>{children}</div>;

