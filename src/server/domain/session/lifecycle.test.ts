import { describe, expect, it } from 'vitest';
import { InvalidSessionTransitionError, UngradedEssaysError } from './errors.js';
import { assertTransition, planClose, planFinalize, planOpen, planStart } from './lifecycle.js';
import { SelfPacedMode } from './mode.js';

const now = new Date(10);

describe('session lifecycle policy', () => {
  it('allows the forward chain and rejects everything else with a 409-kind error', () => {
    expect(assertTransition({ status: 'draft' }, 'open')).toBe('lobby');
    expect(assertTransition({ status: 'lobby' }, 'start')).toBe('running');
    expect(assertTransition({ status: 'running' }, 'close')).toBe('closed');
    expect(assertTransition({ status: 'closed' }, 'finalize')).toBe('finalized');
    const err = (() => { try { assertTransition({ status: 'draft' }, 'start'); } catch (e) { return e; } })();
    expect(err).toBeInstanceOf(InvalidSessionTransitionError);
    expect((err as InvalidSessionTransitionError).kind).toBe('conflict');
    expect((err as Error).message).toBe('Không thể bắt đầu thi khi phiên đang ở trạng thái "Nháp"');
  });

  it('open stamps openedAt and the room code; start stamps startedAt', () => {
    expect(planOpen(now, '123456', 2)).toEqual({ status: 'lobby', openedAt: now, roomCode: '123456', slot: 2 });
    expect(planStart(now)).toEqual({ status: 'running', startedAt: now, countdownEndsAt: null, countdownSource: null });
  });

  it('self-paced close finalizes at once only when the exam has no essay', () => {
    // Closing frees the slot either way.
    expect(planClose(SelfPacedMode, { hasEssay: true }, now)).toEqual({ status: 'closed', closedAt: now, slot: null });
    expect(planClose(SelfPacedMode, { hasEssay: false }, now)).toEqual({ status: 'finalized', closedAt: now, finalizedAt: now, slot: null });
  });

  it('finalize needs every essay graded', () => {
    expect(planFinalize(now, 0)).toEqual({ status: 'finalized', finalizedAt: now });
    expect(() => planFinalize(now, 2)).toThrow(UngradedEssaysError);
    expect(() => planFinalize(now, 2)).toThrow('Còn 2 bài tự luận chưa chấm điểm');
  });
});
