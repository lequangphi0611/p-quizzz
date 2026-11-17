import type { SessionSummary } from '../../../../shared/api/index.js';
import { formatRoomCode, joinLink } from '../../../shared/room/room-code.js';

export type InvitableSession = Pick<SessionSummary, 'id' | 'examTitle' | 'status' | 'access' | 'roomCode'>;

const STATUS_TEXT: Partial<Record<SessionSummary['status'], string>> = {
  lobby: 'đang mở phòng chờ',
  running: 'đang làm bài',
};

/** Only sessions a member can join right now: lobby/running with a room code. */
export const isInvitable = (s: InvitableSession): boolean => (s.status === 'lobby' || s.status === 'running') && !!s.roomCode;

/**
 * The text the mentor pastes into the class chat (PRODUCT.md §7.26).
 * Members only ever see the exam title, so the mentor's session name and group are never in it (§7.5, §7.24).
 */
export function buildInvitation(sessions: readonly InvitableSession[], host: string): string {
  const list = sessions.filter(isInvitable);
  if (list.length === 0) return '';
  const lines: string[] = [list.length === 1 ? 'Bài thi đang mở:' : `${list.length} bài thi đang mở:`, ''];
  list.forEach((s, i) => {
    const prefix = list.length === 1 ? '' : `${i + 1}. `;
    lines.push(`${prefix}${s.examTitle} (${STATUS_TEXT[s.status]})`);
    const pad = ' '.repeat(prefix.length);
    lines.push(`${pad}Link: ${joinLink(host, s.roomCode!)}`);
    lines.push(`${pad}Mã phòng: ${formatRoomCode(s.roomCode!)}`);
    lines.push('');
  });
  const needsEmail = list.some(s => s.access !== 'free');
  lines.push(needsEmail
    ? `Bấm link để vào (hoặc mở http://${host} rồi gõ mã phòng), nhập tên hiển thị; phòng của nhóm thì nhập thêm email.`
    : `Bấm link để vào (hoặc mở http://${host} rồi gõ mã phòng), rồi nhập tên hiển thị.`);
  return lines.join('\n');
}

/** Exam titles that appear more than once in the selection: members cannot tell those rooms apart from the text alone. */
export function duplicateTitles(sessions: readonly InvitableSession[]): string[] {
  const seen = new Map<string, number>();
  for (const s of sessions.filter(isInvitable)) seen.set(s.examTitle, (seen.get(s.examTitle) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([t]) => t);
}
