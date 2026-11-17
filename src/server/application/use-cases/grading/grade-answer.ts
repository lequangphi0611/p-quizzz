import type { GradeResponse } from '../../../../shared/api/index.js';
import { AnswerNotFoundError } from '../../../domain/grading/errors.js';
import type { AiUse } from '../../../domain/grading/ai-suggestion.js';
import { assertGradable, manualTotal, normalizeFeedback } from '../../../domain/grading/grading.js';
import { AttemptNotFoundError } from '../../../domain/attempt/errors.js';
import { ParticipantNotFoundError } from '../../../domain/participant/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { GradingUnitContext } from '../../ports/ai-suggestion-repository.js';
import type { Clock } from '../../ports/clock.js';
import type { EventPublisher } from '../../ports/event-publisher.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { toAiSuggestionDto } from './ai-dto.js';
import { essayProgressOf, loadCountedWork } from './essay-progress.js';

interface Deps {
  unitOfWork: UnitOfWork<GradingUnitContext>;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Stores a grade (or clears it) and recomputes the attempt's manual total, as one unit. A suggestion still waiting for the
 * AI is dropped (the mentor graded it already), and the suggestion remembers how it was used (PRODUCT.md §7.28).
 */
async function writeGrade(deps: Deps, answerId: number, grade: { score: number; feedback?: string; aiUse?: AiUse } | null): Promise<GradeResponse> {
  const { response, sessionId } = await deps.unitOfWork.run(async ctx => {
    const answer = await ctx.attempts.findAnswerById(answerId);
    if (!answer) throw new AnswerNotFoundError();
    const attempt = await ctx.attempts.findById(answer.attemptId);
    const participant = attempt && (await ctx.participants.findById(attempt.participantId));
    const question = await ctx.exams.findQuestion(answer.questionId);
    if (!attempt) throw new AttemptNotFoundError();
    if (!participant) throw new ParticipantNotFoundError();
    if (!question) throw new AnswerNotFoundError();
    const session = await ctx.sessions.findById(participant.sessionId);
    if (!session) throw new SessionNotFoundError();

    assertGradable({
      questionType: question.type,
      questionPoints: question.points,
      sessionStatus: session.status,
      participantStatus: participant.status,
      attemptSubmitted: !!attempt.submittedAt,
      score: grade?.score ?? 0,
    });

    const updated = await ctx.attempts.gradeAnswer(
      answerId,
      grade ? { manualScore: grade.score, feedback: normalizeFeedback(grade.feedback), gradedAt: deps.clock.now() } : { manualScore: null, feedback: null, gradedAt: null },
    );
    await ctx.attempts.setManualScore(attempt.id, manualTotal(await ctx.attempts.answersOf(attempt.id)));
    await ctx.aiSuggestions.removeQueued([answerId]);
    await ctx.aiSuggestions.setUsed(answerId, grade?.aiUse ?? null);
    const [suggestion] = await ctx.aiSuggestions.listByAnswerIds([answerId]);

    const { graded, total } = essayProgressOf(await loadCountedWork(ctx, session.id, session.examId));
    return {
      sessionId: session.id,
      response: {
        answer: { answerId: updated.id, participantId: participant.id, displayName: participant.displayName, textAnswer: updated.textAnswer, manualScore: updated.manualScore, feedback: updated.feedback, aiSuggestion: toAiSuggestionDto(suggestion) },
        graded,
        total,
      },
    };
  });
  await deps.events.publish(sessionId, 'leaderboard');
  return response;
}

/** The mentor scores one essay answer (0.5 steps), by hand or by confirming the AI's suggestion (`aiUse`). */
export class GradeAnswer {
  constructor(private readonly deps: Deps) {}

  execute(input: { answerId: number; score: number; feedback?: string; aiUse?: AiUse }): Promise<GradeResponse> {
    return writeGrade(this.deps, input.answerId, input);
  }
}

/** "Hoàn tác": the answer goes back to ungraded. Same rules as grading (closed, not finalized). */
export class ClearGrade {
  constructor(private readonly deps: Deps) {}

  execute(answerId: number): Promise<GradeResponse> {
    return writeGrade(this.deps, answerId, null);
  }
}
