import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParseResult } from '../../../../shared/exam-format/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { ExamLibraryGateway } from './exam-gateway.js';
import { ImportController } from './import-controller.js';

const ok = (title = 'Đề'): ParseResult => ({ exam: { title, questions: [{}], totalPoints: 1, hasEssay: false }, errors: [], warnings: [] } as unknown as ParseResult);
const bad = (): ParseResult => ({ exam: null, errors: [{ line: 3, message: 'Thiếu đáp án đúng' }], warnings: [] } as unknown as ParseResult);

function make(over: Partial<ExamLibraryGateway> = {}) {
  const gateway = { previewExam: vi.fn(async () => ok()), importExam: vi.fn(async () => ({ exam: { id: 5 } }) as never), ...over } as unknown as ExamLibraryGateway;
  return { gateway, ctrl: new ImportController(gateway, 400) };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ImportController: preview', () => {
  it('waits for a pause in typing, then previews once for the latest text', async () => {
    const { ctrl, gateway } = make();
    ctrl.setMarkdown('a'); ctrl.setMarkdown('ab'); ctrl.setMarkdown('abc');
    expect(ctrl.getState().checking).toBe(true);
    await vi.advanceTimersByTimeAsync(399);
    expect(gateway.previewExam).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(gateway.previewExam).toHaveBeenCalledTimes(1);
    expect(gateway.previewExam).toHaveBeenCalledWith('abc');
    expect(ctrl.getState()).toMatchObject({ checking: false, previewedFor: 'abc' });
    expect(ctrl.canImport).toBe(true);
  });

  it('drops a slow answer for text that has since changed', async () => {
    let release!: (r: ParseResult) => void;
    const { ctrl } = make({ previewExam: vi.fn(() => new Promise<ParseResult>(r => { release = r; })) as never });
    ctrl.setMarkdown('old');
    await vi.advanceTimersByTimeAsync(400);
    ctrl.setMarkdown('new'); // makes the pending preview stale
    release(ok('Đề cũ'));
    await vi.advanceTimersByTimeAsync(0);
    expect(ctrl.getState().result).toBeNull();
    expect(ctrl.canImport).toBe(false);
  });

  it('clearing the text clears the result without calling the server', async () => {
    const { ctrl, gateway } = make();
    ctrl.setMarkdown('x');
    await vi.advanceTimersByTimeAsync(400);
    ctrl.setMarkdown('   ');
    expect(ctrl.getState()).toMatchObject({ result: null, checking: false, previewError: '' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(gateway.previewExam).toHaveBeenCalledTimes(1);
  });

  it('shows the server message, or a fallback, when the preview fails', async () => {
    const a = make({ previewExam: async () => { throw new ApiError(413, 'Đề quá lớn'); } });
    a.ctrl.setMarkdown('x'); await vi.advanceTimersByTimeAsync(400);
    expect(a.ctrl.getState().previewError).toBe('Đề quá lớn');
    const b = make({ previewExam: async () => { throw new Error('x'); } });
    b.ctrl.setMarkdown('x'); await vi.advanceTimersByTimeAsync(400);
    expect(b.ctrl.getState().previewError).toBe('Không kiểm tra được đề');
  });

  it('exposes errors and blocks import while the exam has errors', async () => {
    const { ctrl } = make({ previewExam: async () => bad() });
    ctrl.setMarkdown('x'); await vi.advanceTimersByTimeAsync(400);
    expect(ctrl.errors).toHaveLength(1);
    expect(ctrl.canImport).toBe(false);
  });
});

describe('ImportController: import', () => {
  async function ready() {
    const m = make();
    m.ctrl.setMarkdown('x'); await vi.advanceTimersByTimeAsync(400);
    return m;
  }

  it('returns the new exam id', async () => {
    const { ctrl, gateway } = await ready();
    expect(await ctrl.import()).toBe(5);
    expect(gateway.importExam).toHaveBeenCalledWith('x');
  });

  it('refuses when the preview is out of date (text edited since)', async () => {
    const { ctrl, gateway } = await ready();
    ctrl.setMarkdown('x2');
    expect(await ctrl.import()).toBeNull();
    expect(gateway.importExam).not.toHaveBeenCalled();
  });

  it('a second click while importing does nothing', async () => {
    const { ctrl, gateway } = await ready();
    const first = ctrl.import();
    expect(await ctrl.import()).toBeNull();
    await first;
    expect(gateway.importExam).toHaveBeenCalledTimes(1);
  });

  it('shows the server reason and lets the mentor try again', async () => {
    let fail = true;
    const m = make({ importExam: async () => { if (fail) throw new ApiError(400, 'Đề lỗi'); return { exam: { id: 7 } } as never; } });
    m.ctrl.setMarkdown('x'); await vi.advanceTimersByTimeAsync(400);
    expect(await m.ctrl.import()).toBeNull();
    expect(m.ctrl.getState()).toMatchObject({ importError: 'Đề lỗi', busy: false });
    fail = false;
    expect(await m.ctrl.import()).toBe(7);
  });

  it('editing the text clears the previous import error', async () => {
    const m = make({ importExam: async () => { throw new ApiError(400, 'Đề lỗi'); } });
    m.ctrl.setMarkdown('x'); await vi.advanceTimersByTimeAsync(400);
    await m.ctrl.import();
    m.ctrl.setMarkdown('y');
    expect(m.ctrl.getState().importError).toBe('');
  });
});
