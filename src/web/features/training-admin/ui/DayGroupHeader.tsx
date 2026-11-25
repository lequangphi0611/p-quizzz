import { useState } from 'react';
import { Icon } from '../../../shared/ui/Icon.js';
import type { DayFlag } from '../domain/day-groups.js';
import { dayGroupSpoken } from '../domain/day-groups.js';
import { FlagChip, StuckChip } from './chips.js';
import { NewBadge } from './NewBadge.js';

export interface DayCounts { prompts: number; commands: number; failed: number }

/** `3 prompt · 4 lệnh · 1 lỗi`: tabular numbers; only the failure count is red, and the part is left out at 0. */
function Summary({ counts }: { counts: DayCounts }) {
  return (
    <span style={{ font: '400 13px/1.45 var(--font-sans)', color: 'var(--ink-600)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {counts.prompts} prompt · {counts.commands} lệnh{counts.failed > 0 && <> · <b style={{ fontWeight: 600, color: 'var(--wrong-600)' }}>{counts.failed}</b> lỗi</>}
    </span>
  );
}

const TodayBadge = () => <span style={{ font: '600 11px/1 var(--font-sans)', padding: '4px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--brand-100)', color: 'var(--brand-700)' }}>Hôm nay</span>;

/**
 * The header of a day on the timeline (S42). Not a card: bold text straight on the frame. As a button it folds or opens the day
 * and carries the chips of the day's flags when folded (each its own button next to this one, never inside it). `light` is the
 * plain label used when the timeline has a single day: no button, no chevron. `stuck` = pinned at the top of the frame, so it
 * gets the shadow and the line under it.
 */
export function DayGroupHeader({ id, bodyId, label, today, counts, expanded, onToggle, flags, onFlag, stuck = false, narrow = false, variant = 'default', newCount, pinnedBlock }: {
  id: string; bodyId: string; label: string; today: boolean; counts: DayCounts; expanded: boolean; onToggle: () => void;
  flags?: DayFlag[]; onFlag?: (flag: DayFlag) => void; stuck?: boolean; narrow?: boolean; variant?: 'default' | 'light';
  /** Prompts with something new inside a folded day (S43): "N mới" right after the summary, before the flag chips. */
  newCount?: number;
  /** The number of the session block whose own header has scrolled out of view under this pinned header: "· Phiên N" at the right of the label. */
  pinnedBlock?: number | null;
}) {
  const [hover, setHover] = useState(false);
  if (variant === 'light') {
    return (
      <div id={id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 10px', padding: '4px 0 10px', marginBottom: 12, borderBottom: '1px solid var(--ink-200)' }}>
        <span style={{ font: '600 13px/1.4 var(--font-sans)', color: 'var(--ink-800)' }}>{label}{today ? ' · Hôm nay' : ''}</span>
        <Summary counts={counts} />
        {newCount !== undefined && newCount > 0 && !expanded && <NewBadge count={newCount} />}
      </div>
    );
  }
  const chips = !expanded && flags && flags.length > 0 ? flags : null;
  return (
    <div id={`${id}-row`} data-sticky={expanded || undefined} data-anchor={!expanded || undefined} data-pinned={stuck || undefined}
      style={{ position: expanded ? 'sticky' : 'static', top: 0, zIndex: 2, margin: '0 -16px', padding: '0 16px', background: 'var(--surface-page)', borderBottom: `1px solid ${stuck ? 'var(--ink-200)' : 'transparent'}`, boxShadow: stuck ? '0 6px 8px -6px rgba(20,23,28,.20)' : 'none' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, minHeight: 44 }}>
        <button type="button" id={id} aria-expanded={expanded} aria-controls={bodyId} aria-label={dayGroupSpoken(label, today, counts, expanded ? 0 : newCount ?? 0)} onClick={onToggle}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: 0, border: 0, borderRadius: 10, textAlign: 'left', cursor: 'pointer', font: 'var(--type-body)', background: hover ? 'var(--ink-100)' : 'transparent', color: 'inherit' }}>
          <span style={{ width: 28, height: 28, flex: 'none', display: 'grid', placeItems: 'center', color: 'var(--ink-700)' }}>
            <span style={{ display: 'inline-flex', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur-fast) var(--ease-standard)' }}><Icon name="chevron-right" size={16} /></span>
          </span>
          <span aria-hidden="true" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 0, minWidth: 0, flexDirection: narrow ? 'column' : 'row' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: '700 15px/1.3 var(--font-sans)', color: 'var(--ink-900)', whiteSpace: 'nowrap' }}>{label}{today && <TodayBadge />}{stuck && pinnedBlock != null && <span data-pinned-block style={{ font: '400 13px/1.3 var(--font-sans)', color: 'var(--ink-600)' }}>· Phiên {pinnedBlock}</span>}</span>
            <Summary counts={counts} />
            {!expanded && newCount !== undefined && newCount > 0 && <NewBadge count={newCount} />}
          </span>
        </button>
        {chips && (
          <div role="group" aria-label={`Cờ của ${label}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...(narrow ? { flexBasis: '100%', padding: '0 0 8px 38px' } : {}) }}>
            {chips.map(f => f.stuck
              ? <StuckChip key="stuck" onClick={() => onFlag?.(f)} />
              : <FlagChip key={f.code} code={f.code} count={f.count} onClick={() => onFlag?.(f)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
