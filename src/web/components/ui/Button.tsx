import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon.js';
type Size = 'sm' | 'md' | 'lg';
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export interface ButtonProps { children?: ReactNode; variant?: Variant; size?: Size; icon?: string; iconRight?: string; loading?: boolean; disabled?: boolean; block?: boolean; type?: 'button' | 'submit'; onClick?: () => void; style?: CSSProperties }
const SIZES: Record<Size, { h: number; px: number; fs: number; ic: number }> = { sm: { h: 32, px: 12, fs: 13, ic: 14 }, md: { h: 40, px: 16, fs: 15, ic: 16 }, lg: { h: 48, px: 20, fs: 16, ic: 18 } };
const VARIANTS: Record<Variant, { bg: string; hover: string; fg: string; border: string; shadow: string }> = {
  primary: { bg: 'var(--action-primary-bg)', hover: 'var(--action-primary-bg-hover)', fg: 'var(--action-primary-text)', border: 'transparent', shadow: 'var(--shadow-press)' },
  secondary: { bg: 'var(--paper)', hover: 'var(--ink-100)', fg: 'var(--ink-900)', border: 'var(--border-strong)', shadow: '0 2px 0 var(--ink-200)' },
  ghost: { bg: 'transparent', hover: 'var(--ink-100)', fg: 'var(--ink-800)', border: 'transparent', shadow: 'none' },
  danger: { bg: 'var(--action-danger-bg)', hover: 'var(--action-danger-bg-hover)', fg: '#fff', border: 'transparent', shadow: '0 2px 0 #7E1A14' },
};
export function Button({ children, variant = 'primary', size = 'md', icon, iconRight, loading = false, disabled = false, block = false, type = 'button', onClick, style }: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const s = SIZES[size]; const v = VARIANTS[variant];
  const off = disabled || loading;
  return (
    <button type={type} disabled={off} onClick={off ? undefined : onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setDown(false); }}
      onMouseDown={() => setDown(true)} onMouseUp={() => setDown(false)}
      style={{ display: block ? 'flex' : 'inline-flex', width: block ? '100%' : undefined, alignItems: 'center', justifyContent: 'center', gap: 8,
        height: s.h, padding: '0 ' + s.px + 'px', fontFamily: 'var(--font-sans)', fontSize: s.fs, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
        color: v.fg, background: off ? (variant === 'ghost' ? 'transparent' : 'var(--ink-100)') : (hover ? v.hover : v.bg),
        border: '1px solid ' + (off && variant !== 'ghost' ? 'var(--ink-200)' : v.border), borderRadius: 'var(--radius-md)',
        boxShadow: off || down ? 'none' : v.shadow, transform: down && !off ? 'translateY(2px)' : 'none',
        cursor: off ? 'not-allowed' : 'pointer', opacity: off && !loading ? 0.55 : 1, ...(off ? { color: variant === 'primary' || variant === 'danger' ? 'var(--ink-500)' : v.fg } : null),
        transition: 'background var(--dur-fast) var(--ease-standard), transform 80ms', ...style }}>
      {loading ? <Icon name="loader-circle" size={s.ic} spin /> : icon ? <Icon name={icon} size={s.ic} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={s.ic} /> : null}
    </button>
  );
}