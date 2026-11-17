import { describe, expect, it, vi } from 'vitest';
import type { AttemptView, MemberQuestion } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { AnswerPayload } from './answer-saver.js';
import type { ExamGateway } from './exam-gateway.js';
import { TakingController } from './taking-controller.js';

const q = (id: number, type: MemberQuestion['type'], optionIds: number[] = []): MemberQuestion => ({ id, type, prompt: `Q${id}`, body: null, points: 1, options: optionIds.map(o => ({ id: o, text: `o${o}` })) } as unknown as MemberQuestion);
const view = (): AttemptView => ({ id: 9, questions: [q(1, 'single', [10, 11]), q(2, 'multi', [20, 21]), q(3, 'essay')], answers: [{ questionId: 3, selectedOptionIds: null, textAnswer: 'saved text' }] } as unknown as AttemptView);

function fakeGateway(over: Partial<ExamGateway> = {}) {
  const saved: [number, number, AnswerPayload][] = [];
  const gateway: ExamGateway = {
    startAttempt: vi.fn(async () => {}),
    getAttempt: vi.fn(async () => view()),
    saveAnswer: vi.fn(async (a, qid, p) => { saved.push([a, qid, p]); }),
    submitAttempt: vi.fn(async () => ({}) as never),
    requestEdit: vi.fn(async () => {}),
    finishEdit: vi.fn(async () => {}),
    ...over,
  };
  return { gateway, saved };
}
const make = (over: Partial<ExamGateway> = {}) => {
  const g = fakeGateway(over);
  const onChanged = vi.fn(async () => {});
  const ctrl = new TakingController({ gateway: g.gateway, attemptId: 9, onChanged });
  return { ...g, onChanged, ctrl };
};

describe('TakingController: loading', () => {
  it('loads the attempt and rebuilds drafts from saved answers', async () => {
    const { ctrl } = make();
    await ctrl.load();
    const s = ctrl.getState();
    expect(s.view?.id).toBe(9);
    expect(s.drafts[3]).toEqual({ selected: [], text: 'saved text' });
    expect(s.loadError).toBe('');
  });

  it('reports the server message, or a fallback, and recovers on retry', async () => {
    let fail: unknown = new ApiError(404, 'Không tìm thấy bài làm');
    const { ctrl } = make({ getAttempt: async () => { if (fail) throw fail; return view(); } });
    await ctrl.load();
    expect(ctrl.getState().loadError).toBe('Không tìm thấy bài làm');
    fail = new Error('x');
    await ctrl.load();
    expect(ctrl.getState().loadError).toBe('Không tải được bài làm');
    fail = null;
    await ctrl.load();
    expect(ctrl.getState().loadError).toBe('');
    expect(ctrl.getState().view).not.toBeNull();
  });
});

describe('TakingController: answering', () => {
  it('a single choice replaces and is sent at once', async () => {
    const { ctrl, saved } = make();
    await ctrl.load();
    const [q1] = ctrl.getState().view!.questions;
    ctrl.pick(q1!, 10);
    ctrl.pick(q1!, 11);
    expect(ctrl.getState().drafts[1]!.selected).toEqual([11]);
    await ctrl.retrySave();
    expect(saved.at(-1)).toEqual([9, 1, { selectedOptionIds: [11] }]);
  });

  it('a multi choice toggles', async () => {
    const { ctrl } = make();
    await ctrl.load();
    const q2 = ctrl.getState().view!.questions[1]!;
    ctrl.pick(q2, 20); ctrl.pick(q2, 21); ctrl.pick(q2, 20);
    expect(ctrl.getState().drafts[2]!.selected).toEqual([21]);
  });

  it('essay text is kept in the draft and flushed when leaving the question', async () => {
    const { ctrl, saved } = make();
    await ctrl.load();
    ctrl.go(2);
    ctrl.setText(3, 'hello');
    expect(ctrl.getState().drafts[3]!.text).toBe('hello');
    expect(saved).toHaveLength(0); // still on the debounce
    ctrl.go(1); // leaving flushes
    await vi.waitFor(() => expect(saved).toEqual([[9, 3, { textAnswer: 'hello' }]]));
  });

  it('ignores picks on essays', async () => {
    const { ctrl, saved } = make();
    await ctrl.load();
    ctrl.pick(ctrl.getState().view!.questions[2]!, 1);
    await ctrl.retrySave();
    expect(saved).toHaveLength(0);
  });
});

describe('TakingController: navigation', () => {
  it('stays inside the question range', async () => {
    const { ctrl } = make();
    ctrl.go(1); // before load: no questions
    expect(ctrl.getState().cur).toBe(0);
    await ctrl.load();
    ctrl.go(2); expect(ctrl.getState().cur).toBe(2);
    ctrl.go(3); expect(ctrl.getState().cur).toBe(2);
    ctrl.go(-1); expect(ctrl.getState().cur).toBe(2);
  });
});

describe('TakingController: session closed (409)', () => {
  it('marks the screen closed, asks the parent to refetch, and stops warning about leaving', async () => {
    const { ctrl, onChanged } = make({ saveAnswer: async () => { throw new ApiError(409, 'Phiên đã đóng'); } });
    await ctrl.load();
    ctrl.pick(ctrl.getState().view!.questions[0]!, 10);
    await vi.waitFor(() => expect(ctrl.getState().closed).toBe(true));
    expect(onChanged).toHaveBeenCalledOnce();
    expect(ctrl.hasUnsavedWork()).toBe(false);
  });

  it('warns about leaving while something is unsaved', async () => {
    let release!: () => void;
    const { ctrl } = make({ saveAnswer: () => new Promise<void>(r => { release = r; }) });
    await ctrl.load();
    expect(ctrl.hasUnsavedWork()).toBe(false);
    ctrl.pick(ctrl.getState().view!.questions[0]!, 10);
    expect(ctrl.hasUnsavedWork()).toBe(true);
    release();
    await ctrl.retrySave();
    expect(ctrl.hasUnsavedWork()).toBe(false);
  });
});

describe('TakingController: submit', () => {
  it('flushes, submits, then tells the parent', async () => {
    const order: string[] = [];
    const { ctrl, onChanged } = make({
      saveAnswer: async () => { order.push('save'); },
      submitAttempt: async () => { order.push('submit'); return {} as never; },
    });
    onChanged.mockImplementation(async () => { order.push('changed'); });
    await ctrl.load();
    ctrl.pick(ctrl.getState().view!.questions[0]!, 10);
    ctrl.requestSubmit();
    expect(ctrl.getState().confirming).toBe(true);
    await ctrl.submit();
    expect(order).toEqual(['save', 'submit', 'changed']);
  });

  it('does not submit when an answer could not be saved, and says so', async () => {
    const { ctrl, gateway, onChanged } = make({ saveAnswer: async () => { throw new TypeError('offline'); } });
    await ctrl.load();
    ctrl.pick(ctrl.getState().view!.questions[0]!, 10);
    ctrl.requestSubmit();
    await ctrl.submit();
    const s = ctrl.getState();
    expect(gateway.submitAttempt).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(s).toMatchObject({ confirming: false, submitting: false, submitError: 'Còn câu chưa lưu được. Kiểm tra mạng rồi thử nộp lại.' });
  });

  it('shows the server message when the submit itself is refused', async () => {
    const { ctrl } = make({ submitAttempt: async () => { throw new ApiError(409, 'Bài đã được nộp'); } });
    await ctrl.load();
    ctrl.requestSubmit();
    await ctrl.submit();
    expect(ctrl.getState()).toMatchObject({ confirming: false, submitting: false, submitError: 'Bài đã được nộp' });
  });
});

describe('TakingController: store', () => {
  it('notifies subscribers with a new state object, and stops after unsubscribe', async () => {
    const { ctrl } = make();
    const seen: unknown[] = [];
    const off = ctrl.subscribe(() => seen.push(ctrl.getState()));
    const before = ctrl.getState();
    await ctrl.load();
    expect(seen.length).toBeGreaterThan(0);
    expect(ctrl.getState()).not.toBe(before);
    off();
    const n = seen.length;
    ctrl.requestSubmit();
    expect(seen.length).toBe(n);
  });
});

describe('TakingController: time up (PRODUCT.md §7.27)', () => {
  it('sends the typed text at once, closes the submit dialog and asks the parent to refetch, only once', async () => {
    const { ctrl, saved, onChanged } = make();
    await ctrl.load();
    ctrl.setText(3, 'last words'); // still on the debounce
    ctrl.requestSubmit();
    ctrl.timeUp();
    ctrl.timeUp();
    expect(ctrl.getState()).toMatchObject({ timeUp: true, confirming: false });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(saved).toContainEqual([9, 3, { textAnswer: 'last words' }]);
  });
});
