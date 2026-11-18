import { describe, expect, it, vi } from 'vitest';
import type { GradeResponse, GradingAnswer, GradingView } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { GradingController } from './grading-controller.js';
import type { GradingGateway } from './grading-gateway.js';

const ans = (answerId: number, textAnswer: string | null, manualScore: number | null = null): GradingAnswer => ({ answerId, displayName: `N${answerId}`, textAnswer, manualScore, feedback: null } as unknown as GradingAnswer);
const view = (): GradingView => ({ status: 'closed', graded: 0, total: 3, questions: [{ id: 1, position: 4, points: 5, prompt: 'p', body: null, explanation: null, answers: [ans(1, 'x'), ans(2, '  '), ans(3, null)] }] } as unknown as GradingView);

function make(over: Partial<GradingGateway> = {}, v = view()) {
  const gateway: GradingGateway = {
    getGrading: vi.fn(), getSession: vi.fn(),
    grade: vi.fn(async (answerId, g) => ({ answer: { ...ans(answerId, 'x'), manualScore: g.score }, graded: 1, total: 3 }) as unknown as GradeResponse),
    finalize: vi.fn(async () => {}),
    clearGrade: vi.fn(async answerId => ({ answer: ans(answerId, 'x'), graded: 0, total: 3 }) as unknown as GradeResponse),
    requestAi: vi.fn(async () => ({ queued: 1 })),
    stopAi: vi.fn(async () => ({ stopped: 1 })),
    ...over,
  };
  return { gateway, ctrl: new GradingController(gateway, 9, v) };
}

describe('GradingController', () => {
  it('starts blind on the first question, with blanks (empty or whitespace) counted as ungraded', () => {
    const { ctrl } = make();
    expect(ctrl.getState()).toMatchObject({ cur: 0, blind: true, confirming: false });
    expect(ctrl.question?.position).toBe(4);
    expect(ctrl.blankUngraded.map(a => a.answerId)).toEqual([2, 3]);
    expect(ctrl.done).toBe(false);
    expect(ctrl.locked).toBe(false);
  });

  it('adopts the saved grade and the server counters', async () => {
    const { ctrl, gateway } = make();
    await ctrl.grade(1, 3, 'good');
    expect(gateway.grade).toHaveBeenCalledWith(1, { score: 3, feedback: 'good' });
    expect(ctrl.getState().view.graded).toBe(1);
    expect(ctrl.question!.answers[0]!.manualScore).toBe(3);
  });

  it('lets a failing save reject so the card can show it, leaving the view untouched', async () => {
    const { ctrl } = make({ grade: async () => { throw new ApiError(409, 'Đã chốt'); } });
    await expect(ctrl.grade(1, 3, '')).rejects.toThrow('Đã chốt');
    expect(ctrl.getState().view.graded).toBe(0);
  });

  it('grades every ungraded blank with 0, then reports nothing left', async () => {
    const { ctrl, gateway } = make();
    await ctrl.zeroBlanks();
    expect(gateway.grade).toHaveBeenCalledTimes(2);
    expect(gateway.grade).toHaveBeenCalledWith(2, { score: 0 });
    expect(ctrl.getState()).toMatchObject({ zeroing: false, error: '' });
    expect(ctrl.blankUngraded).toEqual([]);
  });

  it('shows the server error when zeroing fails', async () => {
    const { ctrl } = make({ grade: async () => { throw new ApiError(409, 'Đã chốt'); } });
    await ctrl.zeroBlanks();
    expect(ctrl.getState()).toMatchObject({ zeroing: false, error: 'Đã chốt' });
  });

  it('finalize: true on success; on failure shows the message and closes the dialog', async () => {
    const ok = make();
    ok.ctrl.askFinalize();
    expect(await ok.ctrl.finalize()).toBe(true);
    const bad = make({ finalize: async () => { throw new ApiError(409, 'Còn 2 bài chưa chấm'); } });
    bad.ctrl.askFinalize();
    expect(await bad.ctrl.finalize()).toBe(false);
    expect(bad.ctrl.getState()).toMatchObject({ error: 'Còn 2 bài chưa chấm', confirming: false, finalizing: false });
  });

  it('is locked once finalized', () => {
    const v = view(); (v as { status: string }).status = 'finalized';
    expect(make({}, v).ctrl.locked).toBe(true);
  });
});

describe('GradingController · AI suggestions', () => {
  const suggested = (suspicious = false) => {
    const v = view();
    const a = v.questions[0]!.answers[0]! as unknown as Record<string, unknown>;
    a.aiSuggestion = { status: 'done', score: 4, feedback: 'Tốt', criteria: [], suspicious, suspiciousReason: null, suspiciousLines: [], error: null, used: null };
    return v;
  };

  it('"Dùng gợi ý" saves the suggestion as the grade, marked accepted', async () => {
    const { ctrl, gateway } = make({}, suggested());
    await ctrl.accept(1);
    expect(gateway.grade).toHaveBeenCalledWith(1, { score: 4, feedback: 'Tốt', aiUse: 'accepted' });
  });

  it('a suspicious answer needs "Đã đọc toàn bộ bài" first', async () => {
    const { ctrl, gateway } = make({}, suggested(true));
    await ctrl.accept(1);
    expect(gateway.grade).not.toHaveBeenCalled();
    ctrl.setAck(1, true);
    await ctrl.accept(1);
    expect(gateway.grade).toHaveBeenCalledTimes(1);
  });

  it('"Hoàn tác" clears the grade', async () => {
    const { ctrl, gateway } = make();
    await ctrl.grade(1, 3, '');
    await ctrl.undo(1);
    expect(gateway.clearGrade).toHaveBeenCalledWith(1);
    expect(ctrl.question!.answers[0]!.manualScore).toBeNull();
  });

  it('starts the AI for the question on screen, refreshes and announces it', async () => {
    const { ctrl, gateway } = make({ getGrading: vi.fn(async () => view()) });
    await ctrl.runAi();
    expect(gateway.requestAi).toHaveBeenCalledWith(9, 1, expect.any(Array));
    expect(gateway.getGrading).toHaveBeenCalledWith(9);
    expect(ctrl.getState()).toMatchObject({ aiBusy: false, error: '' });
    expect(ctrl.getState().live).toMatch(/AI bắt đầu chấm nháp/);
  });

  it('shows the server error when the AI cannot start', async () => {
    const { ctrl } = make({ requestAi: async () => { throw new ApiError(409, 'Câu này chưa có rubric'); } });
    await ctrl.runAi();
    expect(ctrl.getState()).toMatchObject({ aiBusy: false, error: 'Câu này chưa có rubric' });
  });

  it('changing question resets the filter', () => {
    const { ctrl } = make();
    ctrl.setFilter('flag');
    ctrl.select(0);
    expect(ctrl.getState().filter).toBe('all');
  });
});
