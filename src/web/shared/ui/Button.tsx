import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon.js';
type Size = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Look = { bg: string; hover: string; fg: string; border: string; shadow: string };
export interface ButtonProps {
  children?: ReactNode; variant?: Variant; size?: Size;
  /** 'screen' = dark projector theme (primary / secondary / ghost) */
  tone?: 'light' | 'screen';
  icon?: string; iconRight?: string;
  /** Keyboard hint rendered as a <kbd> inside the button, e.g. "Space" */
  shortcut?: string;
  /** Required for icon-only buttons; also used as the tooltip */
  ariaLabel?: string;
  loading?: boolean; disabled?: boolean; block?: boolean; type?: 'button' | 'submit'; onClick?: () => void; style?: CSSProperties;
}
const SIZES: Record<Size, { h: number; px: number; fs: number; ic: number; gap: number }> = {
  sm: { h: 32, px: 12, fs: 13, ic: 14, gap: 8 }, md: { h: 40, px: 16, fs: 15, ic: 16, gap: 8 }, lg: { h: 48, px: 20, fs: 16, ic: 18, gap: 8 },
  xl: { h: 56, px: 24, fs: 22, ic: 24, gap: 10 }, xxl: { h: 72, px: 32, fs: 28, ic: 30, gap: 12 },
};
const VARIANTS: Record<Variant, Look> = {
  primary: { bg: 'var(--action-primary-bg)', hover: 'var(--action-primary-bg-hover)', fg: 'var(--action-primary-text)', border: 'transparent', shadow: 'var(--shadow-press)' },
  secondary: { bg: 'var(--paper)', hover: 'var(--ink-100)', fg: 'var(--ink-900)', border: 'var(--border-strong)', shadow: '0 2px 0 var(--ink-200)' },
  ghost: { bg: 'transparent', hover: 'var(--ink-100)', fg: 'var(--ink-800)', border: 'transparent', shadow: 'none' },
  danger: { bg: 'var(--action-danger-bg)', hover: 'var(--action-danger-bg-hover)', fg: '#fff', border: 'transparent', shadow: '0 2px 0 #7E1A14' },
};
const SCREEN: Partial<Record<Variant, Look>> = {
  primary: { bg: 'var(--brand-600)', hover: 'var(--brand-500)', fg: '#fff', border: 'var(--brand-500)', shadow: '0 3px 0 var(--brand-800)' },
  secondary: { bg: 'var(--screen-panel)', hover: 'var(--screen-panel-hover)', fg: 'var(--screen-text)', border: 'var(--screen-line-strong)', shadow: '0 3px 0 #05070A' },
  ghost: { bg: 'transparent', hover: 'var(--screen-panel-hover)', fg: 'var(--screen-text)', border: 'transparent', shadow: 'none' },
};
export function Button({ children, variant = 'primary', size = 'md', tone = 'light', icon, iconRight, shortcut, ariaLabel, loading = false, disabled = false, block = false, type = 'button', onClick, style }: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const scr = tone === 'screen';
  const s = SIZES[size];
  const v = (scr && SCREEN[variant]) || VARIANTS[variant];
  const off = disabled || loading;
  const iconOnly = !children && !!(icon || iconRight);
  let bg = hover ? v.hover : v.bg, fg = v.fg, border = v.border, opacity = 1;
  if (off) {
    if (scr) { bg = variant === 'ghost' ? 'transparent' : 'var(--screen-panel)'; fg = 'var(--screen-meta)'; border = variant === 'ghost' ? 'transparent' : 'var(--screen-line)'; }
    else { bg = variant === 'ghost' ? 'transparent' : 'var(--ink-100)'; border = variant !== 'ghost' ? 'var(--ink-200)' : v.border; if (variant === 'primary' || variant === 'danger') fg = 'var(--ink-500)'; opacity = loading ? 1 : 0.55; }
  }
  return (
    <button type={type} disabled={off} onClick={off ? undefined : onClick} aria-label={ariaLabel} title={ariaLabel}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setDown(false); }}
      onMouseDown={() => setDown(true)} onMouseUp={() => setDown(false)}
      style={{ display: block ? 'flex' : 'inline-flex', width: block ? '100%' : iconOnly ? s.h : undefined, alignItems: 'center', justifyContent: 'center', gap: s.gap, flex: 'none',
        height: s.h, padding: iconOnly ? 0 : '0 ' + s.px + 'px', fontFamily: 'var(--font-sans)', fontSize: s.fs, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
        color: fg, background: bg, border: (scr ? 2 : 1) + 'px solid ' + border, borderRadius: 'var(--radius-md)',
        boxShadow: off || down ? 'none' : v.shadow, transform: down && !off ? 'translateY(2px)' : 'none',
        cursor: off ? 'not-allowed' : 'pointer', opacity,
        transition: 'background var(--dur-fast) var(--ease-standard), transform 80ms', ...style }}>
      {loading ? <Icon name="loader-circle" size={s.ic} spin /> : icon ? <Icon name={icon} size={s.ic} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={s.ic} /> : null}
      {shortcut && <kbd style={{ font: '600 ' + Math.round(s.fs * 0.72) + 'px/1 var(--font-mono)', padding: '5px 8px', marginLeft: 4, borderRadius: 'var(--radius-xs)', border: '1px solid currentColor', opacity: off ? 0.6 : 0.8 }}>{shortcut}</kbd>}
    </button>
  );
}
