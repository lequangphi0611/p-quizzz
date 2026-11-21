import { describe, expect, it } from 'vitest';
import { filterHookEvent, isHookEvent, isPermissionRequest, NOTE_MAX_CHARS } from './filter-hook-event.js';
import {
  ASSISTANT_ANSWER, COMPACT_SUMMARY, CWD, FILE_SECRET, HOME_DIR, PLAN, PROMPT_ID, SCRATCHPAD, SESSION_ID, TRANSCRIPT,
  notificationIdle, notificationOther, notificationPermission, permissionRequestBash, permissionRequestEdit, permissionRequestExitPlan,
  postCompact, postModelSwitch, postToolUseAskUserQuestion, postToolUseExitPlan, preCompactAuto, preCompactManual, sessionEndClear, sessionEndExit,
  WIN_CWD, postToolUseFailurePowerShell, postToolUsePowerShell,
  postToolUseBash, postToolUseEdit, postToolUseFailure, postToolUseRead, postToolUseWrite, stop, userPromptSubmit,
} from './fixtures/hook-payloads.js';

describe('filterHookEvent', () => {
  it('UserPromptSubmit keeps the prompt and Claude Code session id', () => {
    expect(filterHookEvent(userPromptSubmit)).toEqual({ kind: 'prompt', claudeSessionId: SESSION_ID, permissionMode: 'default', promptId: null, prompt: 'Viết hàm cộng hai số' });
  });

  it('PostToolUse Bash: the command, ok, duration, and the output as a clip', () => {
    expect(filterHookEvent(postToolUseBash)).toEqual({
      kind: 'tool', claudeSessionId: SESSION_ID, permissionMode: 'default', promptId: null, note: null, toolName: 'Bash', ok: true, durationMs: 2310, toolTarget: 'npm test', errorExcerpt: null,
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

  it('keeps nothing else: no transcript path, absolute cwd, scratchpad or the assistant answer', () => {
    for (const payload of [userPromptSubmit, postToolUseBash, postToolUseFailure, postToolUseWrite, postToolUseEdit, postToolUseRead]) {
      const json = JSON.stringify(filterHookEvent(payload));
      for (const forbidden of [TRANSCRIPT, 'transcript', CWD, '/home/lan', SCRATCHPAD, ASSISTANT_ANSWER]) expect(json, forbidden).not.toContain(forbidden);
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

describe('filterHookEvent: session, permission, notice, question and plan (S37)', () => {
  const draft = (raw: unknown) => filterHookEvent(raw)!;

  it('SessionEnd: /clear is `clear`, any other reason is `exit`', () => {
    expect(draft(sessionEndClear)).toMatchObject({ kind: 'session', subtype: 'clear', note: null, claudeSessionId: SESSION_ID });
    expect(draft(sessionEndExit)).toMatchObject({ kind: 'session', subtype: 'exit', note: null });
    expect(draft({ ...sessionEndClear, reason: 'other' })).toMatchObject({ subtype: 'exit' });
  });

  it('PreCompact: typed /compact keeps what the member wrote, automatic does not', () => {
    expect(draft(preCompactManual)).toMatchObject({ kind: 'session', subtype: 'compact_manual', note: 'giữ lại ý chính' });
    expect(draft({ ...preCompactManual, custom_instructions: '  ' })).toMatchObject({ subtype: 'compact_manual', note: null });
    expect(draft(preCompactAuto)).toMatchObject({ kind: 'session', subtype: 'compact_auto', note: null });
    expect(filterHookEvent({ ...preCompactManual, trigger: 'weird' })).toBeNull();
  });

  it('a long /compact note is cut', () => {
    const e = draft({ ...preCompactManual, custom_instructions: 'x'.repeat(NOTE_MAX_CHARS + 500) }) as { note: string };
    expect(e.note).toHaveLength(NOTE_MAX_CHARS);
  });

  it('PostCompact is not ours: its summary is Claude\'s own writing', () => {
    expect(filterHookEvent(postCompact)).toBeNull();
    expect(isHookEvent(postCompact)).toBe(false);
  });

  it('PostModelSwitch: "from → to"', () => {
    expect(draft(postModelSwitch)).toMatchObject({ kind: 'session', subtype: 'model_switch', note: 'claude-opus-4-5 → claude-sonnet-4-5', permissionMode: 'default' });
    expect(filterHookEvent({ ...postModelSwitch, to_model: undefined })).toBeNull();
  });

  it('Notification: waiting for permission / idle; the message is dropped; other types are not ours', () => {
    expect(draft(notificationPermission)).toMatchObject({ kind: 'notice', subtype: 'waiting_permission' });
    expect(draft(notificationIdle)).toMatchObject({ kind: 'notice', subtype: 'idle' });
    expect(JSON.stringify(draft(notificationPermission))).not.toContain('needs your permission');
    expect(filterHookEvent(notificationOther)).toBeNull();
  });

  it('PermissionRequest Edit: the tool, the file relative to the folder, and the change; no suggestions', () => {
    const e = draft(permissionRequestEdit);
    expect(e).toMatchObject({ kind: 'permission', toolName: 'Edit', toolTarget: 'src/add.ts', change: { head: '- a + b\n+ a + b + 0' }, permissionMode: 'default', promptId: PROMPT_ID });
    expect(JSON.stringify(e)).not.toContain('permission_suggestions');
    expect(JSON.stringify(e)).not.toContain('addRules');
  });

  it('PermissionRequest Bash: the command with the folder taken out', () => {
    expect(draft(permissionRequestBash)).toMatchObject({ kind: 'permission', toolName: 'Bash', toolTarget: 'cd . && rm -rf build', change: null });
  });

  it('PermissionRequest ExitPlanMode: the plan is the change', () => {
    expect(draft(permissionRequestExitPlan)).toMatchObject({ kind: 'permission', toolName: 'ExitPlanMode', permissionMode: 'plan', change: { head: PLAN } });
  });

  it('AskUserQuestion: the questions as the target, the member\'s choices as the note, no output', () => {
    expect(draft(postToolUseAskUserQuestion)).toMatchObject({
      kind: 'tool', toolName: 'AskUserQuestion', ok: true, toolTarget: 'Dùng thư viện nào?', note: 'Dùng thư viện nào? → vitest', output: null,
    });
  });

  it('AskUserQuestion reads the answers from tool_response when tool_input has none', () => {
    const { answers: _a, ...input } = postToolUseAskUserQuestion.tool_input;
    expect(draft({ ...postToolUseAskUserQuestion, tool_input: input })).toMatchObject({ note: 'Dùng thư viện nào? → vitest' });
    expect(draft({ ...postToolUseAskUserQuestion, tool_input: input, tool_response: {} })).toMatchObject({ note: null });
  });

  it('ExitPlanMode (PostToolUse): the output is the plan, never the plan file\'s absolute path', () => {
    const e = draft(postToolUseExitPlan);
    expect(e).toMatchObject({ kind: 'tool', toolName: 'ExitPlanMode', output: { head: PLAN }, note: null });
    expect(JSON.stringify(e)).not.toContain(HOME_DIR);
  });

  it('keeps the permission mode and turn id of an ordinary tool call, nothing else from the envelope', () => {
    expect(draft(postToolUseExitPlan)).toMatchObject({ permissionMode: 'plan', promptId: PROMPT_ID });
  });

  it('no stored string carries the exercise folder, the scratchpad, the transcript or the summary', () => {
    const all = [
      sessionEndClear, sessionEndExit, preCompactManual, preCompactAuto, postModelSwitch, notificationPermission, notificationIdle,
      permissionRequestEdit, permissionRequestBash, permissionRequestExitPlan, postToolUseAskUserQuestion, postToolUseExitPlan,
    ];
    for (const payload of all) {
      const json = JSON.stringify(filterHookEvent(payload));
      for (const forbidden of [CWD, SCRATCHPAD, TRANSCRIPT, 'transcript', 'scratchpad', COMPACT_SUMMARY, HOME_DIR]) expect(json, forbidden).not.toContain(forbidden);
    }
  });

  it('text that mentions the scratchpad folder has it taken out too', () => {
    const e = draft({ ...postToolUseBash, scratchpad_dir: SCRATCHPAD, tool_response: { stdout: `wrote ${SCRATCHPAD}/out.txt`, stderr: '' } }) as { output: { head: string } };
    expect(e.output.head).toBe('wrote out.txt');
  });

  it('isPermissionRequest only for that hook', () => {
    expect(isPermissionRequest(permissionRequestEdit)).toBe(true);
    expect(isPermissionRequest(postToolUseBash)).toBe(false);
    expect(isPermissionRequest(null)).toBe(false);
    expect(isHookEvent(permissionRequestEdit)).toBe(true);
  });
});
