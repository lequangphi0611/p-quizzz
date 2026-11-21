import { TRAINING_NAME_MAX, type CreatedTraining, type TrainingSummary } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { TrainingAdminGateway } from './training-admin-gateway.js';

export interface TrainingListState {
  /** Newest first, as the server sends them. */
  items: TrainingSummary[];
  /** The create form. */
  name: string;
  /** "Cho phép chế độ tự chấp nhận": the flag for that mode stays down in this training. */
  allowAutoAccept: boolean;
  creating: boolean;
  /** Why creating failed (or why the name is not valid yet). */
  createError: string;
  /** A reload the mentor asked for is running. */
  loading: boolean;
  /** Why that reload failed; the list stays as it was. */
  loadError: string;
}

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/** State and actions of the list of AI trainings and its create form. Plain TypeScript, tested with a fake gateway. */
export class TrainingListController {
  private state: TrainingListState;
  private listeners = new Set<() => void>();
  private seq = 0; // drops a list that arrives after a newer one

  constructor(private gateway: TrainingAdminGateway, initial: TrainingSummary[]) {
    this.state = { items: initial, name: '', allowAutoAccept: false, creating: false, createError: '', loading: false, loadError: '' };
  }

  getState = (): TrainingListState => this.state;
  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  private set(patch: Partial<TrainingListState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  setName(name: string): void { this.set({ name, createError: '' }); }
  setAllowAutoAccept(allowAutoAccept: boolean): void { this.set({ allowAutoAccept }); }

  /** Silent refetch on a change signal (member counts move while a training is open); a failure keeps the list as it is. */
  refresh = async (): Promise<void> => {
    const n = ++this.seq;
    try {
      const items = await this.gateway.list();
      if (n === this.seq) this.set({ items });
    } catch { /* the next signal or the retry button refreshes */ }
  };

  /** "Thử lại" / reload by hand: shows a spinner and the error when it fails. */
  async reload(): Promise<void> {
    const n = ++this.seq;
    this.set({ loading: true, loadError: '' });
    try {
      const items = await this.gateway.list();
      if (n === this.seq) this.set({ items, loading: false });
    } catch (err) {
      if (n === this.seq) this.set({ loading: false, loadError: errorText(err, 'Không tải được danh sách buổi training') });
    }
  }

  /** Creates a training from the typed name. Resolves with it so the page can open it; null (with `createError`) when it was not created. */
  async create(): Promise<CreatedTraining | null> {
    if (this.state.creating) return null; // a double click must not make two trainings
    const name = this.state.name.trim();
    if (name.length === 0) { this.set({ createError: 'Nhập tên buổi training' }); return null; }
    if ([...name].length > TRAINING_NAME_MAX) { this.set({ createError: `Tên buổi training tối đa ${TRAINING_NAME_MAX} ký tự` }); return null; }
    this.set({ creating: true, createError: '' });
    try {
      const created = await this.gateway.create(name, { allowAutoAccept: this.state.allowAutoAccept });
      const { roomCode: _roomCode, ...summary } = created;
      this.seq++; // a list fetched before this training existed must not wipe it out
      this.set({ creating: false, name: '', allowAutoAccept: false, items: [summary, ...this.state.items.filter(t => t.id !== created.id)] });
      return created;
    } catch (err) {
      this.set({ creating: false, createError: errorText(err, 'Không tạo được buổi training') });
      return null;
    }
  }
}
