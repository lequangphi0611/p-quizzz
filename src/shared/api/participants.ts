import { z } from 'zod';
import type { SessionStatus } from '../session-state.js';
import type { MeAttemptState } from './attempts.js';
import type { SessionParticipantInfo } from './sessions.js';

export const MAX_NAME_LENGTH = 30;

// Trim, collapse runs of whitespace, and compose accents (NFC) so "Đạt" typed two ways is the same name.
// Control characters, zero-width spaces and bidi overrides would let two names look identical (or hide a name entirely).
// ZWJ/ZWNJ (U+200D/U+200C) stay because emoji sequences and some scripts need them.
const INVISIBLE = /[\p{Cc}\u00AD\u061C\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/gu;
export const normalizeDisplayName = (raw: string): string => raw.normalize('NFC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();

// Key used to compare names: case-insensitive for the whole Unicode range (SQLite's lower() only does ASCII).
export const displayNameKey = (name: string): string => normalizeDisplayName(name).toLowerCase();

// Body of join and of the mentor's rename. The parsed value is already normalized.
export const DisplayNameBody = z.object({
  displayName: z
    .string({ error: 'Nhập tên của bạn' })
    .transform(normalizeDisplayName)
    .refine(s => s.length > 0, 'Tên không được để trống')
    .refine(s => [...s].length <= MAX_NAME_LENGTH, `Tên tối đa ${MAX_NAME_LENGTH} ký tự`),
});

export const ROOM_CODE_LENGTH = 6;

/** Digits only: members may paste "482 913" or "482-913". */
export const normalizeRoomCode = (raw: string): string => raw.replace(/\D/g, '');

// POST /api/sessions/:id/join. The code is validated for format here and for correctness on the server.
export const JoinBody = DisplayNameBody.extend({
  roomCode: z
    .string({ error: 'Nhập mã phòng' })
    .transform(normalizeRoomCode)
    .refine(s => s.length === ROOM_CODE_LENGTH, `Mã phòng gồm ${ROOM_CODE_LENGTH} chữ số`),
});

// The token is returned here and nowhere else.
export interface JoinResponse {
  token: string;
  participant: SessionParticipantInfo;
}

// GET /api/me.
export interface MeResponse {
  participant: SessionParticipantInfo;
  // participantCount = members with status 'active' (the lobby shows "N người đã vào").
  // questionCount / totalPoints / hasEssay describe the exam for the start screen (counts only, no content).
  session: { id: number; title: string; status: SessionStatus; participantCount: number; questionCount: number; totalPoints: number; hasEssay: boolean };
  attempt: MeAttemptState;
}

// GET /api/sessions/:id/participants — public (projector lobby). Names only: no id, token or status.
export interface PublicParticipant {
  displayName: string;
}
