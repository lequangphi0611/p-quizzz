import { useLayoutEffect, useRef, useState } from 'react';
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
import { isLatestInView, keepAnchorScrollTop, latestSide, type LatestSide } from '../domain/scroll.js';
import { toolLabel } from '../domain/tool-label.js';
import { dayLabel, isToday } from '../domain/days.js';
import { dayFlags, groupByDay, type DayGroup } from '../domain/day-groups.js';
import { buildTimeline } from '../domain/timeline.js';
import { ConnectionChip, FlagChip, StuckChip } from './chips.js';
import { DayGroupHeader } from './DayGroupHeader.js';
import { SessionMarker } from './SessionMarker.js';
import { MarkButton } from './TimelineRows.js';
import { NoteBox } from './NoteBox.js';

const mono = 'var(--font-mono)';

/** A zero-height marker right after the newest day: where the newest event ends. */
const LATEST_ID = 'timeline-latest';

const bodyId = (dayKey: string) => `day-body-${dayKey}`;

interface Detail { commands: number; failed: number; onOpen: () => void }

/**
 * One prompt of the list, a white card on the frame: what the member asked (two lines, the whole text on hover and in the popup), a
 * mode chip when it is not the default, and "Xem chi tiết" for the commands that ran under it. The list is the overview; the
 * commands live in the popup. `flash` draws the card like a focus ring that fades (the "N sự kiện mới" chip arrived here).
 */
function PromptBlock({ event, number, focused, flash, onMark, detail }: { event: TrainingEventRow | null; number: number | null; focused: boolean; flash: boolean; onMark: (id: number) => void; detail: Detail | null }) {
  const mode = modeLabel(event?.permissionMode);
  const box = { borderRadius: 10, background: focused ? 'var(--sun-100)' : event ? 'var(--paper)' : 'var(--surface-sunken)', border: `1px solid ${focused ? 'var(--sun-200)' : 'var(--ink-200)'}`, boxShadow: event ? 'var(--shadow-card)' : 'none' } as const;
  const modeChip = mode && (
    <span title="Chế độ quyền của Claude Code lúc bạn ấy gõ prompt" style={{ padding: '0 7px', borderRadius: 'var(--radius-pill)', font: 'var(--type-label)', fontSize: 11.5, whiteSpace: 'nowrap', background: isAutoMode(event?.permissionMode) ? 'var(--sun-100)' : 'var(--ink-100)', color: isAutoMode(event?.permissionMode) ? 'var(--sun-ink)' : 'var(--ink-700)', border: `1px solid ${isAutoMode(event?.permissionMode) ? 'var(--sun-200)' : 'var(--ink-300)'}` }}>{mode}</span>
  );
  return (
    <div id={event ? `ev-${event.id}` : undefined} data-anchor className={flash ? 'pq-flash' : undefined}
      style={{ ...box, padding: '6px 6px 10px 14px', scrollMarginTop: 56, scrollMarginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, minHeight: 32 }}>
        <span style={{ font: '600 12px/1.3 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--ink-700)', whiteSpace: 'nowrap' }}>{event ? `Prompt${number !== null ? ` ${number}` : ''}` : 'Trước prompt đầu tiên'}</span>
        {modeChip}
        {detail && <span style={{ font: '400 13px/1.45 var(--font-sans)', color: 'var(--ink-600)', fontVariantNumeric: 'tabular-nums' }}>{detail.commands} lệnh{detail.failed > 0 && <> · <b style={{ fontWeight: 600, color: 'var(--wrong-600)' }}>{detail.failed}</b> lỗi</>}</span>}
        <span style={{ flex: '1 1 0' }} />
        {event && <span style={{ font: `500 13px/1 ${mono}`, color: 'var(--ink-600)' }}>{formatClock(event.receivedAt)}</span>}
        {detail && <Button variant="ghost" size="sm" icon="panel-right-open" onClick={detail.onOpen}>Xem chi tiết</Button>}
        {event && <MarkButton id={event.id} marked={event.marked} onToggle={onMark} />}
      </div>
      {event && <p title={event.prompt} style={{ margin: 0, paddingRight: 8, font: '400 14px/1.5 var(--font-sans)', color: 'var(--ink-900)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.prompt}</p>}
    </div>
  );
}

/** Below this width of the timeline frame the day header wraps (summary under the label, chips on a third line). */
const NARROW_PX = 560;
/** How long the card the "N sự kiện mới" chip jumped to stays drawn as focused, before it is cleared. */
const FLASH_MS = 1700;

/**
 * One member's timeline: day groups, the newest day first (folded away when old, its header pinned to the top while it is read);
 * inside a day oldest to newest. Grouped by prompt; Claude Code sessions are marked; a run of the same failing command carries the
 * "có thể đang kẹt" chip. Output is never loaded until a button is pressed. Whatever the mentor is reading stays where it is when
 * events arrive, a day opens or folds, or "Tải thêm" adds rows, unless the newest event is in view (then the view follows it).
 */
export function Timeline({ member, timeline, panel, hidden, markError, ctrl, canRemove, now, onRemove }: {
  member: TrainingMemberRow; timeline: TimelineState; panel: PanelState | null; hidden: boolean; markError: string; ctrl: TrainingController; canRemove: boolean; now: number;
  onRemove: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [stuckDay, setStuckDay] = useState<string | null>(null);
  const [side, setSide] = useState<LatestSide>('in');
  const [flashId, setFlashId] = useState<number | null>(null);
  /** The first element in view when the page last settled, and how far below the top of the frame it was. */
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const onMark = (id: number) => void ctrl.toggleMark(id);
  const groups: DayGroup[] = hidden ? [] : groupByDay(buildTimeline(timeline.events, { memberStuck: member.stuck }));
  const single = groups.length === 1;
  const allOpen = groups.length > 0 && groups.every(g => timeline.openDays.includes(g.dayKey));
  const flags = timeline.flags.filter(f => visibleFlags({ flags: [f.code], stuck: member.stuck }).length > 0).map(f => ({ code: f.code, ids: evidenceOf(f, timeline.events) })).filter(f => f.ids.length > 0);
  const flagsOfDay = dayFlags(groups, timeline.flags.map(f => ({ code: f.code, ids: evidenceOf(f, timeline.events) })), member.stuck);
  const showToggle = !hidden && groups.length >= 2 && timeline.phase === 'ready';
  const newest = groups[0];
  const newestPrompt = newest ? [...newest.items].reverse().find((i): i is Extract<typeof i, { kind: 'turn' }> => i.kind === 'turn' && i.prompt !== null)?.prompt ?? null : null;

  /** Remembers the first element in view (the one `preferId` when it is in view) so the next layout can put it back. */
  const captureAnchor = (preferId?: string) => {
    const el = scroller.current;
    if (!el || hiddenRef.current) return;
    const view = el.getBoundingClientRect();
    const preferred = preferId ? document.getElementById(preferId) : null;
    if (preferred) {
      const r = preferred.getBoundingClientRect();
      if (r.bottom > view.top && r.top < view.bottom) { anchor.current = { id: preferId!, offset: r.top - view.top }; return; }
    }
    for (const n of el.querySelectorAll<HTMLElement>('[data-anchor]')) {
      if (!n.id) continue;
      const r = n.getBoundingClientRect();
      if (r.bottom > view.top + 1) { anchor.current = { id: n.id, offset: r.top - view.top }; return; }
    }
    anchor.current = null;
  };

  /** After a scroll or a layout change: is the newest event in view ("đang theo dõi"), on which side is it, and which day header is pinned. */
  const measure = () => {
    const el = scroller.current;
    if (!el || hiddenRef.current) return;
    const view = el.getBoundingClientRect();
    const latest = el.querySelector(`#${LATEST_ID}`);
    if (latest) {
      const r = latest.getBoundingClientRect();
      ctrl.reportFollowing(isLatestInView(r, view));
      setSide(latestSide(r, view));
    }
    let pinned: string | null = null;
    for (const g of el.querySelectorAll<HTMLElement>('[data-day-group]')) {
      const gr = g.getBoundingClientRect();
      const head = g.querySelector('[data-sticky]');
      if (head && gr.top < view.top - 0.5 && gr.bottom > view.top + 0.5 && head.getBoundingClientRect().top <= view.top + 0.5) { pinned = g.dataset.dayGroup ?? null; break; }
    }
    setStuckDay(pinned);
  };
  const onScroll = () => { measure(); captureAnchor(); };

  // The header is wider than a narrow column: below NARROW_PX it wraps (summary under the label, chips on a third line).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const size = () => setNarrow(el.clientWidth <= NARROW_PX);
    size();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(size);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Put back what was being read: rows added above it, a day opened or folded above it, "Tải thêm". Before the scrolls below, which win.
  useLayoutEffect(() => {
    const el = scroller.current;
    const a = anchor.current;
    if (!el || !a || hidden) return;
    const n = document.getElementById(a.id);
    if (!n) return;
    const off = n.getBoundingClientRect().top - el.getBoundingClientRect().top;
    if (Math.abs(off - a.offset) > 0.5) el.scrollTop = keepAnchorScrollTop(el.scrollTop, a.offset, off);
  });

  // Bring the newest event into view when the controller says so (first load, or new lines while it is being followed). The
  // newest event ends the newest day, which is the first group, so the marker sits right after that group's rows.
  useLayoutEffect(() => {
    const el = scroller.current;
    const latest = el?.querySelector(`#${LATEST_ID}`);
    if (!el || !latest) return;
    el.scrollTop += latest.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
  }, [timeline.followToken, timeline.phase]);

  // A flag chip jumped to an event: scroll to its row (the row is drawn highlighted while `focusId` stays).
  useLayoutEffect(() => {
    if (timeline.focusId !== null) document.getElementById(`ev-${timeline.focusId}`)?.scrollIntoView({ block: 'center' });
  }, [timeline.focusToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // J / K moved the panel to another command: bring its row into view.
  const activeId = panel?.eventId;
  useLayoutEffect(() => {
    if (activeId !== undefined) document.getElementById(`ev-${activeId}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  // Last: read where everything ended up. While the content is hidden nothing is read, so showing it again goes back to the same row.
  useLayoutEffect(() => {
    if (hidden) { setStuckDay(null); return; }
    measure();
    captureAnchor();
  });

  const toggleDay = (dayKey: string) => {
    captureAnchor(`day-${dayKey}-row`); // the header stays where it is (a pinned one goes to the top of the frame once its day is folded)
    ctrl.toggleDay(dayKey);
  };
  const jumpToLatest = () => {
    setFlashId(newestPrompt?.id ?? null);
    window.setTimeout(() => setFlashId(null), FLASH_MS);
    ctrl.jumpToLatest();
  };
  const loadMore = () => { captureAnchor(); void ctrl.loadMore(); };

  const chipSide = side === 'above' ? 'above' : 'below';

  return (
    <section aria-label={`Dòng thời gian của ${member.displayName}`} style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, height: '100%', background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gap: 4, padding: '10px 14px 8px', borderBottom: '1px solid var(--border-hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, font: '700 18px/1.3 var(--font-sans)', color: 'var(--text-title)', overflowWrap: 'anywhere' }}>{member.displayName}</h2>
          <ConnectionChip row={member} />
          {member.stuck && <StuckChip />}
          {(canRemove || showToggle) && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {showToggle && <Button variant="ghost" size="sm" icon="list" onClick={() => ctrl.setAllDays(!allOpen)}>{allOpen ? 'Thu tất cả' : 'Mở tất cả'}</Button>}
              {canRemove && !hidden && <Button variant="ghost" size="sm" icon="pencil" pressed={noteOpen} onClick={() => setNoteOpen(o => !o)}>{member.mentorNote ? 'Ghi chú ✓' : 'Ghi chú'}</Button>}
              {canRemove && <Button variant="ghost" size="sm" icon="user-x" onClick={onRemove}>Mời ra</Button>}
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
      {!hidden && noteOpen && canRemove && <NoteBox key={member.id} member={member} onSave={note => ctrl.saveNote(member.id, note)} />}
      {markError && !hidden && <div role="alert" style={{ padding: '8px 16px', background: 'var(--wrong-surface)', color: 'var(--wrong-600)', font: 'var(--type-meta)', fontWeight: 600 }}>{markError}</div>}

      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface-page)' }}>
        <div ref={scroller} onScroll={onScroll} tabIndex={0} aria-label="Các sự kiện, ngày mới nhất ở trên"
          style={{ flex: 1, minHeight: 0, overflow: 'auto', overflowAnchor: 'auto', display: 'flex', flexDirection: 'column' }}>
          {hidden ? (
            <div style={{ margin: 'auto', display: 'grid', gap: 8, justifyItems: 'center', textAlign: 'center', color: 'var(--text-meta)', font: 'var(--type-body)', maxWidth: 340, padding: 24 }}>
              <Icon name="eye-off" size={28} />
              <strong style={{ color: 'var(--text-title)' }}>Nội dung đang ẩn</strong>
              <span>Prompt, lệnh và output không hiện trên màn hình. Nhấn <kbd style={{ font: `600 12px/1 ${mono}` }}>H</kbd> hoặc nút “Hiện nội dung” để xem lại.</span>
            </div>
          ) : timeline.phase === 'loading' ? (
            <div style={{ paddingTop: 120 }}><Spinner block label="Đang tải dòng thời gian…" /></div>
          ) : timeline.phase === 'error' ? (
            <div style={{ padding: 16 }}><ErrorMessage title="Không tải được dòng thời gian" message={timeline.error} onRetry={() => ctrl.retryTimeline()} /></div>
          ) : groups.length === 0 ? (
            <div style={{ margin: 'auto', display: 'grid', gap: 6, justifyItems: 'center', textAlign: 'center', color: 'var(--text-meta)', font: 'var(--type-body)', maxWidth: 360, padding: 24 }}>
              <Icon name="hourglass" size={26} />
              <strong style={{ color: 'var(--text-title)' }}>Chưa có sự kiện nào</strong>
              <span>{member.connection === 'waiting' ? `${member.displayName} chưa gửi tín hiệu. Prompt và lệnh sẽ hiện ở đây khi Claude Code của bạn ấy gửi về.` : 'Chưa có prompt hay lệnh nào được ghi lại.'}</span>
            </div>
          ) : (
            <div style={{ padding: '12px 0 16px' }}>
              {groups.map((g, at) => {
                const open = single || timeline.openDays.includes(g.dayKey);
                const prevOpen = at > 0 && (timeline.openDays.includes(groups[at - 1]!.dayKey));
                const label = dayLabel(g.startedAt);
                const body = `day-body-${g.dayKey}`;
                return (
                  <div key={g.dayKey} data-day-group={g.dayKey} style={{ padding: '0 16px', ...(at > 0 ? { borderTop: '1px solid var(--ink-200)', marginTop: prevOpen ? 12 : 0 } : {}) }}>
                    <DayGroupHeader id={`day-${g.dayKey}`} bodyId={body} label={label} today={isToday(g.dayKey, now)} counts={g} expanded={open} variant={single ? 'light' : 'default'}
                      onToggle={() => toggleDay(g.dayKey)} flags={flagsOfDay.get(g.dayKey)} onFlag={f => ctrl.jumpToFlag(f.code, g.dayKey)} stuck={stuckDay === g.dayKey} narrow={narrow} />
                    <div id={body} role="region" aria-labelledby={`day-${g.dayKey}`} hidden={!open}
                      style={open ? { ...(single ? { padding: '0 0 8px' } : { marginLeft: 13, borderLeft: '2px solid var(--ink-200)', padding: '0 0 8px 21px' }), animation: 'pq-fade var(--dur-base) var(--ease-standard)' } : undefined}>
                      {open && g.items.map((item, i) => {
                        const prev = g.items[i - 1];
                        const gap = i === 0 ? 0 : prev?.kind === 'turn' && item.kind === 'turn' ? 8 : 12;
                        if (item.kind === 'session') return <div key={item.key} style={{ marginTop: gap }}><SessionMarker index={item.index} openedAt={item.startedAt} continuedFrom={item.continuedFrom} rail={!single} /></div>;
                        const shown = item.tools.filter(t => t.event.kind === 'tool');
                        const detail: Detail | null = item.tools.length > 0 ? { commands: shown.length, failed: shown.filter(t => t.event.ok === false).length, onOpen: () => ctrl.openTurn(item.key) } : null;
                        return (
                          <div key={item.key} style={{ marginTop: gap }}>
                            <PromptBlock event={item.prompt} number={item.promptNumber} focused={item.prompt !== null && timeline.focusId === item.prompt.id} flash={item.prompt !== null && flashId === item.prompt.id} onMark={onMark} detail={detail} />
                          </div>
                        );
                      })}
                    </div>
                    {at === 0 && <div id={LATEST_ID} aria-hidden style={{ height: 0 }} />}
                    {at === 0 && timeline.hasMore && (
                      <div style={{ display: 'grid', gap: 6, margin: '8px 0 4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 12px', borderRadius: 10, background: 'var(--paper)', border: '1px solid var(--ink-200)' }}>
                          <Icon name="info" size={16} color="var(--ink-600)" />
                          <span style={{ flex: 1, font: '400 13px/1.45 var(--font-sans)', color: 'var(--ink-700)' }}>Còn sự kiện mới hơn chưa tải</span>
                          <Button variant="secondary" size="sm" icon="rotate-ccw" loading={timeline.loadingMore} onClick={loadMore}>Tải thêm</Button>
                        </div>
                        {timeline.error && <ErrorMessage message={timeline.error} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {timeline.newCount > 0 && !hidden && (
          <div style={{ position: 'absolute', left: 0, right: 0, ...(chipSide === 'above' ? { top: stuckDay ? 56 : 12 } : { bottom: 16 }), zIndex: 3, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <button type="button" onClick={jumpToLatest} data-side={chipSide} style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px 0 12px', borderRadius: 'var(--radius-pill)', border: 0, cursor: 'pointer', background: 'var(--ink-900)', color: 'var(--paper)', font: '600 13px/1 var(--font-sans)', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-raised)' }}>
              <span style={{ display: 'inline-flex', transform: `rotate(${chipSide === 'above' ? 90 : -90}deg)` }}><Icon name="arrow-left" size={16} /></span>
              {timeline.newCount} sự kiện mới
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
