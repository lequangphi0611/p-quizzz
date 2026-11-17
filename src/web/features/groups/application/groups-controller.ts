import type { GroupDetail, GroupSummary } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { draftOfGroup, EMPTY_DRAFT, emailsToSave, parseDraft, saveBlocker, type EditorDraft } from '../domain/group-editor.js';
import type { GroupsGateway } from './groups-gateway.js';

/** `'new'` = a group being created; a number = that saved group is open. */
export type Selection = 'new' | number;

export interface GroupsState {
  groups: GroupSummary[];
  selected: Selection;
  draft: EditorDraft;
  /** What the editor loaded or last saved, to tell unsaved changes. */
  saved: EditorDraft;
  loading: boolean;
  saving: boolean;
  error: string;
  /** Message after a successful save, until the next edit. */
  notice: string;
  /** Asking to delete the open group. */
  confirmDelete: boolean;
}

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/** State and actions of the mentor's group screen. Plain TypeScript, tested with a fake gateway. */
export class GroupsController {
  private state: GroupsState;
  private listeners = new Set<() => void>();

  constructor(private gateway: GroupsGateway, initial: GroupSummary[]) {
    this.state = { groups: initial, selected: 'new', draft: EMPTY_DRAFT, saved: EMPTY_DRAFT, loading: false, saving: false, error: '', notice: '', confirmDelete: false };
  }

  getState = (): GroupsState => this.state;
  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  private set(patch: Partial<GroupsState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  edit(patch: Partial<EditorDraft>): void { this.set({ draft: { ...this.state.draft, ...patch }, notice: '', error: '' }); }

  newGroup(): void { this.set({ selected: 'new', draft: EMPTY_DRAFT, saved: EMPTY_DRAFT, error: '', notice: '', confirmDelete: false }); }

  async open(id: number): Promise<void> {
    this.set({ loading: true, error: '', notice: '', confirmDelete: false });
    try {
      const g = await this.gateway.get(id);
      const d = draftOfGroup(g);
      this.set({ selected: id, draft: d, saved: d, loading: false });
    } catch (err) { this.set({ loading: false, error: errorText(err, 'Không mở được nhóm') }); }
  }

  private async refreshList(): Promise<void> {
    try { this.set({ groups: await this.gateway.list() }); } catch { /* the list is shown stale; the next action refreshes */ }
  }

  async save(): Promise<void> {
    const { draft, selected } = this.state;
    const parse = parseDraft(draft);
    const blocker = saveBlocker(draft, parse);
    if (blocker) { this.set({ error: blocker }); return; }
    this.set({ saving: true, error: '', notice: '' });
    try {
      const input = { name: draft.name.trim(), emails: emailsToSave(parse) };
      const g: GroupDetail = selected === 'new' ? await this.gateway.create(input) : await this.gateway.update(selected, input);
      const d = draftOfGroup(g);
      this.set({ selected: g.id, draft: d, saved: d, saving: false, notice: `Đã lưu nhóm · ${g.emailCount} email` });
      await this.refreshList();
    } catch (err) { this.set({ saving: false, error: errorText(err, 'Không lưu được nhóm. Danh sách bạn dán vẫn còn nguyên.') }); }
  }

  askDelete(open: boolean): void { this.set({ confirmDelete: open }); }

  async remove(): Promise<void> {
    const { selected } = this.state;
    if (selected === 'new') return;
    this.set({ saving: true, error: '' });
    try {
      await this.gateway.remove(selected);
      this.set({ saving: false, confirmDelete: false, selected: 'new', draft: EMPTY_DRAFT, saved: EMPTY_DRAFT, notice: 'Đã xoá nhóm. Các phiên đã tạo từ nhóm này không bị ảnh hưởng.' });
      await this.refreshList();
    } catch (err) { this.set({ saving: false, confirmDelete: false, error: errorText(err, 'Không xoá được nhóm') }); }
  }
}
