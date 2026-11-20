import type { SharedSessionList, SharedSessionView } from '../../../../shared/api/index.js';
import { isShared, SessionNotSharedError, ShareLinkInvalidError, sharedQuestions, tokensMatch } from '../../../domain/sharing/sharing.js';
import type { AttemptReader } from '../../ports/attempt-repository.js';
import type { ExamReader } from '../../ports/exam-repository.js';
import type { SessionRepository } from '../../ports/session-repository.js';
import type { SharedSessionReader, ShareTokenStore } from '../../ports/share.js';
import { loadCountedWork } from '../grading/essay-progress.js';

async function assertToken(store: ShareTokenStore, presented: string): Promise<void> {
  const stored = await store.get();
  if (!stored || !tokensMatch(presented, stored)) throw new ShareLinkInvalidError();
}

/** The share page's list (PRODUCT.md §7.33c): exam title, start time and question count of each shared session. */
export class ListSharedSessions {
  constructor(private readonly deps: { store: ShareTokenStore; shared: SharedSessionReader }) {}

  async execute(token: string): Promise<SharedSessionList> {
    await assertToken(this.deps.store, token);
    const rows = await this.deps.shared.listShared();
    return { sessions: rows.map(r => ({ id: r.id, examTitle: r.examTitle, startedAt: r.startedAt ? r.startedAt.getTime() : null, questionCount: r.questionCount })) };
  }
}

/**
 * One shared session (PRODUCT.md §7.33d): questions in exam order with the key, explanations and the class's choice
 * counts over the counted attempts. A read model built straight into the shared DTO; nothing about any one person.
 */
export class GetSharedSession {
  constructor(private readonly deps: { store: ShareTokenStore; sessions: Pick<SessionRepository, 'findById'>; attempts: AttemptReader; exams: ExamReader }) {}

  async execute(token: string, sessionId: number): Promise<SharedSessionView> {
    await assertToken(this.deps.store, token);
    const session = await this.deps.sessions.findById(sessionId);
    if (!session || !isShared(session)) throw new SessionNotSharedError();
    const { exam, counted, answers } = await loadCountedWork(this.deps, sessionId, session.examId);
    const submitted = counted.size;
    return {
      id: session.id,
      examTitle: exam.title,
      startedAt: session.startedAt ? session.startedAt.getTime() : null,
      questionCount: exam.questions.length,
      submitted,
      questions: sharedQuestions(exam, answers, submitted),
    };
  }
}
