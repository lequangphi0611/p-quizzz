import { describe, expect, it } from 'vitest';
import { filterHookEvent, isHookEvent } from './filter-hook-event.js';
import {
  ASSISTANT_ANSWER, CWD, FILE_SECRET, SESSION_ID, TRANSCRIPT,
  WIN_CWD, postToolUseFailurePowerShell, postToolUsePowerShell,
  postToolUseBash, postToolUseEdit, postToolUseFailure, postToolUseRead, postToolUseWrite, stop, userPromptSubmit,
} from './fixtures/hook-payloads.js';

describe('filterHookEvent', () => {
  it('UserPromptSubmit keeps the prompt and Claude Code session id', () => {
    expect(filterHookEvent(userPromptSubmit)).toEqual({ kind: 'prompt', claudeSessionId: SESSION_ID, prompt: 'Viết hàm cộng hai số' });
  });

  it('PostToolUse Bash: the command, ok, duration, and the output as a clip', () => {
    expect(filterHookEvent(postToolUseBash)).toEqual({
      kind: 'tool', claudeSessionId: SESSION_ID, toolName: 'Bash', ok: true, durationMs: 2310, toolTarget: 'npm test', errorExcerpt: null,
      output: { head: 'PASS src/add.test.ts\nTests: 3 passed', tail: null, omittedLines: 0 }, change: null,
    });
  });

  it('PostToolUseFailure: ok = false and the error excerpt (first 20 lines)', () => {
    expect(filterHookEvent(postToolUseFailure)).toMatchObject({
      ok: false, toolTarget: 'ls /nope', durationMs: 31, errorExcerpt: 'Exit code 2\nls: cannot access /nope: No such file or directory', output: null,
    });
    const long = Array.from({ length: 50 }, (_, i) => `e${i}`).join('\n');
    expect((filterHookEvent({ ...postToolUseFailure, error: long }) as { errorExcerpt: string }).errorExcerpt.split('\n')).toHaveLength(20);
  });

  it('Bash output joins stdout and stderr', () => {
    const e = filterHookEvent({ ...postToolUseBash, tool_response: { stdout: 'out', stderr: 'warn' } });
    expect(e).toMatchObject({ output: { head: 'out\nwarn' } });
  });

  it('Write and Edit: a path relative to the exercise folder, and the change', () => {
    expect(filterHookEvent(postToolUseWrite)).toMatchObject({
      toolName: 'Write', toolTarget: 'src/add.ts', change: { head: 'export const add = (a: number, b: number) => a + b;\n' },
    });
    expect(filterHookEvent(postToolUseEdit)).toMatchObject({ toolName: 'Edit', toolTarget: 'src/add.ts', change: { head: '- a + b\n+ a + b + 0' } });
  });

  it('Read keeps the path and the line count, and never the file content', () => {
    const e = filterHookEvent(postToolUseRead)!;
    expect(e).toMatchObject({ toolName: 'Read', toolTarget: '.env · 2 dòng', output: null, change: null });
    expect(JSON.stringify(e)).not.toContain(FILE_SECRET);
  });

  it('Read counts lines from the content, or drops the count, when numLines is absent', () => {
    const base = { ...postToolUseRead, tool_response: { file: { content: 'a\nb\nc' } } };
    expect(filterHookEvent(base)).toMatchObject({ toolTarget: '.env · 3 dòng', output: null });
    expect(filterHookEvent({ ...base, tool_response: { weird: true } })).toMatchObject({ toolTarget: '.env', output: null });
    expect(filterHookEvent({ ...base, tool_response: undefined })).toMatchObject({ toolTarget: '.env', output: null });
  });

  it('a path outside the exercise folder keeps only the file name; never an absolute path', () => {
    const e = filterHookEvent({ ...postToolUseWrite, tool_input: { file_path: '/home/lan/.ssh/id_rsa', content: 'x' } })!;
    expect(e).toMatchObject({ toolTarget: 'id_rsa' });
  });

  it('understands Windows paths, whatever the slashes', () => {
    const win = { ...postToolUseWrite, cwd: 'C:\\Users\\Lan\\bai-tap', tool_input: { file_path: 'C:\\Users\\Lan\\bai-tap\\src\\add.ts', content: 'x' } };
    expect(filterHookEvent(win)).toMatchObject({ toolTarget: 'src/add.ts' });
    expect(filterHookEvent({ ...win, tool_input: { file_path: 'c:\\users\\lan\\BAI-TAP\\src\\a.ts', content: 'x' } })).toMatchObject({ toolTarget: 'src/a.ts' });
    expect(filterHookEvent({ ...win, tool_input: { file_path: 'D:\\other\\secret.txt', content: 'x' } })).toMatchObject({ toolTarget: 'secret.txt' });
  });

  it('with no cwd to compare against, only the file name', () => {
    expect(filterHookEvent({ ...postToolUseWrite, cwd: undefined })).toMatchObject({ toolTarget: 'add.ts' });
  });

  it('other tools: no target unless they name a file; the response is kept as compact JSON', () => {
    const e = filterHookEvent({ ...postToolUseBash, tool_name: 'Glob', tool_input: { pattern: '*.ts' }, tool_response: { filenames: ['a.ts'] } })!;
    expect(e).toMatchObject({ toolName: 'Glob', toolTarget: null, output: { head: '{"filenames":["a.ts"]}' } });
    const g = filterHookEvent({ ...postToolUseBash, tool_name: 'Grep', tool_input: { path: `${CWD}/src`, pattern: 'x' }, tool_response: 'a.ts:1:x' })!;
    expect(g).toMatchObject({ toolTarget: 'src', output: { head: 'a.ts:1:x' } });
  });

  it('an empty output is null, not an empty clip', () => {
    expect(filterHookEvent({ ...postToolUseBash, tool_response: { stdout: '', stderr: '' } })).toMatchObject({ output: null });
    expect(filterHookEvent({ ...postToolUseBash, tool_response: { stdout: '  \n' } })).toMatchObject({ output: null });
  });

  it('a long output is clipped before it is kept', () => {
    const stdout = Array.from({ length: 10_000 }, (_, i) => `l${i}`).join('\n');
    const e = filterHookEvent({ ...postToolUseBash, tool_response: { stdout } }) as { output: { omittedLines: number; tail: string } };
    expect(e.output.omittedLines).toBe(9600);
    expect(e.output.tail).toBeTruthy();
  });

  it('a missing or odd duration is null', () => {
    expect(filterHookEvent({ ...postToolUseBash, duration_ms: undefined })).toMatchObject({ durationMs: null });
    expect(filterHookEvent({ ...postToolUseBash, duration_ms: '5' })).toMatchObject({ durationMs: null });
    expect(filterHookEvent({ ...postToolUseBash, duration_ms: 12.6 })).toMatchObject({ durationMs: 13 });
  });

  it('keeps nothing else: no transcript path, absolute cwd, permission mode or the assistant answer', () => {
    for (const payload of [userPromptSubmit, postToolUseBash, postToolUseFailure, postToolUseWrite, postToolUseEdit, postToolUseRead]) {
      const json = JSON.stringify(filterHookEvent(payload));
      for (const forbidden of [TRANSCRIPT, 'transcript', CWD, '/home/lan', 'permission', 'default', ASSISTANT_ANSWER]) expect(json, forbidden).not.toContain(forbidden);
    }
  });

  it('Stop and every other event are not ours: null', () => {
    expect(filterHookEvent(stop)).toBeNull();
    expect(filterHookEvent({ ...userPromptSubmit, hook_event_name: 'SessionStart' })).toBeNull();
    expect(filterHookEvent({ ...postToolUseBash, hook_event_name: 'PreToolUse' })).toBeNull();
  });

  it('malformed input is null, not an exception', () => {
    for (const bad of [null, undefined, 5, 'x', [], {}, { prompt: 5 }, { tool_name: 5 }, { hook_event_name: 'UserPromptSubmit' }, { hook_event_name: 'PostToolUse' }]) {
      expect(filterHookEvent(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('infers the event from its fields when hook_event_name is missing', () => {
    const noName = (p: object) => { const { hook_event_name: _drop, ...rest } = p as Record<string, unknown>; return rest; };
    expect(filterHookEvent(noName(userPromptSubmit))).toMatchObject({ kind: 'prompt' });
    expect(filterHookEvent(noName(postToolUseBash))).toMatchObject({ kind: 'tool', ok: true });
    expect(filterHookEvent(noName(postToolUseFailure))).toMatchObject({ kind: 'tool', ok: false });
    expect(filterHookEvent(noName(stop))).toBeNull();
  });
});

describe('isHookEvent', () => {
  it('is true for our three hooks and false for the rest, without parsing anything', () => {
    expect([userPromptSubmit, postToolUseBash, postToolUseFailure].every(isHookEvent)).toBe(true);
    expect([stop, null, 'x', {}].some(isHookEvent)).toBe(false);
  });
});

describe('the exercise folder never travels in kept text', () => {
  it('is turned into a relative path in the command, output and error', () => {
    const e = filterHookEvent({
      ...postToolUseBash,
      tool_input: { command: `cd ${CWD} && ls` },
      tool_response: { stdout: `${CWD}\n${CWD}/src/add.ts\n${CWD}-2/other.ts` },
    })!;
    expect(e).toMatchObject({ toolTarget: 'cd . && ls', output: { head: `.\nsrc/add.ts\n${CWD}-2/other.ts` } });
    expect(JSON.stringify(filterHookEvent({ ...postToolUseFailure, error: `ENOENT ${CWD}/x.ts` }))).toContain('ENOENT x.ts');
  });

  it('works for a Windows folder written with either slash', () => {
    const win = { ...postToolUseBash, cwd: 'C:\\Users\\Lan\\bai-tap' };
    const e = filterHookEvent({ ...win, tool_response: { stdout: 'C:\\Users\\Lan\\bai-tap\\a.ts\nC:/Users/Lan/bai-tap/b.ts' } })!;
    expect(e).toMatchObject({ output: { head: 'a.ts\nb.ts' } });
  });

  it('Write and Edit keep no output (a confirmation with an absolute path); the change is what counts', () => {
    expect(filterHookEvent(postToolUseWrite)).toMatchObject({ output: null });
    expect(filterHookEvent(postToolUseEdit)).toMatchObject({ output: null });
  });
});

describe('PowerShell and other shells', () => {
  it('PowerShell is a command tool like Bash: the command, ok, duration, stdout as the output', () => {
    const e = filterHookEvent(postToolUsePowerShell)!;
    expect(e).toMatchObject({ kind: 'tool', toolName: 'PowerShell', ok: true, durationMs: 412, errorExcerpt: null, change: null });
    expect(e).toMatchObject({ toolTarget: 'Get-ChildItem src' }); // the exercise folder becomes a relative path
    expect((e as { output: { head: string } }).output.head).toBe('src\\add.ts\nMode  Length Name\n-a--- 52 add.ts\n');
  });

  it('CRLF output leaves no carriage return behind', () => {
    expect(JSON.stringify(filterHookEvent(postToolUsePowerShell))).not.toContain('\\r');
  });

  it('a failed PowerShell call keeps the command and the first lines of the error', () => {
    expect(filterHookEvent(postToolUseFailurePowerShell)).toMatchObject({
      ok: false, toolName: 'PowerShell', toolTarget: 'npm test', durationMs: 95, errorExcerpt: "npm : The term 'npm' is not recognized\nAt line:1 char:1", output: null,
    });
  });

  it('stderr follows stdout, as for Bash', () => {
    const e = filterHookEvent({ ...postToolUsePowerShell, tool_response: { stdout: 'out', stderr: 'warn' } });
    expect(e).toMatchObject({ output: { head: 'out\nwarn' } });
  });

  it('the tool name is not case sensitive', () => {
    expect(filterHookEvent({ ...postToolUsePowerShell, tool_name: 'powershell' })).toMatchObject({ toolTarget: 'Get-ChildItem src' });
  });

  it('a tool this code has not heard of still shows its command line when its input has one', () => {
    const e = filterHookEvent({ ...postToolUseBash, tool_name: 'Pwsh', tool_input: { command: 'Get-Date' }, tool_response: { stdout: 'Friday' } });
    expect(e).toMatchObject({ toolName: 'Pwsh', toolTarget: 'Get-Date', output: { head: 'Friday' } });
  });

  it('a shell response with neither stdout nor stderr is kept as JSON, not lost', () => {
    const e = filterHookEvent({ ...postToolUsePowerShell, tool_response: { output: 'hello', exitCode: 0 } });
    expect(e).toMatchObject({ toolTarget: 'Get-ChildItem src', output: { head: '{"output":"hello","exitCode":0}' } });
  });

  it('keeps the Windows folder, the user name and the transcript out of everything kept', () => {
    for (const payload of [postToolUsePowerShell, postToolUseFailurePowerShell]) {
      const json = JSON.stringify(filterHookEvent(payload));
      for (const forbidden of [WIN_CWD, 'C:', 'Users', 'Lan', 'transcript', '.claude']) expect(json, forbidden).not.toContain(forbidden);
    }
  });
});
