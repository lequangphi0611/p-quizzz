import { z } from 'zod';
import type { SessionStatus } from '../session-state.js';
import type { EditRequestInfo } from './attempts.js';

export type SessionMode = 'self_paced' | 'live';

export const MAX_SESSION_NAME_LENGTH = 80;

export const CreateSessionBody = z.object({
  examId: z.number().int().positive('Chọn một đề'),
  // Mentor-only label; defaults to "<exam title> – dd/MM" (PRODUCT.md §7.5).
  name: z.string().trim().max(MAX_SESSION_NAME_LENGTH, `Tên phiên tối đa ${MAX_SESSION_NAME_LENGTH} ký tự`).optional(),
  shuffle: z.boolean().optional(),
  autoApprove: z.boolean().optional(), // let everyone in without the mentor's approval (default false)
});

export interface SessionSummary {
  id: number;
  examId: number;
  examTitle: string;
  name: string; // mentor-only: members and the projector see the exam title
  slot: number | null; // lowest free number among open sessions; null when not open
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

// GET /api/screen/sessions/:id/room — only answers on the mentor's machine (the projector). Never exposed publicly.
export interface ScreenRoom {
  roomCode: string | null;
}

// What the public may know about a session: the exam title, never the mentor's session name or room code.
// Returned by POST /api/rooms/resolve and GET /api/sessions/:id/public.
export interface ActiveSession {
  id: number;
  title: string;
  status: SessionStatus;
}

// POST /api/rooms/resolve: member types the room code, the server finds the open session.
export const ResolveRoomBody = z.object({
  roomCode: z
    .string({ error: 'Nhập mã phòng' })
    .transform(raw => raw.replace(/\D/g, ''))
    .refine(s => s.length === 6, 'Mã phòng gồm 6 chữ số'),
});

// GET /api/screen/sessions (mentor machine only): what the projector can follow. `latestEnded` only when nothing is open.
export interface ScreenSessionItem {
  id: number;
  name: string;
  slot: number | null;
  title: string; // exam title
  status: SessionStatus;
}
export interface ScreenSessions {
  open: ScreenSessionItem[];
  latestEnded: ScreenSessionItem | null;
}
