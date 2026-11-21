import type { TrainingStatus } from '../../../../shared/api/index.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { StatusBadge, type SessionStatus } from '../../../shared/ui/StatusBadge.js';
import { connectionLabel, type ConnectionLabel } from '../domain/connection-label.js';
import { trainingStatusLabel } from '../domain/training-ui.js';

const TONES: Record<ConnectionLabel['tone'], { bg: string; fg: string; bd: string }> = {
  neutral: { bg: 'var(--paper)', fg: 'var(--ink-700)', bd: 'var(--ink-400)' },
  ok: { bg: 'var(--correct-surface)', fg: 'var(--correct-600)', bd: 'var(--correct-border)' },
  muted: { bg: 'var(--ink-100)', fg: 'var(--ink-700)', bd: 'var(--ink-300)' },
  warn: { bg: 'var(--warn-surface)', fg: 'var(--warn-600)', bd: 'var(--warn-border)' },
};

/** A member's connection: icon + words + border style, so the four states do not rest on colour. */
export function ConnectionChip({ row, iconOnly = false }: { row: Parameters<typeof connectionLabel>[0]; iconOnly?: boolean }) {
  const l = connectionLabel(row);
  const t = TONES[l.tone];
  return (
    <span title={iconOnly ? l.text : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: iconOnly ? '3px 5px' : '2px 9px 2px 7px', borderRadius: 'var(--radius-pill)', background: t.bg, color: t.fg, border: `1.5px ${l.border} ${t.bd}`, font: 'var(--type-label)', fontSize: 12, whiteSpace: 'nowrap' }}>
      <Icon name={l.icon} size={13} />
      {iconOnly ? <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{l.text}</span> : l.text}
    </span>
  );
}

/** "Có thể đang kẹt": a hint to the mentor, pale yellow with a flag, never red and never a verdict. */
export function StuckChip({ label = 'Có thể đang kẹt', iconOnly = false }: { label?: string; iconOnly?: boolean }) {
  return (
    <span title={iconOnly ? label : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: iconOnly ? '3px 5px' : '2px 9px 2px 7px', borderRadius: 'var(--radius-pill)', background: 'var(--sun-100)', color: 'var(--sun-ink)', border: '1px solid var(--sun-200)', font: 'var(--type-label)', fontSize: 12, whiteSpace: 'nowrap' }}>
      <Icon name="flag" size={13} />
      {iconOnly ? <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{label}</span> : label}
    </span>
  );
}

const BADGE: Record<TrainingStatus, SessionStatus> = { open: 'running', stopped: 'closed', ended: 'finalized' };

/** Đang thu / Đã dừng thu / Đã kết thúc, with the design system's status badge. */
export function TrainingStatusBadge({ status, size = 'md' }: { status: TrainingStatus; size?: 'md' | 'lg' }) {
  return <StatusBadge status={BADGE[status]} label={trainingStatusLabel(status)} size={size} />;
}

export const visuallyHidden = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const;
