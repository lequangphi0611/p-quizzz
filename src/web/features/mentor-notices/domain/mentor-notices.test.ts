import { describe, expect, it } from 'vitest';
import type { SessionParticipantDetail } from '../../../../shared/api/index.js';
import { buildNotices, DESKTOP_BATCH_MAX, desktopNotifications, markSeenAt, newPendingNotices, pendingCount, titleWithCount, unreadCount } from './mentor-notices.js';

const person = (id: number, status: SessionParticipantDetail['status'], joinedAt: number, submittedAt: number | null = null): SessionParticipantDetail => ({
  id, displayName: `P${id}`, status, joinedAt,
  progress: { state: submittedAt ? 'submitted' : 'none', attempts: submittedAt ? 1 : 0, countedScore: submittedAt ? 1 : null, maxScore: 2, submittedAt },
});

describe('mentor notices', () => {
  it('one notice per join (pending or approved) and per submission, newest first; kicked people are left out', () => {
    const notices = buildNotices([person(1, 'active', 100, 500), person(2, 'pending', 200), person(3, 'kicked', 300)]);
    expect(notices.map(n => [n.key, n.kind, n.at])).toEqual([
      ['submit:1', 'submitted', 500],
      ['join:2', 'pending', 200],
      ['join:1', 'joined', 100],
    ]);
  });

  it('at the same instant a submission sorts above a join', () => {
    expect(buildNotices([person(1, 'active', 100), person(2, 'active', 50, 100)]).map(n => n.key)).toEqual(['submit:2', 'join:1', 'join:2']);
  });

  it('unread counts notices after the seen mark; marking seen uses the newest server time', () => {
    const notices = buildNotices([person(1, 'active', 100, 300), person(2, 'pending', 200)]);
    expect(unreadCount(notices, 0)).toBe(3);
    expect(unreadCount(notices, 200)).toBe(1);
    const seen = markSeenAt(notices, 0);
    expect(seen).toBe(300);
    expect(unreadCount(notices, seen)).toBe(0);
    expect(markSeenAt([], 42)).toBe(42); // never moves backwards
  });

  it('pending count and tab title', () => {
    expect(pendingCount([person(1, 'pending', 1), person(2, 'active', 2), person(3, 'pending', 3)])).toBe(2);
    expect(titleWithCount('p-quizzz', 0)).toBe('p-quizzz');
    expect(titleWithCount('p-quizzz', 3)).toBe('(3) p-quizzz');
    expect(titleWithCount('p-quizzz', 120)).toBe('(99+) p-quizzz');
  });
});

describe('desktop notifications', () => {
  it('announces only pending joins that are new since the last snapshot, never on the first one', () => {
    const first = buildNotices([person(1, 'pending', 100)]);
    expect(newPendingNotices(null, first)).toEqual([]);
    const known = new Set(first.map(n => n.key));
    const next = buildNotices([person(1, 'pending', 100), person(2, 'pending', 200), person(3, 'active', 300, 400)]);
    expect(newPendingNotices(known, next).map(n => n.key)).toEqual(['join:2']);
  });

  it('one notification per joiner, or a single summary for a burst', () => {
    const fresh = (n: number) => buildNotices(Array.from({ length: n }, (_, i) => person(i + 1, 'pending', i)));
    expect(desktopNotifications(fresh(2), 5)).toEqual([
      { title: 'P2 xin vào phiên', body: '5 người đang chờ duyệt. Bấm để mở phiên.', tag: 'pq-pending-2' },
      { title: 'P1 xin vào phiên', body: '5 người đang chờ duyệt. Bấm để mở phiên.', tag: 'pq-pending-1' },
    ]);
    expect(desktopNotifications(fresh(DESKTOP_BATCH_MAX + 1), 9)).toEqual([{ title: '9 người đang chờ duyệt', body: 'Mới vào: P4, P3, P2…. Bấm để mở phiên.', tag: 'pq-pending-summary' }]);
    expect(desktopNotifications([], 9)).toEqual([]);
  });

  it('right after a pop, a new joiner updates the shared summary instead of stacking another notification', () => {
    const one = buildNotices([person(7, 'pending', 1)]);
    expect(desktopNotifications(one, 4, true)).toEqual([{ title: '4 người đang chờ duyệt', body: 'Mới vào: P7. Bấm để mở phiên.', tag: 'pq-pending-summary' }]);
  });
});
