import { useLayoutEffect, useRef, useState } from 'react';
import type { TrainingEventRow, TrainingMemberRow } from '../../../../shared/api/index.js';
import { formatClock } from '../../../shared/format/date.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import type { PanelKind, PanelState, TimelineState, TrainingController } from '../application/training-controller.js';
import { formatDuration } from '../domain/duration.js';
import { memberCountsText, formatLastSeen } from '../domain/members.js';
import { isNearBottom } from '../domain/scroll.js';
import { shortenTarget } from '../domain/shorten.js';
import { buildTimeline, type TimelineItem, type TimelineTool } from '../domain/timeline.js';
import { ConnectionChip, StuckChip, visuallyHidden } from './chips.js';

const mono = 'var(--font-mono)';

function SessionDivider({ index, startedAt }: { index: number; startedAt: number }) {
  return (
    <div role="separator" aria-label={`Phiên Claude Code ${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      <span style={{ flex: 1, height: 1, background: 'var(--ink-300)' }} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--type-label)', color: 'var(--text-meta)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)' }}>
        <Icon name="play" size={12} />Phiên Claude Code {index} · mở lúc {formatClock(startedAt)}
      </span>
      <span style={{ flex: 1, height: 1, background: 'var(--ink-300)' }} />
    </div>
  );
}

function PromptBlock({ event, number }: { event: TrainingEventRow; number: number | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) auto', gap: 10, alignItems: 'start', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--brand-050)', border: '1px solid var(--brand-200)' }}>
      <Icon name="message-square" size={18} color="var(--brand-700)" style={{ marginTop: 2 }} />
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <span style={{ font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--brand-700)' }}>Prompt{number !== null ? ` ${number}` : ''}</span>
        <p style={{ margin: 0, font: '500 16px/1.5 var(--font-sans)', color: 'var(--text-title)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{event.prompt}</p>
      </div>
      <span style={{ font: `500 13px/1 ${mono}`, color: 'var(--text-meta)' }}>{formatClock(event.receivedAt)}</span>
    </div>
  );
}

function ToolRow({ tool, expanded, onToggle, panel, onOpen }: { tool: TimelineTool; expanded: boolean; onToggle: () => void; panel: PanelState | null; onOpen: (id: number, kind: PanelKind) => void }) {
  const { event: e, run } = tool;
  const failed = e.ok === false;
  const short = shortenTarget(e.toolTarget ?? '');
  const active = panel?.eventId === e.id;
  const open = (kind: PanelKind) => active && panel?.kind === kind;
  return (
    <li id={`ev-${e.id}`} style={{ display: 'grid', gridTemplateColumns: '18px minmax(52px, auto) minmax(0, 1fr) auto', columnGap: 10, rowGap: 6, alignItems: 'center', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: active ? 'var(--selected-bg)' : undefined, boxShadow: active ? 'inset 3px 0 0 var(--brand-600)' : undefined }}>
      <Icon name={failed ? 'circle-x' : 'circle-check'} size={18} color={failed ? 'var(--wrong-600)' : 'var(--correct-600)'} />
      <span style={visuallyHidden}>{failed ? 'Lỗi' : 'Thành công'}</span>
      <span style={{ font: `700 13px/1 ${mono}`, color: 'var(--text-title)' }}>{e.toolName}</span>
      {e.toolTarget === undefined ? <span /> : short.truncated ? (
        <button type="button" onClick={onToggle} aria-expanded={expanded} title="Bấm để xem đầy đủ" style={{ minWidth: 0, textAlign: 'left', padding: 0, border: 0, background: 'none', cursor: 'pointer', font: `500 13.5px/1.45 ${mono}`, color: 'var(--ink-900)', overflowWrap: 'anywhere', whiteSpace: expanded ? 'pre-wrap' : 'nowrap', overflow: expanded ? 'visible' : 'hidden', textOverflow: 'ellipsis' }}>{expanded ? e.toolTarget : short.text}</button>
      ) : <span style={{ minWidth: 0, font: `500 13.5px/1.45 ${mono}`, color: 'var(--ink-900)', overflowWrap: 'anywhere' }}>{short.text}</span>}
      <span style={{ font: `500 13px/1 ${mono}`, fontVariantNumeric: 'tabular-nums', color: 'var(--text-meta)', whiteSpace: 'nowrap' }}>{e.durationMs !== undefined ? formatDuration(e.durationMs) : ''}</span>

      {e.summary && (
        <div style={{ gridColumn: '2 / -1', font: `400 12.5px/1.55 ${mono}`, padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: failed ? 'var(--wrong-surface)' : 'var(--surface-sunken)', color: 'var(--ink-800)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.summary}</div>
      )}
      {run?.start && (
        <div style={{ gridColumn: '2 / -1' }}>
          <StuckChip label={run.active ? `Có thể đang kẹt · cùng lệnh lỗi ${run.length} lần liên tiếp` : `Cùng lệnh lỗi ${run.length} lần liên tiếp`} />
        </div>
      )}
      {(e.hasOutput || e.hasChange) && (
        <div style={{ gridColumn: '2 / -1', display: 'flex', gap: 4, marginLeft: -8 }}>
          {e.hasOutput && <PanelButton id={e.id} kind="output" label="Xem output" icon="code" on={open('output')} onOpen={onOpen} />}
          {e.hasChange && <PanelButton id={e.id} kind="change" label="Xem thay đổi" icon="file-text" on={open('change')} onOpen={onOpen} />}
        </div>
      )}
    </li>
  );
}

function PanelButton({ id, kind, label, icon, on, onOpen }: { id: number; kind: PanelKind; label: string; icon: string; on: boolean; onOpen: (id: number, kind: PanelKind) => void }) {
  return (
    <button type="button" data-trigger={`${id}-${kind}`} aria-pressed={on} onClick={() => onOpen(id, kind)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 8px', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', font: 'var(--type-label)', fontSize: 13, color: on ? 'var(--brand-700)' : 'var(--text-link)', background: on ? 'var(--brand-050)' : 'transparent', textDecoration: on ? 'none' : 'underline' }}>
      <Icon name={icon} size={14} />{label}{on && <Icon name="check" size={12} />}
    </button>
  );
}

/**
 * One member's timeline: oldest at the top, newest at the bottom like a log. Grouped by prompt; Claude Code sessions are
 * separated; a run of the same failing command carries the "có thể đang kẹt" chip. Output is never loaded until a button is pressed.
 */
export function Timeline({ member, timeline, panel, hidden, ctrl, canRemove, now, onOpen, onRemove }: {
  member: TrainingMemberRow; timeline: TimelineState; panel: PanelState | null; hidden: boolean; ctrl: TrainingController; canRemove: boolean; now: number;
  onOpen: (id: number, kind: PanelKind) => void; onRemove: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const items: TimelineItem[] = hidden ? [] : buildTimeline(timeline.events, { memberStuck: member.stuck });

  // Follow the end when the controller says so (first load, or new lines while the mentor is at the end).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [timeline.stickToken, timeline.phase, hidden]);

  // J / K moved the panel to another command: bring its row into view.
  const activeId = panel?.eventId;
  useLayoutEffect(() => {
    if (activeId !== undefined) document.getElementById(`ev-${activeId}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const toggle = (id: number) => setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section aria-label={`Dòng thời gian của ${member.displayName}`} style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, height: '100%', background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border-hairline)', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-title)', overflowWrap: 'anywhere' }}>{member.displayName}</h2>
            <ConnectionChip row={member} />
            {member.stuck && <StuckChip />}
          </div>
          <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>{memberCountsText(member)} · lần cuối thấy {formatLastSeen(member.lastSeenAt, now)}</span>
        </div>
        {canRemove && <div style={{ marginLeft: 'auto' }}><Button variant="ghost" size="sm" icon="user-x" onClick={onRemove}>Mời ra</Button></div>}
      </div>

      <div ref={scroller} onScroll={e => ctrl.reportScroll(isNearBottom(e.currentTarget))} tabIndex={0} aria-label="Các sự kiện, cũ ở trên, mới ở dưới"
        style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {hidden ? (
          <div style={{ margin: 'auto', display: 'grid', gap: 8, justifyItems: 'center', textAlign: 'center', color: 'var(--text-meta)', font: 'var(--type-body)', maxWidth: 340 }}>
            <Icon name="eye-off" size={28} />
            <strong style={{ color: 'var(--text-title)' }}>Nội dung đang ẩn</strong>
            <span>Prompt, lệnh và output không hiện trên màn hình. Nhấn <kbd style={{ font: `600 12px/1 ${mono}` }}>H</kbd> hoặc nút “Hiện nội dung” để xem lại.</span>
          </div>
        ) : timeline.phase === 'loading' ? (
          <div style={{ margin: 'auto' }}><Spinner label="Đang tải dòng thời gian…" /></div>
        ) : timeline.phase === 'error' ? (
          <div style={{ margin: 'auto', maxWidth: 420, width: '100%' }}><ErrorMessage title="Không tải được dòng thời gian" message={timeline.error} onRetry={() => ctrl.retryTimeline()} /></div>
        ) : items.length === 0 ? (
          <div style={{ margin: 'auto', display: 'grid', gap: 6, justifyItems: 'center', textAlign: 'center', color: 'var(--text-meta)', font: 'var(--type-body)', maxWidth: 360 }}>
            <Icon name="hourglass" size={26} />
            <strong style={{ color: 'var(--text-title)' }}>Chưa có sự kiện nào</strong>
            <span>{member.connection === 'waiting' ? `${member.displayName} chưa gửi tín hiệu. Prompt và lệnh sẽ hiện ở đây khi Claude Code của bạn ấy gửi về.` : 'Chưa có prompt hay lệnh nào được ghi lại.'}</span>
          </div>
        ) : (
          <>
            {items.map(item => item.kind === 'session' ? <SessionDivider key={item.key} index={item.index} startedAt={item.startedAt} /> : (
              <div key={item.key} style={{ display: 'grid', gap: 6 }}>
                {item.prompt && <PromptBlock event={item.prompt} number={item.promptNumber} />}
                {item.tools.length > 0 && (
                  <ol style={{ listStyle: 'none', margin: '0 0 0 14px', padding: '0 0 0 12px', borderLeft: '2px solid var(--ink-200)', display: 'grid', gap: 2 }}>
                    {item.tools.map(t => <ToolRow key={t.event.id} tool={t} expanded={expanded.has(t.event.id)} onToggle={() => toggle(t.event.id)} panel={panel} onOpen={onOpen} />)}
                  </ol>
                )}
              </div>
            ))}
            {timeline.hasMore && (
              <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
                {timeline.error && <ErrorMessage message={timeline.error} />}
                <Button variant="secondary" size="sm" icon="rotate-ccw" loading={timeline.loadingMore} onClick={() => void ctrl.loadMore()}>Tải thêm</Button>
              </div>
            )}
          </>
        )}
      </div>

      {timeline.newCount > 0 && !hidden && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <button type="button" onClick={() => ctrl.jumpToBottom()} style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: 0, cursor: 'pointer', background: 'var(--ink-900)', color: '#fff', font: 'var(--type-label)', fontSize: 13, boxShadow: 'var(--shadow-dialog)' }}>
            {timeline.newCount} sự kiện mới<Icon name="chevron-down" size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
