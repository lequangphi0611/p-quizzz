import { useId, useState } from 'react';

export function TextField({ label, value, onChange, onBlur, placeholder, hint, error, multiline = false, mono = false, rows = 6, spellCheck, size = 'md', autoFocus, maxLength, autoComplete, inputMode, disabled, type = 'text', autoCapitalize, autoCorrect }: {
  label?: string; value: string; onChange?: (v: string) => void; onBlur?: () => void; placeholder?: string; hint?: string; error?: string; multiline?: boolean; mono?: boolean; rows?: number; spellCheck?: boolean;
  /** 'screen' = dark projector theme, 26px text */
  size?: 'md' | 'lg' | 'screen'; autoFocus?: boolean; maxLength?: number; autoComplete?: string; inputMode?: 'numeric' | 'text' | 'email'; disabled?: boolean;
  /** `email` gives phones the right keyboard and lets the browser offer saved addresses. */
  type?: 'text' | 'email'; autoCapitalize?: 'off' | 'none' | 'sentences' | 'words'; autoCorrect?: 'on' | 'off';
}) {
  const [focus, setFocus] = useState(false);
  const scr = size === 'screen';
  const h = scr ? 64 : size === 'lg' ? 52 : 44;
  const fs = scr ? 26 : mono ? 14 : size === 'lg' ? 17 : 16;
  const border = error ? (scr ? 'var(--screen-wrong-border)' : 'var(--wrong-500)') : focus ? (scr ? 'var(--screen-focus)' : 'var(--border-focus)') : (scr ? 'var(--screen-line-strong)' : 'var(--border-strong)');
  const ring = scr ? '0 0 0 3px rgba(143,176,255,.32)' : '0 0 0 3px ' + (error ? 'var(--wrong-surface)' : 'var(--brand-100)');
  const style = {
    width: '100%', boxSizing: 'border-box', minHeight: multiline ? undefined : h, padding: multiline ? (scr ? '14px 18px' : '12px 14px') : (scr ? '0 18px' : '0 14px'),
    font: mono ? 'var(--type-code)' : 'var(--type-body)', fontSize: fs, lineHeight: scr ? 1.45 : undefined,
    color: scr ? 'var(--screen-text)' : 'var(--text-title)', background: scr ? (disabled ? 'transparent' : 'var(--screen-bg)') : (disabled ? 'var(--ink-050)' : 'var(--paper)'),
    border: (scr ? 2 : 1.5) + 'px ' + (scr && disabled ? 'dashed' : 'solid') + ' ' + border, borderRadius: 'var(--radius-md)', outline: 'none',
    boxShadow: focus ? ring : 'none', resize: 'vertical', transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
  } as const;
  const hintId = useId();
  const common = { value, placeholder, spellCheck, autoFocus, maxLength, autoComplete, inputMode, disabled, autoCapitalize, autoCorrect, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? hintId : undefined, onFocus: () => setFocus(true), onBlur: () => { setFocus(false); onBlur?.(); }, onChange: (e: { target: { value: string } }) => onChange?.(e.target.value), style };
  return (
    <label style={{ display: 'grid', gap: scr ? 10 : 6 }}>
      {label && <span style={{ font: 'var(--type-label)', fontSize: scr ? 22 : 13, color: scr ? 'var(--screen-meta)' : 'var(--text-title)' }}>{label}</span>}
      {multiline ? <textarea rows={rows} {...common} /> : <input type={type} {...common} />}
      {(error || hint) && <span id={hintId} role={error ? 'alert' : undefined} style={{ font: 'var(--type-meta)', fontSize: scr ? 22 : undefined, color: error ? (scr ? 'var(--screen-wrong)' : 'var(--wrong-600)') : (scr ? 'var(--screen-meta)' : 'var(--text-meta)') }}>{error || hint}</span>}
    </label>
  );
}
