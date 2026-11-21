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

/**
 * ⚠️ SIMULATED, like `postToolUseRead`: no real Windows payload was captured (the spike ran on Linux). Assumes `PowerShell` mirrors
 * `Bash` (`tool_input.command`, `tool_response.stdout/stderr`) with CRLF line ends and a Windows `cwd`. Replace after the Windows
 * checklist (spike §5).
 */
export const WIN_CWD = 'C:\\Users\\Lan\\bai-tap';
const winCommon = { ...common, cwd: WIN_CWD, transcript_path: 'C:\\Users\\Lan\\.claude\\projects\\x\\c0ffee00.jsonl' };

export const postToolUsePowerShell = {
  ...winCommon,
  hook_event_name: 'PostToolUse',
  tool_name: 'PowerShell',
  tool_input: { command: `Get-ChildItem ${WIN_CWD}\\src`, description: 'List sources' },
  tool_response: { stdout: `${WIN_CWD}\\src\\add.ts\r\nMode  Length Name\r\n-a--- 52 add.ts\r\n`, stderr: '', interrupted: false },
  duration_ms: 412,
};

export const postToolUseFailurePowerShell = {
  ...winCommon,
  hook_event_name: 'PostToolUseFailure',
  tool_name: 'PowerShell',
  tool_input: { command: 'npm test' },
  error: `npm : The term 'npm' is not recognized\r\nAt line:1 char:1`,
  duration_ms: 95,
};

export const stop = { ...common, hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: ASSISTANT_ANSWER };

/**
 * Session, permission, question and plan payloads, rebuilt from the real runs in docs/spikes/claude-code-hooks.md §6
 * (Claude Code 2.1.330, Linux) with the absolute paths replaced by `CWD` / `SCRATCHPAD` / `HOME_DIR`. They carry the fields the
 * filter must DROP: `scratchpad_dir`, `compact_summary`, the notification `message`, `permission_suggestions`.
 */
export const SCRATCHPAD = '/tmp/claude-1000/-home-lan-bai-tap/c0ffee00/scratchpad';
export const HOME_DIR = '/home/lan';
export const COMPACT_SUMMARY = 'Tóm tắt do Claude viết: người dùng đang sửa hàm add, mã nguồn nằm ở src/add.ts';
export const PROMPT_ID = 'prompt-1111';

const turn = { session_id: SESSION_ID, transcript_path: TRANSCRIPT, cwd: CWD, scratchpad_dir: SCRATCHPAD, prompt_id: PROMPT_ID };
// `SessionEnd`, `PreCompact` and `Notification` carry no `permission_mode` (spike §6.1).
const turnNoMode = turn;
const turnWithMode = { ...turn, permission_mode: 'default' };

export const sessionEndClear = { ...turnNoMode, hook_event_name: 'SessionEnd', reason: 'clear' };
export const sessionEndExit = { ...turnNoMode, hook_event_name: 'SessionEnd', reason: 'prompt_input_exit' };
export const preCompactManual = { ...turnNoMode, hook_event_name: 'PreCompact', trigger: 'manual', custom_instructions: 'giữ lại ý chính' };
export const preCompactAuto = { ...turnNoMode, hook_event_name: 'PreCompact', trigger: 'auto', custom_instructions: null };
export const postCompact = { ...turnNoMode, hook_event_name: 'PostCompact', trigger: 'manual', compact_summary: COMPACT_SUMMARY };
export const postModelSwitch = {
  ...turnWithMode,
  hook_event_name: 'PostModelSwitch',
  from_model: 'claude-opus-4-5',
  to_model: 'claude-sonnet-4-5',
  requested_model: 'sonnet',
  source: 'command',
  context_tokens: 1234,
};
export const notificationPermission = { ...turnNoMode, hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'Claude needs your permission' };
export const notificationIdle = { ...turnNoMode, hook_event_name: 'Notification', notification_type: 'idle_prompt', message: 'Claude is waiting for your input' };
export const notificationOther = { ...turnNoMode, hook_event_name: 'Notification', notification_type: 'auth_success', message: 'Signed in' };

export const permissionRequestEdit = {
  ...turnWithMode,
  hook_event_name: 'PermissionRequest',
  tool_name: 'Edit',
  tool_input: { file_path: `${CWD}/src/add.ts`, old_string: 'a + b', new_string: 'a + b + 0' },
  permission_suggestions: [{ type: 'addRules', rules: [{ toolName: 'Edit' }], behavior: 'allow', destination: 'session' }],
};
export const permissionRequestBash = {
  ...turnWithMode,
  hook_event_name: 'PermissionRequest',
  tool_name: 'Bash',
  tool_input: { command: `cd ${CWD} && rm -rf build`, description: 'Remove build' },
  permission_suggestions: [],
};

export const askUserQuestionTool_input = {
  questions: [
    { question: 'Dùng thư viện nào?', header: 'Thư viện', multiSelect: false, options: [{ label: 'vitest', description: '' }, { label: 'jest', description: '' }] },
  ],
  answers: { 'Dùng thư viện nào?': 'vitest' },
};
export const postToolUseAskUserQuestion = {
  ...turnWithMode,
  hook_event_name: 'PostToolUse',
  tool_name: 'AskUserQuestion',
  tool_input: askUserQuestionTool_input,
  tool_response: { questions: askUserQuestionTool_input.questions, answers: askUserQuestionTool_input.answers },
  duration_ms: 18000,
};

export const PLAN = '# Kế hoạch\n1. Viết hàm add\n2. Chạy test';
export const permissionRequestExitPlan = { ...turn, permission_mode: 'plan', hook_event_name: 'PermissionRequest', tool_name: 'ExitPlanMode', tool_input: { plan: PLAN } };
export const postToolUseExitPlan = {
  ...turn,
  permission_mode: 'plan',
  hook_event_name: 'PostToolUse',
  tool_name: 'ExitPlanMode',
  tool_input: { plan: PLAN },
  tool_response: { plan: PLAN, isAgent: false, filePath: `${HOME_DIR}/.claude/plans/x.md` },
  duration_ms: 5,
};
