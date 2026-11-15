import { z } from 'zod';
import type { SessionStatus } from '../session-state.js';
import type { SessionParticipantInfo } from './sessions.js';

export const MAX_NAME_LENGTH = 30;

// Trim, collapse runs of whitespace, and compose accents (NFC) so "Đạt" typed two ways is the same name.
export const normalizeDisplayName = (raw: string): string => raw.normalize('NFC').replace(/\s+/g, ' ').trim();

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

// The token is returned here and nowhere else.
export interface JoinResponse {
  token: string;
  participant: SessionParticipantInfo;
}

// GET /api/me. `attempt` is filled in by S11.
export interface MeResponse {
  participant: SessionParticipantInfo;
  // participantCount = members with status 'active' (the lobby shows "N người đã vào").
  session: { id: number; title: string; status: SessionStatus; participantCount: number };
  attempt: null;
}
