import { describe, expect, it } from 'vitest';
import { SETTINGS_LOCAL_PATH, buildRemovalPrompt, ingestUrl } from './removal.js';

describe('ingestUrl', () => {
  it('is the address the hooks post to, built from the host the member is on', () => {
    expect(ingestUrl('192.168.1.5:3000')).toBe('http://192.168.1.5:3000/api/training/ingest');
    expect(ingestUrl('http://192.168.1.5:3000/')).toBe('http://192.168.1.5:3000/api/training/ingest');
  });
});

describe('buildRemovalPrompt', () => {
  const prompt = buildRemovalPrompt('192.168.1.5:3000');
  it('names the file and the exact address to remove, and all eight events', () => {
    expect(prompt).toContain(SETTINGS_LOCAL_PATH);
    expect(prompt).toContain('http://192.168.1.5:3000/api/training/ingest');
    for (const e of ['UserPromptSubmit', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest', 'Notification', 'PreCompact', 'SessionEnd', 'PostModelSwitch']) expect(prompt).toContain(e);
  });
  it('asks to remove only that, keep everything else and touch no other file', () => {
    expect(prompt).toMatch(/Giữ nguyên/);
    expect(prompt).toContain('~/.claude/settings.json');
  });
  it('carries no secret: the ingest token is never in it', () => {
    expect(prompt).not.toMatch(/X-Training-Token/i);
  });
});
