import type { ExampleDraftRow, ExampleDraftStatus, TrainingEventRow } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { placesByEvent } from '../domain/day-groups.js';
import {
  appliedOf, applyDraft, draftFailedNote, draftReadyNote, draftStartedNote, isDrafting, overwriteFields, type AppliedDraft, type DraftField,
} from '../domain/example-draft.js';
import type { TeachingForm } from '../domain/teaching.js';
import type { TeachingEditState, TrainingState } from './training-controller.js';
import type { TrainingAdminGateway } from './training-admin-gateway.js';

// S45 (PRODUCT.md §7.40): the AI draft of a teaching example. The dialog of S44 keeps its own state in `TeachingEditState`; what the draft adds
// lives in `ai` there. This class holds the rules around it: asking for a draft, pouring it into the fields (and asking before it replaces
// what the mentor typed), what is kept per prompt while the page stays open, the words for a screen reader, and the way to the next draft.

/** What the dialog knows about the draft of its prompt. */
export interface DraftEditState {
  /** The mentor has set up the AI command, so a draft can be asked for. */
  available: boolean;
  /** The draft of the server for this prompt, as last seen; null = none. */
  row: ExampleDraftRow | null;
  /** The request for a draft is on its way. */
  requesting: boolean;
  /** Why the request itself failed (the server's message); the draft's own failure is in `row.error`. */
  error: string;
  /** What the dialog poured into the fields from a draft (null = nothing yet). Browser only: the server never learns which fields were touched. */
  applied: AppliedDraft | null;
  /** The mentor changed the topic before any draft came (the select has a value either way). */
  topicTouched: boolean;
  /** "Đã đọc kỹ prompt" is ticked (needed to save a draft the AI flagged). */
  ack: boolean;
  /** A draft arrived over text the mentor typed: these fields wait for "Dùng nháp AI" or "Giữ nội dung của tôi". */
  overwrite: { fields: DraftField[] } | null;
  /** "prompt N" for the words read aloud. */
  promptNumber: number | null;
}

export const noDraftEdit = (available: boolean, promptNumber: number | null): DraftEditState => ({
  available, row: null, requesting: false, error: '', applied: null, topicTouched: false, ack: false, overwrite: null, promptNumber,
});

/** What the dialog keeps for a prompt while the page stays open (lost on reload). */
interface Kept { form: TeachingForm; ai: Pick<DraftEditState, 'applied' | 'topicTouched' | 'ack'> }

interface Watched { name: string; number: number | null; status: ExampleDraftStatus }

/** What the controller gives this class: its state, its gateway and the few moves it needs. */
export interface DraftHost {
  gateway: TrainingAdminGateway;
  getState(): TrainingState;
  set(patch: Partial<TrainingState>): void;
  /** Changes whenever the dialog is replaced or closed: an answer for an older one is dropped. */
  token(): number;
  refresh(): Promise<void>;
  select(memberId: number): void;
  revealTurn(turnKey: string): void;
}

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/** The `exampleDraft` of a timeline row from the row the server holds. */
export const rowFlags = (r: ExampleDraftRow): NonNullable<TrainingEventRow['exampleDraft']> => ({ status: r.status, seen: r.seen, suspicious: r.draft?.suspicious ?? false, error: r.error });

/** "prompt N": its place among the prompts of the member (the events are loaded from the start, oldest first). */
export const promptNumberOf = (events: readonly TrainingEventRow[], eventId: number): number | null =>
  events.some(e => e.id === eventId && e.kind === 'prompt') ? events.filter(e => e.kind === 'prompt' && e.id <= eventId).length : null;

export class ExampleDrafts {
  private kept = new Map<number, Kept>();
  private watched = new Map<number, Watched>();
  private pendingFocus: number | null = null;

  constructor(private host: DraftHost) {}

  private edit(): TeachingEditState | null { return this.host.getState().teachingEdit; }

  /** Changes the open dialog if it is still the one (`eventId`, `token`) that asked. */
  private patchEdit(eventId: number, token: number, change: (e: TeachingEditState) => TeachingEditState): boolean {
    const e = this.edit();
    if (!e || e.eventId !== eventId || token !== this.host.token()) return false;
    this.host.set({ teachingEdit: change(e) });
    return true;
  }

  private patchAi(eventId: number, token: number, ai: Partial<DraftEditState>, rest: Partial<TeachingEditState> = {}): boolean {
    return this.patchEdit(eventId, token, e => ({ ...e, ...rest, ai: { ...e.ai, ...ai } }));
  }

  /** The row of the timeline shows the draft (or none) at once, without waiting for the reload. */
  patchRow(eventId: number, exampleDraft: TrainingEventRow['exampleDraft']): void {
    const tl = this.host.getState().timeline;
    if (!tl || !tl.events.some(e => e.id === eventId)) return;
    this.host.set({ timeline: { ...tl, events: tl.events.map(e => (e.id === eventId ? { ...e, exampleDraft } : e)) } });
  }

  private announce(text: string): void { this.host.set({ announcement: text }); }

  // ── Opening the dialog ───────────────────────────────────────────────────────────────────────────

  /** What a dialog opened for `eventId` starts from: what was kept for it (only while the server still has a draft: else it is stale), or nothing. */
  start(eventId: number, available: boolean, promptNumber: number | null, hasDraft: boolean): { form: TeachingForm | null; ai: DraftEditState } {
    const kept = hasDraft ? this.kept.get(eventId) : undefined;
    if (!hasDraft) this.kept.delete(eventId);
    return { form: kept?.form ?? null, ai: { ...noDraftEdit(available, promptNumber), ...kept?.ai } };
  }

  /** Right after the dialog opened: load the draft the button showed, or ask for one when there is none and the AI is on. */
  begin(eventId: number, token: number, hasDraft: boolean, exists: boolean): void {
    const e = this.edit();
    if (hasDraft) void this.loadRow(eventId, token, exists);
    else if (!exists && e?.ai.available) void this.request(eventId);
  }

  private async loadRow(eventId: number, token: number, exists: boolean): Promise<void> {
    try {
      const row = await this.host.gateway.exampleDraft(this.host.getState().detail.id, eventId);
      if (!row) { // dropped meanwhile (saved or discarded elsewhere)
        this.patchRow(eventId, null);
        this.kept.delete(eventId);
        if (!this.patchAi(eventId, token, { applied: null, ack: false }, { phase: 'ready' })) return;
        if (!exists && this.edit()?.ai.available) await this.request(eventId);
        return;
      }
      this.receive(eventId, token, row, true);
    } catch (err) {
      this.patchAi(eventId, token, { error: errorText(err, 'Không tải được nháp') }, { phase: 'ready' });
    }
  }

  // ── A draft arrives ──────────────────────────────────────────────────────────────────────────────

  /**
   * The server's draft for the open dialog: shown as it is (writing, failed), or, when finished, poured into the fields. Fields the mentor typed
   * are not replaced until they say so (`resolveOverwrite`); the label is never chosen for them. `show` also turns the dialog from "loading" to
   * "ready" in the same step, so the form is drawn once with the draft in it.
   */
  private receive(eventId: number, token: number, row: ExampleDraftRow, show = false): void {
    const e = this.edit();
    if (!e || e.eventId !== eventId || token !== this.host.token()) return;
    let form = e.form;
    let ai: DraftEditState = { ...e.ai, row, requesting: false, error: '' };
    if (row.status === 'done' && row.draft && ai.applied?.key !== row.createdAt) {
      const fields = overwriteFields(form, ai.applied, ai.topicTouched, row.draft);
      if (fields.length > 0) ai = { ...ai, overwrite: { fields } };
      else { form = applyDraft(form, row.draft); ai = { ...ai, applied: appliedOf(row.createdAt, row.draft), topicTouched: false, overwrite: null }; }
    }
    this.host.set({ teachingEdit: { ...e, form, ai, ...(show ? { phase: 'ready' as const } : {}) } });
    this.noteStatus(eventId, row.status, row.error);
    if (row.status === 'done' && !row.seen) this.markSeen(eventId);
  }

  /** "Dùng nháp AI" (all three fields from the draft) or "Giữ nội dung của tôi" (only the fields the mentor did not type). */
  resolveOverwrite(useDraft: boolean): void {
    const e = this.edit();
    const draft = e?.ai.row?.draft;
    if (!e || !e.ai.overwrite || !e.ai.row || !draft) return;
    const form = applyDraft(e.form, draft, useDraft ? [] : e.ai.overwrite.fields);
    this.host.set({ teachingEdit: { ...e, form, ai: { ...e.ai, applied: appliedOf(e.ai.row.createdAt, draft), topicTouched: false, overwrite: null } } });
  }

  private markSeen(eventId: number): void {
    const id = this.host.getState().detail.id;
    this.host.gateway.markExampleDraftSeen(id, eventId).then(() => {
      const row = this.host.getState().timeline?.events.find(x => x.id === eventId)?.exampleDraft;
      if (row) this.patchRow(eventId, { ...row, seen: true });
      void this.host.refresh();
    }, () => { /* the button keeps saying "chưa xem"; opening it again tries again */ });
  }

  // ── The mentor's moves in the dialog ──────────────────────────────────────────────────────────────

  /** "Viết lại nháp" (and the first request): the AI starts over; what is in the fields stays until the new draft arrives. */
  async request(eventId: number): Promise<void> {
    const e = this.edit();
    if (!e || e.eventId !== eventId || e.ai.requesting || e.saving) return;
    const token = this.host.token();
    this.patchAi(eventId, token, { requesting: true, error: '' });
    try {
      const row = await this.host.gateway.requestExampleDraft(this.host.getState().detail.id, eventId);
      this.patchRow(eventId, rowFlags(row));
      this.noteStatus(eventId, row.status, row.error, true);
      this.receive(eventId, token, row);
      void this.host.refresh();
    } catch (err) {
      this.patchAi(eventId, token, { requesting: false, error: errorText(err, 'Không gọi được AI') });
    }
  }

  /** "Bỏ nháp": the draft is deleted and the dialog closes; what was typed or poured in is dropped too. */
  async discard(): Promise<void> {
    const e = this.edit();
    if (!e || e.saving || (!e.ai.row && !e.ai.requesting)) return;
    const eventId = e.eventId;
    const token = this.host.token();
    try {
      await this.host.gateway.discardExampleDraft(this.host.getState().detail.id, eventId);
    } catch (err) {
      this.patchAi(eventId, token, { error: errorText(err, 'Không bỏ được nháp') });
      return;
    }
    this.forget(eventId);
    this.patchRow(eventId, null);
    if (token === this.host.token()) this.host.set({ teachingEdit: null });
    void this.host.refresh();
  }

  setAck(ack: boolean): void {
    const e = this.edit();
    if (e && !e.saving) this.host.set({ teachingEdit: { ...e, ai: { ...e.ai, ack } } });
  }

  /** The mentor changed the topic: before any draft it counts as typed. */
  noteTopicTouched(): void {
    const e = this.edit();
    if (e && !e.ai.topicTouched) this.host.set({ teachingEdit: { ...e, ai: { ...e.ai, topicTouched: true } } });
  }

  // ── Kept while the page is open ───────────────────────────────────────────────────────────────────

  /** The dialog is going away without a save: keep what the mentor typed and chose for this prompt (only while it has a draft). */
  keep(e: TeachingEditState): void {
    if (e.exists || e.phase !== 'ready' || (!e.ai.row && !e.ai.applied)) return;
    this.kept.set(e.eventId, { form: e.form, ai: { applied: e.ai.applied, topicTouched: e.ai.topicTouched, ack: e.ai.ack } });
  }

  /** Saved or discarded: nothing is kept for this prompt any more. */
  forget(eventId: number): void {
    this.kept.delete(eventId);
    this.watched.delete(eventId);
  }

  reset(): void {
    this.kept.clear();
    this.watched.clear();
    this.pendingFocus = null;
  }

  // ── Following the drafts (for the screen reader, and the dialog that waits) ───────────────────────

  private describe(eventId: number): { name: string; number: number | null } | null {
    const s = this.host.getState();
    const tl = s.timeline;
    const name = s.detail.members.find(m => m.id === tl?.memberId)?.displayName;
    if (!tl || name === undefined) return null;
    return { name, number: promptNumberOf(tl.events, eventId) };
  }

  /** A draft changed state: say so once (started when asked for here, ready, failed). */
  private noteStatus(eventId: number, status: ExampleDraftStatus, error: string | null, started = false): void {
    let w = this.watched.get(eventId);
    if (!w) {
      const who = isDrafting(status) ? this.describe(eventId) : null;
      if (!who) return;
      w = { ...who, status };
      this.watched.set(eventId, w);
      if (started) this.announce(draftStartedNote(w.number, w.name));
      return;
    }
    const was = w.status;
    w.status = status;
    if (isDrafting(status)) { if (started && !isDrafting(was)) this.announce(draftStartedNote(w.number, w.name)); return; }
    this.watched.delete(eventId);
    if (isDrafting(was)) this.announce(status === 'done' ? draftReadyNote(w.number, w.name) : draftFailedNote(w.number, w.name, (error ?? 'không rõ lý do').replace(/\.$/, '').toLowerCase()));
  }

  /** After every reload: pick up drafts already running, learn how the ones we watch ended, and bring the dialog that waits up to date. */
  async afterRefresh(): Promise<void> {
    const s = this.host.getState();
    if (s.detail.status === 'ended') { this.reset(); return; }
    const events = s.timeline?.events ?? [];
    for (const ev of events) {
      if (ev.kind === 'prompt' && ev.exampleDraft && isDrafting(ev.exampleDraft.status) && !this.watched.has(ev.id)) this.noteStatus(ev.id, ev.exampleDraft.status, null);
    }
    for (const [id, w] of [...this.watched]) {
      const ev = events.find(x => x.id === id);
      if (ev) {
        if (ev.exampleDraft) this.noteStatus(id, ev.exampleDraft.status, ev.exampleDraft.error); else this.watched.delete(id);
      } else if (isDrafting(w.status)) { // another member's prompt: the timeline of the page is not theirs
        try {
          const row = await this.host.gateway.exampleDraft(s.detail.id, id);
          if (row) this.noteStatus(id, row.status, row.error); else this.watched.delete(id);
        } catch { /* looked at again on the next reload */ }
      }
    }
    const e = this.host.getState().teachingEdit;
    if (e?.ai.row && isDrafting(e.ai.row.status)) await this.pollDialog(e.eventId, this.host.token(), e.ai.row.status);
  }

  /** The dialog is showing "đang viết": ask the server how it ended. */
  private async pollDialog(eventId: number, token: number, shown: ExampleDraftStatus): Promise<void> {
    try {
      const row = await this.host.gateway.exampleDraft(this.host.getState().detail.id, eventId);
      if (row && row.status === shown) return;
      if (!row) { this.patchRow(eventId, null); this.patchAi(eventId, token, { row: null }); return; }
      this.patchRow(eventId, rowFlags(row));
      this.receive(eventId, token, row);
    } catch { /* the next reload tries again */ }
  }

  // ── "Nháp tiếp theo" ─────────────────────────────────────────────────────────────────────────────

  /** Goes to the finished draft that was waiting longest: picks its member, scrolls to the prompt and puts the focus on its button. */
  goToNext(): void {
    const s = this.host.getState();
    const next = s.detail.exampleDrafts.next;
    if (!next || s.detail.status === 'ended') return;
    this.pendingFocus = next.eventId;
    if (s.selectedId === next.memberId && s.timeline?.phase === 'ready') this.focusPending();
    else if (s.selectedId !== next.memberId) this.host.select(next.memberId);
  }

  /** The timeline of the member just loaded: finish a "Nháp tiếp theo" that was waiting for it. */
  onTimelineLoaded(): void {
    if (this.pendingFocus !== null) this.focusPending();
  }

  private focusPending(): void {
    const s = this.host.getState();
    const tl = s.timeline;
    if (!tl || tl.phase !== 'ready' || this.pendingFocus === null) return;
    const id = this.pendingFocus;
    this.pendingFocus = null;
    const place = placesByEvent(tl.events).get(id);
    if (!place) return;
    this.host.revealTurn(place.turnKey);
    this.host.set({ draftFocus: { eventId: id, token: this.host.getState().draftFocus.token + 1 } });
  }
}
