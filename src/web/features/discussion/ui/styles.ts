import type { CSSProperties } from 'react';

export const TYPE_LABEL = { single: 'Một đáp án', multi: 'Nhiều đáp án', essay: 'Tự luận' } as const;

export const st = {
  meta: { font: '600 22px/1.2 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--screen-meta)', display: 'flex', gap: 14, alignItems: 'center' },
  prompt: { margin: 0, font: '700 var(--fs-screen-question)/1.25 var(--font-sans)', color: 'var(--screen-text)', textWrap: 'pretty', letterSpacing: '-0.01em', overflowWrap: 'anywhere' },
  panel: { background: 'var(--screen-panel)', border: '2px solid var(--screen-line)', borderRadius: 'var(--radius-lg)', padding: '22px 26px' },
  hiddenPanel: { border: '2px dashed var(--screen-line-strong)', borderRadius: 'var(--radius-lg)', padding: '22px 26px', display: 'grid', gap: 18, alignContent: 'start' },
  panelLabel: { font: '700 22px/1.2 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--screen-meta)', display: 'flex', alignItems: 'center', gap: 10 },
  big: { font: '700 var(--fs-screen-stat)/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums' },
  body28: { font: '500 28px/1.35 var(--font-sans)', color: 'var(--screen-text)' },
  reveal: { animation: 'pq-reveal var(--dur-slow) var(--ease-standard)' },
  kbd: { display: 'inline-block', minWidth: 30, textAlign: 'center', font: '600 18px/1 var(--font-mono)', padding: '6px 8px', borderRadius: 'var(--radius-xs)', background: 'var(--screen-panel)', border: '1.5px solid var(--screen-line-strong)', borderBottomWidth: 3, color: '#fff' },
  mono: { fontFamily: 'var(--font-mono)' },
} satisfies Record<string, CSSProperties>;
