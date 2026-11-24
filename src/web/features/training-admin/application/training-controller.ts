import type { Clip, FlagCode, MemberFlag, TrainingDetail, TrainingEventRow, TrainingExportSummary } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { announcementFor } from '../domain/announcements.js';
import { dayGroupsOf, dayKeyOfEvent, dayKeyOfTurn, dayKeysByEvent, reconcileOpenDays, withDayOpen } from '../domain/day-groups.js';
import { exportFileName, exportInputError, paramsFor, type ExportMode } from '../domain/export.js';
import { evidenceOf } from '../domain/flags.js';
import { reportFileName } from '../domain/report.js';
import { stepEvent, turnKeyOf } from '../domain/timeline.js';
import type { TrainingAdminGateway } from './training-admin-gateway.js';

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
  /** The flags of this member's whole timeline, each with the events behind it (from the server). */
  flags: MemberFlag[];
  /** The event a flag chip last jumped to: drawn highlighted; `focusToken` changes on every jump so the page scrolls even to the same row. */
  focusId: number | null;
  focusToken: number;
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
  /** The prompt whose commands are open in the popup (key from `buildTimeline`), or null. */
  turnKey: string | null;
  /** Why the last mark / unmark failed (the row went back to how it was). Cleared by the next one that works. */
  markError: string;
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
  private reportToken = 0; // bumped on every open / close of the report dialog
  private exportToken = 0; // bumped on every change of what the data export dialog shows, and on close
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
    const id = opts.initialMemberId ?? null;
    const known = id !== null && initial.status !== 'ended' && initial.members.some(m => m.id === id);
    this.state = {
      detail: initial, selectedId: known ? id : null, timeline: known ? this.freshTimeline(id) : null, panel: null, confirm: null,
      working: false, actionError: '', hidden: gateway.readHideContent(), offline: false, announcement: '', endedMemberCount: null, report: null, dataExport: null, turnKey: null, markError: '',
    };
  }

  getState = (): TrainingState => this.state;
  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  private set(patch: Partial<TrainingState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }
  private freshTimeline(memberId: number): TimelineState {
    return { memberId, events: [], hasMore: false, phase: 'loading', loadingMore: false, error: '', newCount: 0, followToken: 0, openDays: [], knownDays: [], flags: [], focusId: null, focusToken: 0 };
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
    if (next.status === 'ended') { this.panelToken++; this.reportToken++; this.exportToken++; patch.panel = null; patch.turnKey = null; patch.report = null; patch.dataExport = null; }
    if (this.state.confirm && !this.state.working && !confirmStillMakesSense(this.state.confirm, next)) patch.confirm = null;
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
    const days = fresh.length > 0 ? reconcileOpenDays({ open: tl.openDays, known: tl.knownDays }, dayGroupsOf(events).map(g => g.dayKey)) : { open: tl.openDays, known: tl.knownDays };
    this.set({ timeline: { ...tl, events, hasMore: fetched.hasMore, flags: fetched.flags, phase: 'ready', loadingMore: false, error: '', newCount, followToken, openDays: days.open, knownDays: days.known } });
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
    const days = dayKeysByEvent(tl.events);
    const ids = evidenceOf(flag, tl.events).filter(id => dayKey === undefined || days.get(id) === dayKey);
    if (ids.length === 0) return;
    const at = tl.focusId === null ? -1 : ids.indexOf(tl.focusId);
    const id = ids[(at + 1) % ids.length]!;
    // A command sits in the popup of its prompt: open that one (a prompt itself is in the list).
    const target = tl.events.find(e => e.id === id);
    const key = target && target.kind !== 'prompt' ? turnKeyOf(tl.events, id) : null;
    // A folded day opens first, so the row exists when the page scrolls to it.
    const openDays = withDayOpen(tl.openDays, days.get(id) ?? null);
    this.set({ ...(key ? { turnKey: key } : {}), timeline: { ...tl, openDays, focusId: id, focusToken: tl.focusToken + 1 } });
  }

  // ── The detail of one prompt (its commands, in a popup) ───────────────────────────────────────────

  /** Opens the popup with the commands under one prompt (`key` from `buildTimeline`). */
  openTurn(key: string): void {
    const tl = this.state.timeline;
    if (this.state.hidden || this.state.detail.status === 'ended' || !tl) return;
    this.set({ turnKey: key, timeline: { ...tl, openDays: withDayOpen(tl.openDays, dayKeyOfTurn(tl.events, key)) } });
  }

  /** Closes the popup, and the output panel that belongs to it. */
  closeTurn(): void {
    if (this.state.turnKey === null && this.state.panel === null) return;
    this.panelToken++;
    this.set({ turnKey: null, panel: null });
  }

  /** Following = the newest event is in view AND its day is open: a folded day shows no event, so nothing new would be seen. */
  private isFollowing(tl: TimelineState): boolean {
    const newest = dayGroupsOf(tl.events)[0]?.dayKey;
    return this.inView && (newest === undefined || tl.openDays.includes(newest));
  }

  /** The page reports, after every scroll, whether the newest event is in (or near) the viewport: "đang theo dõi". */
  reportFollowing(inView: boolean): void {
    this.inView = inView;
    const tl = this.state.timeline;
    // Called on every scroll and every render: the cheap check first, `isFollowing` rebuilds the day groups.
    if (tl && tl.newCount > 0 && this.isFollowing(tl)) this.set({ timeline: { ...tl, newCount: 0 } });
  }

  /** The "N sự kiện mới" chip: opens the day of the newest event if it is folded and brings that event into view. */
  jumpToLatest(): void {
    this.inView = true;
    const tl = this.state.timeline;
    if (!tl) return;
    const newest = dayGroupsOf(tl.events)[0]?.dayKey ?? null;
    this.set({ timeline: { ...tl, newCount: 0, followToken: tl.followToken + 1, openDays: withDayOpen(tl.openDays, newest) } });
  }

  /** Opens or folds one day group. */
  toggleDay(dayKey: string): void {
    const tl = this.state.timeline;
    if (!tl) return;
    const openDays = tl.openDays.includes(dayKey) ? tl.openDays.filter(k => k !== dayKey) : [...tl.openDays, dayKey];
    this.set({ timeline: { ...tl, openDays } });
  }

  /** "Mở tất cả" / "Thu tất cả". */
  setAllDays(open: boolean): void {
    const tl = this.state.timeline;
    if (!tl) return;
    this.set({ timeline: { ...tl, openDays: open ? dayGroupsOf(tl.events).map(g => g.dayKey) : [] } });
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
    const day = dayKeyOfEvent(tl.events, target.id);
    if (day !== null && !tl.openDays.includes(day)) this.set({ timeline: { ...tl, openDays: withDayOpen(tl.openDays, day) } });
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
    this.set({ dataExport: null, report: { phase: 'loading', text: '', error: '', saving: false, saved: false } });
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
    this.set({ report: null, dataExport });
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
  askEnd(): void { if (this.state.detail.status === 'stopped') this.set({ confirm: { kind: 'end' }, actionError: '' }); }
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
