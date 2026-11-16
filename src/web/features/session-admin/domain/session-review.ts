import type { SessionParticipantDetail } from '../../../../shared/api/index.js';

export const MEMBERSHIP_LABEL: Record<SessionParticipantDetail['status'], { label: string; color: string }> = {
  active: { label: 'Đã tham gia', color: 'var(--correct-600)' },
  pending: { label: 'Chờ duyệt', color: 'var(--warn-600)' },
  kicked: { label: 'Đã bị kick', color: 'var(--wrong-600)' },
};

export interface SessionSummaryStats {
  total: number; // everyone who asked to join, whatever happened to them
  joined: number; // admitted (active)
  submitted: number; // admitted people with a submitted attempt
  average: number | null; // mean score of those who submitted; null when nobody did
}

// Headline numbers for the review page. Kicked and pending people are listed but do not count towards results.
export function summarize(participants: readonly SessionParticipantDetail[]): SessionSummaryStats {
  const joined = participants.filter(p => p.status === 'active');
  const scored = joined.filter(p => p.progress.state === 'submitted' && p.progress.countedScore !== null);
  const sum = scored.reduce((t, p) => t + (p.progress.countedScore ?? 0), 0);
  return { total: participants.length, joined: joined.length, submitted: scored.length, average: scored.length ? sum / scored.length : null };
}

/** The person to show first: the best-ranked submitter, else the first admitted member, else anyone. */
export function defaultSelection(participants: readonly SessionParticipantDetail[]): number | null {
  const submitted = participants.filter(p => p.status === 'active' && p.progress.state === 'submitted');
  const best = [...submitted].sort((a, b) => (b.progress.countedScore ?? 0) - (a.progress.countedScore ?? 0) || a.id - b.id)[0];
  return (best ?? participants.find(p => p.status === 'active') ?? participants[0])?.id ?? null;
}
