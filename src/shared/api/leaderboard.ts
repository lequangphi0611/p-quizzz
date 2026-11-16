// Public: shown on member screens and on the projector. Names and scores only — no ids, tokens or answers.
export interface LeaderboardEntry {
  rank: number; // ties share a rank (1, 1, 3)
  displayName: string;
  score: number; // counted attempt: automatic + manual points
  maxScore: number; // exam total points
  submittedAt: number; // epoch ms of the counted attempt
}

export interface LeaderboardResponse {
  provisional: boolean; // true until the session is finalized
  entries: LeaderboardEntry[];
}
