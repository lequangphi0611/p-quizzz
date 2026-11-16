import { z } from 'zod';
import type { SessionStatus } from '../session-state.js';
import type { EditRequestInfo } from './attempts.js';

export type SessionMode = 'self_paced' | 'live';

export const CreateSessionBody = z.object({
  examId: z.number().int().positive('Chọn một đề'),
  shuffle: z.boolean().optional(),
  autoApprove: z.boolean().optional(), // let everyone in without the mentor's approval (default false)
});

export interface SessionSummary {
  id: number;
  examId: number;
  examTitle: string;
  mode: SessionMode;
  status: SessionStatus;
  shuffle: boolean;
  autoApprove: boolean;
  roomCode: string | null; // mentor-only; null until the session is opened
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

// Mentor's view of one member's work. `countedScore` is the counted attempt's score so far
// (automatic + manual graded so far); null until something is submitted.
export interface ParticipantProgress {
  state: 'none' | 'doing' | 'submitted';
  attempts: number; // attempts started, including one in progress
  countedScore: number | null;
  maxScore: number; // exam total points
  submittedAt: number | null; // epoch ms the counted attempt was submitted (drives mentor notifications)
  editRequest: EditRequestInfo | null; // the counted attempt's request to edit the essays (PRODUCT.md §7.21)
}

export interface SessionParticipantDetail extends SessionParticipantInfo {
  progress: ParticipantProgress;
}

export interface SessionDetail extends SessionSummary {
  exam: { id: number; title: string; hasEssay: boolean; totalPoints: number };
  participants: SessionParticipantDetail[];
}

// GET /api/screen/room — only answers on the mentor's machine (the projector). Never exposed publicly.
export interface ScreenRoom {
  roomCode: string | null;
}

// GET /api/sessions/active (public). `null` when no session is in lobby/running.
export interface ActiveSession {
  id: number;
  title: string;
  status: SessionStatus;
}
