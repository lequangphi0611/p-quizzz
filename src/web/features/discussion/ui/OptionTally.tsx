import { useEffect, useState } from 'react';
import { Markdown } from '../../../shared/ui/Markdown.js';
import { Icon } from '../../../shared/ui/Icon.js';

const pill = { display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 'var(--radius-pill)', font: '700 22px/1 var(--font-sans)', whiteSpace: 'nowrap', animation: 'pq-reveal var(--dur-slow) var(--ease-standard)' } as const;

/**
 * One answer option with the class's pick tally (projector "Thảo luận"). Neutral bar until `revealed`; then the
 * correct option turns green + "Đáp án đúng" (icon + text, never colour alone). Wrong options stay neutral — never
 * painted red for the class; the most-picked wrong one may carry flag="common" → "Nhầm phổ biến".
 */
export function OptionTally({ kind = 'single', letter, text, count, total, revealed = false, correct = false, flag }: {
  kind?: 'single' | 'multi'; letter: string; text: string; count: number; total: number; revealed?: boolean; correct?: boolean; flag?: 'common';
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setGrown(true)); });
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, []);
  const win = revealed && correct;
  const common = revealed && !correct && flag === 'common';
  const ease = 'var(--dur-slow) var(--ease-standard)';
  return (
    <div role="listitem" aria-label={`Phương án ${letter}: ${count} người, ${pct}%${win ? ', đáp án đúng' : ''}`}
      style={{ display: 'grid', gridTemplateColumns: '56px minmax(0,1fr) 150px', columnGap: 20, alignItems: 'center', padding: '16px 22px', borderRadius: 'var(--radius-lg)',
        background: win ? 'var(--screen-correct-surface)' : 'var(--screen-panel)', border: '2px solid ' + (win ? 'var(--screen-correct-border)' : 'var(--screen-line)'), transition: `background ${ease}, border-color ${ease}` }}>
      <span aria-hidden="true" style={{ width: 56, height: 56, display: 'grid', placeItems: 'center', borderRadius: kind === 'multi' ? 'var(--radius-md)' : '50%', background: win ? 'var(--screen-correct)' : 'var(--screen-panel-hover)', border: '2px solid ' + (win ? 'var(--screen-correct)' : 'var(--screen-line-strong)'), color: win ? 'var(--ink-900)' : 'var(--screen-text)', font: '700 26px/1 var(--font-mono)', transition: `background ${ease}, color ${ease}` }}>{letter}</span>
      <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ font: '500 var(--fs-screen-option)/1.3 var(--font-sans)', color: 'var(--screen-text)', minWidth: 0, overflowWrap: 'anywhere' }}><Markdown inlineOnly size="screen" source={text} /></span>
          {win && <span style={{ ...pill, padding: '6px 14px', background: 'var(--screen-correct)', color: 'var(--ink-900)' }}><Icon name="circle-check" size={22} />Đáp án đúng</span>}
          {common && <span style={{ ...pill, padding: '4px 12px', border: '2px solid var(--sun-400)', color: 'var(--sun-400)' }}><Icon name="flag" size={20} />Nhầm phổ biến</span>}
        </div>
        <div style={{ height: 18, borderRadius: 'var(--radius-pill)', background: 'var(--screen-bar-track)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: (grown ? pct : 0) + '%', minWidth: count > 0 && grown ? 8 : 0, borderRadius: 'inherit', background: win ? 'var(--screen-correct)' : 'var(--screen-bar)', transition: `width var(--dur-pop) var(--ease-standard), background ${ease}` }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', display: 'grid', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ font: '700 44px/1 var(--font-mono)', color: win ? 'var(--screen-correct)' : 'var(--screen-text)', transition: `color ${ease}` }}>{pct}%</span>
        <span style={{ font: '500 24px/1.2 var(--font-sans)', color: 'var(--screen-meta)' }}><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--screen-text)' }}>{count}</span> người</span>
      </div>
    </div>
  );
}
