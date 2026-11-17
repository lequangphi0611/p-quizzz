import { describe, expect, it } from 'vitest';
import { buildInvitation, duplicateTitles, isInvitable, type InvitableSession } from './invitation.js';

const s = (over: Partial<InvitableSession>): InvitableSession => ({ id: 1, examTitle: 'Docker cơ bản', status: 'lobby', access: 'free', roomCode: '482913', ...over });

describe('isInvitable', () => {
  it('accepts lobby and running sessions with a room code only', () => {
    expect(isInvitable(s({ status: 'lobby' }))).toBe(true);
    expect(isInvitable(s({ status: 'running' }))).toBe(true);
    expect(isInvitable(s({ status: 'draft', roomCode: null }))).toBe(false);
    expect(isInvitable(s({ status: 'closed' }))).toBe(false);
    expect(isInvitable(s({ roomCode: null }))).toBe(false);
  });
});

describe('buildInvitation', () => {
  it('returns empty text when nothing can be joined', () => {
    expect(buildInvitation([s({ status: 'closed' })], '192.168.1.5:3000')).toBe('');
  });

  it('lists one session without numbering, with link and spaced room code', () => {
    const text = buildInvitation([s({})], '192.168.1.5:3000');
    expect(text).toContain('Bài thi đang mở:');
    expect(text).toContain('Docker cơ bản (đang mở phòng chờ)');
    expect(text).toContain('Link: http://192.168.1.5:3000/?room=482913');
    expect(text).toContain('Mã phòng: 482 913');
    expect(text).not.toMatch(/^1\. /m);
    expect(text).not.toContain('email');
  });

  it('numbers several sessions and mentions email when any room is group-only', () => {
    const text = buildInvitation([s({}), s({ id: 2, examTitle: 'Git', status: 'running', access: 'roster', roomCode: '111222' }), s({ id: 3, status: 'closed' })], 'h:1');
    expect(text.startsWith('2 bài thi đang mở:')).toBe(true);
    expect(text).toMatch(/^1\. Docker cơ bản/m);
    expect(text).toMatch(/^2\. Git \(đang làm bài\)/m);
    expect(text).toContain('nhập thêm email');
  });

  it('never contains the mentor-only session name', () => {
    const withName = { ...s({}), name: 'Nhóm A – bí mật' } as InvitableSession;
    expect(buildInvitation([withName], 'h')).not.toContain('Nhóm A');
  });
});

describe('duplicateTitles', () => {
  it('reports exam titles chosen more than once', () => {
    expect(duplicateTitles([s({}), s({ id: 2, roomCode: '000111' }), s({ id: 3, examTitle: 'Git' })])).toEqual(['Docker cơ bản']);
    expect(duplicateTitles([s({}), s({ id: 3, examTitle: 'Git' })])).toEqual([]);
  });
});
