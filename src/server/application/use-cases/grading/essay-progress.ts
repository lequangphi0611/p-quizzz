import { essayProgress, pickCountedAttempts, type EssayProgress } from '../../../domain/grading/grading.js';
import type { Answer, Attempt } from '../../../domain/attempt/attempt.js';
import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import type { AttemptReader } from '../../ports/attempt-repository.js';
import type { ExamReader } from '../../ports/exam-repository.js';
import type { SessionRepository, UngradedEssayCounter } from '../../ports/session-repository.js';
import type { Exam } from '../../../domain/exam/exam.js';

export interface CountedWork {
  exam: Exam;
  /** The counted attempt of each active member that submitted, keyed by participant id. */
  counted: Map<number, Attempt>;
  /** Their answers (all questions). */
  answers: Answer[];
}

/** Loads the exam, the counted attempts of the session and their answers: the base of grading, discussion and finalize. */
export async function loadCountedWork(deps: { attempts: AttemptReader; exams: ExamReader }, sessionId: number, examId: number): Promise<CountedWork> {
  const exam = await deps.exams.findById(examId);
  if (!exam) throw new ExamNotFoundError();
  const counted = pickCountedAttempts(await deps.attempts.listSubmittedOfActiveMembers(sessionId));
  const answers = await deps.attempts.answersOfAttempts([...counted.values()].map(a => a.id));
  return { exam, counted, answers };
}

/** Essay answers of counted attempts, and how many already have a score. This is what blocks `finalize`. */
export function essayProgressOf(work: CountedWork): EssayProgress {
  const essayIds = new Set(work.exam.questions.filter(q => q.type === 'essay').map(q => q.id));
  return essayProgress(work.answers.filter(a => essayIds.has(a.questionId)));
}

/** Seen from the sessions module: how many essay answers still wait for a score. */
export class CountUngradedEssays implements UngradedEssayCounter {
  constructor(private readonly deps: { attempts: AttemptReader; sessions: Pick<SessionRepository, 'findById'>; exams: ExamReader }) {}

  async count(sessionId: number): Promise<number> {
    const session = await this.deps.sessions.findById(sessionId);
    if (!session) throw new SessionNotFoundError();
    const { graded, total } = essayProgressOf(await loadCountedWork(this.deps, sessionId, session.examId));
    return total - graded;
  }
}
