// SSE event names. Events are only "something changed" signals (payload is always `{}`); clients refetch over REST.
export const SESSION_EVENT_TYPES = ['session', 'participants', 'leaderboard'] as const;
export type SessionEventType = (typeof SESSION_EVENT_TYPES)[number];
