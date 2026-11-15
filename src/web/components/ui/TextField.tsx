import { useState } from 'react';

export function TextField({ label, value, onChange, placeholder, hint, error, multiline = false, mono = false, rows = 6, spellCheck, size = 'md', autoFocus, maxLength, autoComplete }: {
  label?: string; value: string; onChange?: (v: string) => void; placeholder?: string; hint?: string; error?: string; multiline?: boolean; mono?: boolean; rows?: number; spellCheck?: boolean;
  size?: 'md' | 'lg'; autoFocus?: boolean; maxLength?: number; autoComplete?: string;
}) {
  const [focus, setFocus] = useState(false);
  const style = {
    width: '100%', boxSizing: 'border-box', minHeight: multiline ? undefined : size === 'lg' ? 52 : 44, padding: multiline ? '12px 14px' : '0 14px',
    font: mono ? 'var(--type-code)' : 'var(--type-body)', fontSize: mono ? 14 : size === 'lg' ? 17 : 16, color: 'var(--text-title)', background: 'var(--paper)',
    border: '1.5px solid ' + (error ? 'var(--wrong-500)' : focus ? 'var(--border-focus)' : 'var(--border-strong)'), borderRadius: 'var(--radius-md)', outline: 'none',
    boxShadow: focus ? '0 0 0 3px ' + (error ? 'var(--wrong-surface)' : 'var(--brand-100)') : 'none', resize: 'vertical',
    transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
  } as const;
  const common = { value, placeholder, spellCheck, autoFocus, maxLength, autoComplete, onFocus: () => setFocus(true), onBlur: () => setFocus(false), onChange: (e: { target: { value: string } }) => onChange?.(e.target.value), style };
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      {label && <span style={{ font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' }}>{label}</span>}
      {multiline ? <textarea rows={rows} {...common} /> : <input type="text" {...common} />}
      {(error || hint) && <span style={{ font: 'var(--type-meta)', color: error ? 'var(--wrong-600)' : 'var(--text-meta)' }}>{error || hint}</span>}
    </label>
  );
}
