import { z } from 'zod';
import type { SessionStatus } from '../session-state.js';
import type { EditRequestInfo } from './attempts.js';
import { MAX_READY_MIN, type SessionStartInfo } from '../session-start.js';
import { MAX_EXTEND_MINUTES, MAX_TIME_LIMIT_MINUTES, MIN_TIME_LIMIT_MINUTES, isTimeLimitMinutes, type SessionTimer } from '../session-timer.js';

export type SessionMode = 'self_paced' | 'live';

export const MAX_SESSION_NAME_LENGTH = 80;

/** Who may join (PRODUCT.md §7.22): anyone with the code (`free`), or only the emails on the session's list (`roster`). */
export type SessionAccess = 'free' | 'roster';
/** Someone not on the list: turned away, or waiting for the mentor (`pending`). */
export type OutsiderPolicy = 'block' | 'pending';
/** `group` = list copied from a saved group; `temp` = typed for this session (can be saved as a group later). */
export type RosterSource = 'group' | 'temp';
/**
 * When members see scores and the leaderboard (PRODUCT.md §7.25): right after they submit (`on_submit`, the default), or
 * only once the mentor publishes them (`on_release`). Closing the session publishes them anyway.
 */
export type ScoreVisibility = 'on_submit' | 'on_release';
const TIME_LIMIT_MESSAGE = `Thời gian làm bài là số phút nguyên từ ${MIN_TIME_LIMIT_MINUTES} đến ${MAX_TIME_LIMIT_MINUTES}`;
const TimeLimitMinutes = z.number({ error: TIME_LIMIT_MESSAGE }).refine(isTimeLimitMinutes, TIME_LIMIT_MESSAGE);
/** PUT /api/admin/sessions/:id/time-limit: change, add or remove the limit before the session starts. */
export const TimeLimitBody = z.object({ timeLimitMinutes: TimeLimitMinutes.nullable() });
/** POST /api/admin/sessions/:id/extend-time: "+N phút" for everyone while the session runs. */
export const ExtendTimeBody = z.object({
  minutes: z.number().int().min(1, 'Cộng ít nhất 1 phút').max(MAX_EXTEND_MINUTES, `Mỗi lần cộng tối đa ${MAX_EXTEND_MINUTES} phút`),
});

/** PUT /api/admin/sessions/:id/start-schedule: the scheduled start (epoch ms), or null to remove it (PRODUCT.md §7.31b). */
export const StartScheduleBody = z.object({ startsAt: z.number({ error: 'Giờ bắt đầu không hợp lệ' }).int().positive().nullable() });
/** PUT /api/admin/sessions/:id/auto-start: "Tự bắt đầu khi mọi người sẵn sàng" and its least number of people (§7.31e). */
export const AutoStartBody = z.object({
  enabled: z.boolean(),
  minParticipants: z.number({ error: 'Số người tối thiểu không hợp lệ' }).int().min(1, 'Tối thiểu 1 người').max(MAX_READY_MIN, `Tối đa ${MAX_READY_MIN} người`),
});

export const ScoreVisibilityBody = z.object({ scoreVisibility: z.enum(['on_submit', 'on_release']) });

export const CreateSessionBody = z.object({
  examId: z.number().int().positive('Chọn một đề'),
  // Mentor-only label; defaults to "<exam title> – dd/MM" (PRODUCT.md §7.5).
  name: z.string().trim().max(MAX_SESSION_NAME_LENGTH, `Tên phiên tối đa ${MAX_SESSION_NAME_LENGTH} ký tự`).optional(),
  shuffle: z.boolean().optional(),
  autoApprove: z.boolean().optional(), // let everyone in without the mentor's approval (default false); only for free sessions
  // Who may join. Omitted = free (as before).
  access: z
    .union([
      z.object({ kind: z.literal('free') }),
      z.object({ kind: z.literal('group'), groupId: z.number().int().positive('Chọn một nhóm') }),
      z.object({ kind: z.literal('emails'), emails: z.array(z.string()).min(1, 'Nhập ít nhất một email').max(2000) }),
    ])
    .optional(),
  outsiderPolicy: z.enum(['block', 'pending']).optional(), // roster sessions only (default block)
  scoreVisibility: z.enum(['on_submit', 'on_release']).optional(), // default on_submit (PRODUCT.md §7.25)
  // Minutes (PRODUCT.md §7.27). Omitted = the exam's `duration`; null = no time limit.
  timeLimitMinutes: TimeLimitMinutes.nullable().optional(),
  // How it starts (PRODUCT.md §7.31). Omitted = by hand, as before. `startsAt` is epoch ms and must lie ahead.
  startsAt: StartScheduleBody.shape.startsAt.optional(),
  autoStart: AutoStartBody.optional(),
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
  access: SessionAccess;
  outsiderPolicy: OutsiderPolicy;
  rosterSource: RosterSource | null; // null for free sessions
  scoreVisibility: ScoreVisibility;
  scoresReleasedAt: number | null; // epoch ms the mentor pressed "Công bố điểm"; null otherwise (closing publishes without setting it)
  scoresHidden: boolean; // members and the projector cannot see scores or ranks right now
  timeLimitMinutes: number | null; // the setting (PRODUCT.md §7.27), kept after the session ends; null = no limit
  timer: SessionTimer | null; // the running clock; null without a limit or once the session ended
  start: SessionStartInfo | null; // how and when it starts (PRODUCT.md §7.31); null once it has started
  startScheduleDroppedAt: number | null; // a scheduled start passed while the server was off and was dropped (the bell says so)
  pendingCount: number; // waiting for the mentor's approval
  roomCode: string | null; // mentor-only; null until the session is opened
  createdAt: number; // epoch ms
  openedAt: number | null;
  startedAt: number | null;
  closedAt: number | null;
  finalizedAt: number | null;
  sharedAt: number | null; // on the share page since then (PRODUCT.md §7.33); null = not shared
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
  /** Questions answered in the attempt still in progress, out of `SessionDetail.exam.questionCount`; null without one or outside RUNNING. Never how many are correct (PRODUCT.md §7.26). */
  answered: number | null;
}

export interface SessionParticipantDetail extends SessionParticipantInfo {
  readyAt: number | null; // mentor only: pressed "Sẵn sàng" in the lobby (PRODUCT.md §7.31d)
  progress: ParticipantProgress;
  email: string | null; // mentor only (PRODUCT.md §7.24); null in free sessions
  /** Mentor only (PRODUCT.md §7.23b): is the member's browser still talking to the server, and when was it last heard from. */
  connection: { online: boolean; lastSeenAt: number | null };
  /** The mentor said "let them back in": until this time (epoch ms) entering their email/name again takes the seat over once. */
  rejoinAllowedUntil: number | null;
}

// How the session's list is doing: emails on it, how many have a participant, and those still missing. Mentor only.
export interface SessionRoster {
  size: number;
  joined: number;
  notJoined: string[];
}

export interface SessionDetail extends SessionSummary {
  exam: { id: number; title: string; hasEssay: boolean; totalPoints: number; questionCount: number };
  participants: SessionParticipantDetail[];
  roster: SessionRoster | null; // null for free sessions
  /** Someone claiming a seat that already has a person behind it, waiting for the mentor (PRODUCT.md §7.23). Open sessions only. */
  rejoinRequests: RejoinRequestInfo[];
  /** For the warnings when the mentor turns sharing on (PRODUCT.md §7.33a): other sessions of the same exam not yet closed, and counted submissions here. */
  share: { examUnfinishedSessions: number; submitted: number };
}

export interface RejoinRequestInfo {
  id: number;
  participantId: number; // the person holding the seat
  claimantName: string; // what the person asking typed
  requestedAt: number; // epoch ms
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
  access: SessionAccess; // tells the join form whether to ask for an email
  timer: SessionTimer | null; // shared clock (PRODUCT.md §7.27): the lobby shows the minutes, the projector counts down
  start: SessionStartInfo | null; // the start (PRODUCT.md §7.31): counts only, never who; null once started
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
