import { parseRubric } from '../../../../shared/rubric.js';
import { assertCanSuggest, InvalidSuggestionError, isBlankText, normalizeSuggestion, pickAnswersToSuggest } from '../../../domain/grading/ai-suggestion.js';
import { QuestionNotFoundError } from '../../../domain/grading/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { GradingUnitContext, SuggestionQueue } from '../../ports/ai-suggestion-repository.js';
import type { Clock } from '../../ports/clock.js';
import { EssayGraderError, type EssayGrader, type EssayGradingInput } from '../../ports/essay-grader.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { loadCountedWork } from './essay-progress.js';

// AI grading suggestions (PRODUCT.md §7.28, docs/architecture.md §11.6). Suggestions never touch scores.

interface Deps {
  unitOfWork: UnitOfWork<GradingUnitContext>;
  clock: Clock;
}

/** The counted answers of one essay question of a session, with the question itself. */
async function questionWork(ctx: GradingUnitContext, sessionId: number, questionId: number) {
  const session = await ctx.sessions.findById(sessionId);
  if (!session) throw new SessionNotFoundError();
  const work = await loadCountedWork(ctx, sessionId, session.examId);
  const question = work.exam.questions.find(q => q.id === questionId);
  if (!question) throw new QuestionNotFoundError();
  return { session, question, answers: work.answers.filter(a => a.questionId === questionId) };
}

/** "AI chấm nháp" for one question: queues every written, ungraded answer without a live suggestion (or just `answerIds`). */
export class RequestAiSuggestions {
  constructor(private readonly deps: Deps & { grader: EssayGrader; queue: SuggestionQueue }) {}

  async execute(input: { sessionId: number; questionId: number; answerIds?: number[] }): Promise<{ queued: number }> {
    const available = await this.deps.grader.available();
    const ids = await this.deps.unitOfWork.run(async ctx => {
      const { session, question, answers } = await questionWork(ctx, input.sessionId, input.questionId);
      assertCanSuggest({ questionType: question.type, explanation: question.explanation, sessionStatus: session.status, available });
      const existing = new Map((await ctx.aiSuggestions.listByAnswerIds(answers.map(a => a.id))).map(s => [s.answerId, s]));
      const pick = pickAnswersToSuggest(answers, existing, input.answerIds);
      return ctx.aiSuggestions.queue(pick, this.deps.clock.now());
    });
    this.deps.queue.enqueue(ids);
    return { queued: ids.length };
  }
}

/** "Dừng": drops the answers of this question still waiting; the one running finishes, finished suggestions stay. */
export class StopAiSuggestions {
  constructor(private readonly deps: Deps) {}

  async execute(input: { sessionId: number; questionId: number }): Promise<{ stopped: number }> {
    return this.deps.unitOfWork.run(async ctx => {
      const { answers } = await questionWork(ctx, input.sessionId, input.questionId);
      return { stopped: await ctx.aiSuggestions.removeQueued(answers.map(a => a.id)) };
    });
  }
}

/** Runs one queued suggestion. Skips it if it was stopped or the mentor graded the answer meanwhile. Never throws. */
export class RunAiSuggestion {
  constructor(private readonly deps: Deps & { grader: EssayGrader; onError?: (err: unknown) => void }) {}

  async execute(suggestionId: number): Promise<void> {
    const job = await this.deps.unitOfWork.run(async ctx => {
      const row = await ctx.aiSuggestions.findById(suggestionId);
      if (!row || row.status !== 'queued') return null;
      const answer = await ctx.attempts.findAnswerById(row.answerId);
      if (!answer || answer.manualScore !== null || isBlankText(answer.textAnswer)) {
        await ctx.aiSuggestions.remove(row.id);
        return null;
      }
      const attempt = await ctx.attempts.findById(answer.attemptId);
      const participant = attempt && (await ctx.participants.findById(attempt.participantId));
      const session = participant && (await ctx.sessions.findById(participant.sessionId));
      const exam = session && (await ctx.exams.findById(session.examId));
      const question = exam?.questions.find(q => q.id === answer.questionId);
      if (!question || session?.status !== 'closed') {
        await ctx.aiSuggestions.fail(row.id, 'Phiên không còn ở trạng thái chấm được', this.deps.clock.now());
        return null;
      }
      await ctx.aiSuggestions.markRunning(row.id);
      const rubric = parseRubric(question.explanation, question.points);
      const input: EssayGradingInput = {
        questionPrompt: question.prompt,
        questionBody: question.body,
        maxPoints: question.points,
        rubricText: question.explanation ?? '',
        rubricCriteria: rubric?.criteria ?? null,
        answerText: answer.textAnswer!,
      };
      return { id: row.id, input };
    });
    if (!job) return;

    let outcome: { ok: true; value: ReturnType<typeof normalizeSuggestion> } | { ok: false; error: string };
    try {
      const raw = await this.deps.grader.suggest(job.input);
      outcome = { ok: true, value: normalizeSuggestion(raw, job.input.maxPoints, job.input.rubricCriteria, job.input.answerText.split('\n').length) };
    } catch (err) {
      if (err instanceof EssayGraderError) outcome = { ok: false, error: err.message };
      else if (err instanceof InvalidSuggestionError) outcome = { ok: false, error: new EssayGraderError('bad_output').message };
      else {
        this.deps.onError?.(err);
        outcome = { ok: false, error: 'Lỗi không xác định khi chạy AI' };
      }
    }

    await this.deps.unitOfWork.run(async ctx => {
      const row = await ctx.aiSuggestions.findById(job.id);
      if (!row || row.status !== 'running') return;
      if (outcome.ok) await ctx.aiSuggestions.complete(job.id, outcome.value, this.deps.clock.now());
      else await ctx.aiSuggestions.fail(job.id, outcome.error, this.deps.clock.now());
    });
  }
}

/** At startup: work left over by a previous process cannot finish any more. */
export class FailUnfinishedSuggestions {
  constructor(private readonly deps: Deps) {}

  execute(): Promise<number> {
    return this.deps.unitOfWork.run(ctx => ctx.aiSuggestions.failUnfinished('Server đã khởi động lại', this.deps.clock.now()));
  }
}
