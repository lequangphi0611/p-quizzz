import { describe, expect, it } from 'vitest';
import { roomCodeMatches } from '../session/room-code.js';
import {
  NameTakenError, NotPendingError, ParticipantKickedError, SessionClosedForApprovalError, SessionFinalizedError, SessionNotOpenError, WrongRoomCodeError,
} from './errors.js';
import { assertApprovable, assertCanJoin, assertListEditable, assertNameFree, assertNotKicked, statusOnJoin } from './participant.js';

describe('participant rules', () => {
  it('names clash case-insensitively across Unicode and ignoring invisible characters, except for oneself', () => {
    const others = [{ id: 1, displayName: 'Đạt' }];
    expect(() => assertNameFree(others, 'đạt')).toThrow(NameTakenError);
    expect(() => assertNameFree(others, 'Đ​ạt')).toThrow(NameTakenError);
    expect(() => assertNameFree(others, 'đạt', 1)).not.toThrow();
    expect(() => assertNameFree(others, 'Lan')).not.toThrow();
  });

  it('joining needs an active session and the right code', () => {
    const open = { status: 'lobby' as const, roomCode: '123456' };
    expect(() => assertCanJoin(open, '123456')).not.toThrow();
    expect(() => assertCanJoin({ ...open, status: 'running' }, '123456')).not.toThrow();
    expect(() => assertCanJoin({ ...open, status: 'closed' }, '123456')).toThrow(SessionNotOpenError);
    expect(() => assertCanJoin({ ...open, status: 'draft' }, '123456')).toThrow(SessionNotOpenError);
    expect(() => assertCanJoin(open, '123457')).toThrow(WrongRoomCodeError);
    expect(() => assertCanJoin({ ...open, roomCode: null }, '123456')).toThrow(WrongRoomCodeError);
    expect(new WrongRoomCodeError().kind).toBe('forbidden');
  });

  it('roomCodeMatches compares whole strings', () => {
    expect(roomCodeMatches('123456', '123456')).toBe(true);
    expect(roomCodeMatches('123456', '12345')).toBe(false);
    expect(roomCodeMatches('123456', '654321')).toBe(false);
  });

  it('members wait for approval unless the session auto-approves', () => {
    expect(statusOnJoin(false)).toBe('pending');
    expect(statusOnJoin(true)).toBe('active');
  });

  it('a finalized session freezes the list; kicked members cannot be edited again', () => {
    expect(() => assertListEditable('finalized')).toThrow(SessionFinalizedError);
    expect(() => assertListEditable('closed')).not.toThrow();
    expect(() => assertNotKicked({ status: 'kicked' })).toThrow(ParticipantKickedError);
    expect(() => assertNotKicked({ status: 'active' })).not.toThrow();
  });

  it('approving needs a pending member and a session still in lobby/running', () => {
    expect(() => assertApprovable({ status: 'pending' }, 'lobby')).not.toThrow();
    expect(() => assertApprovable({ status: 'active' }, 'lobby')).toThrow(NotPendingError);
    expect(() => assertApprovable({ status: 'pending' }, 'closed')).toThrow(SessionClosedForApprovalError);
    expect(() => assertApprovable({ status: 'pending' }, undefined)).toThrow(SessionClosedForApprovalError);
  });
});
