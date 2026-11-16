import type { ParseResult } from '../../../../shared/exam-format/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { ExamLibraryGateway } from './exam-gateway.js';

export const PREVIEW_DEBOUNCE_MS = 400;

export interface ImportState {
  markdown: string;
  result: ParseResult | null;
  /** The text the current `result` was computed for. */
  previewedFor: string;
  checking: boolean;
  previewError: string;
  importError: string;
  busy: boolean;
}

/**
 * Import page logic: the Markdown being edited, the debounced server-side preview (a stale answer is dropped),
 * and the import itself. Plain TypeScript, tested with a fake gateway and fake timers.
 */
export class ImportController {
  private state: ImportState = { markdown: '', result: null, previewedFor: '', checking: false, previewError: '', importError: '', busy: false };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private submitting = false; // blocks a second submit before `busy` is visible

  constructor(private gateway: ExamLibraryGateway, private debounceMs = PREVIEW_DEBOUNCE_MS) {}

  getState = (): ImportState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<ImportState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  get exam() { return this.state.result?.exam ?? null; }
  get errors() { return this.state.result?.errors ?? []; }
  get warnings() { return this.state.result?.warnings ?? []; }
  get upToDate(): boolean { return !this.state.checking && this.state.previewedFor === this.state.markdown; }
  get canImport(): boolean { return !!this.exam && this.errors.length === 0 && this.upToDate && !this.state.busy; }

  setMarkdown(markdown: string): void {
    this.set({ markdown, importError: '' });
    this.schedulePreview();
  }
  reportFileError(): void { this.set({ previewError: 'Không đọc được file' }); }

  private schedulePreview(): void {
    if (this.timer) clearTimeout(this.timer);
    const n = ++this.seq; // a later edit makes this one stale
    const markdown = this.state.markdown;
    if (!markdown.trim()) { this.set({ result: null, previewError: '', checking: false }); return; }
    this.set({ checking: true });
    this.timer = setTimeout(async () => {
      try {
        const result = await this.gateway.previewExam(markdown);
        if (n !== this.seq) return;
        this.set({ result, previewedFor: markdown, previewError: '' });
      } catch (err) {
        if (n === this.seq) this.set({ previewError: err instanceof ApiError ? err.message : 'Không kiểm tra được đề' });
      } finally {
        if (n === this.seq) this.set({ checking: false });
      }
    }, this.debounceMs);
  }

  /** The new exam's id, or null when it could not be imported (the reason is in `importError`). */
  async import(): Promise<number | null> {
    if (!this.canImport || this.submitting) return null;
    this.submitting = true;
    this.set({ busy: true, importError: '' });
    try {
      return (await this.gateway.importExam(this.state.markdown)).exam.id;
    } catch (err) {
      this.set({ importError: err instanceof ApiError ? err.message : 'Không import được đề', busy: false });
      this.submitting = false;
      return null;
    }
  }

  dispose(): void { if (this.timer) clearTimeout(this.timer); this.seq++; }
}
