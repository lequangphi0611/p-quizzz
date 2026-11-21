import { describe, expect, it } from 'vitest';
import type { TrainingDetail, TrainingMemberRow } from '../../../../shared/api/index.js';
import { announcementFor } from './announcements.js';
import { formatLastSeen, memberCountsText, sortMembers, stillSendingCount, uninstallProgress } from './members.js';

const row = (id: number, displayName: string, over: Partial<TrainingMemberRow> = {}): TrainingMemberRow =>
  ({ id, displayName, connection: 'waiting', lastSeenAt: null, promptCount: 0, toolCount: 0, failedCount: 0, stuck: false, stillSending: false, ...over });
const detail = (members: TrainingMemberRow[], over: Partial<TrainingDetail> = {}): TrainingDetail =>
  ({ id: 1, name: 'T', status: 'open', roomCode: '482913', createdAt: 0, stoppedAt: null, endedAt: null, uninstalled: null, members, ...over });

describe('sortMembers', () => {
  it('sorts by name (Vietnamese order, case and accents aside) and never by errors', () => {
    const rows = [row(1, 'Khoa', { failedCount: 0 }), row(2, 'An', { failedCount: 99 }), row(3, 'Dũng'), row(4, 'bình', { stuck: true }), row(5, 'Chi')];
    expect(sortMembers(rows).map(m => m.displayName)).toEqual(['An', 'bình', 'Chi', 'Dũng', 'Khoa']);
  });

  it('keeps the join order for equal names and does not change the input', () => {
    const rows = [row(7, 'An'), row(3, 'An')];
    expect(sortMembers(rows).map(m => m.id)).toEqual([3, 7]);
    expect(rows.map(m => m.id)).toEqual([7, 3]);
  });
});

describe('uninstallProgress', () => {
  it('is null until the training is stopped', () => {
    expect(uninstallProgress(detail([row(1, 'An')]))).toBeNull();
  });

  it('counts removed hooks from the server and still-sending machines from the rows (a number, not a list)', () => {
    const d = detail([row(1, 'An', { connection: 'uninstalled' }), row(2, 'Bình', { stillSending: true }), row(3, 'Chi', { stillSending: true })], { status: 'stopped', uninstalled: { count: 1, total: 3 } });
    expect(uninstallProgress(d)).toEqual({ done: 1, total: 3, stillSending: 2 });
    expect(stillSendingCount(d.members)).toBe(2);
  });
});

describe('formatLastSeen', () => {
  const now = new Date(2026, 10, 21, 14, 37).getTime();
  it('shows the clock for today, the date for another day and a dash for never', () => {
    expect(formatLastSeen(new Date(2026, 10, 21, 14, 21).getTime(), now)).toBe('14:21');
    expect(formatLastSeen(new Date(2026, 10, 20, 9, 5).getTime(), now)).toBe('20/11 09:05');
    expect(formatLastSeen(null, now)).toBe('—');
  });
});

describe('memberCountsText', () => {
  it('reads prompts, commands and errors in one neutral line', () => {
    expect(memberCountsText({ promptCount: 6, toolCount: 18, failedCount: 5 })).toBe('6 prompt · 18 lệnh · 5 lỗi');
  });
});

describe('announcementFor', () => {
  it('is empty when nothing changed', () => {
    const d = detail([row(1, 'An', { connection: 'connected' })]);
    expect(announcementFor(d, d)).toBe('');
  });

  it('says who started sending, joined, removed the hook or still sends', () => {
    const before = detail([row(1, 'An'), row(2, 'Bình', { connection: 'connected' }), row(3, 'Chi', { connection: 'connected' })], { status: 'stopped' });
    const after = detail([
      row(1, 'An', { connection: 'connected' }),
      row(2, 'Bình', { connection: 'uninstalled' }),
      row(3, 'Chi', { connection: 'connected', stillSending: true }),
      row(4, 'Dũng'),
    ], { status: 'stopped' });
    expect(announcementFor(before, after)).toBe('An đã nhận tín hiệu. Bình đã gỡ kết nối. Chi vẫn gửi dữ liệu sau khi dừng thu và 1 thay đổi khác');
  });

  it('announces the stop and the end', () => {
    expect(announcementFor(detail([]), detail([], { status: 'stopped' }))).toBe('Đã dừng thu');
    expect(announcementFor(detail([], { status: 'stopped' }), detail([], { status: 'ended' }))).toBe('Buổi training đã kết thúc, dữ liệu đã xoá');
  });
});
