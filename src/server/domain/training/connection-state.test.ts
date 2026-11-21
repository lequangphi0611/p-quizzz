import { describe, expect, it } from 'vitest';
import { TrainingCheckTooEarlyError, TrainingStateError } from './errors.js';
import { connectionState, stillSending, uninstallCheckState, uninstallCheckVerdict, UNINSTALL_CHECK_MIN_MS } from './training.js';

const d = (ms: number) => new Date(ms);
const fresh = { firstSeenAt: null, seenAfterStopAt: null, uninstallCheckAt: null, uninstalledAt: null };

describe('connectionState', () => {
  it('waiting until the first event, connected after', () => {
    expect(connectionState(fresh)).toBe('waiting');
    expect(connectionState({ ...fresh, firstSeenAt: d(1) })).toBe('connected');
  });

  it('uninstalled once the check passed and nothing came after it', () => {
    expect(connectionState({ ...fresh, firstSeenAt: d(1), uninstalledAt: d(20) })).toBe('uninstalled');
    expect(connectionState({ ...fresh, firstSeenAt: d(1), seenAfterStopAt: d(10), uninstalledAt: d(20) })).toBe('uninstalled');
  });

  it('an event after the check passed means the hook is still there: back to connected', () => {
    expect(connectionState({ ...fresh, firstSeenAt: d(1), seenAfterStopAt: d(30), uninstalledAt: d(20) })).toBe('connected');
  });
});

describe('stillSending', () => {
  const m = { seenAfterStopAt: d(10), uninstalledAt: null };
  it('only while stopped, once an event came after the stop, and not after a clean removal', () => {
    expect(stillSending({ status: 'stopped' }, m)).toBe(true);
    expect(stillSending({ status: 'open' }, m)).toBe(false);
    expect(stillSending({ status: 'stopped' }, { ...m, seenAfterStopAt: null })).toBe(false);
    expect(stillSending({ status: 'stopped' }, { ...m, uninstalledAt: d(20) })).toBe(false);
  });

  it('is true again when an event arrives after the removal check passed', () => {
    expect(stillSending({ status: 'stopped' }, { seenAfterStopAt: d(30), uninstalledAt: d(20) })).toBe(true);
  });
});

describe('uninstallCheckState', () => {
  it('none → waiting → passed', () => {
    expect(uninstallCheckState(fresh)).toBe('none');
    expect(uninstallCheckState({ ...fresh, uninstallCheckAt: d(1) })).toBe('waiting');
    expect(uninstallCheckState({ ...fresh, uninstallCheckAt: d(1), uninstalledAt: d(2) })).toBe('passed');
  });

  it('failed when an event came after the check began, or after it passed', () => {
    expect(uninstallCheckState({ ...fresh, uninstallCheckAt: d(5), seenAfterStopAt: d(8) })).toBe('failed');
    expect(uninstallCheckState({ ...fresh, uninstallCheckAt: d(5), uninstalledAt: d(10), seenAfterStopAt: d(12) })).toBe('failed');
  });

  it('an event from before the check began does not fail it (that is how the check starts)', () => {
    expect(uninstallCheckState({ ...fresh, uninstallCheckAt: d(5), seenAfterStopAt: d(3) })).toBe('waiting');
  });
});

describe('uninstallCheckVerdict', () => {
  const started = { uninstallCheckAt: d(1000), seenAfterStopAt: null };
  const after = d(1000 + UNINSTALL_CHECK_MIN_MS);

  it('passes after the quiet period with no event since the check began', () => {
    expect(uninstallCheckVerdict(started, after)).toBe('passed');
    expect(uninstallCheckVerdict({ ...started, seenAfterStopAt: d(500) }, after)).toBe('passed');
  });

  it('fails when an event came after the check began', () => {
    expect(uninstallCheckVerdict({ ...started, seenAfterStopAt: d(2000) }, after)).toBe('failed');
  });

  it('refuses a verdict that is too early, or before any check was started', () => {
    expect(() => uninstallCheckVerdict(started, d(1000 + UNINSTALL_CHECK_MIN_MS - 1))).toThrow(TrainingCheckTooEarlyError);
    expect(() => uninstallCheckVerdict({ uninstallCheckAt: null, seenAfterStopAt: null }, after)).toThrow(TrainingStateError);
  });
});
