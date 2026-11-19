import { SMALL_CLASS_WARNING, type SessionDetail } from '../../../../shared/api/index.js';
import type { SessionStatus } from '../../../../shared/session-state.js';

// Mentor side of the share page (PRODUCT.md §7.33): when sharing is possible and what to warn about first.

export const canShare = (status: SessionStatus) => status === 'closed' || status === 'finalized';

/** The link members open: same LAN address as the join link. */
export const shareLink = (host: string, token: string) => `http://${host}/shared/${encodeURIComponent(token)}`;

export interface ShareWarnings {
  /** Other sessions of this exam not closed yet: their members could read the answers while working (needs a tick to go on). */
  unfinished: number;
  /** Fewer submissions than the warning line: the counts may give away who chose what. Null when there are enough. */
  fewSubmissions: number | null;
}

export function shareWarnings(share: SessionDetail['share']): ShareWarnings {
  return { unfinished: share.examUnfinishedSessions, fewSubmissions: share.submitted < SMALL_CLASS_WARNING ? share.submitted : null };
}
