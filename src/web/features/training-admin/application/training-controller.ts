import type { Clip, TrainingDetail, TrainingEventRow } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { announcementFor } from '../domain/announcements.js';
import { stepEvent } from '../domain/timeline.js';
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
  /** Changes whenever the timeline should scroll to its end (the page reacts to the change, not the value). */
  stickToken: number;
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
}

export interface TrainingControllerOptions {
  /** The member in the URL (`?hv=`), opened as soon as `start()` runs. */
  initialMemberId?: number | null;
  /** Pages of 500 events fetched in a row before "Tải thêm" is offered. */
  maxPages?: number;
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
  private started = false;
  private atBottom = true;
  private detailGen = 0; // bumped when an action's own answer is newer than any reload in flight
  private timelineToken = 0; // bumped when another member is picked (or none)
  private panelToken = 0; // bumped on every open / close of the panel
  private inflight: Promise<void> | null = null;
  private queued = false;

  constructor(private gateway: TrainingAdminGateway, initial: TrainingDetail, opts: TrainingControllerOptions = {}) {
    this.maxPages = opts.maxPages ?? 10;
    const id = opts.initialMemberId ?? null;
    const known = id !== null && initial.status !== 'ended' && initial.members.some(m => m.id === id);
    this.state = {
      detail: initial, selectedId: known ? id : null, timeline: known ? this.freshTimeline(id) : null, panel: null, confirm: null,
      working: false, actionError: '', hidden: gateway.readHideContent(), offline: false, announcement: '', endedMemberCount: null,
    };
  }

  getState = (): TrainingState => this.state;
  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  private set(patch: Partial<TrainingState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }
  private freshTimeline(memberId: number): TimelineState {
    return { memberId, events: [], hasMore: false, phase: 'loading', loadingMore: false, error: '', newCount: 0, stickToken: 0 };
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
    }
    if (next.status === 'ended') { this.panelToken++; patch.panel = null; }
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
  private async fetchPages(memberId: number, after: number): Promise<{ events: TrainingEventRow[]; hasMore: boolean }> {
    const events: TrainingEventRow[] = [];
    let cursor = after;
    for (let page = 0; page < this.maxPages; page++) {
      const r = await this.gateway.events(this.state.detail.id, memberId, cursor);
      events.push(...r.events);
      const last = r.events[r.events.length - 1];
      if (!last) return { events, hasMore: false };
      if (!r.hasMore) return { events, hasMore: false };
      cursor = last.id;
    }
    return { events, hasMore: true };
  }

  private appendEvents(memberId: number, fetched: { events: TrainingEventRow[]; hasMore: boolean }): void {
    const tl = this.state.timeline;
    if (!tl || tl.memberId !== memberId) return;
    const lastId = tl.events[tl.events.length - 1]?.id ?? 0;
    const fresh = fetched.events.filter(e => e.id > lastId);
    let { newCount, stickToken } = tl;
    // At the end of the timeline (or empty so far) it follows the new lines; higher up it only counts them.
    if (fresh.length > 0) { if (tl.events.length === 0 || this.atBottom) stickToken++; else newCount += fresh.length; }
    this.set({ timeline: { ...tl, events: [...tl.events, ...fresh], hasMore: fetched.hasMore, phase: 'ready', loadingMore: false, error: '', newCount, stickToken } });
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
    if (memberId === null) { this.set({ selectedId: null, timeline: null, panel: null }); return; }
    if (this.state.detail.status === 'ended' || !this.state.detail.members.some(m => m.id === memberId)) return;
    this.atBottom = true;
    this.set({ selectedId: memberId, timeline: this.freshTimeline(memberId), panel: null });
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
    try {
      const fetched = await this.fetchPages(tl.memberId, lastId);
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
      this.appendEvents(tl.memberId, fetched);
    } catch (err) {
      const now = this.state.timeline;
      if (token === this.timelineToken && now) this.set({ timeline: { ...now, loadingMore: false, error: errorText(err, 'Không tải thêm được') } });
    }
  }

  /** The page reports whether the timeline is at its end (within 80px) after every scroll. */
  reportScroll(atBottom: boolean): void {
    this.atBottom = atBottom;
    const tl = this.state.timeline;
    if (atBottom && tl && tl.newCount > 0) this.set({ timeline: { ...tl, newCount: 0 } });
  }

  /** The "N sự kiện mới ↓" chip. */
  jumpToBottom(): void {
    this.atBottom = true;
    const tl = this.state.timeline;
    if (tl) this.set({ timeline: { ...tl, newCount: 0, stickToken: tl.stickToken + 1 } });
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
    void this.openDetail(target.id, kind);
  }

  // ── Hiding content ──────────────────────────────────────────────────────────────────────────────

  setHidden(hidden: boolean): void {
    if (hidden === this.state.hidden) return;
    this.gateway.writeHideContent(hidden);
    if (hidden) { this.panelToken++; this.set({ hidden, panel: null }); } else this.set({ hidden });
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
