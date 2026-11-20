import type { SharedQuestion } from '../../../shared/api/index.js';
import type { SessionStatus } from '../../../shared/session-state.js';
import type { Answer } from '../attempt/attempt.js';
import { DomainError } from '../errors.js';
import type { Exam } from '../exam/exam.js';

// The share page (PRODUCT.md §7.33): the mentor shares closed sessions; anyone with the one share link reads the
// questions, the key, explanations and how the class chose. Pure rules; the use cases load the facts.

export class ShareNotAllowedError extends DomainError {
  constructor() {
    super('conflict', 'Chỉ chia sẻ được sau khi đóng phiên');
  }
}

/** A wrong link and a replaced one read the same, so nobody learns whether a share page ever existed. */
export class ShareLinkInvalidError extends DomainError {
  constructor() {
    super('not_found', 'Link này không mở được. Link có thể bị gõ sai hoặc không còn dùng nữa.', 'share_link_invalid');
  }
}

/** The link is right but this session is not (or no longer) shared. An unknown id reads the same. */
export class SessionNotSharedError extends DomainError {
  constructor() {
    super('not_found', 'Phiên này không còn được chia sẻ.', 'session_not_shared');
  }
}

const ENDED: readonly SessionStatus[] = ['closed', 'finalized'];

/** Answers are revealed only from CLOSED (PRODUCT.md §4.6), so only an ended session can be shared. */
export function assertCanShare(status: SessionStatus): void {
  if (!ENDED.includes(status)) throw new ShareNotAllowedError();
}

/** Is this session on the share page right now? */
export function isShared(s: { status: SessionStatus; sharedAt: Date | null }): boolean {
  return s.sharedAt !== null && ENDED.includes(s.status);
}

/** Compares a presented token with the stored one without stopping at the first different character. */
export function tokensMatch(presented: string, stored: string): boolean {
  let diff = presented.length ^ stored.length;
  for (let i = 0; i < stored.length; i++) diff |= (presented.charCodeAt(i) | 0) ^ stored.charCodeAt(i);
  return diff === 0;
}

/**
 * The questions as the share page shows them, in exam order. `answers` are those of the counted attempts and
 * `submitted` how many there are. Only aggregate counts leave here: no answer, attempt or participant id.
 */
export function sharedQuestions(exam: Pick<Exam, 'questions'>, answers: readonly Pick<Answer, 'questionId' | 'selectedOptionIds'>[], submitted: number): SharedQuestion[] {
  return exam.questions.map(q => {
    const base = {
      id: q.id, position: q.position, type: q.type, prompt: q.prompt, body: q.body, points: q.points, explanation: q.explanation,
      options: q.options.map(o => ({ id: o.id, position: o.position, text: o.text, isCorrect: o.isCorrect })),
    };
    if (q.type === 'essay' || submitted === 0) return { ...base, distribution: null };
    const counts: Record<number, number> = {};
    for (const o of q.options) counts[o.id] = 0;
    let picked = 0;
    for (const a of answers) {
      if (a.questionId !== q.id || !a.selectedOptionIds?.length) continue;
      picked++;
      for (const id of new Set(a.selectedOptionIds)) if (id in counts) counts[id]!++;
    }
    // A counted attempt always has a row per question; a missing one still counts as blank.
    return { ...base, distribution: { counts, blank: submitted - picked } };
  });
}
