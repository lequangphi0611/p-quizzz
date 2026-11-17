// SSE event names. Events are only "something changed" signals; clients refetch over REST.
// Per-session stream: payload `{}`. Mentor-wide stream (GET /api/admin/events): payload `{"sessionId":N}`.
export const SESSION_EVENT_TYPES = ['session', 'participants', 'leaderboard'] as const;
export type SessionEventType = (typeof SESSION_EVENT_TYPES)[number];
