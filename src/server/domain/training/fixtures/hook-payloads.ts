/**
 * Hook payloads as Claude Code sends them, rebuilt from the field lists in docs/spikes/claude-code-hooks.md §3
 * (the spike did not keep the raw JSON). They carry the fields the filter must DROP on purpose: `transcript_path`,
 * an absolute `cwd`, `permission_mode`, `last_assistant_message`.
 *
 * ⚠️ `postToolUseRead` is SIMULATED: the spike never recorded a real `Read` payload. Replace it with a captured one
 * after the real-machine checklist (spike §5); the filter does not depend on the shape of Read's `tool_response`.
 */
export const CWD = '/home/lan/bai-tap';
export const SESSION_ID = 'c0ffee00-1111-4222-8333-444455556666';
export const TRANSCRIPT = '/home/lan/.claude/projects/-home-lan-bai-tap/c0ffee00.jsonl';
export const ASSISTANT_ANSWER = 'Đây là câu trả lời riêng của Claude, không được lưu';
export const FILE_SECRET = 'API_KEY=sk-live-do-not-store';

const common = { session_id: SESSION_ID, transcript_path: TRANSCRIPT, cwd: CWD, permission_mode: 'default' };

export const userPromptSubmit = { ...common, hook_event_name: 'UserPromptSubmit', prompt: 'Viết hàm cộng hai số' };

export const postToolUseBash = {
  ...common,
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'npm test', description: 'Run tests' },
  tool_response: { stdout: 'PASS src/add.test.ts\nTests: 3 passed', stderr: '', interrupted: false },
  duration_ms: 2310,
};

export const postToolUseFailure = {
  ...common,
  hook_event_name: 'PostToolUseFailure',
  tool_name: 'Bash',
  tool_input: { command: 'ls /nope' },
  error: 'Exit code 2\nls: cannot access /nope: No such file or directory',
  duration_ms: 31,
};

export const postToolUseWrite = {
  ...common,
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: { file_path: `${CWD}/src/add.ts`, content: 'export const add = (a: number, b: number) => a + b;\n' },
  tool_response: { type: 'create', filePath: `${CWD}/src/add.ts` },
  duration_ms: 12,
};

export const postToolUseEdit = {
  ...common,
  hook_event_name: 'PostToolUse',
  tool_name: 'Edit',
  tool_input: { file_path: `${CWD}/src/add.ts`, old_string: 'a + b', new_string: 'a + b + 0' },
  tool_response: { filePath: `${CWD}/src/add.ts` },
  duration_ms: 9,
};

export const postToolUseRead = {
  ...common,
  hook_event_name: 'PostToolUse',
  tool_name: 'Read',
  tool_input: { file_path: `${CWD}/.env` },
  tool_response: { type: 'text', file: { filePath: `${CWD}/.env`, content: `${FILE_SECRET}\nDEBUG=1`, numLines: 2, startLine: 1, totalLines: 2 } },
  duration_ms: 4,
};

export const stop = { ...common, hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: ASSISTANT_ANSWER };
