import type { GradingAnswer, GradingQuestion, GradingView } from '../../../../shared/api/index.js';
import { assertGradingOpen, compareKeys, shuffleKey } from '../../../domain/grading/grading.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { AttemptReader } from '../../ports/attempt-repository.js';
import type { ExamReader } from '../../ports/exam-repository.js';
import type { ParticipantReader } from '../../ports/participant-repository.js';
import type { SessionRepository } from '../../ports/session-repository.js';
import { parseRubric, hasRubric } from '../../../../shared/rubric.js';
import type { AiSuggestionReader } from '../../ports/ai-suggestion-repository.js';
import type { EssayGrader } from '../../ports/essay-grader.js';
import { toAiSuggestionDto } from './ai-dto.js';
import { loadCountedWork } from './essay-progress.js';

/** Everything the grading screen shows (mentor only): each essay question with the counted answers of every active member. A read model, built straight into the shared DTO. */
export class GetGradingView {
  constructor(private readonly deps: { attempts: AttemptReader; sessions: Pick<SessionRepository, 'findById'>; exams: ExamReader; participants: ParticipantReader; aiSuggestions: AiSuggestionReader; grader: Pick<EssayGrader, 'available'> }) {}

  async execute(sessionId: number): Promise<GradingView> {
    const session = await this.deps.sessions.findById(sessionId);
    if (!session) throw new SessionNotFoundError();
    assertGradingOpen(session.status);

    const { exam, counted, answers } = await loadCountedWork(this.deps, sessionId, session.examId);
    const participantOf = new Map([...counted].map(([pid, a]) => [a.id, pid]));
    const names = new Map((await this.deps.participants.namesOf(sessionId)).map(p => [p.id, p.displayName]));
    const essayIds = new Set(exam.questions.filter(q => q.type === 'essay').map(q => q.id));
    const suggestions = new Map((await this.deps.aiSuggestions.listByAnswerIds(answers.filter(a => essayIds.has(a.questionId)).map(a => a.id))).map(s => [s.answerId, s]));
    const count = (ids: number[], status: string) => ids.filter(id => suggestions.get(id)?.status === status).length;

    const questions: GradingQuestion[] = exam.questions
      .filter(q => q.type === 'essay')
      .map(q => {
        const own = answers.filter(a => a.questionId === q.id);
        const ids = own.map(a => a.id);
        return {
        id: q.id,
        position: q.position,
        prompt: q.prompt,
        body: q.body,
        points: q.points,
        explanation: q.explanation,
        hasRubric: hasRubric(q.explanation),
        rubric: parseRubric(q.explanation, q.points),
        ai: { queued: count(ids, 'queued'), running: count(ids, 'running'), done: count(ids, 'done'), failed: count(ids, 'failed') },
        answers: own
          .map((a): GradingAnswer => {
            const pid = participantOf.get(a.attemptId)!;
            return { answerId: a.id, participantId: pid, displayName: names.get(pid) ?? '', textAnswer: a.textAnswer, manualScore: a.manualScore, feedback: a.feedback, aiSuggestion: toAiSuggestionDto(suggestions.get(a.id)) };
          })
          .sort((x, y) => compareKeys(shuffleKey(sessionId, q.id, x.answerId), shuffleKey(sessionId, q.id, y.answerId))),
        };
      });
    const all = questions.flatMap(q => q.answers);
    return { sessionId, status: session.status, aiGrader: { available: await this.deps.grader.available() }, graded: all.filter(a => a.manualScore !== null).length, total: all.length, questions };
  }
}
