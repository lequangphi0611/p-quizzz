import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { TrainingEventRow, TrainingMemberRow } from '../../../../shared/api/index.js';
import { formatClock } from '../../../shared/format/date.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import type { PanelKind, PanelState, TimelineState, TrainingController } from '../application/training-controller.js';
import { formatDuration } from '../domain/duration.js';
import { memberCountsText, memberExtraCountsText, formatLastSeen } from '../domain/members.js';
import { evidenceOf, visibleFlags } from '../domain/flags.js';
import { decisionText, isAutoMode, modeLabel, noteLines, noticeTitle, sessionTitle } from '../domain/row-text.js';
import { isLatestInView } from '../domain/scroll.js';
import { toolLabel } from '../domain/tool-label.js';
import { dayLabel } from '../domain/days.js';
import { dayGroupSummary, groupByDay, type DayGroup } from '../domain/day-groups.js';
import { buildTimeline } from '../domain/timeline.js';
import { ConnectionChip, FlagChip, StuckChip, ToolName, visuallyHidden } from './chips.js';
import { MarkButton } from './TimelineRows.js';
import { NoteBox } from './NoteBox.js';

const mono = 'var(--font-mono)';

/** A zero-height marker right after the newest day: where the newest event ends. */
const LATEST_ID = 'timeline-latest';

const bodyId = (dayKey: string) => `day-body-${dayKey}`;

/**
 * The header of a day group: a button that folds or opens it. It shows the full date, so a prompt of another day is never taken
 * for today's, and the counts of the day, so a folded day still says what happened.
 */
function DayHeader({ group, open, onToggle }: { group: DayGroup; open: boolean; onToggle: () => void }) {
  const text = dayGroupSummary(dayLabel(group.startedAt), group);
  return (
    <button type="button" id={`day-${group.dayKey}`} aria-expanded={open} aria-controls={bodyId(group.dayKey)} onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', textAlign: 'left', cursor: 'pointer', borderRadius: 'var(--radius-md)', background: 'var(--brand-050)', border: '1px solid var(--brand-200)', font: 'var(--type-label)', fontSize: 13.5, color: 'var(--brand-700)' }}>
      <Icon name={open ? 'chevron-down' : 'chevron-right'} size={15} />
      <Icon name="calendar" size={14} />
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{text}</span>
    </button>
  );
}

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

interface Detail { commands: number; failed: number; onOpen: () => void }

/**
 * One prompt of the list: what the member asked (two lines, the whole text on hover and in the popup), a mode chip when it is not
 * the default, and "Xem chi tiết" for the commands that ran under it. The list is the overview; the commands live in the popup.
 */
function PromptBlock({ event, number, focused, onMark, detail }: { event: TrainingEventRow | null; number: number | null; focused: boolean; onMark: (id: number) => void; detail: Detail | null }) {
  const mode = modeLabel(event?.permissionMode);
  const box = { borderRadius: 'var(--radius-md)', background: focused ? 'var(--sun-100)' : event ? 'var(--brand-050)' : 'var(--surface-sunken)', border: `1px solid ${focused ? 'var(--sun-200)' : event ? 'var(--brand-200)' : 'var(--ink-300)'}` } as const;
  const modeChip = mode && (
    <span title="Chế độ quyền của Claude Code lúc bạn ấy gõ prompt" style={{ padding: '0 7px', borderRadius: 'var(--radius-pill)', font: 'var(--type-label)', fontSize: 11.5, whiteSpace: 'nowrap', background: isAutoMode(event?.permissionMode) ? 'var(--sun-100)' : 'var(--paper)', color: isAutoMode(event?.permissionMode) ? 'var(--sun-ink)' : 'var(--ink-700)', border: `1px solid ${isAutoMode(event?.permissionMode) ? 'var(--sun-200)' : 'var(--ink-300)'}` }}>{mode}</span>
  );
  const label = <span style={{ font: 'var(--type-label)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: event ? 'var(--brand-700)' : 'var(--text-meta)', whiteSpace: 'nowrap' }}>{event ? `Prompt${number !== null ? ` ${number}` : ''}` : 'Trước prompt đầu tiên'}</span>;
  return (
    <div id={event ? `ev-${event.id}` : undefined} style={{ ...box, display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr) auto', gap: 10, alignItems: 'start', padding: '8px 6px 8px 12px' }}>
      <Icon name={event ? 'message-square' : 'terminal'} size={16} color={event ? 'var(--brand-700)' : 'var(--ink-600)'} style={{ marginTop: 3 }} />
      <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {label}{modeChip}
          {detail && <span style={{ font: 'var(--type-meta)', fontSize: 12.5, color: 'var(--text-meta)' }}>{detail.commands} lệnh{detail.failed > 0 ? ` · ${detail.failed} lỗi` : ''}</span>}
        </span>
        {event && <p title={event.prompt} style={{ margin: 0, font: '500 15px/1.45 var(--font-sans)', color: 'var(--text-title)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.prompt}</p>}
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none' }}>
        {event && <span style={{ font: `500 12.5px/1 ${mono}`, color: 'var(--text-meta)', marginRight: 2 }}>{formatClock(event.receivedAt)}</span>}
        {detail && <Button variant="secondary" size="sm" icon="panel-right-open" onClick={detail.onOpen}>Xem chi tiết</Button>}
        {event && <MarkButton id={event.id} marked={event.marked} onToggle={onMark} />}
      </span>
    </div>
  );
}

/**
 * One member's timeline: day groups, the newest day first and folded away when old; inside a day oldest to newest. Grouped by prompt; Claude Code sessions are
 * separated; a run of the same failing command carries the "có thể đang kẹt" chip. Output is never loaded until a button is pressed.
 */
export function Timeline({ member, timeline, panel, hidden, markError, ctrl, canRemove, now, onRemove }: {
  member: TrainingMemberRow; timeline: TimelineState; panel: PanelState | null; hidden: boolean; markError: string; ctrl: TrainingController; canRemove: boolean; now: number;
  onRemove: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const onMark = (id: number) => void ctrl.toggleMark(id);
  const groups: DayGroup[] = hidden ? [] : groupByDay(buildTimeline(timeline.events, { memberStuck: member.stuck }));
  const allOpen = groups.length > 0 && groups.every(g => timeline.openDays.includes(g.dayKey));
  const flags = timeline.flags.filter(f => visibleFlags({ flags: [f.code], stuck: member.stuck }).length > 0).map(f => ({ code: f.code, ids: evidenceOf(f, timeline.events) })).filter(f => f.ids.length > 0);

  // Bring the newest event into view when the controller says so (first load, or new lines while it is being followed). The
  // newest event ends the newest day, which is the first group, so the marker sits right after that group.
  useLayoutEffect(() => {
    const el = scroller.current;
    const latest = document.getElementById(LATEST_ID);
    if (!el || !latest) return;
    el.scrollTop += latest.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
  }, [timeline.followToken, timeline.phase, hidden]);

  // "Đang theo dõi": after a scroll, or when a day opens or folds, is the newest event in (or near) the viewport?
  const reportFollowing = () => {
    const el = scroller.current;
    const latest = document.getElementById(LATEST_ID);
    if (el && latest) ctrl.reportFollowing(isLatestInView(latest.getBoundingClientRect(), el.getBoundingClientRect()));
  };
  useLayoutEffect(reportFollowing, [timeline.openDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // A flag chip jumped to an event: scroll to its row (the row is drawn highlighted while `focusId` stays).
  useLayoutEffect(() => {
    if (timeline.focusId !== null) document.getElementById(`ev-${timeline.focusId}`)?.scrollIntoView({ block: 'center' });
  }, [timeline.focusToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // J / K moved the panel to another command: bring its row into view.
  const activeId = panel?.eventId;
  useLayoutEffect(() => {
    if (activeId !== undefined) document.getElementById(`ev-${activeId}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);


  return (
    <section aria-label={`Dòng thời gian của ${member.displayName}`} style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, height: '100%', background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gap: 4, padding: '10px 14px 8px', borderBottom: '1px solid var(--border-hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, font: '700 18px/1.3 var(--font-sans)', color: 'var(--text-title)', overflowWrap: 'anywhere' }}>{member.displayName}</h2>
          <ConnectionChip row={member} />
          {member.stuck && <StuckChip />}
          {canRemove && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
              {!hidden && <Button variant="ghost" size="sm" icon="pencil" pressed={noteOpen} onClick={() => setNoteOpen(o => !o)}>{member.mentorNote ? 'Ghi chú ✓' : 'Ghi chú'}</Button>}
              <Button variant="ghost" size="sm" icon="user-x" onClick={onRemove}>Mời ra</Button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px 10px', flexWrap: 'wrap', font: 'var(--type-meta)', fontSize: 13, color: 'var(--text-meta)' }}>
          <span>{[memberCountsText(member), memberExtraCountsText(member)].filter(Boolean).join(' · ')} · lần cuối thấy {formatLastSeen(member.lastSeenAt, now)}</span>
          {!hidden && flags.length > 0 && (
            <span aria-label="Cờ gợi ý" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {flags.map(({ code, ids }) => <FlagChip key={code} code={code} count={ids.length} onClick={() => ctrl.jumpToFlag(code)} />)}
              <span style={{ fontSize: 12, color: 'var(--text-meta)' }}>Gợi ý để bạn xem, không phải đánh giá.</span>
            </span>
          )}
        </div>
      </div>
      {groups.length >= 2 && timeline.phase === 'ready' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 12px', borderBottom: '1px solid var(--border-hairline)' }}>
          <Button variant="ghost" size="sm" icon={allOpen ? 'minus' : 'chevron-down'} onClick={() => ctrl.setAllDays(!allOpen)}>{allOpen ? 'Thu tất cả' : 'Mở tất cả'}</Button>
        </div>
      )}
      {!hidden && noteOpen && canRemove && <NoteBox key={member.id} member={member} onSave={note => ctrl.saveNote(member.id, note)} />}
      {markError && !hidden && <div role="alert" style={{ padding: '8px 16px', background: 'var(--wrong-surface)', color: 'var(--wrong-600)', font: 'var(--type-meta)', fontWeight: 600 }}>{markError}</div>}

      <div ref={scroller} onScroll={reportFollowing} tabIndex={0} aria-label="Các sự kiện, ngày mới nhất ở trên"
        style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        ) : groups.length === 0 ? (
          <div style={{ margin: 'auto', display: 'grid', gap: 6, justifyItems: 'center', textAlign: 'center', color: 'var(--text-meta)', font: 'var(--type-body)', maxWidth: 360 }}>
            <Icon name="hourglass" size={26} />
            <strong style={{ color: 'var(--text-title)' }}>Chưa có sự kiện nào</strong>
            <span>{member.connection === 'waiting' ? `${member.displayName} chưa gửi tín hiệu. Prompt và lệnh sẽ hiện ở đây khi Claude Code của bạn ấy gửi về.` : 'Chưa có prompt hay lệnh nào được ghi lại.'}</span>
          </div>
        ) : (
          <>
            {timeline.hasMore && (
              <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
                <span style={{ font: 'var(--type-meta)', fontSize: 13, color: 'var(--text-meta)' }}>Còn sự kiện mới hơn chưa tải</span>
                {timeline.error && <ErrorMessage message={timeline.error} />}
                <Button variant="secondary" size="sm" icon="rotate-ccw" loading={timeline.loadingMore} onClick={() => void ctrl.loadMore()}>Tải thêm</Button>
              </div>
            )}
            {groups.map((g, at) => {
              const open = timeline.openDays.includes(g.dayKey);
              return (
                <Fragment key={g.dayKey}>
                  <DayHeader group={g} open={open} onToggle={() => ctrl.toggleDay(g.dayKey)} />
                  <div id={bodyId(g.dayKey)} hidden={!open} style={open ? { display: 'flex', flexDirection: 'column', gap: 10 } : undefined}>
                    {open && g.items.map(item => {
                      if (item.kind === 'session') return <SessionDivider key={item.key} index={item.index} startedAt={item.startedAt} />;
                      const shown = item.tools.filter(t => t.event.kind === 'tool');
                      const detail: Detail | null = item.tools.length > 0 ? { commands: shown.length, failed: shown.filter(t => t.event.ok === false).length, onOpen: () => ctrl.openTurn(item.key) } : null;
                      return <PromptBlock key={item.key} event={item.prompt} number={item.promptNumber} focused={item.prompt !== null && timeline.focusId === item.prompt.id} onMark={onMark} detail={detail} />;
                    })}
                  </div>
                  {at === 0 && <div id={LATEST_ID} aria-hidden style={{ height: 0, flex: 'none' }} />}
                </Fragment>
              );
            })}
          </>
        )}
      </div>

      {timeline.newCount > 0 && !hidden && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <button type="button" onClick={() => ctrl.jumpToLatest()} style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: 0, cursor: 'pointer', background: 'var(--ink-900)', color: '#fff', font: 'var(--type-label)', fontSize: 13, boxShadow: 'var(--shadow-dialog)' }}>
            {timeline.newCount} sự kiện mới<Icon name="chevron-down" size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
