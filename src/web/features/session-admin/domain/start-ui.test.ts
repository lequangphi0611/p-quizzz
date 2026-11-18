import { describe, expect, it } from 'vitest';
import type { SessionDetail, SessionParticipantDetail } from '../../../../shared/api/index.js';
import type { SessionStartInfo } from '../../../../shared/session-start.js';
import { autoStartBlockers, defaultReadyMin, earlyStartWarning, nextOccurrence, scheduleLabel, toTimeInput } from './start-ui.js';

const now = new Date(2026, 10, 18, 8, 55, 48);
const start = (over: Partial<SessionStartInfo> = {}): SessionStartInfo => ({
  scheduledAt: null, countdownEndsAt: null, countdownSource: null, startsAt: null, startsInMs: null, early: false, autoStartReady: true, readyMin: 4, ready: { count: 3, total: 5 }, ...over,
});
const person = (name: string, ready: boolean, online = true, lastSeenAt: number | null = null): SessionParticipantDetail =>
  ({ id: name.length, displayName: name, status: 'active', joinedAt: 0, readyAt: ready ? 1 : null, connection: { online, lastSeenAt } } as SessionParticipantDetail);

describe('mentor start card (PRODUCT.md §7.31)', () => {
  it('reads a time of day as the next time it comes', () => {
    expect(nextOccurrence('09:00', now)).toEqual(new Date(2026, 10, 18, 9, 0));
    expect(nextOccurrence('8:30', now)).toEqual(new Date(2026, 10, 19, 8, 30)); // passed today: tomorrow
    expect(nextOccurrence('25:00', now)).toBeNull();
    expect(nextOccurrence('', now)).toBeNull();
    expect(scheduleLabel(new Date(2026, 10, 18, 9, 0).getTime(), now)).toBe('9:00');
    expect(scheduleLabel(new Date(2026, 10, 19, 8, 30).getTime(), now)).toBe('8:30 ngày mai');
    expect(toTimeInput(new Date(2026, 10, 18, 9, 5).getTime())).toBe('09:05');
  });

  it('suggests the list size, else the people in the room', () => {
    expect(defaultReadyMin({ roster: { size: 20, joined: 18, notJoined: [] }, participants: [] })).toBe(20);
    expect(defaultReadyMin({ roster: null, participants: [person('An', false), person('Bình', true)] })).toBe(2);
    expect(defaultReadyMin({ roster: null, participants: [] })).toBe(1);
  });

  it('says why everyone-ready has not started yet, naming who dropped off without being ready', () => {
    const lastSeen = new Date(2026, 10, 18, 8, 54).getTime();
    const d = { start: start(), pendingCount: 2, participants: [person('An', true), person('Hà', false, false, lastSeen)] } as Pick<SessionDetail, 'start' | 'participants' | 'pendingCount'>;
    expect(autoStartBlockers(d).map(b => b.text)).toEqual(['Mới 3/5 sẵn sàng', 'Đang chờ duyệt 2 người', 'Hà mất kết nối từ 8:54 — vẫn tính vào 5']);
    expect(autoStartBlockers({ ...d, start: start({ readyMin: 8 }) })[0]!.text).toBe('Cần tối thiểu 8 người (đang có 5)');
    expect(autoStartBlockers({ ...d, start: start({ autoStartReady: false }) })).toEqual([]);
  });

  it('warns before starting early only for a timed session with a scheduled time ahead', () => {
    const at = new Date(2026, 10, 18, 9, 0).getTime();
    expect(earlyStartWarning({ start: start({ scheduledAt: at }), timeLimitMinutes: 30 }, now.getTime())).toContain('Bắt đầu sớm hơn giờ hẹn (9:00)');
    expect(earlyStartWarning({ start: start({ scheduledAt: at }), timeLimitMinutes: null }, now.getTime())).toBeNull();
    expect(earlyStartWarning({ start: start(), timeLimitMinutes: 30 }, now.getTime())).toBeNull();
  });
});
