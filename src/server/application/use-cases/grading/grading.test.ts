import { describe, expect, it } from 'vitest';
import { newExam } from '../../../domain/exam/exam.js';
import { AnswerNotFoundError, DiscussionNotOpenError, GradingNotOpenError, NotEssayError, ResultsFinalizedError, ScoreOutOfRangeError } from '../../../domain/grading/errors.js';
import { ParticipantKickedError } from '../../../domain/participant/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { FakeClock, RecordingEventPublisher } from '../../testing/fakes.js';
import { InMemoryAttemptRepository } from '../../testing/in-memory-attempt-repository.js';
import { InMemoryExamRepository } from '../../testing/in-memory-exam-repository.js';
import { InMemoryParticipantRepository } from '../../testing/in-memory-participant-repository.js';
import { InMemorySessionRepository } from '../../testing/in-memory-session-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { GetLeaderboard } from '../leaderboard/get-leaderboard.js';
import { GetProjectorRoom } from '../sessions/get-projector-room.js';
import { SubmitAttempt } from '../attempts/submit-attempt.js';
import { SaveAnswer } from '../attempts/save-answer.js';
import { StartAttempt } from '../attempts/start-attempt.js';
import { FakeRandom } from '../../testing/fakes.js';
import { CountUngradedEssays } from './essay-progress.js';
import { GetDiscussionView } from './get-discussion-view.js';
import { GetGradingView } from './get-grading-view.js';
import { ClearGrade, GradeAnswer } from './grade-answer.js';
import { FailUnfinishedSuggestions, RequestAiSuggestions, RunAiSuggestion, StopAiSuggestions } from './ai-suggestions.js';
import { FakeEssayGrader, InMemoryAiSuggestionRepository, RecordingSuggestionQueue } from '../../testing/in-memory-ai-suggestion-repository.js';
import { EssayGraderError } from '../../ports/essay-grader.js';

let exams: InMemoryExamRepository;
let sessions: InMemorySessionRepository;
let people: InMemoryParticipantRepository;
let attempts: InMemoryAttemptRepository;
let events: RecordingEventPublisher;
let ai: InMemoryAiSuggestionRepository;
let grader: FakeEssayGrader;
let queue: RecordingSuggestionQueue;
let sessionId: number;
let examId: number;
let ids: { single: number; correct: number; wrong: number; essay: number };
let members: { id: number; name: string }[];

async function setup() {
  exams = new InMemoryExamRepository();
  sessions = new InMemorySessionRepository(exams);
  people = new InMemoryParticipantRepository();
  attempts = new InMemoryAttemptRepository(people);
  events = new RecordingEventPublisher();
  examId = await exams.add(
    newExam({
      title: 'Đề T', description: null, durationMinutes: null, sourceMarkdown: '#', createdAt: new Date(),
      questions: [
        { type: 'single', prompt: 'S', body: '', points: 2, explanation: 'why', options: [{ text: 'a', correct: true }, { text: 'b', correct: false }] },
        { type: 'essay', prompt: 'E', body: '', points: 4, explanation: 'rubric', options: [] },
      ],
    }),
  );
  const exam = (await exams.findById(examId))!;
  ids = { single: exam.questions[0]!.id, correct: exam.questions[0]!.options[0]!.id, wrong: exam.questions[0]!.options[1]!.id, essay: exam.questions[1]!.id };
  sessionId = await sessions.create({ examId, name: 'Phiên', access: 'free', outsiderPolicy: 'block', sourceGroupId: null, scoreVisibility: 'on_submit', mode: 'self_paced', shuffle: false, autoApprove: true, timeLimitMinutes: null, createdAt: new Date() });
  await sessions.update(sessionId, { status: 'running', roomCode: '123456' });

  const clock = new FakeClock(1000);
  const unitOfWork = new InMemoryUnitOfWork({ attempts, sessions, participants: people, exams }, [attempts]);
  const start = new StartAttempt({ unitOfWork, clock, random: new FakeRandom(), events });
  const save = new SaveAnswer(unitOfWork, clock);
  const submit = new SubmitAttempt({ unitOfWork, clock, events });

  members = [];
  for (const [name, pick, text] of [['An', 'correct', 'nội dung bài một'], ['Bình', 'wrong', ''], ['Cường', 'correct', 'nội dung bài ba']] as const) {
    const p = await people.add({ sessionId, displayName: name, email: null, token: `t-${name}`, status: 'active', joinedAt: new Date() });
    const { attempt } = await start.execute(p.id);
    await save.execute({ participantId: p.id, attemptId: attempt.id, questionId: ids.single, answer: { selectedOptionIds: [ids[pick]] } });
    if (text) await save.execute({ participantId: p.id, attemptId: attempt.id, questionId: ids.essay, answer: { textAnswer: text } });
    clock.advance(1000);
    await submit.execute({ participantId: p.id, attemptId: attempt.id });
    members.push({ id: p.id, name });
  }
  await sessions.update(sessionId, { status: 'closed' });
  events.events.length = 0;

  const reads = { attempts, sessions, exams };
  ai = new InMemoryAiSuggestionRepository(() => sessionId);
  grader = new FakeEssayGrader();
  queue = new RecordingSuggestionQueue();
  const gradingUnit = new InMemoryUnitOfWork({ attempts, sessions, participants: people, exams, aiSuggestions: ai }, [attempts, ai]);
  const aiDeps = { unitOfWork: gradingUnit, clock: new FakeClock(7000) };
  return {
    gradingView: new GetGradingView({ ...reads, participants: people, aiSuggestions: ai, grader }),
    requestAi: new RequestAiSuggestions({ ...aiDeps, grader, queue }),
    stopAi: new StopAiSuggestions(aiDeps),
    runAi: new RunAiSuggestion({ ...aiDeps, grader }),
    failUnfinished: new FailUnfinishedSuggestions(aiDeps),
    clear: new ClearGrade({ unitOfWork: gradingUnit, clock: new FakeClock(5000), events }),
    discussion: new GetDiscussionView(reads),
    grade: new GradeAnswer({ unitOfWork: gradingUnit, clock: new FakeClock(5000), events }),
    ungraded: new CountUngradedEssays(reads),
    leaderboard: new GetLeaderboard({ ...reads, participants: people }),
    projector: new GetProjectorRoom(sessions),
  };
}

const essayAnswerOf = async (participantId: number) => {
  const attempt = (await attempts.listByParticipant(participantId))[0]!;
  return (await attempts.answersOf(attempt.id)).find(a => a.questionId === ids.essay)!;
};


describe('GetGradingView', () => {
  it('lists every counted essay answer with names, blank ones included, once the session is closed', async () => {
    const uc = await setup();
    const view = await uc.gradingView.execute(sessionId);
    expect(view).toMatchObject({ sessionId, status: 'closed', graded: 0, total: 3 });
    expect(view.questions).toHaveLength(1); // choice questions are not graded by hand
    expect(view.questions[0]!.answers.map(a => a.displayName).sort()).toEqual(['An', 'Bình', 'Cường']);
    expect(view.questions[0]!.answers.find(a => a.displayName === 'Bình')!.textAnswer).toBeNull();
    expect(view.questions[0]!.explanation).toBe('rubric');
  });

  it('refuses before the close and for an unknown session', async () => {
    const uc = await setup();
    await sessions.update(sessionId, { status: 'running' });
    await expect(uc.gradingView.execute(sessionId)).rejects.toBeInstanceOf(GradingNotOpenError);
    await expect(uc.gradingView.execute(99)).rejects.toBeInstanceOf(SessionNotFoundError);
  });
});

describe('GradeAnswer', () => {
  it('stores score and trimmed comment, recomputes the attempt total, reports progress and publishes leaderboard', async () => {
    const uc = await setup();
    const answer = await essayAnswerOf(members[0]!.id);
    const res = await uc.grade.execute({ answerId: answer.id, score: 3.5, feedback: '  tốt  ' });
    expect(res).toMatchObject({ answer: { answerId: answer.id, displayName: 'An', manualScore: 3.5, feedback: 'tốt' }, graded: 1, total: 3 });
    expect(events.events).toEqual([{ sessionId, type: 'leaderboard' }]);
    expect((await attempts.listByParticipant(members[0]!.id))[0]!.manualScore).toBe(3.5);
    // Regrading replaces, never adds up.
    await uc.grade.execute({ answerId: answer.id, score: 1 });
    expect((await attempts.listByParticipant(members[0]!.id))[0]!.manualScore).toBe(1);
    expect((await essayAnswerOf(members[0]!.id)).gradedAt).toEqual(new Date(5000));
  });

  it('refuses: unknown answer, choice question, score too high, finalized, not closed, kicked member', async () => {
    const uc = await setup();
    const essay = await essayAnswerOf(members[0]!.id);
    const choice = (await attempts.answersOf((await attempts.listByParticipant(members[0]!.id))[0]!.id)).find(a => a.questionId === ids.single)!;
    await expect(uc.grade.execute({ answerId: 999, score: 1 })).rejects.toBeInstanceOf(AnswerNotFoundError);
    await expect(uc.grade.execute({ answerId: choice.id, score: 1 })).rejects.toBeInstanceOf(NotEssayError);
    await expect(uc.grade.execute({ answerId: essay.id, score: 4.5 })).rejects.toBeInstanceOf(ScoreOutOfRangeError);
    await sessions.update(sessionId, { status: 'running' });
    await expect(uc.grade.execute({ answerId: essay.id, score: 1 })).rejects.toBeInstanceOf(GradingNotOpenError);
    await sessions.update(sessionId, { status: 'finalized' });
    await expect(uc.grade.execute({ answerId: essay.id, score: 1 })).rejects.toBeInstanceOf(ResultsFinalizedError);
    await sessions.update(sessionId, { status: 'closed' });
    await people.update(members[0]!.id, { status: 'kicked' });
    await expect(uc.grade.execute({ answerId: essay.id, score: 1 })).rejects.toBeInstanceOf(ParticipantKickedError);
    expect(events.events).toEqual([]);
  });

  it('CountUngradedEssays drops as answers are graded (a zero counts as graded)', async () => {
    const uc = await setup();
    expect(await uc.ungraded.count(sessionId)).toBe(3);
    await uc.grade.execute({ answerId: (await essayAnswerOf(members[1]!.id)).id, score: 0 });
    expect(await uc.ungraded.count(sessionId)).toBe(2);
  });
});

describe('GetLeaderboard', () => {
  it('is provisional with automatic points only, then official with the manual part', async () => {
    const uc = await setup();
    await uc.grade.execute({ answerId: (await essayAnswerOf(members[0]!.id)).id, score: 4 });
    const provisional = await uc.leaderboard.execute(sessionId);
    expect(provisional.provisional).toBe(true);
    expect(provisional.entries.map(e => [e.displayName, e.score, e.rank])).toEqual([['An', 2, 1], ['Cường', 2, 2], ['Bình', 0, 3]]); // equal score: earlier submission first
    await sessions.update(sessionId, { status: 'finalized' });
    const final = await uc.leaderboard.execute(sessionId);
    expect(final.provisional).toBe(false);
    expect(final.entries[0]).toMatchObject({ displayName: 'An', score: 6, maxScore: 6, rank: 1 });
  });

  it('leaves kicked members out and 404s for an unknown session', async () => {
    const uc = await setup();
    await people.update(members[2]!.id, { status: 'kicked' });
    expect((await uc.leaderboard.execute(sessionId)).entries.map(e => e.displayName)).toEqual(['An', 'Bình']);
    await expect(uc.leaderboard.execute(99)).rejects.toBeInstanceOf(SessionNotFoundError);
  });
});

describe('GetDiscussionView', () => {
  it('shows statistics and anonymous essays labelled by a stable shuffled number, never by name', async () => {
    const uc = await setup();
    const view = await uc.discussion.execute(sessionId);
    expect(view).toMatchObject({ examTitle: 'Đề T', status: 'closed', submitted: 3, total: 3, graded: 0 });
    const single = view.questions[0]!;
    expect(single.options.map(o => [o.isCorrect, o.count])).toEqual([[true, 2], [false, 1]]);
    expect(single).toMatchObject({ correctCount: 2, blankCount: 0 });
    const essay = view.questions[1]!;
    expect(essay.answers.map(a => a.label).sort()).toEqual(['Bài #1', 'Bài #2', 'Bài #3']);
    expect(essay.blankCount).toBe(1);
    expect(JSON.stringify(view)).not.toMatch(/displayName|"An"|Bình|Cường/);
    expect((await uc.discussion.execute(sessionId)).questions[1]!.answers.map(a => a.answerId)).toEqual(essay.answers.map(a => a.answerId)); // stable order
  });

  it('refuses before the close', async () => {
    const uc = await setup();
    await sessions.update(sessionId, { status: 'running' });
    await expect(uc.discussion.execute(sessionId)).rejects.toBeInstanceOf(DiscussionNotOpenError);
  });
});

describe('GetProjectorRoom', () => {
  it('returns the active session\'s room code, or null', async () => {
    const uc = await setup();
    expect(await uc.projector.execute(sessionId)).toEqual({ roomCode: null }); // closed
    await sessions.update(sessionId, { status: 'lobby' });
    expect(await uc.projector.execute(sessionId)).toEqual({ roomCode: '123456' });
    expect(await uc.projector.execute(sessionId + 1)).toEqual({ roomCode: null }); // another session
  });
});

describe('AI suggestions (PRODUCT.md §7.28)', () => {
  const runAll = async (uc: Awaited<ReturnType<typeof setup>>) => {
    for (const id of queue.enqueued.splice(0)) await uc.runAi.execute(id);
  };

  it('queues written, ungraded answers only, sends no name, and never changes a score', async () => {
    const uc = await setup();
    const an = await essayAnswerOf(members[0]!.id);
    const cuong = await essayAnswerOf(members[2]!.id);
    await uc.grade.execute({ answerId: cuong.id, score: 1 });
    expect(await uc.requestAi.execute({ sessionId, questionId: ids.essay })).toEqual({ queued: 1 }); // Bình is blank, Cường graded
    expect(await uc.requestAi.execute({ sessionId, questionId: ids.essay })).toEqual({ queued: 0 }); // no duplicate
    await runAll(uc);
    expect(grader.inputs).toHaveLength(1);
    expect(grader.inputs[0]).toMatchObject({ questionPrompt: 'E', maxPoints: 4, rubricText: 'rubric', answerText: 'nội dung bài một' });
    expect(JSON.stringify(grader.inputs[0])).not.toMatch(/An|Bình|Cường|participant|email/);

    const view = await uc.gradingView.execute(sessionId);
    const q = view.questions[0]!;
    const card = q.answers.find(a => a.answerId === an.id)!;
    expect(card.manualScore).toBeNull();
    expect(card.aiSuggestion).toMatchObject({ status: 'done', score: 4, used: null });
    expect(q.ai).toEqual({ queued: 0, running: 0, done: 1, failed: 0 });
    expect(view.graded).toBe(1);
    expect(view.aiGrader).toEqual({ available: true });
    expect(await uc.ungraded.count(sessionId)).toBe(2);
  });

  it('refuses without a rubric, before the close, or when the AI is not set up', async () => {
    const uc = await setup();
    grader.isAvailable = false;
    await expect(uc.requestAi.execute({ sessionId, questionId: ids.essay })).rejects.toThrow('chưa được bật');
    grader.isAvailable = true;
    await expect(uc.requestAi.execute({ sessionId, questionId: ids.single })).rejects.toBeInstanceOf(NotEssayError);
    await sessions.update(sessionId, { status: 'running' });
    await expect(uc.requestAi.execute({ sessionId, questionId: ids.essay })).rejects.toBeInstanceOf(GradingNotOpenError);
  });

  it('records a failure with a short reason, and retries only that answer', async () => {
    const uc = await setup();
    grader.next = new EssayGraderError('timeout');
    await uc.requestAi.execute({ sessionId, questionId: ids.essay });
    await runAll(uc);
    const failed = [...ai.rows.values()];
    expect(failed.map(r => [r.status, r.error])).toEqual([['failed', 'Quá thời gian'], ['failed', 'Quá thời gian']]);
    grader.next = new FakeEssayGrader().next;
    expect(await uc.requestAi.execute({ sessionId, questionId: ids.essay, answerIds: [failed[0]!.answerId] })).toEqual({ queued: 1 });
    await runAll(uc);
    expect([...ai.rows.values()].map(r => r.status).sort()).toEqual(['done', 'failed']);
  });

  it('rejects an out-of-range suggestion as invalid output', async () => {
    const uc = await setup();
    grader.next = input => ({ score: input.maxPoints + 1, feedback: 'x', criteria: [], suspicious: false, suspiciousReason: null, suspiciousLines: [], model: null });
    await uc.requestAi.execute({ sessionId, questionId: ids.essay });
    await runAll(uc);
    expect([...ai.rows.values()][0]).toMatchObject({ status: 'failed', error: 'AI trả kết quả không hợp lệ' });
  });

  it('drops a queued answer that the mentor graded by hand, and stops the rest', async () => {
    const uc = await setup();
    await uc.requestAi.execute({ sessionId, questionId: ids.essay });
    const an = await essayAnswerOf(members[0]!.id);
    await uc.grade.execute({ answerId: an.id, score: 2 });
    expect(ai.byAnswer(an.id)).toBeUndefined();
    expect(await uc.stopAi.execute({ sessionId, questionId: ids.essay })).toEqual({ stopped: 1 });
    await runAll(uc);
    expect(grader.inputs).toHaveLength(0);
  });

  it('remembers how the mentor used the suggestion; "Hoàn tác" clears the grade', async () => {
    const uc = await setup();
    await uc.requestAi.execute({ sessionId, questionId: ids.essay });
    await runAll(uc);
    const an = await essayAnswerOf(members[0]!.id);
    const saved = await uc.grade.execute({ answerId: an.id, score: 4, feedback: 'Tốt.', aiUse: 'accepted' });
    expect(saved.answer.aiSuggestion?.used).toBe('accepted');
    const cleared = await uc.clear.execute(an.id);
    expect(cleared.answer).toMatchObject({ manualScore: null, feedback: null });
    expect(cleared.answer.aiSuggestion?.used).toBeNull();
    expect(cleared.graded).toBe(0);
    expect(events.events.at(-1)).toEqual({ sessionId, type: 'leaderboard' });
  });

  it('fails leftovers at startup and flags the session for the member review', async () => {
    const uc = await setup();
    await uc.requestAi.execute({ sessionId, questionId: ids.essay });
    expect(await uc.failUnfinished.execute()).toBe(2);
    expect([...ai.rows.values()].every(r => r.status === 'failed' && r.error === 'Server đã khởi động lại')).toBe(true);
    expect(await ai.questionsWithDoneInSession(sessionId)).toEqual([]);
  });

  it('keeps suggestions out of the discussion view', async () => {
    const uc = await setup();
    await uc.requestAi.execute({ sessionId, questionId: ids.essay });
    await runAll(uc);
    expect(JSON.stringify(await uc.discussion.execute(sessionId))).not.toMatch(/aiSuggestion|Tốt\./);
  });
});
