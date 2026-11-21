import { beforeEach, describe, expect, it } from 'vitest';
import { inferPermissionDecision } from './infer-permission-decision.js';
import { perm, prompt, resetEvents, session, tool } from './test-events.js';

beforeEach(resetEvents);

describe('inferPermissionDecision', () => {
  it('allowed: the same tool ran before the next prompt, with the estimated time to decide', () => {
    const p = perm('Bash', 'npm test', 10);
    const t = tool('Bash', 'npm test', true, { atSec: 14, durationMs: 1500 });
    expect(inferPermissionDecision([prompt('go', 1), p, t]).get(p.id)).toEqual({ decision: 'allowed', decisionMs: 2500 });
  });

  it('never reports a negative time', () => {
    const p = perm('Bash', 'ls', 10);
    const t = tool('Bash', 'ls', true, { atSec: 10, durationMs: 5000 });
    expect(inferPermissionDecision([p, t]).get(p.id)?.decisionMs).toBe(0);
  });

  it('denied: the next prompt came and the tool never ran', () => {
    const p = perm('Bash', 'rm -rf x', 10);
    expect(inferPermissionDecision([p, prompt('no, do not', 20)]).get(p.id)).toEqual({ decision: 'denied', decisionMs: null });
  });

  it('denied: Claude went on with another tool, and a new session also closes the turn', () => {
    const a = perm('Bash', 'a', 1);
    expect(inferPermissionDecision([a, tool('Read', 'x')]).get(a.id)?.decision).toBe('denied');
    const b = perm('Bash', 'b', 1);
    expect(inferPermissionDecision([b, session('clear')]).get(b.id)?.decision).toBe('denied');
  });

  it('pending: nothing happened since the request (notices do not count)', () => {
    const p = perm('Bash', 'npm test', 1);
    expect(inferPermissionDecision([p]).get(p.id)).toEqual({ decision: 'pending', decisionMs: null });
  });

  it('does not match a tool of another command or from the next turn', () => {
    const p = perm('Bash', 'npm test', 1);
    const out = inferPermissionDecision([p, prompt('x', 2), tool('Bash', 'npm test', true, { atSec: 3 })]);
    expect(out.get(p.id)?.decision).toBe('denied');
  });

  it('one tool run answers one request: two identical requests need two runs', () => {
    const p1 = perm('Bash', 'ls', 1);
    const p2 = perm('Bash', 'ls', 2);
    const out = inferPermissionDecision([p1, p2, tool('Bash', 'ls', true, { atSec: 3 }), prompt('x', 9)]);
    expect(out.get(p1.id)?.decision).toBe('allowed');
    expect(out.get(p2.id)?.decision).toBe('denied');
  });
});
