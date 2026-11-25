import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { isCardReadable, isLatestInView, keepAnchorScrollTop, latestSide, type LatestSide } from '../domain/scroll.js';
import { toolLabel } from '../domain/tool-label.js';
import { dayLabel, isToday } from '../domain/days.js';
import { dayFlags, groupByDay, newestPromptOf, turnsOfDay, type DayGroup } from '../domain/day-groups.js';
import { READ_DWELL_MS, ReadDwell } from '../domain/read-dwell.js';
import { blockEnd, blockKeyOf } from '../domain/session-blocks.js';
import { buildTimeline, type Turn } from '../domain/timeline.js';
import { maxEventId, newCommandsOf, turnNewness, turnReadKey, unreadTurns, type ReadState } from '../domain/unread.js';
import { ConnectionChip, FlagChip, StuckChip } from './chips.js';
import { DayGroupHeader } from './DayGroupHeader.js';
import { NewBadge } from './NewBadge.js';
import { PromptEventStrip } from './PromptEventStrip.js';
import { SessionBlockHeader } from './SessionBlockHeader.js';
import { MarkButton } from './TimelineRows.js';
import { NoTeachingChip, TeachingButton } from './TeachingButton.js';
import { NoteBox } from './NoteBox.js';

const mono = 'var(--font-mono)';

/** A zero-height marker right after the newest day: where the newest event ends. */
const LATEST_ID = 'timeline-latest';

const bodyId = (dayKey: string) => `day-body-${dayKey}`;

interface Detail { commands: number; failed: number; onOpen: () => void }

/** How a prompt card shows that it holds something new (S43): `new` = the prompt itself, `fading` = the 2 seconds just ended (the badge is going), `events` = new commands in an older prompt. */
interface CardNewness { badge: 'new' | 'fading' | null; newEvents: number; strips: { event: TrainingEventRow; fading: boolean }[]; moreStrips: number }

const NO_NEWNESS: CardNewness = { badge: null, newEvents: 0, strips: [], moreStrips: 0 };
/** Most strips shown under one prompt; the rest is one line ("và N sự kiện mới khác"). */
const MAX_STRIPS = 3;

/** The text of one strip: what ran (or was asked), how it ended, when. */
function stripOf(e: TrainingEventRow): { kind: 'command' | 'permission'; text: string; result: string; at: string } {
  if (e.kind === 'permission') return { kind: 'permission', text: `Claude xin quyền: ${e.toolName ?? 'công cụ'} ${e.toolTarget ?? ''}`.trim(), result: decisionText(e).text.toLowerCase(), at: formatClock(e.receivedAt) };
  return { kind: 'command', text: `${e.toolName ?? 'Công cụ'} ${e.toolTarget ?? ''}`.trim(), result: e.ok === false ? 'lỗi' : 'chạy xong', at: formatClock(e.receivedAt) };
}

/**
 * One prompt of the list, a white card on the frame: what the member asked (two lines, the whole text on hover and in the popup), a
 * mode chip when it is not the default, and "Xem chi tiết" for the commands that ran under it. The list is the overview; the
 * commands live in the popup. `flash` draws the card like a focus ring that fades (the "N prompt có mục mới" chip arrived here).
 * A new prompt has the "Mới" badge and a brand border; an older prompt with new commands keeps its border and gets "· N mới" and
 * a strip per new command (S43).
 */
function PromptBlock({ event, number, turnKey, focused, flash, onMark, onTeach, canTeach, detail, fresh = NO_NEWNESS }: { event: TrainingEventRow | null; number: number | null; turnKey: string; focused: boolean; flash: boolean; onMark: (id: number) => void; onTeach: (id: number) => void; canTeach: boolean; detail: Detail | null; fresh?: CardNewness }) {
  const mode = modeLabel(event?.permissionMode);
  const isNew = fresh.badge !== null;
  const box = {
    borderRadius: 10, background: focused ? 'var(--sun-100)' : event ? 'var(--paper)' : 'var(--surface-sunken)',
    border: `1px solid ${fresh.badge === 'new' ? 'var(--brand-500)' : focused && !isNew ? 'var(--sun-200)' : 'var(--ink-200)'}`,
    boxShadow: event ? 'var(--shadow-card)' : 'none', transition: 'border-color var(--dur-slow) var(--ease-standard)',
  } as const;
  const modeChip = mode && (
    <span title="Chế độ quyền của Claude Code lúc bạn ấy gõ prompt" style={{ padding: '0 7px', borderRadius: 'var(--radius-pill)', font: 'var(--type-label)', fontSize: 11.5, whiteSpace: 'nowrap', background: isAutoMode(event?.permissionMode) ? 'var(--sun-100)' : 'var(--ink-100)', color: isAutoMode(event?.permissionMode) ? 'var(--sun-ink)' : 'var(--ink-700)', border: `1px solid ${isAutoMode(event?.permissionMode) ? 'var(--sun-200)' : 'var(--ink-300)'}` }}>{mode}</span>
  );
  return (
    <div id={event ? `ev-${event.id}` : undefined} data-anchor data-turn-key={turnKey} data-new={fresh.badge === 'new' ? 'prompt' : fresh.newEvents > 0 ? 'events' : undefined} className={flash ? 'pq-flash' : undefined}
      style={{ ...box, padding: '6px 6px 10px 14px', scrollMarginTop: 56, scrollMarginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, minHeight: 32 }}>
        {isNew && <NewBadge fading={fresh.badge === 'fading'} />}
        <span style={{ font: '600 12px/1.3 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--ink-700)', whiteSpace: 'nowrap' }}>{event ? `Prompt${number !== null ? ` ${number}` : ''}` : 'Trước prompt đầu tiên'}</span>
        {modeChip}
        {detail && (
          <span style={{ font: '400 13px/1.45 var(--font-sans)', color: 'var(--ink-600)', fontVariantNumeric: 'tabular-nums' }}>
            {detail.commands} lệnh{detail.failed > 0 && <> · <b style={{ fontWeight: 600, color: 'var(--wrong-600)' }}>{detail.failed}</b> lỗi</>}
            {fresh.newEvents > 0 && <> · <b data-new-events style={{ fontWeight: 600, color: 'var(--brand-700)' }}>{fresh.newEvents} mới</b></>}
          </span>
        )}
        <span style={{ flex: '1 1 0' }} />
        {event && <span style={{ font: `500 13px/1 ${mono}`, color: 'var(--ink-600)' }}>{formatClock(event.receivedAt)}</span>}
        {detail && <Button variant="ghost" size="sm" icon="panel-right-open" onClick={detail.onOpen}>Xem chi tiết</Button>}
        {event && canTeach && <TeachingButton id={event.id} label={event.teachingExample?.label ?? null} onOpen={onTeach} />}
        {event && canTeach && <span aria-hidden="true" style={{ width: 1, height: 18, background: 'var(--ink-300)', flex: 'none' }} />}
        {event && <MarkButton id={event.id} marked={event.marked} onToggle={onMark} withText />}
      </div>
      {event && <p title={event.prompt} style={{ margin: 0, paddingRight: 8, font: '400 14px/1.5 var(--font-sans)', color: 'var(--ink-900)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.prompt}</p>}
      {fresh.strips.map(({ event: e, fading }) => <PromptEventStrip key={e.id} {...stripOf(e)} fading={fading} />)}
      {fresh.moreStrips > 0 && <div style={{ margin: '6px 8px 0 0', font: '400 12px/1.4 var(--font-sans)', color: 'var(--ink-600)' }}>và {fresh.moreStrips} sự kiện mới khác</div>}
    </div>
  );
}

/** Below this width of the timeline frame the day header wraps (summary under the label, chips on a third line). */
const NARROW_PX = 560;
/** How long the card the "N sự kiện mới" chip jumped to stays drawn as focused, before it is cleared. A local value (like the 1600ms of `pq-flash` in index.css) pending a design-system token. */
const FLASH_MS = 1700;

/** How long the "Mới" badge takes to go (`--dur-slow` plus a little), before it is removed and gives its place back. */
const BADGE_FADE_MS = 350;

/** A turn with something unread, and where it is drawn (the day and the block hold its card, or its header when folded). */
interface UnreadTurn { turn: Turn; dayKey: string; blockKey: string }

/** The "N prompt có mục mới" chip: on which edge, how many unread prompts are out of view on that side, and the nearest one. */
interface UnreadChip { side: 'above' | 'below'; count: number; nearestTurnKey: string; nearestPromptId: number | null }

const sameChip = (a: UnreadChip | null, b: UnreadChip | null) => a === b || (!!a && !!b && a.side === b.side && a.count === b.count && a.nearestTurnKey === b.nearestTurnKey);

/**
 * One member's timeline: day groups, the newest day first (folded away when old, its header pinned to the top while it is read);
 * inside a day, one block per Claude Code session (oldest first), inside a block the prompts oldest to newest. A run of the same
 * failing command carries the "có thể đang kẹt" chip. Output is never loaded until a button is pressed. Whatever the mentor is
 * reading stays where it is when events arrive, a day or block opens or folds, or "Tải thêm" adds rows, unless the newest prompt is
 * in view (then the view follows it). New prompts (and new commands in old prompts) are marked until the mentor has had them in
 * view for 2 seconds (S43); that clock never runs while the content is hidden.
 */
export function Timeline({ member, timeline, panel, hidden, markError, read, ctrl, canRemove, now, onRemove }: {
  member: TrainingMemberRow; timeline: TimelineState; panel: PanelState | null; hidden: boolean; markError: string; read: ReadState; ctrl: TrainingController; canRemove: boolean; now: number;
  onRemove: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [stuckDay, setStuckDay] = useState<string | null>(null);
  const [stuckBlock, setStuckBlock] = useState<number | null>(null);
  const [side, setSide] = useState<LatestSide>('in');
  const [chip, setChip] = useState<UnreadChip | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const redraw = () => setTick(t => t + 1);
  /** The first element in view when the page last settled, and how far below the top of the frame it was. */
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const onMark = (id: number) => void ctrl.toggleMark(id);
  const onTeach = (id: number) => ctrl.openTeaching(id);
  const groups: DayGroup[] = useMemo(() => (hidden ? [] : groupByDay(buildTimeline(timeline.events, { memberStuck: member.stuck }))), [hidden, timeline.events, member.stuck]);
  const single = groups.length === 1;
  const allOpen = groups.length > 0 && groups.every(g => timeline.openDays.includes(g.dayKey) && g.blocks.every(b => g.blocks.length === 1 || timeline.openBlocks.includes(b.key)));
  const flags = timeline.flags.filter(f => visibleFlags({ flags: [f.code], stuck: member.stuck }).length > 0).map(f => ({ code: f.code, ids: evidenceOf(f, timeline.events) })).filter(f => f.ids.length > 0);
  const flagsOfDay = dayFlags(groups, timeline.flags.map(f => ({ code: f.code, ids: evidenceOf(f, timeline.events) })), member.stuck);
  const multiBlock = groups.some(g => g.blocks.length > 1);
  const showToggle = !hidden && (groups.length >= 2 || multiBlock) && timeline.phase === 'ready';
  const newest = groups[0];
  const newestPrompt = hidden ? null : newestPromptOf(timeline.events);

  // What is new, from what the mentor has read. Nothing while the content is hidden.
  const rec = hidden ? undefined : read.members[String(member.id)];
  const unread: UnreadTurn[] = [];
  for (const g of groups) for (const b of g.blocks) for (const turn of b.turns) if (turnNewness(turn, rec).kind !== 'none') unread.push({ turn, dayKey: g.dayKey, blockKey: b.key });
  const unreadIn = (turns: readonly Turn[]) => unreadTurns(turns, rec).length;
  const unreadRef = useRef(unread);
  unreadRef.current = unread;

  // The badge of a prompt that was new and is not any more goes (opacity, scale) before it is removed; strips of new commands stay until their card is out of view.
  const prevKind = useRef(new Map<string, string>());
  const fadingBadges = useRef(new Set<string>());
  const strips = useRef(new Map<string, Map<number, TrainingEventRow>>());
  const cardNewness = (turn: Turn): CardNewness => {
    const key = turnReadKey(turn);
    const n = turnNewness(turn, rec);
    if (hidden) return NO_NEWNESS;
    if (n.kind !== 'prompt' && prevKind.current.get(key) === 'prompt') fadingBadges.current.add(key);
    const nowNew = new Set(newCommandsOf(n).map(e => e.id));
    if (n.kind === 'events') {
      const kept = strips.current.get(key) ?? new Map<number, TrainingEventRow>();
      for (const e of newCommandsOf(n)) kept.set(e.id, e);
      strips.current.set(key, kept);
    }
    const kept = [...(strips.current.get(key)?.values() ?? [])].sort((x, y) => x.id - y.id);
    const shown = kept.slice(0, MAX_STRIPS);
    return {
      badge: n.kind === 'prompt' ? 'new' : fadingBadges.current.has(key) ? 'fading' : null,
      newEvents: n.kind === 'events' ? nowNew.size : 0,
      strips: shown.map(event => ({ event, fading: !nowNew.has(event.id) })),
      moreStrips: Math.max(0, kept.length - shown.length),
    };
  };

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

  /** The element that stands for "the newest prompt": its card, else the header of its block (folded), else the marker after the newest day. */
  const latestElement = (el: HTMLElement): Element | null => {
    if (newestPrompt) {
      const card = el.querySelector(`#ev-${newestPrompt.id}`);
      if (card) return card;
      // Usually in the newest day, but a later day may hold only a session's turn before its first prompt.
      const place = groups.flatMap(g => g.blocks).find(b => b.turns.some(t => t.prompt?.id === newestPrompt.id));
      const header = place ? el.querySelector(`#block-${place.key}-row`) : null;
      if (header) return header;
    }
    return el.querySelector(`#${LATEST_ID}`);
  };

  const dwell = useRef<ReadDwell | null>(null);
  if (!dwell.current) dwell.current = new ReadDwell((key, maxId) => ctrl.markTurnRead(key, maxId));
  useEffect(() => () => dwell.current?.dispose(), []);

  /** The 2-second clock: which unread cards are in the frame enough, and whether anything may be counted now. */
  const measureRead = () => {
    const el = scroller.current;
    const canCount = !!el && !hiddenRef.current && timeline.phase === 'ready' && document.visibilityState === 'visible' && document.hasFocus();
    const inView = new Map<string, number>();
    if (el && canCount) {
      const view = el.getBoundingClientRect();
      for (const u of unreadRef.current) {
        const card = el.querySelector(`[data-turn-key="${turnReadKey(u.turn)}"]`);
        if (!card) continue;
        if (isCardReadable(card.getBoundingClientRect(), view)) inView.set(turnReadKey(u.turn), maxEventId(u.turn));
      }
    }
    dwell.current!.update(inView, canCount);
  };

  /** After a scroll or a layout change: is the newest prompt in view ("đang theo dõi"), on which side, which day header is pinned, the chip, and what to forget. */
  const measure = () => {
    const el = scroller.current;
    if (!el || hiddenRef.current) return;
    const view = el.getBoundingClientRect();
    const latest = latestElement(el);
    if (latest) {
      const r = latest.getBoundingClientRect();
      ctrl.reportFollowing(isLatestInView(r, view));
      setSide(latestSide(r, view));
    }
    let pinned: string | null = null;
    let pinnedBlock: number | null = null;
    for (const g of el.querySelectorAll<HTMLElement>('[data-day-group]')) {
      const gr = g.getBoundingClientRect();
      const head = g.querySelector('[data-sticky]');
      if (head && gr.top < view.top - 0.5 && gr.bottom > view.top + 0.5 && head.getBoundingClientRect().top <= view.top + 0.5) {
        pinned = g.dataset.dayGroup ?? null;
        const headBottom = head.getBoundingClientRect().bottom;
        const heads = [...g.querySelectorAll<HTMLElement>('[data-block-head]')];
        const passed = heads.filter(h => h.getBoundingClientRect().top < headBottom);
        if (heads.length > 1 && passed.length > 0) pinnedBlock = Number(passed[passed.length - 1]!.dataset.blockHead);
        break;
      }
    }
    setStuckDay(pinned);
    setStuckBlock(pinnedBlock);

    // The strips of cards that are out of the frame and no longer new go; the card above or below is held by the scroll anchor.
    let dropped = false;
    for (const [key, kept] of strips.current) {
      const card = el.querySelector(`[data-turn-key="${key}"]`);
      const still = unreadRef.current.some(u => turnReadKey(u.turn) === key && newCommandsOf(turnNewness(u.turn, rec)).length > 0);
      const r = card?.getBoundingClientRect();
      const away = !r || r.bottom <= view.top || r.top >= view.bottom;
      if (away && !still) { strips.current.delete(key); dropped = true; }
    }
    if (dropped) redraw();

    // The chip: unread prompts out of the frame (a folded block or day is judged by its header).
    const out: { u: UnreadTurn; side: 'above' | 'below' }[] = [];
    for (const u of unreadRef.current) {
      const target = el.querySelector(`[data-turn-key="${turnReadKey(u.turn)}"]`) ?? el.querySelector(`#block-${u.blockKey}-row`) ?? el.querySelector(`#day-${u.dayKey}-row`) ?? el.querySelector(`#day-${u.dayKey}`);
      if (!target) continue;
      const s = latestSide(target.getBoundingClientRect(), view);
      if (s !== 'in') out.push({ u, side: s });
    }
    let next: UnreadChip | null = null;
    if (out.length > 0) {
      const newestOut = out.reduce((m, o) => (o.u.turn.firstId > m.u.turn.firstId ? o : m));
      const sideList = out.filter(o => o.side === newestOut.side);
      const nearest = newestOut.side === 'below' ? sideList[0]! : sideList[sideList.length - 1]!;
      next = { side: newestOut.side, count: sideList.length, nearestTurnKey: nearest.u.turn.key, nearestPromptId: nearest.u.turn.prompt?.id ?? null };
    }
    setChip(prev => (sameChip(prev, next) ? prev : next));
    measureRead();
  };
  const onScroll = () => { measure(); captureAnchor(); };

  // The window gains or loses focus, the tab is shown or hidden: the clock may start or must stop.
  useEffect(() => {
    const check = () => measureRead();
    window.addEventListener('focus', check);
    window.addEventListener('blur', check);
    document.addEventListener('visibilitychange', check);
    return () => { window.removeEventListener('focus', check); window.removeEventListener('blur', check); document.removeEventListener('visibilitychange', check); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Put back what was being read: rows added above it, a day or block opened or folded above it, "Tải thêm". Before the scrolls below, which win.
  useLayoutEffect(() => {
    const el = scroller.current;
    const a = anchor.current;
    if (!el || !a || hidden) return;
    const n = document.getElementById(a.id);
    if (!n) return;
    const off = n.getBoundingClientRect().top - el.getBoundingClientRect().top;
    if (Math.abs(off - a.offset) > 0.5) el.scrollTop = keepAnchorScrollTop(el.scrollTop, a.offset, off);
  });

  // Bring the newest prompt into view when the controller says so (first load, or new lines while it is being followed). When it is
  // the last card of the newest day the marker after that day is used, so "Tải thêm" stays in sight; otherwise the card itself,
  // wherever its block is.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const lastTurn = newest ? turnsOfDay({ blocks: newest.blocks.length > 0 ? [newest.blocks[newest.blocks.length - 1]!] : [] }).at(-1) : undefined;
    const target = newestPrompt && lastTurn?.prompt?.id !== newestPrompt.id ? latestElement(el) : el.querySelector(`#${LATEST_ID}`) ?? latestElement(el);
    if (!target) return;
    el.scrollTop += target.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
  }, [timeline.followToken, timeline.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // A flag chip jumped to an event: scroll to its row (the row is drawn highlighted while `focusId` stays).
  useLayoutEffect(() => {
    if (timeline.focusId !== null) document.getElementById(`ev-${timeline.focusId}`)?.scrollIntoView({ block: 'center' });
  }, [timeline.focusToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // The "N prompt có mục mới" chip or "Song song với phiên M" asked for a turn or a block.
  useLayoutEffect(() => {
    if (timeline.revealId !== null) document.getElementById(`ev-${timeline.revealId}`)?.scrollIntoView({ block: 'center' });
  }, [timeline.revealToken]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (timeline.revealBlockKey === null) return;
    document.getElementById(`block-${timeline.revealBlockKey}-row`)?.scrollIntoView({ block: 'start' });
    document.getElementById(`block-${timeline.revealBlockKey}`)?.focus({ preventScroll: true });
  }, [timeline.revealBlockToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // J / K moved the panel to another command: bring its row into view.
  const activeId = panel?.eventId;
  useLayoutEffect(() => {
    if (activeId !== undefined) document.getElementById(`ev-${activeId}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  // Last: read where everything ended up. While the content is hidden nothing is read, so showing it again goes back to the same row.
  useLayoutEffect(() => {
    if (hidden) { setStuckDay(null); setStuckBlock(null); setChip(null); dwell.current?.update(new Map(), false); return; }
    measure();
    captureAnchor();
  });

  // Remember what each card was, and let the badge of one that stopped being new go after its fade.
  useEffect(() => {
    const timers: number[] = [];
    for (const u of unreadRef.current) prevKind.current.set(turnReadKey(u.turn), turnNewness(u.turn, rec).kind);
    for (const key of [...fadingBadges.current]) {
      timers.push(window.setTimeout(() => { fadingBadges.current.delete(key); prevKind.current.set(key, 'none'); redraw(); }, BADGE_FADE_MS));
    }
    for (const [key, kind] of prevKind.current) if (kind === 'prompt' && !unreadRef.current.some(u => turnReadKey(u.turn) === key)) prevKind.current.set(key, 'none');
    return () => { for (const t of timers) window.clearTimeout(t); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDay = (dayKey: string) => {
    captureAnchor(`day-${dayKey}-row`); // the header stays where it is (a pinned one goes to the top of the frame once its day is folded)
    ctrl.toggleDay(dayKey);
  };
  const toggleBlock = (blockKey: string) => {
    captureAnchor(`block-${blockKey}-row`);
    ctrl.toggleBlock(blockKey);
  };
  const flashTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const jumpToUnread = (c: UnreadChip) => {
    setFlashId(c.nearestPromptId);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), FLASH_MS);
    ctrl.revealTurn(c.nearestTurnKey);
  };
  const loadMore = () => { captureAnchor(); void ctrl.loadMore(); };

  const unreadLoaded = unread.length;
  const chipSide = chip?.side ?? (side === 'above' ? 'above' : 'below');

  return (
    <section aria-label={`Dòng thời gian của ${member.displayName}`} style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, height: '100%', background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gap: 4, padding: '10px 14px 8px', borderBottom: '1px solid var(--border-hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, font: '700 18px/1.3 var(--font-sans)', color: 'var(--text-title)', overflowWrap: 'anywhere' }}>{member.displayName}</h2>
          <ConnectionChip row={member} />
          {member.stuck && <StuckChip />}
          {!member.teachingConsent && !hidden && <NoTeachingChip />}
          {/* The learner row's buttons, in the design's order: mark all read · open/fold all · hide the content (H), then the note and "Mời ra". Narrow: they wrap to a line of their own. */}
          <div style={{ marginLeft: narrow ? 0 : 'auto', flexBasis: narrow ? '100%' : undefined, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {!hidden && timeline.phase === 'ready' && <Button variant="ghost" size="sm" icon="list-checks" disabled={unreadLoaded === 0} onClick={() => ctrl.markAllRead()}>Đánh dấu đã đọc hết</Button>}
            {showToggle && <Button variant="ghost" size="sm" icon="list" onClick={() => ctrl.setAllOpen(!allOpen)}>{allOpen ? 'Thu tất cả' : 'Mở tất cả'}</Button>}
            {canRemove && <Button variant="ghost" size="sm" icon={hidden ? 'eye' : 'eye-off'} pressed={hidden} shortcut="H" onClick={() => ctrl.toggleHidden()}>{hidden ? 'Hiện nội dung' : 'Ẩn nội dung'}</Button>}
            {canRemove && !hidden && <Button variant="ghost" size="sm" icon="pencil" pressed={noteOpen} onClick={() => setNoteOpen(o => !o)}>{member.mentorNote ? 'Ghi chú ✓' : 'Ghi chú'}</Button>}
            {canRemove && <Button variant="ghost" size="sm" icon="user-x" onClick={onRemove}>Mời ra</Button>}
          </div>
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
                const body = bodyId(g.dayKey);
                const dayNew = unreadIn(turnsOfDay(g));
                const lightBlock = g.blocks.length === 1;
                return (
                  <div key={g.dayKey} data-day-group={g.dayKey} style={{ padding: '0 16px', ...(at > 0 ? { borderTop: '1px solid var(--ink-200)', marginTop: prevOpen ? 12 : 0 } : {}) }}>
                    <DayGroupHeader id={`day-${g.dayKey}`} bodyId={body} label={label} today={isToday(g.dayKey, now)} counts={g} expanded={open} variant={single ? 'light' : 'default'}
                      onToggle={() => toggleDay(g.dayKey)} flags={flagsOfDay.get(g.dayKey)} onFlag={f => ctrl.jumpToFlag(f.code, g.dayKey)} stuck={stuckDay === g.dayKey} narrow={narrow}
                      newCount={dayNew} pinnedBlock={stuckDay === g.dayKey ? stuckBlock : null} />
                    <div id={body} role="region" aria-labelledby={`day-${g.dayKey}`} hidden={!open}
                      style={open ? { ...(single ? { padding: '0 0 8px' } : { marginLeft: 13, borderLeft: '2px solid var(--ink-200)', padding: '0 0 8px 21px' }), animation: 'pq-fade var(--dur-base) var(--ease-standard)' } : undefined}>
                      {open && g.blocks.map((b, bi) => {
                        const bOpen = lightBlock || timeline.openBlocks.includes(b.key);
                        const prevBlockOpen = bi > 0 && !lightBlock && timeline.openBlocks.includes(g.blocks[bi - 1]!.key);
                        const gap = bi === 0 ? 2 : prevBlockOpen ? 16 : 4;
                        const bid = `block-${b.key}`;
                        const end = blockEnd(b);
                        return (
                          <div key={b.key} data-block={b.key} data-block-head={b.index} style={{ marginTop: gap }}>
                            <SessionBlockHeader id={bid} bodyId={`${bid}-body`} index={b.index} range={`${formatClock(b.firstAt)}–${formatClock(b.lastAt)}`} counts={b} end={end}
                              continuedFrom={b.continuedFrom} continuesTo={b.continuesTo} parallelWith={b.overlapsWith} newCount={unreadIn(b.turns)} expanded={bOpen}
                              variant={lightBlock ? 'light' : 'default'} onToggle={() => toggleBlock(b.key)} onParallel={m => ctrl.revealBlock(blockKeyOf(g.dayKey, m))} />
                            <div id={`${bid}-body`} role="region" aria-labelledby={bid} hidden={!bOpen} style={bOpen ? { animation: lightBlock ? undefined : 'pq-fade var(--dur-base) var(--ease-standard)' } : undefined}>
                              {bOpen && b.turns.map((item, ti) => {
                                const shown = item.tools.filter(t => t.event.kind === 'tool');
                                const detail: Detail | null = item.tools.length > 0 ? { commands: shown.length, failed: shown.filter(t => t.event.ok === false).length, onOpen: () => ctrl.openTurn(item.key) } : null;
                                return (
                                  <div key={item.key} style={{ marginTop: ti === 0 ? 4 : 8 }}>
                                    <PromptBlock event={item.prompt} number={item.promptNumber} turnKey={turnReadKey(item)} focused={item.prompt !== null && timeline.focusId === item.prompt.id} flash={item.prompt !== null && flashId === item.prompt.id}
                                      onMark={onMark} onTeach={onTeach} canTeach={member.teachingConsent} detail={detail} fresh={cardNewness(item)} />
                                  </div>
                                );
                              })}
                            </div>
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

        {timeline.newCount > 0 && !hidden && chip && (
          <div style={{ position: 'absolute', left: 0, right: 0, ...(chipSide === 'above' ? { top: stuckDay ? 56 : 12 } : { bottom: 16 }), zIndex: 3, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <button type="button" onClick={() => jumpToUnread(chip)} data-side={chipSide} data-unread-chip style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px 0 12px', borderRadius: 'var(--radius-pill)', border: 0, cursor: 'pointer', background: 'var(--ink-900)', color: 'var(--paper)', font: '600 13px/1 var(--font-sans)', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-raised)' }}>
              <span style={{ display: 'inline-flex', transform: `rotate(${chipSide === 'above' ? 90 : -90}deg)` }}><Icon name="arrow-left" size={16} /></span>
              {chip.count} prompt có mục mới
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
