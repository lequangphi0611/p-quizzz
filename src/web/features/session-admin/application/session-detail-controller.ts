import type { SessionDetail, SessionParticipantInfo } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { ACTION_FOR_STATUS } from '../domain/session-ui.js';
import type { SessionAdminGateway } from './session-admin-gateway.js';

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export type Dialog = { kind: 'action' } | { kind: 'kick'; p: SessionParticipantInfo } | null;

export interface SessionDetailState { detail: SessionDetail; error: string; working: boolean; dialog: Dialog }

/** State and actions of the mentor's control page for one session. Plain TypeScript, tested with a fake gateway. */
export class SessionDetailController {
  private state: SessionDetailState;
  private listeners = new Set<() => void>();
  private seq = 0; // drops a fetch that finished after a newer one (or after an action's own response)

  constructor(private gateway: SessionAdminGateway, initial: SessionDetail) {
    this.state = { detail: initial, error: '', working: false, dialog: null };
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
      const d = await this.gateway.runAction(this.state.detail.id, spec.action);
      this.seq++;
      this.set({ detail: d });
    }, `Không thể ${spec.label.toLowerCase()}`);
    this.closeDialog(); // on failure the message shows on the page behind the dialog
  }

  approveAll(list: readonly { id: number }[]): Promise<boolean> {
    return this.run(async () => { for (const p of list) await this.gateway.approveParticipant(p.id); await this.refetch(); }, 'Không duyệt hết được');
  }
  approve(id: number): Promise<boolean> { return this.run(async () => { await this.gateway.approveParticipant(id); await this.refetch(); }, 'Không duyệt được'); }
  async kickConfirmed(): Promise<void> {
    const d = this.state.dialog;
    if (d?.kind !== 'kick') return;
    await this.run(async () => { await this.gateway.kickParticipant(d.p.id); await this.refetch(); }, 'Không kick được');
    this.closeDialog();
  }
  rename(id: number, name: string): Promise<boolean> { return this.run(async () => { await this.gateway.renameParticipant(id, name); await this.refetch(); }, 'Không đổi được tên'); }
}
