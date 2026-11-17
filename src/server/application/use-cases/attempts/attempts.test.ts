import { beforeEach, describe, expect, it } from 'vitest';
import {
  AlreadyAttemptedError, AnswersNotYetVisibleError, AttemptAlreadySubmittedError, AttemptInProgressError, AttemptNotFoundError,
  AwaitingApprovalError, InvalidAnswerError, SessionNotRunningError,
} from '../../../domain/attempt/errors.js';
import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import type { Participant } from '../../../domain/participant/participant.js';
import { FakeClock, FakeRandom, RecordingEventPublisher } from '../../testing/fakes.js';
import { FakeMemberRoomReader, InMemoryAttemptRepository } from '../../testing/in-memory-attempt-repository.js';
import { InMemoryExamRepository } from '../../testing/in-memory-exam-repository.js';
import { InMemoryParticipantRepository } from '../../testing/in-memory-participant-repository.js';
import { InMemorySessionRepository } from '../../testing/in-memory-session-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { newExam } from '../../../domain/exam/exam.js';
import { AutoSubmitOpenAttempts } from './auto-submit-open-attempts.js';
import { GetAttemptReview, GetAttemptView, GetMemberState, GetParticipantReview } from './queries.js';
import { SaveAnswer } from './save-answer.js';
import { StartAttempt } from './start-attempt.js';
import { SubmitAttempt } from './submit-attempt.js';

let exams: InMemoryExamRepository;
let sessions: InMemorySessionRepository;
let people: InMemoryParticipantRepository;
let attempts: InMemoryAttemptRepository;
let events: RecordingEventPublisher;
let clock: FakeClock;
let sessionId: number;
let examId: number;
let lan: Participant;

async function setup(opts: { shuffle?: boolean; random?: number[] } = {}) {
  exams = new InMemoryExamRepository();
  sessions = new InMemorySessionRepository(exams);
  people = new InMemoryParticipantRepository();
  attempts = new InMemoryAttemptRepository(people);
  events = new RecordingEventPublisher();
  clock = new FakeClock(1000);
  examId = await exams.add(
    newExam({
      title: 'T', description: null, sourceMarkdown: '#', createdAt: new Date(),
      questions: [
        { type: 'single', prompt: 'S', body: '', points: 1, explanation: 'why S', options: [{ text: 'a', correct: true }, { text: 'b', correct: false }] },
        { type: 'multi', prompt: 'M', body: '', points: 2, explanation: null, options: [{ text: 'a', correct: true }, { text: 'b', correct: true }, { text: 'c', correct: false }] },
        { type: 'essay', prompt: 'E', body: '', points: 4, explanation: 'rubric', options: [] },
      ],
    }),
  );
  sessionId = await sessions.create({ examId, name: 'Phiên', access: 'free', outsiderPolicy: 'block', sourceGroupId: null, scoreVisibility: 'on_submit', mode: 'self_paced', shuffle: opts.shuffle ?? false, autoApprove: true, createdAt: new Date() });
  await sessions.update(sessionId, { status: 'running', roomCode: '123456' });
  lan = await people.add({ sessionId, displayName: 'Lan', email: null, token: 't1', status: 'active', joinedAt: new Date() });

  const unitOfWork = new InMemoryUnitOfWork({ attempts, sessions, participants: people, exams }, [attempts]);
  const reads = { attempts, sessions, exams };
  return {
    start: new StartAttempt({ unitOfWork, clock, random: new FakeRandom(opts.random ?? [0]), events }),
    save: new SaveAnswer(unitOfWork),
    submit: new SubmitAttempt({ unitOfWork, clock, events }),
    view: new GetAttemptView(reads),
    review: new GetAttemptReview(reads),
    participantReview: new GetParticipantReview({ ...reads, participants: people }),
    memberState: new GetMemberState({ ...reads, rooms: new FakeMemberRoomReader({ id: 1, title: 'T', status: 'running', totalPoints: 7, hasEssay: true, participantCount: 1, questionCount: 3 }) }),
    autoSubmit: new AutoSubmitOpenAttempts({ attempts, sessions, exams, clock }),
  };
}

const ids = async () => {
  const e = (await exams.findById(examId))!;
  return { q: e.questions.map(q => q.id), o: e.questions.map(q => q.options.map(o => o.id)) };
};


describe('StartAttempt', () => {
  it('creates the single attempt with a fixed order and tells the mentor', async () => {
    const uc = await setup();
    const data = await uc.start.execute(lan.id);
    const { q } = await ids();
    expect(data.attempt).toMatchObject({ participantId: lan.id, attemptNo: 1, questionOrder: q, startedAt: new Date(1000), submittedAt: null });
    expect(events.events).toEqual([{ sessionId, type: 'participants' }]);
  });

  it('shuffles per session setting, using the injected randomness', async () => {
    const uc = await setup({ shuffle: true, random: [0] });
    const { q } = await ids();
    const data = await uc.start.execute(lan.id);
    expect([...data.attempt.questionOrder].sort()).toEqual([...q].sort());
    expect(data.attempt.questionOrder).not.toEqual(q);
  });

  it('refuses outside a running session, while pending, twice, and for an unknown member', async () => {
    const uc = await setup();
    await sessions.update(sessionId, { status: 'lobby' });
    await expect(uc.start.execute(lan.id)).rejects.toBeInstanceOf(SessionNotRunningError);
    await sessions.update(sessionId, { status: 'running' });
    await people.update(lan.id, { status: 'pending' });
    await expect(uc.start.execute(lan.id)).rejects.toBeInstanceOf(AwaitingApprovalError);
    await people.update(lan.id, { status: 'active' });
    await uc.start.execute(lan.id);
    await expect(uc.start.execute(lan.id)).rejects.toBeInstanceOf(AttemptInProgressError);
    await expect(uc.start.execute(99)).rejects.toBeInstanceOf(ParticipantNotFoundError);
  });
});

describe('SaveAnswer / SubmitAttempt', () => {
  it('saves (replacing earlier answers), then submits and scores, essay pending', async () => {
    const uc = await setup();
    const { attempt } = await uc.start.execute(lan.id);
    const { q, o } = await ids();
    await uc.save.execute({ participantId: lan.id, attemptId: attempt.id, questionId: q[0]!, answer: { selectedOptionIds: [o[0]![1]!] } });
    await uc.save.execute({ participantId: lan.id, attemptId: attempt.id, questionId: q[0]!, answer: { selectedOptionIds: [o[0]![0]!] } });
    await uc.save.execute({ participantId: lan.id, attemptId: attempt.id, questionId: q[1]!, answer: { selectedOptionIds: [o[1]![0]!] } }); // partial: 0 points
    await uc.save.execute({ participantId: lan.id, attemptId: attempt.id, questionId: q[2]!, answer: { textAnswer: 'essay' } });

    events.events.length = 0;
    clock.advance(60_000);
    const res = await uc.submit.execute({ participantId: lan.id, attemptId: attempt.id });
    expect(res).toMatchObject({ maxScore: 3, essayPending: true, attempt: { autoScore: 1, submittedAt: new Date(61_000) } });
    expect(events.events.map(e => e.type)).toEqual(['leaderboard', 'participants']);
    expect((await attempts.answersOf(attempt.id)).map(a => a.autoScore)).toEqual([1, 0, null]);
  });

  it('rejects bad input with 400-kind errors, other people\'s attempts as not found, and edits after submit or close', async () => {
    const uc = await setup();
    const { attempt } = await uc.start.execute(lan.id);
    const { q, o } = await ids();
    const save = (answer: object, questionId = q[0]!) => uc.save.execute({ participantId: lan.id, attemptId: attempt.id, questionId, answer });
    await expect(save({ textAnswer: 'x' })).rejects.toBeInstanceOf(InvalidAnswerError);
    await expect(save({ selectedOptionIds: [o[1]![0]!] })).rejects.toThrow('Đáp án không thuộc câu hỏi này');
    await expect(save({ selectedOptionIds: [1] }, 999)).rejects.toThrow('Câu hỏi không thuộc lượt làm bài này');
    const other = await people.add({ sessionId, displayName: 'Mai', email: null, token: 't2', status: 'active', joinedAt: new Date() });
    await expect(uc.save.execute({ participantId: other.id, attemptId: attempt.id, questionId: q[0]!, answer: { selectedOptionIds: [] } })).rejects.toBeInstanceOf(AttemptNotFoundError);

    await sessions.update(sessionId, { status: 'closed' });
    await expect(save({ selectedOptionIds: [] })).rejects.toBeInstanceOf(SessionNotRunningError);
    await sessions.update(sessionId, { status: 'running' });
    await uc.submit.execute({ participantId: lan.id, attemptId: attempt.id });
    await expect(save({ selectedOptionIds: [] })).rejects.toBeInstanceOf(AttemptAlreadySubmittedError);
    await expect(uc.submit.execute({ participantId: lan.id, attemptId: attempt.id })).rejects.toBeInstanceOf(AttemptAlreadySubmittedError);
    await expect(uc.start.execute(lan.id)).rejects.toBeInstanceOf(AlreadyAttemptedError);
  });

  it('a failure inside the unit leaves the attempt unsubmitted', async () => {
    const uc = await setup();
    const { attempt } = await uc.start.execute(lan.id);
    attempts.markSubmitted = async () => { throw new Error('boom'); };
    await expect(uc.submit.execute({ participantId: lan.id, attemptId: attempt.id })).rejects.toThrow('boom');
    expect((await attempts.answersOf(attempt.id))).toEqual([]); // blank rows rolled back too
  });
});

describe('answer key visibility', () => {
  it('the review is refused until the session closes, then shows the key', async () => {
    const uc = await setup();
    const { attempt } = await uc.start.execute(lan.id);
    await uc.submit.execute({ participantId: lan.id, attemptId: attempt.id });
    await expect(uc.review.execute(lan, attempt.id)).rejects.toBeInstanceOf(AnswersNotYetVisibleError);
    await sessions.update(sessionId, { status: 'closed' });
    const r = await uc.review.execute(lan, attempt.id);
    expect(r.sessionStatus).toBe('closed');
    expect(r.exam.questions[0]!.options.some(o => o.isCorrect)).toBe(true);
  });

  it('the mentor sees any state: none, doing, submitted', async () => {
    const uc = await setup();
    expect(await uc.participantReview.execute(lan.id)).toMatchObject({ state: 'none', review: null });
    const { attempt } = await uc.start.execute(lan.id);
    expect(await uc.participantReview.execute(lan.id)).toMatchObject({ state: 'doing', review: null });
    await uc.submit.execute({ participantId: lan.id, attemptId: attempt.id });
    expect((await uc.participantReview.execute(lan.id)).review?.attempt.id).toBe(attempt.id); // while still running
    await expect(uc.participantReview.execute(99)).rejects.toBeInstanceOf(ParticipantNotFoundError);
  });

  it('GetAttemptView only returns the member\'s own attempt', async () => {
    const uc = await setup();
    const { attempt } = await uc.start.execute(lan.id);
    expect((await uc.view.execute(lan, attempt.id)).attempt.id).toBe(attempt.id);
    const other = await people.add({ sessionId, displayName: 'Mai', email: null, token: 't2', status: 'active', joinedAt: new Date() });
    await expect(uc.view.execute(other, attempt.id)).rejects.toBeInstanceOf(AttemptNotFoundError);
  });
});

describe('GetMemberState / AutoSubmitOpenAttempts', () => {
  it('reports whether the member can start, the current attempt and the submitted ones with the max auto score', async () => {
    const uc = await setup();
    expect(await uc.memberState.execute(lan)).toMatchObject({ canStartNew: true, current: null, submitted: [], maxScore: 3 });
    const { attempt } = await uc.start.execute(lan.id);
    expect(await uc.memberState.execute(lan)).toMatchObject({ canStartNew: false, current: { id: attempt.id } });
    await uc.submit.execute({ participantId: lan.id, attemptId: attempt.id });
    expect((await uc.memberState.execute(lan)).submitted).toHaveLength(1);
  });

  it('closing submits open attempts of active members and skips kicked ones', async () => {
    const uc = await setup();
    const a = (await uc.start.execute(lan.id)).attempt;
    const mai = await people.add({ sessionId, displayName: 'Mai', email: null, token: 't2', status: 'active', joinedAt: new Date() });
    const b = (await uc.start.execute(mai.id)).attempt;
    await people.update(mai.id, { status: 'kicked' });
    expect(await uc.autoSubmit.submitOpenAttempts(sessionId)).toBe(1);
    expect((await attempts.findOwned(lan.id, a.id))!.submittedAt).toEqual(new Date(1000));
    expect((await attempts.findOwned(mai.id, b.id))!.submittedAt).toBeNull();
    expect(await uc.autoSubmit.submitOpenAttempts(sessionId)).toBe(0);
  });
});
