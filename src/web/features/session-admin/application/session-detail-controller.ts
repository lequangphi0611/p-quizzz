import type { RejoinRequestInfo, ScoreVisibility, SessionDetail, SessionParticipantInfo } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { ACTION_FOR_STATUS } from '../domain/session-ui.js';
import type { SessionAdminGateway } from './session-admin-gateway.js';

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export type Dialog = { kind: 'action' } | { kind: 'kick'; p: SessionParticipantInfo } | { kind: 'addRoster' } | { kind: 'saveGroup' } | { kind: 'impostor'; request: RejoinRequestInfo } | { kind: 'releaseScores' } | null;

export interface SessionDetailState { detail: SessionDetail; error: string; working: boolean; dialog: Dialog; /** A confirmation to show after saving a group, until dismissed. */ notice: string }

/** State and actions of the mentor's control page for one session. Plain TypeScript, tested with a fake gateway. */
export class SessionDetailController {
  private state: SessionDetailState;
  private listeners = new Set<() => void>();
  private seq = 0; // drops a fetch that finished after a newer one (or after an action's own response)

  constructor(private gateway: SessionAdminGateway, initial: SessionDetail) {
    this.state = { detail: initial, error: '', working: false, dialog: null, notice: '' };
  }

  getState = (): SessionDetailState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<SessionDetailState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  openDialog(dialog: Dialog): void { this.set({ dialog }); }
  closeDialog(): void { this.set({ dialog: null }); }

  /** Called on SSE events; failures are ignored (the next event or action refreshes). */
  refetch = async (): Promise<void> => {
    const n = ++this.seq;
    try {
      const d = await this.gateway.getSession(this.state.detail.id);
      if (n === this.seq) this.set({ detail: d });
    } catch { /* transient (e.g. server restarting) */ }
  };

  private async run(call: () => Promise<unknown>, fallback: string): Promise<boolean> {
    this.set({ working: true, error: '' });
    try { await call(); return true; }
    catch (err) { this.set({ error: errorText(err, fallback) }); return false; }
    finally { this.set({ working: false }); }
  }

  /** The one next lifecycle step for the current status (open / start / close / finalize). */
  async doAction(): Promise<void> {
    const spec = ACTION_FOR_STATUS[this.state.detail.status];
    if (!spec) return;
    await this.run(async () => {
      // In the lobby the button is "Bắt đầu ngay": the room counts down 10 seconds first (PRODUCT.md §7.31c).
      const d = spec.action === 'start' ? await this.gateway.startCountdown(this.state.detail.id) : await this.gateway.runAction(this.state.detail.id, spec.action);
      this.seq++;
      this.set({ detail: d });
    }, `Không thể ${spec.label.toLowerCase()}`);
    this.closeDialog(); // on failure the message shows on the page behind the dialog
  }

  approveAll(list: readonly { id: number }[]): Promise<boolean> {
    return this.run(async () => { for (const p of list) await this.gateway.approveParticipant(p.id); await this.refetch(); }, 'Không duyệt hết được');
  }
  resolveEdit(id: number, decision: 'approve' | 'reject'): Promise<boolean> { return this.run(async () => { await this.gateway.resolveEditRequest(id, decision); await this.refetch(); }, 'Không xử lý được yêu cầu sửa bài'); }
  approve(id: number): Promise<boolean> { return this.run(async () => { await this.gateway.approveParticipant(id); await this.refetch(); }, 'Không duyệt được'); }
  async kickConfirmed(): Promise<void> {
    const d = this.state.dialog;
    if (d?.kind !== 'kick') return;
    await this.run(async () => { await this.gateway.kickParticipant(d.p.id); await this.refetch(); }, 'Không kick được');
    this.closeDialog();
  }
  /** Answers someone who asks to take a seat. "Đây là mạo danh" goes through a confirmation (the holder loses the attempt). */
  async answerRejoin(requestId: number, answer: 'keep' | 'takeover' | 'reject'): Promise<boolean> {
    const ok = await this.run(async () => { await this.gateway.answerRejoin(requestId, answer); await this.refetch(); }, answer === 'takeover' ? 'Không cho người xin vào được' : 'Không xử lý được yêu cầu vào lại');
    if (answer === 'takeover') this.closeDialog();
    return ok;
  }

  /** "Cho vào lại" ahead of time for someone who dropped off. */
  async allowRejoin(participantId: number, name: string): Promise<boolean> {
    let until = 0;
    const ok = await this.run(async () => { until = await this.gateway.allowRejoin(participantId); await this.refetch(); }, 'Không cho phép vào lại được');
    if (ok) this.set({ notice: `Đã cho phép ${name} vào lại trong 10 phút: họ chỉ cần nhập lại email hoặc tên.` });
    void until;
    return ok;
  }

  /** Lets more emails into this session's list (an exception); the saved group is untouched. Resolves false after setting `error`. */
  async addRoster(emails: string[]): Promise<boolean> {
    const ok = await this.run(async () => { const d = await this.gateway.addRoster(this.state.detail.id, emails); this.seq++; this.set({ detail: d }); }, 'Không thêm được email');
    if (ok) this.closeDialog();
    return ok;
  }

  /** Saves the typed list as a group; afterwards the session counts as saved. */
  async saveGroup(name: string): Promise<boolean> {
    let saved: { name: string; emailCount: number } | null = null;
    const ok = await this.run(async () => { saved = await this.gateway.saveGroup(this.state.detail.id, name); await this.refetch(); }, 'Không lưu được nhóm');
    if (ok && saved) { this.closeDialog(); this.set({ notice: `Đã lưu thành nhóm “${(saved as { name: string }).name}” · ${(saved as { emailCount: number }).emailCount} email` }); }
    return ok;
  }
  dismissNotice(): void { this.set({ notice: '' }); }

  /** Show scores on submit / hold them until published (PRODUCT.md §7.25). Refused by the server once someone submitted. */
  setScoreVisibility(value: ScoreVisibility): Promise<boolean> {
    return this.run(async () => { const d = await this.gateway.setScoreVisibility(this.state.detail.id, value); this.seq++; this.set({ detail: d }); }, 'Không đổi được cách hiện điểm');
  }

  /** "Công bố điểm" (after the confirmation): scores and ranks appear for everyone at once. */
  async releaseScores(): Promise<boolean> {
    const ok = await this.run(async () => { const d = await this.gateway.releaseScores(this.state.detail.id); this.seq++; this.set({ detail: d }); }, 'Không công bố được điểm');
    this.closeDialog();
    if (ok) this.set({ notice: 'Đã công bố điểm: học viên và màn chiếu thấy điểm và bảng xếp hạng.' });
    return ok;
  }

  /** Change, add or remove the time limit before the start (PRODUCT.md §7.27c). */
  /** How the session starts (PRODUCT.md §7.31). */
  setStartSchedule(startsAt: number | null): Promise<boolean> {
    return this.run(async () => { const d = await this.gateway.setStartSchedule(this.state.detail.id, startsAt); this.seq++; this.set({ detail: d }); }, 'Không đặt được giờ bắt đầu');
  }
  cancelCountdown(): Promise<boolean> {
    return this.run(async () => { const d = await this.gateway.cancelCountdown(this.state.detail.id); this.seq++; this.set({ detail: d }); }, 'Không huỷ được đếm ngược');
  }
  setAutoStart(enabled: boolean, minParticipants: number): Promise<boolean> {
    return this.run(async () => { const d = await this.gateway.setAutoStart(this.state.detail.id, enabled, minParticipants); this.seq++; this.set({ detail: d }); }, 'Không đổi được cách tự bắt đầu');
  }

  setTimeLimit(minutes: number | null): Promise<boolean> {
    return this.run(async () => { const d = await this.gateway.setTimeLimit(this.state.detail.id, minutes); this.seq++; this.set({ detail: d }); }, 'Không đổi được thời gian làm bài');
  }

  /** "+N phút" for the whole room while running. */
  async extendTime(minutes: number): Promise<boolean> {
    const ok = await this.run(async () => { const d = await this.gateway.extendTime(this.state.detail.id, minutes); this.seq++; this.set({ detail: d }); }, 'Không cộng thêm giờ được');
    if (ok) this.set({ notice: `Đã cộng thêm ${minutes} phút cho cả phòng.` });
    return ok;
  }

  rename(id: number, name: string): Promise<boolean> { return this.run(async () => { await this.gateway.renameParticipant(id, name); await this.refetch(); }, 'Không đổi được tên'); }
}
