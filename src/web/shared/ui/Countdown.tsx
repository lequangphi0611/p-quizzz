import { useEffect, useRef, useState } from 'react';
import { countdownLevel, formatCountdown, reminderText, type CountdownLevel } from '../format/countdown.js';
import { Icon } from './Icon.js';

const TONE: Record<CountdownLevel, { bg: string; ink: string; border: string }> = {
  normal: { bg: 'var(--surface-sunken)', ink: 'var(--text-title)', border: 'var(--border-hairline)' },
  soon: { bg: 'var(--warn-surface)', ink: 'var(--warn-600)', border: 'var(--warn-border)' },
  last: { bg: 'var(--wrong-surface)', ink: 'var(--wrong-600)', border: 'var(--wrong-border)' },
  up: { bg: 'var(--wrong-surface)', ink: 'var(--wrong-600)', border: 'var(--wrong-border)' },
};
const SIZE = { sm: { font: 15, icon: 15, pad: '4px 10px' }, md: { font: 18, icon: 18, pad: '6px 12px' }, screen: { font: 44, icon: 36, pad: '10px 24px' } };

/**
 * The session clock (PRODUCT.md §7.27): one pill with the time left; turns amber at 5 minutes and red in the last one.
 * Screen readers hear the 5-minute, 1-minute and time-up reminders once each, not every second.
 */
export function Countdown({ ms, size = 'md', label = 'Thời gian còn lại', announce = true }: { ms: number; size?: keyof typeof SIZE; label?: string; announce?: boolean }) {
  const level = countdownLevel(ms);
  const tone = TONE[level];
  const sz = SIZE[size];
  const [said, setSaid] = useState('');
  const lastLevel = useRef<CountdownLevel>(level);
  useEffect(() => {
    if (level !== lastLevel.current) { lastLevel.current = level; const text = reminderText(level); if (announce && text) setSaid(text); }
  }, [level, announce]);
  return (
    <span role="timer" aria-label={`${label}: ${formatCountdown(ms)}`} title={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: sz.pad, borderRadius: 'var(--radius-pill)', background: tone.bg, color: tone.ink, border: `1px solid ${tone.border}`, font: `700 ${sz.font}px/1 var(--font-mono)`, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flex: 'none' }}>
      <Icon name="hourglass" size={sz.icon} />
      {formatCountdown(ms)}
      <span aria-live="assertive" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{said}</span>
    </span>
  );
}
