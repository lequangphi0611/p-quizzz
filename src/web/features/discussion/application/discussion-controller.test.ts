import { describe, expect, it, vi } from 'vitest';
import type { DiscussionAnswer, DiscussionView, GradeResponse } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { DiscussionController } from './discussion-controller.js';
import type { DiscussionGateway } from './discussion-gateway.js';

const ans = (answerId: number, text: string | null, manualScore: number | null = null): DiscussionAnswer => ({ answerId, textAnswer: text, manualScore, feedback: null } as unknown as DiscussionAnswer);
const view = (over: Partial<DiscussionView> = {}): DiscussionView => ({
  status: 'closed', examTitle: 'T', submitted: 3, graded: 0, total: 3,
  questions: [{ id: 1, type: 'essay', points: 5, prompt: 'p', body: null, explanation: null, options: [], correctCount: 0, blankCount: 1, answers: [ans(11, 'a'), ans(12, 'b'), ans(13, null)] }],
  ...over,
} as unknown as DiscussionView);

function make(over: Partial<DiscussionGateway> = {}, v: DiscussionView = view()) {
  const gateway: DiscussionGateway = {
    getView: vi.fn(async () => v),
    gradeAnswer: vi.fn(async (answerId, g) => ({ answer: { answerId, manualScore: g.score, feedback: g.feedback ?? null }, graded: 1, total: 3 }) as unknown as GradeResponse),
    finalize: vi.fn(async () => {}),
    ...over,
  };
  return { gateway, ctrl: new DiscussionController(gateway, 7) };
}
const papersOf = (c: DiscussionController) => c.getState().view!.questions[0]!.answers.filter(a => a.textAnswer);

describe('DiscussionController: loading', () => {
  it('loads, or reports the server message / a network failure', async () => {
    const a = make();
    await a.ctrl.load();
    expect(a.ctrl.getState()).toMatchObject({ load: 'ready' });
    const b = make({ getView: async () => { throw new ApiError(403, 'Phiên chưa đóng'); } });
    await b.ctrl.load();
    expect(b.ctrl.getState()).toMatchObject({ load: 'error', loadError: 'Phiên chưa đóng' });
    const c = make({ getView: async () => { throw new ApiError(0, 'Không kết nối được tới máy chủ'); } });
    await c.ctrl.load();
    expect(c.ctrl.getState()).toMatchObject({ load: 'error', loadError: undefined });
  });
});

describe('DiscussionController: reveal and navigation', () => {
  it('reveals per question and toggles back', () => {
    const { ctrl } = make();
    ctrl.toggleReveal(1);
    expect(ctrl.getState().revealed.has(1)).toBe(true);
    ctrl.toggleReveal(1);
    expect(ctrl.getState().revealed.has(1)).toBe(false);
  });

  it('J/K: from the list jump to the first ungraded / last paper; in a paper step and clamp', async () => {
    const { ctrl } = make();
    await ctrl.load();
    const papers = papersOf(ctrl);
    ctrl.stepPaper(papers, 1);
    expect(ctrl.getState()).toMatchObject({ mode: 'paper', paperIdx: 0, lastOpened: 0 });
    ctrl.stepPaper(papers, 1); expect(ctrl.getState().paperIdx).toBe(1);
    ctrl.stepPaper(papers, 1); expect(ctrl.getState().paperIdx).toBe(1); // clamped at the end
    ctrl.backToList();
    ctrl.stepPaper(papers, -1);
    expect(ctrl.getState().paperIdx).toBe(1);
    ctrl.questionChanged();
    expect(ctrl.getState()).toMatchObject({ mode: 'list', lastOpened: null });
  });
});

describe('DiscussionController: grading', () => {
  it('saves a valid score, adopts the server progress and shows it as saved', async () => {
    const { ctrl, gateway } = make();
    await ctrl.load();
    const papers = papersOf(ctrl);
    ctrl.openPaper(0);
    await ctrl.commitScore({ points: 5 }, papers, '2,5', false);
    expect(gateway.gradeAnswer).toHaveBeenCalledWith(11, { score: 2.5, feedback: '' });
    const s = ctrl.getState();
    expect(s.view!.graded).toBe(1);
    expect(s.view!.questions[0]!.answers[0]).toMatchObject({ manualScore: 2.5 });
    expect(s.drafts[11]).toMatchObject({ value: '2,5', save: 'saved' });
  });

  it('does not call the server for an invalid or empty score', async () => {
    const { ctrl, gateway } = make();
    await ctrl.load();
    const papers = papersOf(ctrl);
    ctrl.openPaper(0);
    await ctrl.commitScore({ points: 5 }, papers, '9', false);
    expect(ctrl.getState().drafts[11]).toMatchObject({ error: 'Điểm phải từ 0 đến 5', save: 'unsaved' });
    await ctrl.commitScore({ points: 5 }, papers, '', false);
    expect(gateway.gradeAnswer).not.toHaveBeenCalled();
  });

  it('Enter saves, then opens the next paper that has no score', async () => {
    const { ctrl } = make();
    await ctrl.load();
    const papers = papersOf(ctrl);
    ctrl.openPaper(0);
    await ctrl.commitScore({ points: 5 }, papers, '1', true);
    expect(ctrl.getState()).toMatchObject({ mode: 'paper', paperIdx: 1 });
  });

  it('keeps the typed value and shows the server error when saving fails', async () => {
    const { ctrl } = make({ gradeAnswer: async () => { throw new ApiError(409, 'Phiên đã chốt'); } });
    await ctrl.load();
    ctrl.openPaper(0);
    await ctrl.commitScore({ points: 5 }, papersOf(ctrl), '3', false);
    expect(ctrl.getState().drafts[11]).toMatchObject({ value: '3', save: 'error', error: 'Phiên đã chốt' });
  });

  it('is read-only once the session is finalized', async () => {
    const { ctrl, gateway } = make({}, view({ status: 'finalized' }));
    await ctrl.load();
    ctrl.openPaper(0);
    await ctrl.commitScore({ points: 5 }, papersOf(ctrl), '3', false);
    expect(gateway.gradeAnswer).not.toHaveBeenCalled();
  });

  it('grades every ungraded blank paper with 0', async () => {
    const { ctrl, gateway } = make();
    await ctrl.load();
    const blanks = ctrl.getState().view!.questions[0]!.answers.filter(a => !a.textAnswer);
    await ctrl.zeroBlanks(blanks);
    expect(gateway.gradeAnswer).toHaveBeenCalledWith(13, { score: 0 });
    expect(ctrl.getState().zeroing).toBe(false);
  });
});

describe('DiscussionController: finalize', () => {
  it('closes the dialog and locks the view on success', async () => {
    const { ctrl } = make();
    await ctrl.load();
    ctrl.openFinalize();
    expect(ctrl.getState().dialog).toBe(true);
    await ctrl.finalize();
    expect(ctrl.getState()).toMatchObject({ dialog: false, finalizing: false });
    expect(ctrl.getState().view!.status).toBe('finalized');
    expect(ctrl.locked).toBe(true);
  });

  it('keeps the dialog open with the server message on failure', async () => {
    const { ctrl } = make({ finalize: async () => { throw new ApiError(409, 'Còn 2 bài chưa chấm'); } });
    await ctrl.load();
    ctrl.openFinalize();
    await ctrl.finalize();
    expect(ctrl.getState()).toMatchObject({ dialog: true, finalizing: false, finalizeError: 'Còn 2 bài chưa chấm' });
  });
});
