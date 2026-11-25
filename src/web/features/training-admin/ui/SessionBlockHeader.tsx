import { useState } from 'react';
import { Icon } from '../../../shared/ui/Icon.js';
import { dayMonth } from '../domain/days.js';
import { NewBadge } from './NewBadge.js';

export type BlockEndLabel = 'clear' | 'exit' | 'open' | 'next';

export interface BlockCounts { prompts: number; commands: number; failed: number }

/** `09:55–10:24 · 2 prompt · 5 lệnh · 1 lỗi`: tabular numbers, only the failure count is red, and the part is left out at 0. */
function Summary({ range, counts }: { range: string; counts?: BlockCounts }) {
  return (
    <span style={{ font: '400 13px/1.45 var(--font-sans)', color: 'var(--ink-600)', fontVariantNumeric: 'tabular-nums' }}>
      {range}{counts && <> · {counts.prompts} prompt · {counts.commands} lệnh{counts.failed > 0 && <> · <b style={{ fontWeight: 600, color: 'var(--wrong-600)' }}>{counts.failed}</b> lỗi</>}</>}
    </span>
  );
}

const parallelStyle = { display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 8px', borderRadius: 8, border: '1px solid var(--ink-300)', background: 'transparent', color: 'var(--ink-800)', font: '500 12px/1 var(--font-sans)', cursor: 'pointer', whiteSpace: 'nowrap' } as const;

const pill = { display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 999, background: 'var(--ink-100)', color: 'var(--ink-700)', font: '500 12px/1 var(--font-sans)', whiteSpace: 'nowrap' } as const;

/** How the session ended: `/clear` like a command, "thoát" and the continuations as pills, "chưa kết thúc" dashed (no signal yet, not "running"). */
function EndLabel({ end, continuedFrom }: { end: BlockEndLabel; continuedFrom?: number }) {
  return (
    <>
      {continuedFrom !== undefined && <span data-block-label="from" style={pill}>tiếp từ {dayMonth(continuedFrom)}</span>}
      {end === 'clear' && <span data-block-label="clear" style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 6px', borderRadius: 4, background: 'var(--ink-100)', color: 'var(--ink-800)', font: '500 12px/1 var(--font-mono)' }}>/clear</span>}
      {end === 'exit' && <span data-block-label="exit" style={pill}>thoát</span>}
      {end === 'open' && <span data-block-label="open" style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 999, border: '1px dashed var(--ink-400)', color: 'var(--ink-700)', font: '500 12px/1 var(--font-sans)', whiteSpace: 'nowrap' }}>chưa kết thúc</span>}
    </>
  );
}

/**
 * The header of one Claude Code session inside a day (S43), in place of the old session marker: no fill, no border, on the rail of
 * the day. As a button (chevron + title + summary: `aria-expanded`, `aria-controls`) it folds or opens the block; the labels at its
 * right (new count, how it ended, "song song với phiên M") are outside the button. `light` = the day has only this session: a plain
 * line, no button. `end: 'next'` = the session also runs on the next day (the label says "tiếp sang dd/mm").
 */
export function SessionBlockHeader({ id, bodyId, index, range, counts, end, continuedFrom, continuesTo, parallelWith, newCount, expanded, onToggle, onParallel, variant = 'default' }: {
  id: string; bodyId: string; index: number; range: string; counts: BlockCounts; end: BlockEndLabel; continuedFrom?: number; continuesTo?: number;
  parallelWith?: number[]; newCount?: number; expanded: boolean; onToggle: () => void; onParallel?: (index: number) => void; variant?: 'default' | 'light';
}) {
  const [hover, setHover] = useState(false);
  const title = `Phiên Claude Code ${index}`;
  const dot = (
    <span aria-hidden="true" style={{ position: 'absolute', left: -28, top: 10, width: 12, height: 12, boxSizing: 'border-box', borderRadius: '50%', ...(expanded || variant === 'light' ? { background: 'var(--surface-page)', border: '2px solid var(--ink-500)' } : { background: 'var(--ink-300)' }) }} />
  );
  const labels = (
    <>
      {!expanded && newCount !== undefined && newCount > 0 && <NewBadge count={newCount} />}
      <EndLabel end={end} continuedFrom={continuedFrom} />
      {end === 'next' && continuesTo !== undefined && <span data-block-label="next" style={pill}>tiếp sang {dayMonth(continuesTo)}</span>}
      {variant !== 'light' && parallelWith && parallelWith.length === 1 && (
        <button type="button" data-parallel onClick={() => onParallel?.(parallelWith[0]!)} aria-label={`Song song với phiên ${parallelWith[0]}: mở khối`} style={parallelStyle}>
          Song song với phiên {parallelWith[0]}
        </button>
      )}
      {variant !== 'light' && parallelWith && parallelWith.length > 1 && (
        <span role="group" aria-label={`Song song với phiên ${parallelWith.join(', ')}`} style={{ ...parallelStyle, gap: 4, cursor: 'default' }}>
          Song song với phiên
          {parallelWith.map((m, i) => (
            <span key={m}>
              <button type="button" data-parallel onClick={() => onParallel?.(m)} aria-label={`Mở phiên ${m}`}
                style={{ padding: '0 2px', border: 0, background: 'transparent', color: 'var(--ink-900)', font: 'inherit', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>{m}</button>{i < parallelWith.length - 1 ? ',' : ''}
            </span>
          ))}
        </span>
      )}
    </>
  );
  const line = <span aria-hidden="true" style={{ flex: '1 1 24px', minWidth: 24, borderTop: '1px dashed var(--ink-300)' }} />;
  if (variant === 'light') {
    return (
      <div id={id} role="group" aria-label={title} style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4, minHeight: 32 }}>
        {dot}
        <span style={{ font: '600 13px/1.3 var(--font-sans)', color: 'var(--ink-900)', whiteSpace: 'nowrap' }}>{title}</span>
        <Summary range={range} />
        {labels}
        {line}
      </div>
    );
  }
  return (
    <div id={`${id}-row`} data-anchor={!expanded || undefined} style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4, minHeight: 32 }}>
      {dot}
      <button type="button" id={id} aria-expanded={expanded} aria-controls={bodyId} onClick={onToggle}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, minHeight: 32, padding: '0 6px', margin: '0 0 0 -6px', border: 0, borderRadius: 8, textAlign: 'left', cursor: 'pointer', background: hover ? 'var(--ink-100)' : 'transparent', color: 'inherit', font: 'inherit' }}>
        <span style={{ display: 'inline-flex', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur-fast) var(--ease-standard)', color: 'var(--ink-600)' }}><Icon name="chevron-right" size={14} /></span>
        <span style={{ font: '600 13px/1.3 var(--font-sans)', color: 'var(--ink-900)', whiteSpace: 'nowrap' }}>{title}</span>
        <Summary range={range} counts={counts} />
      </button>
      {labels}
      {line}
    </div>
  );
}
