import type { FlagCode, TrainingStatus } from '../../../../shared/api/index.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { StatusBadge, type SessionStatus } from '../../../shared/ui/StatusBadge.js';
import { connectionLabel, type ConnectionLabel } from '../domain/connection-label.js';
import { FLAG_INFO } from '../domain/flags.js';
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

/**
 * "Đã dừng gửi": the member stopped sending themselves (PRODUCT.md §7.35j). Shown next to the name whenever it is true, even if the
 * connection chip says something else (still sending, removed), because the mentor has a pending decision about their data.
 */
export function StoppedSendingChip({ iconOnly = false }: { iconOnly?: boolean }) {
  const label = 'Đã dừng gửi';
  return (
    <span title={iconOnly ? label : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: iconOnly ? '3px 5px' : '2px 9px 2px 7px', borderRadius: 'var(--radius-pill)', background: 'var(--ink-100)', color: 'var(--ink-700)', border: '1px solid var(--ink-300)', font: 'var(--type-label)', fontSize: 12, whiteSpace: 'nowrap' }}>
      <Icon name="log-out" size={13} />
      {iconOnly ? <span style={visuallyHidden}>{label}</span> : label}
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

/**
 * A behaviour flag (PRODUCT.md §7.35c): the same pale yellow as "Có thể đang kẹt", never red, no verdict. With `onClick` it is a button that
 * jumps to the events behind it; `count` is how many events there are. The hint is the tooltip, so the mentor sees what it can and cannot tell.
 */
export function FlagChip({ code, count, onClick, iconOnly = false }: { code: FlagCode; count?: number; onClick?: () => void; iconOnly?: boolean }) {
  const info = FLAG_INFO[code];
  const style = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: iconOnly ? '3px 5px' : '2px 9px 2px 7px', borderRadius: 'var(--radius-pill)', background: 'var(--sun-100)', color: 'var(--sun-ink)', border: '1px solid var(--sun-200)', font: 'var(--type-label)', fontSize: 12, whiteSpace: 'nowrap' } as const;
  const body = (
    <>
      <Icon name={info.icon} size={13} />
      {iconOnly ? <span style={visuallyHidden}>{info.label}</span> : info.label}
      {count !== undefined && count > 1 && <span aria-hidden="true" style={{ fontVariantNumeric: 'tabular-nums' }}>· {count}</span>}
    </>
  );
  const title = `${info.label}. ${info.hint}${onClick ? ' Bấm để nhảy tới sự kiện căn cứ.' : ''}`;
  return onClick
    ? <button type="button" data-flag={code} title={title} onClick={onClick} style={{ ...style, cursor: 'pointer' }}>{body}</button>
    : <span data-flag={code} title={title} style={style}>{body}</span>;
}

const BADGE: Record<TrainingStatus, SessionStatus> = { open: 'running', stopped: 'closed', ended: 'finalized' };

/** Đang thu / Đã dừng thu / Đã kết thúc, with the design system's status badge. */
export function TrainingStatusBadge({ status, size = 'md' }: { status: TrainingStatus; size?: 'md' | 'lg' }) {
  return <StatusBadge status={BADGE[status]} label={trainingStatusLabel(status)} size={size} />;
}

export const visuallyHidden = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const;

/** The tool's name in a fixed-width cell; `PowerShell` shows as `PS` (hover and screen readers get the full name). */
export function ToolName({ name }: { name: { label: string; full: string } }) {
  return (
    <abbr title={name.full} style={{ font: `700 13px/1 var(--font-mono)`, color: 'var(--text-title)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name.label}</abbr>
  );
}
