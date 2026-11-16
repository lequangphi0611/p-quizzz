import { useState } from 'react';
import { formatPoints as formatScore } from '../../../shared/format/points.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';

const parse = (s: string): number | null => { const n = parseFloat(s.replace(',', '.')); return Number.isNaN(n) ? null : n; };

/**
 * Big "__ / 5" score input for grading on the projector: ± steppers (step 0,5), quick whole-number chips, inline
 * error, read-only after finalize. Key events are stopped inside the input so the page's shortcuts don't fire while
 * typing. `onCommit(value, enter)` fires on blur, Enter, a stepper or a chip — the parent saves.
 */
export function ScoreField({ value, max, step = 0.5, error, locked = false, label = 'Điểm', onChange, onCommit }: {
  value: string; max: number; step?: number; error?: string; locked?: boolean; label?: string; onChange: (v: string) => void; onCommit: (value: string, enter: boolean) => void;
}) {
  const [focus, setFocus] = useState(false);
  const n = parse(value);
  const set = (v: string) => { onChange(v); onCommit(v, false); };
  const bump = (d: number) => { const base = n ?? 0; set(formatScore(Math.min(max, Math.max(0, Math.round((base + d) / step) * step)))); };
  if (locked) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, font: '600 22px/1.2 var(--font-sans)', color: 'var(--screen-meta)' }}><Icon name="lock" size={22} />Đã chốt — chỉ xem</span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 14, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ font: '700 72px/1 var(--font-mono)', color: 'var(--screen-text)' }}>{value === '' ? '—' : value}</span>
          <span style={{ font: '600 40px/1 var(--font-mono)', color: 'var(--screen-meta)' }}>/ {formatScore(max)}</span>
        </span>
      </div>
    );
  }
  const border = error ? 'var(--screen-wrong-border)' : focus ? 'var(--screen-focus)' : 'var(--screen-line-strong)';
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <label htmlFor="pq-score" style={{ font: 'var(--type-label)', fontSize: 22, color: 'var(--screen-meta)' }}>{label} <span style={{ fontWeight: 400 }}>· bước {formatScore(step)}</span></label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Button tone="screen" variant="secondary" size="xxl" icon="minus" ariaLabel={'Giảm ' + formatScore(step)} onClick={() => bump(-step)} />
        <input id="pq-score" inputMode="decimal" autoComplete="off" value={value} placeholder="__" aria-invalid={!!error} aria-describedby={error ? 'pq-score-err' : undefined}
          onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); onCommit(value, false); }}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'ArrowUp') { e.preventDefault(); bump(step); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); bump(-step); }
            else if (e.key === 'Enter') { e.preventDefault(); onCommit(value, true); }
            else if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
          }}
          style={{ width: 168, height: 104, boxSizing: 'border-box', textAlign: 'center', font: '700 64px/1 var(--font-mono)', color: error ? 'var(--screen-wrong)' : 'var(--screen-text)', background: 'var(--screen-bg)', border: '3px solid ' + border, borderRadius: 'var(--radius-lg)', outline: 'none', boxShadow: focus ? '0 0 0 4px rgba(143,176,255,.32)' : 'none', transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)' }} />
        <span style={{ font: '600 44px/1 var(--font-mono)', color: 'var(--screen-meta)' }}>/ {formatScore(max)}</span>
        <Button tone="screen" variant="secondary" size="xxl" icon="plus" ariaLabel={'Tăng ' + formatScore(step)} onClick={() => bump(step)} />
      </div>
      <div role="group" aria-label="Điểm nhanh" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Array.from({ length: Math.floor(max) + 1 }, (_, i) => {
          const on = n === i && !error;
          return <button key={i} type="button" onClick={() => set(String(i))} aria-pressed={on} style={{ minWidth: 64, height: 56, borderRadius: 'var(--radius-md)', cursor: 'pointer', font: '700 26px/1 var(--font-mono)', background: on ? 'var(--sun-400)' : 'transparent', color: on ? 'var(--ink-900)' : 'var(--screen-text)', border: '2px solid ' + (on ? 'var(--sun-400)' : 'var(--screen-line-strong)'), transition: 'background var(--dur-fast)' }}>{i}</button>;
        })}
      </div>
      {error && <div id="pq-score-err"><ErrorMessage size="screen" message={error} /></div>}
    </div>
  );
}
