import { describe, expect, it } from 'vitest';
import { NameTakenError } from '../participant/errors.js';
import { TrainingStateError } from './errors.js';
import { buildHookSettings, buildMergePrompt } from './hook-settings.js';
import { assertTrainingNameFree, connectionState, nextTrainingStatus, stillSending, uninstallCheckState } from './training.js';

describe('nextTrainingStatus', () => {
  it('goes open → stopped → ended and nowhere else', () => {
    expect(nextTrainingStatus('open', 'stop')).toBe('stopped');
    expect(nextTrainingStatus('stopped', 'end')).toBe('ended');
    for (const [status, action] of [['stopped', 'stop'], ['ended', 'stop'], ['open', 'end'], ['ended', 'end']] as const) {
      expect(() => nextTrainingStatus(status, action)).toThrow(TrainingStateError);
    }
  });
});

describe('assertTrainingNameFree', () => {
  it('compares names case-insensitively over all of Unicode, as identity_in_use', () => {
    expect(() => assertTrainingNameFree([{ displayName: 'Đạt' }], 'đạt')).toThrow(NameTakenError);
    expect(() => assertTrainingNameFree([{ displayName: 'Đạt' }], 'Mai')).not.toThrow();
    try {
      assertTrainingNameFree([{ displayName: 'Lan' }], 'LAN');
    } catch (err) {
      expect((err as NameTakenError).code).toBe('identity_in_use');
    }
  });
});

describe('connection and removal state', () => {
  const none = { firstSeenAt: null, uninstalledAt: null };
  it('waiting until the first event, connected after, uninstalled once the check passed', () => {
    expect(connectionState(none)).toBe('waiting');
    expect(connectionState({ ...none, firstSeenAt: new Date(1) })).toBe('connected');
    expect(connectionState({ firstSeenAt: new Date(1), uninstalledAt: new Date(2) })).toBe('uninstalled');
  });

  it('stillSending only while stopped, after events were seen, before removal', () => {
    const m = { seenAfterStopAt: new Date(1), uninstalledAt: null };
    expect(stillSending({ status: 'stopped' }, m)).toBe(true);
    expect(stillSending({ status: 'open' }, m)).toBe(false);
    expect(stillSending({ status: 'stopped' }, { ...m, seenAfterStopAt: null })).toBe(false);
    expect(stillSending({ status: 'stopped' }, { ...m, uninstalledAt: new Date(2) })).toBe(false);
  });

  it('uninstall check: none → waiting → passed', () => {
    expect(uninstallCheckState({ uninstallCheckAt: null, uninstalledAt: null })).toBe('none');
    expect(uninstallCheckState({ uninstallCheckAt: new Date(1), uninstalledAt: null })).toBe('waiting');
    expect(uninstallCheckState({ uninstallCheckAt: new Date(1), uninstalledAt: new Date(2) })).toBe('passed');
  });
});

describe('buildHookSettings', () => {
  const settings = buildHookSettings('http://192.168.1.5:3000/', 'ingest-abc');

  it('has exactly the three approved hooks: http, timeout 1, token header, no Stop', () => {
    expect(Object.keys(settings.hooks).sort()).toEqual(['PostToolUse', 'PostToolUseFailure', 'UserPromptSubmit']);
    for (const entries of Object.values(settings.hooks)) {
      expect(entries).toHaveLength(1);
      expect(entries[0]!.hooks).toEqual([{ type: 'http', url: 'http://192.168.1.5:3000/api/training/ingest', headers: { 'X-Training-Token': 'ingest-abc' }, timeout: 1 }]);
    }
    expect(settings.hooks.PostToolUse[0]!.matcher).toBe('*');
    expect(settings.hooks.PostToolUseFailure[0]!.matcher).toBe('*');
    expect(settings.hooks.UserPromptSubmit[0]!.matcher).toBeUndefined();
    expect(JSON.stringify(settings)).not.toContain('"Stop"');
    expect(JSON.stringify(settings)).not.toContain('"command"');
  });

  it('the merge prompt is Vietnamese, says merge-not-overwrite, names the file, and carries the settings', () => {
    const prompt = buildMergePrompt(settings);
    expect(prompt).toContain('.claude/settings.local.json');
    expect(prompt).toContain('không ghi đè');
    expect(prompt).toContain('~/.claude/settings.json');
    expect(prompt).toContain(JSON.stringify(settings, null, 2));
  });
});
