import type { Clip, FlagCode, MemberFlag, TrainingDetail, TrainingEventRow, TrainingExportSummary } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { announcementFor } from '../domain/announcements.js';
import { dayGroupsOf, newestPromptOf, placeOfTurn, placesByEvent, reconcileOpenBlocks, reconcileOpenDays, stepEvent, turnsOfDay, withDayOpen } from '../domain/day-groups.js';
import { exportFileName, exportInputError, paramsFor, type ExportMode } from '../domain/export.js';
import { evidenceOf } from '../domain/flags.js';
import { reportFileName } from '../domain/report.js';
import {
  NAME_PLACEHOLDER, betterOf, replaceName, sortReviewItems, draftTextError, draftTooLong, editedContextOf, editedPromptOf, emptyTeachingForm, formFromRow, isDirty, reviewBody, reviewItemOf, teachingBody, teachingFileName, teachingFormError, teachingLockReason,
  type ReviewItem, type TeachingForm,
} from '../domain/teaching.js';
import { turnKeyOf, type Turn } from '../domain/timeline.js';
import { markAllRead, markTurnsRead, restoreMemberRead, turnReadKey, unreadTurnCount, withBaselines, type MemberRead, type ReadState } from '../domain/unread.js';
import type { TrainingAdminGateway } from './training-admin-gateway.js';
import { InMemoryTrainingReadStore, type TrainingReadStore } from './training-read-store.js';

/** How long "Hoàn tác" stays on screen after "Đánh dấu đã đọc hết". */
export const UNDO_MS = 5000;

/** A member's timeline as loaded so far (oldest first). */
export interface TimelineState {
  memberId: number;
  events: TrainingEventRow[];
  /** More events exist after the last one loaded (only when the page cap was reached). */
  hasMore: boolean;
  /** `loading` = first load, `error` = the first load failed (nothing to show yet). */
  phase: 'loading' | 'ready' | 'error';
  loadingMore: boolean;
  /** First-load failure, or why "tải thêm" failed. */
  error: string;
  /** Events that arrived while the mentor was reading higher up: the "N sự kiện mới ↓" chip. */
  newCount: number;
  /** Changes whenever the timeline should scroll to its newest event (the page reacts to the change, not the value). */
  followToken: number;
  /** The days (`yyyy-mm-dd`) whose group is open; the rest are folded to their header. */
  openDays: string[];
  /** Every day already shown once: a day not in it is new and opens by itself. */
  knownDays: string[];
  /** The session blocks (`SessionBlock.key`) that are open; the rest are folded to their header (S43). */
  openBlocks: string[];
  /** Every block already shown once: a block not in it is new and opens by itself. */
  knownBlocks: string[];
  /** The flags of this member's whole timeline, each with the events behind it (from the server). */
  flags: MemberFlag[];
  /** The event a flag chip last jumped to: drawn highlighted; `focusToken` changes on every jump so the page scrolls even to the same row. */
  focusId: number | null;
  focusToken: number;
  /** A turn the "N prompt có mục mới" chip brought into view: its prompt (or first event) id. The page scrolls to it when `revealToken` changes; no highlight stays. */
  revealId: number | null;
  revealToken: number;
  /** A session block the "Song song với phiên M" button brought into view; same idea as `revealId`. */
  revealBlockKey: string | null;
  revealBlockToken: number;
}

export type PanelKind = 'output' | 'change';

/** The right-hand panel: the output or the change of one command, fetched when opened. */
export interface PanelState {
  eventId: number;
  kind: PanelKind;
  phase: 'loading' | 'ready' | 'error';
  clip: Clip | null;
  error: string;
}

/** The "Xuất báo cáo" dialog: a preview of the Markdown, then the file. */
export interface ReportState {
  phase: 'loading' | 'ready' | 'error';
  text: string;
  error: string;
  /** The file is being fetched (this is also what records the export on the server). */
  saving: boolean;
  /** The file was handed to the browser at least once while this dialog was open. */
  saved: boolean;
}

/** The "Xuất dữ liệu để phân tích" dialog (PRODUCT.md §7.36): which days, which members, what the zip would hold, then the file. */
export interface DataExportState {
  mode: ExportMode;
  /** The days as a date input gives them (`YYYY-MM-DD`); empty until the mentor leaves "Hôm nay". */
  from: string;
  to: string;
  /** null = the whole class. */
  memberIds: number[] | null;
  /** About `summary`: `loading` while the server counts, `error` when it could not. */
  phase: 'loading' | 'ready' | 'error';
  /** What the server counted for the current choice (kept while the next count loads, so the dialog does not flicker). */
  summary: TrainingExportSummary | null;
  /** Why the choice cannot be exported (checked here) or why counting failed. */
  error: string;
  /** Why the last download failed; the mentor may press the button again. */
  saveError: string;
  /** The zip is being fetched. */
  saving: boolean;
  /** The file was handed to the browser for the current choice. */
  saved: boolean;
}

/** The "Ví dụ" dialog of one prompt (PRODUCT.md §7.39b): label, topic, comment, a better version, or drop the example. */
export interface TeachingEditState {
  eventId: number;
  memberName: string;
  /** The prompt as the mentor sees it on the timeline (not masked: this is the mentor's own screen). */
  prompt: string;
  /** An example already exists for this prompt: the form is filled from it and "Bỏ ví dụ" is offered. */
  exists: boolean;
  /** `loading` while an existing example is fetched to fill the form; `error` when that failed. */
  phase: 'loading' | 'ready' | 'error';
  form: TeachingForm;
  /** The edits made on the review screen: a save from this dialog keeps them, because the server replaces the whole example. */
  edited: { editedPrompt: string | null; editedContext: string | null };
  saving: boolean;
  error: string;
}

/** The "Xuất ví dụ" review screen (PRODUCT.md §7.39c): one example at a time with its prompt and context to rewrite, "Đã rà ví dụ này" for each, then the file once all are reviewed. */
export interface TeachingReviewState {
  phase: 'loading' | 'ready' | 'error';
  /** In the order of the list on the left (topic, label). */
  items: ReviewItem[];
  /** The example shown on the right. */
  selectedId: number | null;
  error: string;
  /** The file is being fetched. */
  saving: boolean;
  saved: boolean;
  saveError: string;
}

export type Confirm = { kind: 'stop' } | { kind: 'end' } | { kind: 'remove'; memberId: number; name: string } | { kind: 'purge'; memberId: number; name: string };

export interface TrainingState {
  detail: TrainingDetail;
  selectedId: number | null;
  timeline: TimelineState | null;
  panel: PanelState | null;
  confirm: Confirm | null;
  /** A stop / end / remove is running: the dialog's buttons lock so it cannot run twice. */
  working: boolean;
  /** Why the confirmed action failed; shown in the dialog. */
  actionError: string;
  /** "Ẩn nội dung": prompts, commands and output are not drawn (the page may be on a projector). */
  hidden: boolean;
  /** The last reload failed: the page may show old data. Cleared by the next successful one. */
  offline: boolean;
  /** Words for a screen reader (`aria-live="polite"`) after the state of a member or of the training changed. */
  announcement: string;
  /** Members of an ended training, from the list (the detail no longer carries them); null until known. */
  endedMemberCount: number | null;
  report: ReportState | null;
  dataExport: DataExportState | null;
  teachingEdit: TeachingEditState | null;
  teachingReview: TeachingReviewState | null;
  /** The prompt whose commands are open in the popup (key from `buildTimeline`), or null. */
  turnKey: string | null;
  /** Why the last mark / unmark failed (the row went back to how it was). Cleared by the next one that works. */
  markError: string;
  /** What the mentor has read, per member, kept in this browser (S43). Empty when the browser keeps nothing. */
  read: ReadState;
  /** "Đánh dấu đã đọc hết" was pressed less than `UNDO_MS` ago: the toast with "Hoàn tác". */
  undo: { memberId: number } | null;
}

export interface TrainingControllerOptions {
  /** The member in the URL (`?hv=`), opened as soon as `start()` runs. */
  initialMemberId?: number | null;
  /** Pages of 500 events fetched in a row before "Tải thêm" is offered. */
  maxPages?: number;
  /** Hands a text file to the browser's download (the page supplies it; the controller stays free of the DOM). */
  saveFile?: (filename: string, text: string) => void;
  /** Same for a binary file (the zip). */
  saveBlob?: (filename: string, blob: Blob) => void;
  /** Where "đã đọc" is kept (S43). Without one nothing is remembered across page loads. */
  readStore?: TrainingReadStore;
}

interface Fetched {
  events: TrainingEventRow[];
  hasMore: boolean;
  flags: MemberFlag[];
}

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

const confirmStillMakesSense = (c: Confirm, d: TrainingDetail): boolean => {
  if (c.kind === 'stop') return d.status === 'open';
  if (c.kind === 'end') return d.status === 'stopped';
  return d.status !== 'ended' && d.members.some(m => m.id === c.memberId);
};

/**
 * State and actions of the mentor's page for one AI training. Plain TypeScript, tested with a fake gateway.
 * Every request that can come back late is guarded: a response for a member, panel or reload that is no longer current is dropped.
 */
export class TrainingController {
  private state: TrainingState;
  private listeners = new Set<() => void>();
  private maxPages: number;
  private saveFile: (filename: string, text: string) => void;
  private saveBlob: (filename: string, blob: Blob) => void;
  private readStore: TrainingReadStore;
  private undoRecord: MemberRead | undefined;
  private undoTimer: ReturnType<typeof setTimeout> | undefined;
  private reportToken = 0; // bumped on every open / close of the report dialog
  private exportToken = 0; // bumped on every change of what the data export dialog shows, and on close
  private commits = new Map<number, Promise<boolean>>(); // the save of each example on the review screen that is running
  private marking = new Set<number>(); // examples whose "đã rà" is being saved
  private teachingToken = 0; // bumped on every open / close of the teaching dialog and the review screen
  private started = false;
  private inView = true; // the newest event is in (or near) the viewport
  private detailGen = 0; // bumped when an action's own answer is newer than any reload in flight
  private timelineToken = 0; // bumped when another member is picked (or none)
  private panelToken = 0; // bumped on every open / close of the panel
  private inflight: Promise<void> | null = null;
  private queued = false;

  constructor(private gateway: TrainingAdminGateway, initial: TrainingDetail, opts: TrainingControllerOptions = {}) {
    this.maxPages = opts.maxPages ?? 10;
    this.saveFile = opts.saveFile ?? (() => {});
    this.saveBlob = opts.saveBlob ?? (() => {});
    this.readStore = opts.readStore ?? new InMemoryTrainingReadStore();
    const id = opts.initialMemberId ?? null;
    const known = id !== null && initial.status !== 'ended' && initial.members.some(m => m.id === id);
    this.state = {
      detail: initial, selectedId: known ? id : null, timeline: known ? this.freshTimeline(id) : null, panel: null, confirm: null,
      working: false, actionError: '', hidden: gateway.readHideContent(), offline: false, announcement: '', endedMemberCount: null, report: null, dataExport: null, teachingEdit: null, teachingReview: null, turnKey: null, markError: '',
      read: this.loadRead(initial), undo: null,
    };
  }

  /** The stored record of this training with every member of the list in it (a member first seen now is "already read"); an ended training keeps nothing. */
  private loadRead(d: TrainingDetail): ReadState {
    if (d.status === 'ended') { this.readStore.clear(d.id); return { members: {} }; }
    const stored = this.readStore.load(d.id);
    const read = withBaselines(stored, d.members);
    if (read !== stored) this.readStore.save(d.id, read);
    return read;
  }

  private setRead(read: ReadState): void {
    if (read === this.state.read) return;
    this.readStore.save(this.state.detail.id, read);
    this.set({ read });
  }

  getState = (): TrainingState => this.state;
  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  private set(patch: Partial<TrainingState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }
  private freshTimeline(memberId: number): TimelineState {
    return { memberId, events: [], hasMore: false, phase: 'loading', loadingMore: false, error: '', newCount: 0, followToken: 0, openDays: [], knownDays: [], openBlocks: [], knownBlocks: [], flags: [], focusId: null, focusToken: 0, revealId: null, revealToken: 0, revealBlockKey: null, revealBlockToken: 0 };
  }

  /** Loads what the first render could not: the timeline of the member from the URL, the count of an ended training. Safe to call twice. */
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.state.detail.status === 'ended') void this.loadEndedCount();
    const tl = this.state.timeline;
    if (tl && tl.phase === 'loading') void this.loadInitial(tl.memberId, this.timelineToken);
  }

  // ── Reloading ──────────────────────────────────────────────────────────────────────────────────

  /**
   * Reloads the training and the open timeline (called on SSE signals, a resync and a slow poll). Calls made while one is
   * running collapse into one more run after it, so signals never pile up requests nor apply out of order.
   */
  refresh = (): Promise<void> => {
    if (this.inflight) { this.queued = true; return this.inflight; }
    const run = this.runRefresh().finally(() => {
      this.inflight = null;
      if (this.queued) { this.queued = false; void this.refresh(); }
    });
    this.inflight = run;
    return run;
  };

  private async runRefresh(): Promise<void> {
    const gen = this.detailGen;
    try {
      const detail = await this.gateway.get(this.state.detail.id);
      if (gen !== this.detailGen) return; // a stop / end finished meanwhile: its answer is newer
      this.applyDetail(detail);
      if (this.state.offline) this.set({ offline: false });
    } catch (err) {
      if (!(err instanceof ApiError) || err.status === 0 || err.status >= 500) this.set({ offline: true });
      return;
    }
    await this.refreshTimeline();
  }

  private applyDetail(next: TrainingDetail): void {
    const prev = this.state.detail;
    const patch: Partial<TrainingState> = { detail: next };
    const note = announcementFor(prev, next);
    if (note) patch.announcement = note;
    const gone = next.status === 'ended' || (this.state.selectedId !== null && !next.members.some(m => m.id === this.state.selectedId));
    if (gone && this.state.selectedId !== null) {
      this.timelineToken++;
      this.panelToken++;
      patch.selectedId = null;
      patch.timeline = null;
      patch.panel = null;
      patch.turnKey = null;
    }
    if (next.status === 'ended') { this.panelToken++; this.reportToken++; this.exportToken++; patch.panel = null; patch.turnKey = null; patch.report = null; patch.dataExport = null; this.teachingToken++; patch.teachingEdit = null; patch.teachingReview = null; }
    if (this.state.confirm && !this.state.working && !confirmStillMakesSense(this.state.confirm, next)) patch.confirm = null;
    if (next.status === 'ended') {
      if (prev.status !== 'ended' || Object.keys(this.state.read.members).length > 0) { this.readStore.clear(next.id); patch.read = { members: {} }; patch.undo = null; }
    } else {
      const read = withBaselines(this.state.read, next.members);
      if (read !== this.state.read) { this.readStore.save(next.id, read); patch.read = read; }
    }
    this.set(patch);
    if (next.status === 'ended' && prev.status !== 'ended') void this.loadEndedCount();
  }

  private async loadEndedCount(): Promise<void> {
    try {
      const id = this.state.detail.id;
      const found = (await this.gateway.list()).find(t => t.id === id);
      if (found) this.set({ endedMemberCount: found.memberCount });
    } catch { /* shown as unknown */ }
  }

  // ── The timeline of the picked member ────────────────────────────────────────────────────────────

  /** Pages of events after `after`, oldest first, up to the page cap. */
  private async fetchPages(memberId: number, after: number): Promise<Fetched> {
    const events: TrainingEventRow[] = [];
    let cursor = after;
    let flags: MemberFlag[] = [];
    for (let page = 0; page < this.maxPages; page++) {
      const r = await this.gateway.events(this.state.detail.id, memberId, cursor);
      events.push(...r.events);
      flags = r.flags ?? flags;
      const last = r.events[r.events.length - 1];
      if (!last || !r.hasMore) return { events, hasMore: false, flags };
      cursor = last.id;
    }
    return { events, hasMore: true, flags };
  }

  /**
   * Adds what came after the last event, and swaps in the newer version of rows already shown (a permission request that was
   * "waiting" gets its inferred answer once more events exist).
   */
  private appendEvents(memberId: number, fetched: Fetched, fromLoadMore = false): void {
    const tl = this.state.timeline;
    if (!tl || tl.memberId !== memberId) return;
    const lastId = tl.events[tl.events.length - 1]?.id ?? 0;
    const fresh = fetched.events.filter(e => e.id > lastId);
    const updated = new Map(fetched.events.filter(e => e.id <= lastId).map(e => [e.id, e]));
    let { newCount, followToken } = tl;
    // While the newest event is in view (or nothing was shown yet) the view follows the new lines; elsewhere it only counts them.
    // "Tải thêm" is the mentor's own request and sits right under the newest loaded event: it never follows and never counts as new.
    if (fresh.length > 0 && !fromLoadMore) { if (tl.events.length === 0 || this.isFollowing(tl)) followToken++; else newCount += fresh.length; }
    const events = [...tl.events.map(e => updated.get(e.id) ?? e), ...fresh];
    // The first days that appear open only the newest; a day that appears later opens by itself, the others stay as they are.
    const groups = fresh.length > 0 ? dayGroupsOf(events) : [];
    const days = fresh.length > 0 ? reconcileOpenDays({ open: tl.openDays, known: tl.knownDays }, groups.map(g => g.dayKey)) : { open: tl.openDays, known: tl.knownDays };
    // A block opens by default when it holds something unread or its session sent no end signal; one that appears later opens by itself.
    const rec = this.state.read.members[String(memberId)];
    const blocks = fresh.length > 0
      // A day's only block is always drawn open (the light header has no toggle), so it is kept open here too.
      ? reconcileOpenBlocks({ open: tl.openBlocks, known: tl.knownBlocks }, groups.flatMap(g => g.blocks.map(b => ({ key: b.key, isDefaultOpen: g.blocks.length === 1 || b.endedBy === null || unreadTurnCount(b.turns, rec) > 0 }))))
      : { open: tl.openBlocks, known: tl.knownBlocks };
    this.set({ timeline: { ...tl, events, hasMore: fetched.hasMore, flags: fetched.flags, phase: 'ready', loadingMore: false, error: '', newCount, followToken, openDays: days.open, knownDays: days.known, openBlocks: blocks.open, knownBlocks: blocks.known } });
  }

  private async loadInitial(memberId: number, token: number): Promise<void> {
    try {
      const fetched = await this.fetchPages(memberId, 0);
      if (token !== this.timelineToken) return;
      this.appendEvents(memberId, fetched);
    } catch (err) {
      if (token !== this.timelineToken) return;
      const tl = this.state.timeline;
      if (tl) this.set({ timeline: { ...tl, phase: 'error', error: errorText(err, 'Không tải được dòng thời gian') } });
    }
  }

  /** Picks a member (their timeline loads) or `null` for none. Closes the open panel: it belongs to the previous member. */
  select(memberId: number | null): void {
    if (memberId === this.state.selectedId) return;
    this.timelineToken++;
    this.panelToken++;
    this.dropUndo();
    if (memberId === null) { this.set({ selectedId: null, timeline: null, panel: null, turnKey: null }); return; }
    if (this.state.detail.status === 'ended' || !this.state.detail.members.some(m => m.id === memberId)) return;
    this.inView = true;
    this.set({ selectedId: memberId, timeline: this.freshTimeline(memberId), panel: null, turnKey: null });
    void this.loadInitial(memberId, this.timelineToken);
  }

  retryTimeline(): void {
    const tl = this.state.timeline;
    if (!tl || tl.phase !== 'error') return;
    const token = ++this.timelineToken;
    this.set({ timeline: this.freshTimeline(tl.memberId) });
    void this.loadInitial(tl.memberId, token);
  }

  /** New events after the last one shown (on a signal). Skipped while another load of the same timeline is running. */
  private async refreshTimeline(): Promise<void> {
    const tl = this.state.timeline;
    if (!tl || this.state.detail.status === 'ended') return;
    if (tl.phase === 'error') { this.retryTimeline(); return; }
    if (tl.phase !== 'ready' || tl.loadingMore) return;
    const token = this.timelineToken;
    const lastId = tl.events[tl.events.length - 1]?.id ?? 0;
    // Start at the oldest request still "waiting": its answer is inferred from what came after it.
    const waiting = tl.events.find(e => e.kind === 'permission' && e.decision === 'pending');
    try {
      const fetched = await this.fetchPages(tl.memberId, waiting ? waiting.id - 1 : lastId);
      const now = this.state.timeline;
      // Drop the answer if another member was picked, or something else already appended after `lastId`.
      if (token !== this.timelineToken || !now || now.memberId !== tl.memberId || (now.events[now.events.length - 1]?.id ?? 0) !== lastId) return;
      this.appendEvents(tl.memberId, fetched);
    } catch { /* kept as it is; the next signal tries again */ }
  }

  /** "Tải thêm": the events beyond the page cap. */
  async loadMore(): Promise<void> {
    const tl = this.state.timeline;
    if (!tl || tl.phase !== 'ready' || !tl.hasMore || tl.loadingMore) return;
    const token = this.timelineToken;
    const lastId = tl.events[tl.events.length - 1]?.id ?? 0;
    this.set({ timeline: { ...tl, loadingMore: true, error: '' } });
    try {
      const fetched = await this.fetchPages(tl.memberId, lastId);
      if (token !== this.timelineToken) return;
      this.appendEvents(tl.memberId, fetched, true);
    } catch (err) {
      const now = this.state.timeline;
      if (token === this.timelineToken && now) this.set({ timeline: { ...now, loadingMore: false, error: errorText(err, 'Không tải thêm được') } });
    }
  }

  /**
   * A flag chip: jumps to the next event behind that flag (the first press goes to the first one), highlighting its row. The chip of
   * a day (`dayKey`) goes only through the events of that day.
   */
  jumpToFlag(code: FlagCode, dayKey?: string): void {
    const tl = this.state.timeline;
    const flag = tl?.flags.find(f => f.code === code);
    if (!tl || this.state.hidden) return;
    const places = placesByEvent(tl.events);
    const ids = evidenceOf(flag, tl.events).filter(id => dayKey === undefined || places.get(id)?.dayKey === dayKey);
    if (ids.length === 0) return;
    const at = tl.focusId === null ? -1 : ids.indexOf(tl.focusId);
    const id = ids[(at + 1) % ids.length]!;
    // A command sits in the popup of its prompt: open that one (a prompt itself is in the list).
    const target = tl.events.find(e => e.id === id);
    const key = target && target.kind !== 'prompt' ? turnKeyOf(tl.events, id) : null;
    // A folded day or block opens first, so the row exists when the page scrolls to it.
    this.set({ ...(key ? { turnKey: key } : {}), timeline: { ...this.showing(tl, places.get(id)), focusId: id, focusToken: tl.focusToken + 1 } });
  }

  /** The timeline with the day and the session block of `place` open (a folded one hides its rows, so they would not be there to scroll to). */
  private showing(tl: TimelineState, place: { dayKey: string; blockKey: string } | null | undefined): TimelineState {
    if (!place) return tl;
    return { ...tl, openDays: withDayOpen(tl.openDays, place.dayKey), openBlocks: withDayOpen(tl.openBlocks, place.blockKey) };
  }

  // ── The detail of one prompt (its commands, in a popup) ───────────────────────────────────────────

  /** Opens the popup with the commands under one prompt (`key` from `buildTimeline`). */
  openTurn(key: string): void {
    const tl = this.state.timeline;
    if (this.state.hidden || this.state.detail.status === 'ended' || !tl) return;
    this.set({ turnKey: key, timeline: this.showing(tl, placeOfTurn(tl.events, key)) });
  }

  /** Closes the popup, and the output panel that belongs to it. */
  closeTurn(): void {
    if (this.state.turnKey === null && this.state.panel === null) return;
    this.panelToken++;
    this.set({ turnKey: null, panel: null });
  }

  /** Following = the newest prompt is in view AND its day and block are open: a folded one shows no prompt, so nothing new would be seen. */
  private isFollowing(tl: TimelineState): boolean {
    const newest = newestPromptOf(tl.events);
    const place = newest ? placesByEvent(tl.events).get(newest.id) : undefined;
    const newestDay = dayGroupsOf(tl.events)[0]?.dayKey;
    // A day with a single block draws it open whatever `openBlocks` says (the light header cannot fold it).
    const lone = place ? dayGroupsOf(tl.events).find(g => g.dayKey === place.dayKey)?.blocks.length === 1 : false;
    const shown = place ? tl.openDays.includes(place.dayKey) && (lone || tl.openBlocks.includes(place.blockKey)) : newestDay === undefined || tl.openDays.includes(newestDay);
    return this.inView && shown;
  }

  /** The page reports, after every scroll, whether the newest prompt is in (or near) the viewport: "đang theo dõi". */
  reportFollowing(inView: boolean): void {
    this.inView = inView;
    const tl = this.state.timeline;
    // Called on every scroll and every render: the cheap check first, `isFollowing` rebuilds the day groups.
    if (tl && tl.newCount > 0 && this.isFollowing(tl)) this.set({ timeline: { ...tl, newCount: 0 } });
  }

  /** Brings the newest prompt into view, opening its day and block if they are folded. */
  jumpToLatest(): void {
    this.inView = true;
    const tl = this.state.timeline;
    if (!tl) return;
    const newest = newestPromptOf(tl.events);
    const place = newest ? placesByEvent(tl.events).get(newest.id) : undefined;
    const openDays = place ? tl.openDays : withDayOpen(tl.openDays, dayGroupsOf(tl.events)[0]?.dayKey ?? null);
    this.set({ timeline: { ...this.showing({ ...tl, openDays }, place), newCount: 0, followToken: tl.followToken + 1 } });
  }

  /** The "N prompt có mục mới" chip: opens the day and block of the turn `turnKey` (from `buildTimeline`) and scrolls to it. */
  revealTurn(turnKey: string): void {
    const tl = this.state.timeline;
    if (!tl) return;
    const place = placeOfTurn(tl.events, turnKey);
    const turn = place ? dayGroupsOf(tl.events).flatMap(g => turnsOfDay(g)).find(t => t.key === turnKey) : undefined;
    if (!place || !turn) return;
    this.inView = true;
    this.set({ timeline: { ...this.showing(tl, place), revealId: turn.prompt?.id ?? turn.firstId, revealToken: tl.revealToken + 1 } });
  }

  /** Opens or folds one day group. */
  toggleDay(dayKey: string): void {
    const tl = this.state.timeline;
    if (!tl) return;
    const openDays = tl.openDays.includes(dayKey) ? tl.openDays.filter(k => k !== dayKey) : [...tl.openDays, dayKey];
    this.set({ timeline: { ...tl, openDays } });
  }

  /** "Song song với phiên M": opens the block `blockKey` (and its day) and asks the page to scroll to it. */
  revealBlock(blockKey: string): void {
    const tl = this.state.timeline;
    if (!tl) return;
    const group = dayGroupsOf(tl.events).find(g => g.blocks.some(b => b.key === blockKey));
    if (!group) return;
    this.set({ timeline: { ...this.showing(tl, { dayKey: group.dayKey, blockKey }), revealBlockKey: blockKey, revealBlockToken: tl.revealBlockToken + 1 } });
  }

  /** Opens or folds one session block. */
  toggleBlock(blockKey: string): void {
    const tl = this.state.timeline;
    if (!tl) return;
    const openBlocks = tl.openBlocks.includes(blockKey) ? tl.openBlocks.filter(k => k !== blockKey) : [...tl.openBlocks, blockKey];
    this.set({ timeline: { ...tl, openBlocks } });
  }

  /** "Mở tất cả" / "Thu tất cả": every day and every session block (PRODUCT.md §7.38b). */
  setAllOpen(open: boolean): void {
    const tl = this.state.timeline;
    if (!tl) return;
    const groups = dayGroupsOf(tl.events);
    this.set({ timeline: { ...tl, openDays: open ? groups.map(g => g.dayKey) : [], openBlocks: open ? groups.flatMap(g => g.blocks.map(b => b.key)) : [] } });
  }

  // ── What the mentor has read (S43, PRODUCT.md §7.38d) ───────────────────────────────────────────────

  /** The page read a turn (2 seconds in view): everything in it up to `maxId` counts as read. Ignored while the content is hidden. */
  markTurnRead(turnReadKeyValue: string, maxId: number): void {
    const tl = this.state.timeline;
    if (!tl || this.state.hidden || this.state.detail.status === 'ended') return;
    const turn = this.allTurns(tl).find(t => turnReadKey(t) === turnReadKeyValue);
    if (turn) this.setRead(markTurnsRead(this.state.read, tl.memberId, [{ turn, maxId }]));
  }

  private allTurns(tl: TimelineState): Turn[] {
    return dayGroupsOf(tl.events).flatMap(g => turnsOfDay(g));
  }

  /** "Đánh dấu đã đọc hết" for the member being viewed: every loaded turn is read. "Hoàn tác" (`undoMarkAllRead`) puts the record back for `UNDO_MS`. */
  markAllRead(): void {
    const tl = this.state.timeline;
    const member = tl && this.state.detail.members.find(m => m.id === tl.memberId);
    if (!tl || !member || this.state.hidden || this.state.detail.status === 'ended') return;
    const next = markAllRead(this.state.read, member, this.allTurns(tl), !tl.hasMore);
    if (next === this.state.read) return;
    this.undoRecord = this.state.read.members[String(member.id)];
    clearTimeout(this.undoTimer);
    this.undoTimer = setTimeout(() => this.dropUndo(), UNDO_MS);
    this.readStore.save(this.state.detail.id, next);
    this.set({ read: next, undo: { memberId: member.id } });
  }

  undoMarkAllRead(): void {
    const undo = this.state.undo;
    if (!undo) return;
    const restored = restoreMemberRead(this.state.read, undo.memberId, this.undoRecord);
    this.dropUndo();
    this.setRead(restored);
  }

  /** Forgets the undo (its time is up, or another member was picked). */
  private dropUndo(): void {
    clearTimeout(this.undoTimer);
    this.undoTimer = undefined;
    this.undoRecord = undefined;
    if (this.state.undo) this.set({ undo: null });
  }

  /** Stops the timers of the controller when the page goes away. */
  dispose(): void {
    clearTimeout(this.undoTimer);
    this.undoTimer = undefined;
  }

  // ── The output / change panel ──────────────────────────────────────────────────────────────────

  /** Fetches the output or the change of one command (never before the mentor asks). */
  async openDetail(eventId: number, kind: PanelKind): Promise<void> {
    if (this.state.detail.status === 'ended') return;
    const token = ++this.panelToken;
    this.set({ panel: { eventId, kind, phase: 'loading', clip: null, error: '' } });
    try {
      const d = await this.gateway.eventDetail(this.state.detail.id, eventId);
      if (token !== this.panelToken) return;
      this.set({ panel: { eventId, kind, phase: 'ready', clip: d[kind], error: '' } });
    } catch (err) {
      if (token !== this.panelToken) return;
      this.set({ panel: { eventId, kind, phase: 'error', clip: null, error: errorText(err, 'Không tải được nội dung') } });
    }
  }

  retryPanel(): void {
    const p = this.state.panel;
    if (p) void this.openDetail(p.eventId, p.kind);
  }

  closePanel(): void {
    this.panelToken++;
    if (this.state.panel) this.set({ panel: null });
  }

  /** J / K: the next / previous command that has something to open. Keeps the kind (output or change) when the new one has it. */
  step(direction: 1 | -1): void {
    const p = this.state.panel;
    const tl = this.state.timeline;
    if (!p || !tl) return;
    const target = stepEvent(tl.events, p.eventId, direction);
    if (!target) return;
    const kind: PanelKind = p.kind === 'output' ? (target.hasOutput ? 'output' : 'change') : (target.hasChange ? 'change' : 'output');
    const key = turnKeyOf(tl.events, target.id);
    if (key !== null && key !== this.state.turnKey) this.set({ turnKey: key });
    const place = placesByEvent(tl.events).get(target.id);
    if (place && (!tl.openDays.includes(place.dayKey) || !tl.openBlocks.includes(place.blockKey))) this.set({ timeline: this.showing(tl, place) });
    void this.openDetail(target.id, kind);
  }

  // ── Marks, notes and the report (S40) ─────────────────────────────────────────────────────────────

  /** Picks or drops a row as an example for the report. The row changes at once; if the server says no it goes back and `markError` says why. */
  async toggleMark(eventId: number): Promise<void> {
    const tl = this.state.timeline;
    const event = tl?.events.find(e => e.id === eventId);
    if (!tl || !event || this.state.detail.status === 'ended') return;
    const marked = !event.marked;
    const memberId = tl.memberId;
    const setMarked = (value: boolean) => {
      const now = this.state.timeline;
      if (!now || now.memberId !== memberId) return;
      this.set({ timeline: { ...now, events: now.events.map(e => (e.id === eventId ? { ...e, marked: value } : e)) } });
    };
    setMarked(marked);
    try {
      await this.gateway.mark(this.state.detail.id, eventId, marked);
      if (this.state.markError) this.set({ markError: '' });
      void this.refresh(); // the member's marked count is on the training
    } catch (err) {
      setMarked(!marked);
      this.set({ markError: errorText(err, marked ? 'Không đánh dấu được' : 'Không bỏ đánh dấu được') });
    }
  }

  /** The mentor's note for a member. Answers with the reason it failed, or null when it was saved. */
  async saveNote(memberId: number, note: string): Promise<string | null> {
    if (this.state.detail.status === 'ended') return 'Buổi training đã kết thúc';
    try {
      await this.gateway.saveNote(this.state.detail.id, memberId, note);
    } catch (err) {
      return errorText(err, 'Không lưu được ghi chú');
    }
    // The row on screen shows the new note without waiting for the reload.
    const members = this.state.detail.members.map(m => (m.id === memberId ? { ...m, mentorNote: note.trim() === '' ? null : note.trim() } : m));
    this.set({ detail: { ...this.state.detail, members } });
    void this.refresh();
    return null;
  }

  /** Opens the report dialog with the preview. The preview is the text the file will carry; it is not an export. */
  async openReport(): Promise<void> {
    if (this.state.detail.status === 'ended') return;
    const token = ++this.reportToken;
    this.exportToken++;
    this.teachingToken++;
    this.set({ dataExport: null, teachingEdit: null, teachingReview: null, report: { phase: 'loading', text: '', error: '', saving: false, saved: false } });
    try {
      const text = await this.gateway.reportPreview(this.state.detail.id);
      if (token !== this.reportToken) return;
      this.set({ report: { phase: 'ready', text, error: '', saving: false, saved: false } });
    } catch (err) {
      if (token !== this.reportToken) return;
      this.set({ report: { phase: 'error', text: '', error: errorText(err, 'Không dựng được báo cáo'), saving: false, saved: false } });
    }
  }

  closeReport(): void {
    this.reportToken++;
    if (this.state.report) this.set({ report: null });
  }

  /** "Tải file": asks the server for the file (it records the export), then hands it to the browser. */
  async downloadReport(): Promise<void> {
    const r = this.state.report;
    if (!r || r.phase !== 'ready' || r.saving) return;
    const token = this.reportToken;
    this.set({ report: { ...r, saving: true, error: '' } });
    try {
      const text = await this.gateway.exportReport(this.state.detail.id);
      if (token !== this.reportToken) return;
      this.saveFile(reportFileName(this.state.detail.name), text);
      this.set({ report: { phase: 'ready', text, error: '', saving: false, saved: true } });
      void this.refresh(); // `reportExportedAt` changed
    } catch (err) {
      if (token !== this.reportToken) return;
      const now = this.state.report;
      if (now) this.set({ report: { ...now, saving: false, error: errorText(err, 'Không tải được file') } });
    }
  }

  // ── Export the raw data for the mentor's own AI (S41) ─────────────────────────────────────────────

  /** Opens the dialog on "Hôm nay" and the whole class, and asks the server what that holds. */
  openDataExport(): void {
    if (this.state.detail.status === 'ended') return;
    this.reportToken++;
    const dataExport: DataExportState = { mode: 'today', from: '', to: '', memberIds: null, phase: 'loading', summary: null, error: '', saveError: '', saving: false, saved: false };
    this.teachingToken++;
    this.set({ report: null, teachingEdit: null, teachingReview: null, dataExport });
    void this.reloadDataExport();
  }

  closeDataExport(): void {
    this.exportToken++;
    if (this.state.dataExport) this.set({ dataExport: null });
  }

  /** Leaving "Hôm nay" starts from the day the server counted as today, so the mentor edits a real date instead of typing one. */
  setDataExportMode(mode: ExportMode): void {
    const d = this.state.dataExport;
    if (!d || d.saving || mode === d.mode) return;
    const from = d.from || d.summary?.from || '';
    const to = mode === 'range' ? (d.to && d.to >= from ? d.to : from) : d.to;
    this.changeDataExport({ mode, from, to });
  }

  setDataExportFrom(from: string): void {
    const d = this.state.dataExport;
    if (!d || d.saving) return;
    // A start after the end would be refused: the end follows it.
    this.changeDataExport({ from, to: d.mode === 'range' && from && d.to && d.to < from ? from : d.to });
  }

  setDataExportTo(to: string): void {
    const d = this.state.dataExport;
    if (!d || d.saving) return;
    this.changeDataExport({ to });
  }

  /** "Cả lớp" or "Chọn bạn" (everyone starts ticked, so the mentor only unticks). */
  setDataExportAllMembers(all: boolean): void {
    const d = this.state.dataExport;
    if (!d || d.saving || (d.memberIds === null) === all) return;
    this.changeDataExport({ memberIds: all ? null : this.state.detail.members.map(m => m.id) });
  }

  toggleDataExportMember(memberId: number): void {
    const d = this.state.dataExport;
    if (!d || d.saving || d.memberIds === null) return;
    this.changeDataExport({ memberIds: d.memberIds.includes(memberId) ? d.memberIds.filter(id => id !== memberId) : [...d.memberIds, memberId] });
  }

  /** "Thử lại" after counting failed. */
  retryDataExport(): void {
    if (this.state.dataExport?.phase === 'error') void this.reloadDataExport();
  }

  private changeDataExport(patch: Partial<DataExportState>): void {
    const d = this.state.dataExport;
    if (!d) return;
    this.set({ dataExport: { ...d, ...patch, saved: false, saveError: '' } });
    void this.reloadDataExport();
  }

  /** Counts what the current choice holds. A choice that cannot be exported is not sent to the server; the answer of an older choice is dropped. */
  private async reloadDataExport(): Promise<void> {
    const token = ++this.exportToken;
    const d = this.state.dataExport;
    if (!d) return;
    // A member who left the training since the box was ticked would make the server refuse the whole request.
    const here = new Set(this.state.detail.members.map(m => m.id));
    const memberIds = d.memberIds === null ? null : d.memberIds.filter(id => here.has(id));
    const problem = exportInputError(d.mode, d.from, d.to, memberIds);
    if (problem) {
      this.set({ dataExport: { ...d, memberIds, phase: 'ready', summary: null, error: problem } });
      return;
    }
    this.set({ dataExport: { ...d, memberIds, phase: 'loading', error: '' } });
    try {
      const summary = await this.gateway.exportSummary(this.state.detail.id, paramsFor(d.mode, d.from, d.to, memberIds));
      if (token !== this.exportToken || !this.state.dataExport) return;
      this.set({ dataExport: { ...this.state.dataExport, phase: 'ready', summary, error: '' } });
    } catch (err) {
      if (token !== this.exportToken || !this.state.dataExport) return;
      this.set({ dataExport: { ...this.state.dataExport, phase: 'error', summary: null, error: errorText(err, 'Không đếm được dữ liệu') } });
    }
  }

  /** "Tải file .zip": builds the zip on the server and hands it to the browser. Not the report: nothing is recorded as exported. */
  async downloadDataExport(): Promise<void> {
    const d = this.state.dataExport;
    const summary = d?.summary;
    if (!d || !summary || d.phase !== 'ready' || d.saving || d.error || summary.eventCount === 0 || summary.tooLarge) return;
    const token = ++this.exportToken;
    this.set({ dataExport: { ...d, saving: true, saveError: '' } });
    try {
      // The days the server counted, so a dialog left open past midnight still downloads what it showed.
      const blob = await this.gateway.exportData(this.state.detail.id, paramsFor('range', summary.from, summary.to, d.memberIds));
      if (token !== this.exportToken || !this.state.dataExport) return;
      this.saveBlob(exportFileName(this.state.detail.name, summary.from, summary.to), blob);
      this.set({ dataExport: { ...this.state.dataExport, saving: false, saved: true, saveError: '' } });
    } catch (err) {
      if (token !== this.exportToken || !this.state.dataExport) return;
      this.set({ dataExport: { ...this.state.dataExport, saving: false, saveError: errorText(err, 'Không tải được file') } });
    }
  }

  // ── Teaching examples for the next course (S44, PRODUCT.md §7.39) ───────────────────────────────────

  /** Opens the dialog of a prompt of the open timeline. Does nothing for a member who did not agree (the button is locked) or an ended training. */
  openTeaching(eventId: number): void {
    const tl = this.state.timeline;
    const event = tl?.events.find(e => e.id === eventId && e.kind === 'prompt');
    const member = this.state.detail.members.find(m => m.id === tl?.memberId);
    if (!tl || !event || !member || this.state.detail.status === 'ended' || teachingLockReason(member)) return;
    const token = ++this.teachingToken;
    this.reportToken++;
    this.exportToken++;
    const exists = event.teachingExample !== null;
    const edit: TeachingEditState = {
      eventId, memberName: member.displayName, prompt: event.prompt ?? '', exists, phase: exists ? 'loading' : 'ready',
      form: emptyTeachingForm(), edited: { editedPrompt: null, editedContext: null }, saving: false, error: '',
    };
    this.set({ report: null, dataExport: null, teachingReview: null, teachingEdit: edit });
    if (exists) void this.loadTeaching(eventId, token);
  }

  private async loadTeaching(eventId: number, token: number): Promise<void> {
    try {
      const row = (await this.gateway.teachingExamples(this.state.detail.id)).find(r => r.eventId === eventId);
      const edit = this.state.teachingEdit;
      if (token !== this.teachingToken || !edit) return;
      if (!row) { this.set({ teachingEdit: { ...edit, exists: false, phase: 'ready' } }); return; } // dropped meanwhile: starts empty
      this.set({ teachingEdit: { ...edit, phase: 'ready', form: formFromRow(row), edited: { editedPrompt: row.editedPrompt, editedContext: row.editedContext } } });
    } catch (err) {
      const edit = this.state.teachingEdit;
      if (token !== this.teachingToken || !edit) return;
      this.set({ teachingEdit: { ...edit, phase: 'error', error: errorText(err, 'Không tải được ví dụ') } });
    }
  }

  retryTeaching(): void {
    const edit = this.state.teachingEdit;
    if (!edit || edit.phase !== 'error') return;
    this.set({ teachingEdit: { ...edit, phase: 'loading', error: '' } });
    void this.loadTeaching(edit.eventId, this.teachingToken);
  }

  closeTeaching(): void {
    const edit = this.state.teachingEdit;
    if (!edit || edit.saving) return;
    this.teachingToken++;
    this.set({ teachingEdit: null });
  }

  setTeachingForm(patch: Partial<TeachingForm>): void {
    const edit = this.state.teachingEdit;
    if (!edit || edit.saving || edit.phase !== 'ready') return;
    this.set({ teachingEdit: { ...edit, form: { ...edit.form, ...patch }, error: '' } });
  }

  /** The row of the timeline shows the example's label (or none) at once, without waiting for the reload. */
  private showTeachingOnRow(eventId: number, example: TrainingEventRow['teachingExample']): void {
    const tl = this.state.timeline;
    if (!tl) return;
    this.set({ timeline: { ...tl, events: tl.events.map(e => (e.id === eventId ? { ...e, teachingExample: example } : e)) } });
  }

  /** "Lưu ví dụ". The form's own rules are checked first; the server's answer (e.g. the member did not agree) is shown in the dialog. */
  async saveTeaching(): Promise<void> {
    const edit = this.state.teachingEdit;
    if (!edit || edit.saving || edit.phase !== 'ready' || teachingFormError(edit.form)) return;
    const token = this.teachingToken;
    this.set({ teachingEdit: { ...edit, saving: true, error: '' } });
    try {
      const row = await this.gateway.saveTeachingExample(this.state.detail.id, edit.eventId, teachingBody(edit.form, edit.edited));
      this.showTeachingOnRow(edit.eventId, { label: row.label });
      if (token === this.teachingToken) this.set({ teachingEdit: null });
      void this.refresh();
    } catch (err) {
      const now = this.state.teachingEdit;
      if (token !== this.teachingToken || !now) return;
      this.set({ teachingEdit: { ...now, saving: false, error: errorText(err, 'Không lưu được ví dụ') } });
    }
  }

  /** "Bỏ ví dụ". */
  async removeTeaching(): Promise<void> {
    const edit = this.state.teachingEdit;
    if (!edit || edit.saving || !edit.exists) return;
    const token = this.teachingToken;
    this.set({ teachingEdit: { ...edit, saving: true, error: '' } });
    try {
      await this.gateway.deleteTeachingExample(this.state.detail.id, edit.eventId);
      this.showTeachingOnRow(edit.eventId, null);
      if (token === this.teachingToken) this.set({ teachingEdit: null });
      void this.refresh();
    } catch (err) {
      const now = this.state.teachingEdit;
      if (token !== this.teachingToken || !now) return;
      this.set({ teachingEdit: { ...now, saving: false, error: errorText(err, 'Không bỏ được ví dụ') } });
    }
  }

  /** Opens the review screen and loads every example with its prompt and context. */
  async openTeachingReview(): Promise<void> {
    if (this.state.detail.status === 'ended') return;
    const token = ++this.teachingToken;
    this.reportToken++;
    this.exportToken++;
    const fresh: TeachingReviewState = { phase: 'loading', items: [], selectedId: null, error: '', saving: false, saved: false, saveError: '' };
    this.set({ report: null, dataExport: null, teachingEdit: null, teachingReview: fresh });
    try {
      const rows = await this.gateway.teachingExamples(this.state.detail.id);
      if (token !== this.teachingToken) return;
      const items = sortReviewItems(rows.map(reviewItemOf));
      this.set({ teachingReview: { ...fresh, phase: 'ready', items, selectedId: (items.find(i => !i.reviewed) ?? items[0])?.eventId ?? null } });
    } catch (err) {
      if (token !== this.teachingToken) return;
      this.set({ teachingReview: { ...fresh, phase: 'error', error: errorText(err, 'Không tải được các ví dụ') } });
    }
  }

  closeTeachingReview(): void {
    this.teachingToken++;
    if (this.state.teachingReview) this.set({ teachingReview: null });
  }

  private changeReviewItem(eventId: number, change: (i: ReviewItem) => ReviewItem, rest: Partial<TeachingReviewState> = {}): void {
    const r = this.state.teachingReview;
    if (!r || r.phase !== 'ready') return;
    this.set({ teachingReview: { ...r, ...rest, items: r.items.map(i => (i.eventId === eventId ? change(i) : i)) } });
  }

  /** Any edit takes the item back to "chưa rà" at once (the server does the same when the edit is saved): what was reviewed is no longer what would be written. */
  private edit(eventId: number, patch: Partial<ReviewItem>): void {
    this.changeReviewItem(eventId, i => ({ ...i, ...patch, reviewed: false, error: '' }), { saved: false, saveError: '' });
  }

  editReviewPrompt(eventId: number, text: string): void { this.edit(eventId, { promptDraft: text }); }
  editReviewComment(eventId: number, text: string): void { this.edit(eventId, { commentDraft: text }); }
  editReviewBetter(eventId: number, text: string): void { this.edit(eventId, { betterDraft: text }); }
  editReviewContext(eventId: number, text: string): void { this.edit(eventId, { contextDraft: text }); }

  /** "Khôi phục bản app đã che": prompt and context go back to the masked original (and are saved so). */
  resetReviewItem(eventId: number): void {
    this.edit(eventId, {});
    this.changeReviewItem(eventId, i => ({ ...i, promptDraft: i.defaultPrompt, contextDraft: i.defaultContext }));
    void this.commitReviewItem(eventId);
  }

  selectReviewItem(eventId: number): void {
    const r = this.state.teachingReview;
    if (r && r.phase === 'ready' && r.items.some(i => i.eventId === eventId) && r.selectedId !== eventId) {
      void this.commitReviewItem(r.selectedId ?? -1); // leaving an example saves what was typed there
      this.set({ teachingReview: { ...r, selectedId: eventId } });
    }
  }

  /** "Trước" / "Sau": the neighbour in the list. */
  stepReview(delta: -1 | 1): void {
    const r = this.state.teachingReview;
    if (!r || r.phase !== 'ready') return;
    const at = r.items.findIndex(i => i.eventId === r.selectedId);
    const next = r.items[at + delta];
    if (next) this.selectReviewItem(next.eventId);
  }

  /** "Thay bằng [bạn]": every whole-word place of the name in this example's four texts (same accents, any case), saved at once. */
  replaceReviewName(eventId: number, name: string): void {
    this.edit(eventId, {});
    this.changeReviewItem(eventId, i => ({
      ...i,
      promptDraft: replaceName(i.promptDraft, name, NAME_PLACEHOLDER), contextDraft: replaceName(i.contextDraft, name, NAME_PLACEHOLDER),
      commentDraft: replaceName(i.commentDraft, name, NAME_PLACEHOLDER), betterDraft: replaceName(i.betterDraft, name, NAME_PLACEHOLDER),
    }));
    void this.commitReviewItem(eventId);
  }

  /** "Không phải tên": the warning for this name goes away for this example (in this browser only; nothing is sent). */
  dismissReviewName(eventId: number, name: string): void {
    this.changeReviewItem(eventId, i => ({ ...i, dismissed: [...i.dismissed, name] }));
  }

  /**
   * Saves the edits of one example (the text box lost focus). Answers true when it is saved or there was nothing to save. Saves of one
   * example run one after the other: a click on "Đã rà ví dụ này" right after typing waits for the save the blur started, it is not lost.
   */
  commitReviewItem(eventId: number): Promise<boolean> {
    const before = this.commits.get(eventId);
    const run = (async () => {
      if (before) await before;
      return this.commitNow(eventId);
    })();
    this.commits.set(eventId, run);
    void run.finally(() => { if (this.commits.get(eventId) === run) this.commits.delete(eventId); });
    return run;
  }

  private async commitNow(eventId: number): Promise<boolean> {
    const item = this.state.teachingReview?.items.find(i => i.eventId === eventId);
    if (!item) return true;
    if (!isDirty(item)) return true;
    if (draftTooLong(item)) { this.changeReviewItem(eventId, i => ({ ...i, error: 'Văn bản quá dài (tối đa 4000 ký tự), hãy rút gọn' })); return false; }
    const textError = draftTextError(item);
    if (textError) { this.changeReviewItem(eventId, i => ({ ...i, error: textError })); return false; }
    const token = this.teachingToken;
    const sent = item;
    this.changeReviewItem(eventId, i => ({ ...i, saving: true, error: '' }));
    try {
      await this.gateway.saveTeachingExample(this.state.detail.id, eventId, reviewBody(sent));
      if (token !== this.teachingToken) return true;
      this.changeReviewItem(eventId, i => ({ ...i, saving: false, reviewed: false, savedPrompt: editedPromptOf(sent), savedContext: editedContextOf(sent), comment: sent.commentDraft.trim(), betterPrompt: betterOf(sent) }));
      void this.refresh(); // `unexportedExampleCount` on the training changed
      return true;
    } catch (err) {
      if (token !== this.teachingToken) return false;
      this.changeReviewItem(eventId, i => ({ ...i, saving: false, error: errorText(err, 'Không lưu được bản sửa') }));
      return false;
    }
  }

  /** "Đã rà ví dụ này, sang tiếp": saves the edits (after any save already running), marks it reviewed on the server, then goes to the next example not reviewed yet (wrapping round). */
  async markReviewed(eventId: number): Promise<void> {
    if (!this.state.teachingReview?.items.some(i => i.eventId === eventId) || this.marking.has(eventId)) return;
    this.marking.add(eventId);
    try {
      if (!(await this.commitReviewItem(eventId))) return;
      const token = this.teachingToken;
      this.changeReviewItem(eventId, i => ({ ...i, saving: true, error: '' }));
      try {
        await this.gateway.setTeachingReviewed(this.state.detail.id, eventId, true);
      } catch (err) {
        if (token === this.teachingToken) this.changeReviewItem(eventId, i => ({ ...i, saving: false, error: errorText(err, 'Không lưu được trạng thái đã rà') }));
        return;
      }
      if (token !== this.teachingToken) return;
      this.changeReviewItem(eventId, i => ({ ...i, saving: false, reviewed: true }), { saved: false, saveError: '' });
      const r = this.state.teachingReview;
      if (!r) return;
      const at = r.items.findIndex(i => i.eventId === eventId);
      const next = [...r.items.slice(at + 1), ...r.items.slice(0, at)].find(i => !i.reviewed);
      if (next) this.set({ teachingReview: { ...r, selectedId: next.eventId } });
    } finally {
      this.marking.delete(eventId);
    }
  }

  /** Takes "đã rà" back (the file is locked again until it is marked once more). */
  async unmarkReviewed(eventId: number): Promise<void> {
    const item = this.state.teachingReview?.items.find(i => i.eventId === eventId);
    if (!item || item.saving || !item.reviewed) return;
    const token = this.teachingToken;
    this.changeReviewItem(eventId, i => ({ ...i, saving: true, error: '' }));
    try {
      await this.gateway.setTeachingReviewed(this.state.detail.id, eventId, false);
      if (token === this.teachingToken) this.changeReviewItem(eventId, i => ({ ...i, saving: false, reviewed: false }), { saved: false, saveError: '' });
    } catch (err) {
      if (token === this.teachingToken) this.changeReviewItem(eventId, i => ({ ...i, saving: false, error: errorText(err, 'Không lưu được trạng thái đã rà') }));
    }
  }

  /** "Tải file .md": only when every example is reviewed (the server checks too: 400 `examples_not_reviewed`). Not the report. */
  async downloadTeaching(): Promise<void> {
    const r = this.state.teachingReview;
    if (!r || r.phase !== 'ready' || r.saving || r.items.length === 0 || r.items.some(i => !i.reviewed || i.saving) || this.state.hidden) return;
    const token = this.teachingToken;
    this.set({ teachingReview: { ...r, saving: true, saveError: '' } });
    let unsaved = 0;
    for (const item of r.items) if (!(await this.commitReviewItem(item.eventId))) unsaved++;
    if (token !== this.teachingToken) return;
    if (unsaved > 0) {
      const now = this.state.teachingReview;
      if (now) this.set({ teachingReview: { ...now, saving: false, saveError: `Chưa lưu được bản sửa của ${unsaved} ví dụ. Xem lỗi ở từng ví dụ rồi tải lại.` } });
      return;
    }
    try {
      const text = await this.gateway.exportTeachingExamples(this.state.detail.id);
      if (token !== this.teachingToken) return;
      this.saveFile(teachingFileName(this.state.detail.name), text);
      const now = this.state.teachingReview;
      if (now) this.set({ teachingReview: { ...now, saving: false, saved: true, saveError: '' } });
      void this.refresh(); // `unexportedExampleCount` changed
    } catch (err) {
      const now = this.state.teachingReview;
      if (token !== this.teachingToken || !now) return;
      this.set({ teachingReview: { ...now, saving: false, saveError: errorText(err, 'Không tải được file') } });
    }
  }

  /** From the "Kết thúc" prompt: back out of it and open the examples export instead (S44). */
  exportExamplesBeforeEnding(): void {
    this.cancelConfirm();
    void this.openTeachingReview();
  }

  /** From the "Kết thúc" prompt: back out of it and open the report instead. */
  exportBeforeEnding(): void {
    this.cancelConfirm();
    void this.openReport();
  }

  // ── Hiding content ──────────────────────────────────────────────────────────────────────────────

  setHidden(hidden: boolean): void {
    if (hidden === this.state.hidden) return;
    this.gateway.writeHideContent(hidden);
    if (hidden) { this.panelToken++; this.set({ hidden, panel: null, turnKey: null }); } else this.set({ hidden });
  }
  toggleHidden(): void { this.setHidden(!this.state.hidden); }

  // ── Stop / end / remove (each behind a confirmation) ─────────────────────────────────────────────

  askStop(): void { if (this.state.detail.status === 'open') this.set({ confirm: { kind: 'stop' }, actionError: '' }); }
  /** Opens the prompt at once and reloads the training under it: `unexportedExampleCount` may have changed by edits on the review screen, and a stopped training has no live signal to say so. */
  askEnd(): void {
    if (this.state.detail.status !== 'stopped') return;
    this.set({ confirm: { kind: 'end' }, actionError: '' });
    void this.refresh();
  }
  askRemove(memberId: number): void {
    const m = this.state.detail.members.find(x => x.id === memberId);
    if (m && this.state.detail.status !== 'ended') this.set({ confirm: { kind: 'remove', memberId, name: m.displayName }, actionError: '' });
  }
  /** "Duyệt xoá": only for a member who stopped sending themselves. */
  askPurge(memberId: number): void {
    const m = this.state.detail.members.find(x => x.id === memberId);
    if (m?.stoppedSending && this.state.detail.status !== 'ended') this.set({ confirm: { kind: 'purge', memberId, name: m.displayName }, actionError: '' });
  }
  cancelConfirm(): void { if (!this.state.working) this.set({ confirm: null, actionError: '' }); }

  /** Runs the confirmed action once. A second call while it runs does nothing. */
  async confirm(): Promise<void> {
    const c = this.state.confirm;
    if (!c || this.state.working) return;
    const id = this.state.detail.id;
    this.set({ working: true, actionError: '' });
    try {
      if (c.kind === 'remove' || c.kind === 'purge') {
        await (c.kind === 'remove' ? this.gateway.removeMember(id, c.memberId) : this.gateway.purgeMember(id, c.memberId));
        if (this.state.selectedId === c.memberId) this.select(null);
        this.set({ working: false, confirm: null });
        await this.refresh();
        return;
      }
      const detail = c.kind === 'stop' ? await this.gateway.stop(id) : await this.gateway.end(id);
      this.detailGen++; // a reload that started before this answer would bring older data
      this.set({ working: false, confirm: null });
      this.applyDetail(detail);
      if (this.state.offline) this.set({ offline: false });
    } catch (err) {
      this.set({ working: false, actionError: errorText(err, c.kind === 'stop' ? 'Không dừng thu được' : c.kind === 'end' ? 'Không kết thúc được' : c.kind === 'purge' ? 'Không xoá được dữ liệu' : 'Không mời ra được') });
      void this.refresh(); // a 409 means the training is not what the page thought: look again
    }
  }
}
