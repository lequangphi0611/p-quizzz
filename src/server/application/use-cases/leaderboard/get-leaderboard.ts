import type { LeaderboardResponse } from '../../../../shared/api/index.js';
import { pickCountedAttempts } from '../../../domain/grading/grading.js';
import { buildLeaderboard } from '../../../domain/leaderboard/leaderboard.js';
import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { areScoresHidden } from '../../../domain/session/score-visibility.js';
import type { AttemptReader } from '../../ports/attempt-repository.js';
import type { ExamReader } from '../../ports/exam-repository.js';
import type { ParticipantReader } from '../../ports/participant-repository.js';
import type { SessionRepository } from '../../ports/session-repository.js';

/** Public, read-only. Realtime clients refetch it on the `leaderboard` event. Scores held back by the mentor never leave here. */
export class GetLeaderboard {
  constructor(private readonly deps: { attempts: AttemptReader; sessions: Pick<SessionRepository, 'findById'>; exams: Pick<ExamReader, 'findSummary'>; participants: ParticipantReader }) {}

  async execute(sessionId: number): Promise<LeaderboardResponse> {
    const session = await this.deps.sessions.findById(sessionId);
    if (!session) throw new SessionNotFoundError();
    const exam = await this.deps.exams.findSummary(session.examId);
    if (!exam) throw new ExamNotFoundError();
    const counted = pickCountedAttempts(await this.deps.attempts.listSubmittedOfActiveMembers(sessionId));
    const names = new Map((await this.deps.participants.namesOf(sessionId)).map(p => [p.id, p.displayName]));
    return buildLeaderboard({ status: session.status, totalPoints: exam.totalPoints, counted, names, hidden: areScoresHidden(session) });
  }
}
