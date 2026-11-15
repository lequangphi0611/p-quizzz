import { z } from 'zod';
import type { SessionStatus } from '../session-state.js';

export type SessionMode = 'self_paced' | 'live';

export const CreateSessionBody = z.object({
  examId: z.number().int().positive('Chọn một đề'),
  shuffle: z.boolean().optional(),
});

export interface SessionSummary {
  id: number;
  examId: number;
  examTitle: string;
  mode: SessionMode;
  status: SessionStatus;
  shuffle: boolean;
  createdAt: number; // epoch ms
  openedAt: number | null;
  startedAt: number | null;
  closedAt: number | null;
  finalizedAt: number | null;
  participantCount: number; // participants with status 'active'
}

// Never carries the participant token.
export interface SessionParticipantInfo {
  id: number;
  displayName: string;
  status: 'active' | 'pending' | 'kicked';
  joinedAt: number; // epoch ms
}

export interface SessionDetail extends SessionSummary {
  exam: { id: number; title: string; hasEssay: boolean; totalPoints: number };
  participants: SessionParticipantInfo[];
}

// GET /api/sessions/active (public). `null` when no session is in lobby/running.
export interface ActiveSession {
  id: number;
  title: string;
  status: SessionStatus;
}
