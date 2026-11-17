// Public: shown on member screens and on the projector. Names and scores only — no ids, tokens or answers.
export interface LeaderboardEntry {
  rank: number; // ties share a rank (1, 1, 3)
  displayName: string;
  score: number; // counted attempt: automatic + manual points
  maxScore: number; // exam total points
  submittedAt: number; // epoch ms of the counted attempt
}

// Who has submitted, without score or rank: what members and the projector see while scores are held back.
export interface SubmittedEntry {
  displayName: string;
  submittedAt: number; // epoch ms
}

export interface LeaderboardResponse {
  provisional: boolean; // true until the session is finalized
  // The mentor holds scores back (PRODUCT.md §7.25): `entries` is empty and `submitted` lists who has handed in, by time.
  hidden: boolean;
  entries: LeaderboardEntry[];
  submitted: SubmittedEntry[]; // empty unless hidden
}
