import { describe, expect, it } from 'vitest';
import type { TeachingTopic } from '../../../shared/api/training.js';
import { turnOf } from './export-selection.js';
import { buildTeachingExamplesFile, buildTurnContext, orderExamples, type ContextEvent, type TeachingFileExample } from './teaching-examples.js';

let id = 0;
const ev = (kind: ContextEvent['kind'], session: string, extra: Partial<ContextEvent> = {}): ContextEvent => ({
  id: ++id, kind, claudeSessionId: session, toolName: null, toolTarget: null, ok: null, ...extra,
});
const tool = (session: string, name: string, target: string, ok: boolean) => ev('tool', session, { toolName: name, toolTarget: target, ok });

describe('buildTurnContext', () => {
  it('lists the commands of the turn, one line each, in order, with ✓/✗', () => {
    id = 0;
    const events = [ev('prompt', 'A'), tool('A', 'Bash', 'npm test', false), tool('A', 'Edit', 'src/add.ts', true), ev('prompt', 'A'), tool('A', 'Bash', 'later', true)];
    expect(buildTurnContext(events, 1)).toBe('✗ Bash npm test\n✓ Edit src/add.ts');
  });

  it('keeps parallel sessions apart: only the prompt\'s own session counts, up to that session\'s next prompt', () => {
    id = 0;
    const events = [ev('prompt', 'A'), ev('prompt', 'B'), tool('A', 'Bash', 'a-1', true), tool('B', 'Bash', 'b-1', true), tool('A', 'Bash', 'a-2', true), ev('prompt', 'A'), tool('A', 'Bash', 'a-3', true)];
    expect(buildTurnContext(events, 1)).toBe('✓ Bash a-1\n✓ Bash a-2');
    expect(buildTurnContext(events, 2)).toBe('✓ Bash b-1');
  });

  it('is empty for a turn without commands, and for an id that is not a prompt', () => {
    id = 0;
    const events = [ev('prompt', 'A'), ev('prompt', 'A'), tool('A', 'Bash', 'x', true)];
    expect(buildTurnContext(events, 1)).toBe('');
    expect(buildTurnContext(events, 3)).toBe('');
    expect(turnOf(events, 3)).toEqual([]);
  });

  it('shortens the target to one line and masks secrets', () => {
    id = 0;
    const long = `echo ${'x'.repeat(300)}`;
    const events = [ev('prompt', 'A'), tool('A', 'Bash', 'curl -H "token=abcdefgh12345678"\nnext', true), tool('A', 'Bash', long, true)];
    const lines = buildTurnContext(events, 1).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toContain('abcdefgh12345678');
    expect(lines[1]!.length).toBeLessThan(140);
    expect(lines[1]).toMatch(/…$/);
  });
});

const ex = (eventId: number, topic: TeachingTopic = 'other', label: 'good' | 'needs_work' = 'good', extra: Partial<TeachingFileExample> = {}): TeachingFileExample => ({
  eventId, topic, label, prompt: `prompt ${eventId}`, context: '✓ Bash npm test', comment: `nhận xét ${eventId}`, betterPrompt: null, ...extra,
});

describe('orderExamples', () => {
  it('groups by topic then label (good first), and shuffles inside a group the same way every time', () => {
    const list = [ex(5, 'other', 'needs_work'), ex(1, 'other', 'good'), ex(2, 'verify', 'needs_work'), ex(3, 'verify', 'good'), ex(4, 'other', 'good'), ex(6, 'other', 'good')];
    const a = orderExamples(list).map(e => e.eventId);
    expect(a.slice(0, 2)).toEqual([3, 2]);
    expect(new Set(a.slice(2, 5))).toEqual(new Set([1, 4, 6]));
    expect(a[5]).toBe(5);
    expect(orderExamples([...list].reverse()).map(e => e.eventId)).toEqual(a);
  });

  it('does not simply follow the event id (so not the order the members typed)', () => {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1);
    const out = orderExamples(ids.map(n => ex(n))).map(e => e.eventId);
    expect(out).not.toEqual(ids);
    expect(out).not.toEqual([...ids].reverse());
  });
});

describe('buildTeachingExamplesFile', () => {
  it('has the training name, the intro, and per example the label, prompt, context, comment and better version', () => {
    const md = buildTeachingExamplesFile('Buổi 1', [ex(1, 'verify', 'good', { betterPrompt: 'prompt tốt hơn' })]);
    expect(md).toContain('# Ví dụ prompt để dạy: Buổi 1');
    expect(md).toContain('đã bỏ tên');
    expect(md).toContain('## Chủ đề: Kiểm chứng');
    expect(md).toContain('### Tốt');
    expect(md).toContain('> prompt 1');
    expect(md).toContain('✓ Bash npm test');
    expect(md).toContain('> nhận xét 1');
    expect(md).toContain('**Phiên bản tốt hơn**\n\n> prompt tốt hơn');
  });

  it('omits the better version when there is none, and says so when the turn had no command', () => {
    const md = buildTeachingExamplesFile('B', [ex(1, 'other', 'good', { context: '' })]);
    expect(md).not.toContain('Phiên bản tốt hơn');
    expect(md).toContain('Không có lệnh nào');
  });

  it('prints the edited texts it is given, and masks a secret that came in through any field', () => {
    const secret = 'sk-live-abcdefghijklmnop1234';
    const md = buildTeachingExamplesFile('B', [ex(1, 'other', 'good', { prompt: `khoá ${secret}`, context: `✓ Bash export TOKEN=abcdefgh12345678`, comment: secret, betterPrompt: `dùng ${secret}` })]);
    expect(md).not.toContain(secret);
    expect(md).not.toContain('abcdefgh12345678');
    expect(md).toContain('[đã che]');
  });

  it('does not let a prompt with backticks break out of the context fence', () => {
    const md = buildTeachingExamplesFile('B', [ex(1, 'other', 'good', { context: '✓ Bash echo ```' })]);
    expect(md).toContain('````\n✓ Bash echo ```\n````');
  });

  it('puts every example in order of topic: verify before delegation before other', () => {
    const md = buildTeachingExamplesFile('B', [ex(1, 'other'), ex(2, 'delegation'), ex(3, 'verify')]);
    const at = (t: string) => md.indexOf(t);
    expect(at('Chủ đề: Kiểm chứng')).toBeLessThan(at('Chủ đề: Cách giao việc'));
    expect(at('Chủ đề: Cách giao việc')).toBeLessThan(at('Chủ đề: Khác'));
  });
});
