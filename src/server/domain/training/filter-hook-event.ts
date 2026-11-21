import { clip } from './clip.js';
import type { NoticeSubtype, SessionSubtype, TrainingEventDraft } from './training-event.js';

const ERROR_EXCERPT_LINES = 20;
/** `note` (a `/compact` instruction, the member's answers to Claude's questions) is cut here. */
export const NOTE_MAX_CHARS = 2000;
/**
 * No output kept: `Read` returns the file itself (PRODUCT.md §7.34c); `Write`/`Edit` only echo a confirmation with an absolute
 * path, and what they did is already in `change`.
 */
const NO_OUTPUT_TOOLS = new Set(['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'AskUserQuestion']);

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

type HookKind = 'prompt' | 'tool_ok' | 'tool_failed' | 'permission' | 'compact' | 'session_end' | 'model_switch' | 'notification';

/**
 * Which of our hooks sent this, or null (Stop, SessionStart, junk, ...). Uses `hook_event_name` when it names one of
 * ours; when it is missing (the spike did not record it) it infers from the fields present, for the original three only.
 */
function hookKind(raw: unknown): HookKind | null {
  if (!isObject(raw)) return null;
  const name = str(raw.hook_event_name);
  if (name !== null) {
    if (name === 'UserPromptSubmit') return typeof raw.prompt === 'string' ? 'prompt' : null;
    if (name === 'PostToolUse') return typeof raw.tool_name === 'string' ? 'tool_ok' : null;
    if (name === 'PostToolUseFailure') return typeof raw.tool_name === 'string' ? 'tool_failed' : null;
    if (name === 'PermissionRequest') return typeof raw.tool_name === 'string' ? 'permission' : null;
    if (name === 'PreCompact') return raw.trigger === 'manual' || raw.trigger === 'auto' ? 'compact' : null;
    if (name === 'SessionEnd') return 'session_end';
    if (name === 'PostModelSwitch') return typeof raw.from_model === 'string' && typeof raw.to_model === 'string' ? 'model_switch' : null;
    if (name === 'Notification') return noticeSubtype(raw) === null ? null : 'notification';
    return null;
  }
  if (typeof raw.prompt === 'string' && raw.tool_name === undefined) return 'prompt';
  if (typeof raw.tool_name === 'string') return typeof raw.error === 'string' ? 'tool_failed' : 'tool_ok';
  return null;
}

function noticeSubtype(raw: Json): NoticeSubtype | null {
  if (raw.notification_type === 'permission_prompt') return 'waiting_permission';
  if (raw.notification_type === 'idle_prompt') return 'idle';
  return null;
}

/**
 * Is this a `PermissionRequest`? The one hook whose answer can decide for the member (spike §6.2), so the route
 * answers it with an empty 204 whatever else happens (architecture.md §11.9).
 */
export const isPermissionRequest = (raw: unknown): boolean => isObject(raw) && raw.hook_event_name === 'PermissionRequest';

/** Cheap check, used once a training has stopped: "is this one of our hooks still firing?". Nothing is parsed or stored. */
export const isHookEvent = (raw: unknown): boolean => hookKind(raw) !== null;

const WINDOWS_PATH = /^[A-Za-z]:[\\/]/;
const normalize = (p: string) => p.replace(/\\/g, '/');
const baseName = (p: string) => normalize(p).split('/').filter(Boolean).pop() ?? p;

/** A path relative to the exercise folder; outside it, or with no folder to compare to, only the file name (never an absolute path). */
function relativePath(path: string, cwd: string | null): string {
  if (!cwd) return baseName(path);
  const windows = WINDOWS_PATH.test(cwd) || WINDOWS_PATH.test(path);
  const root = normalize(cwd).replace(/\/+$/, '');
  const file = normalize(path);
  const fold = (s: string) => (windows ? s.toLowerCase() : s);
  if (fold(file).startsWith(`${fold(root)}/`)) return file.slice(root.length + 1);
  return baseName(path);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The exercise folder's absolute path never leaves the member's machine: inside any kept text it becomes a relative path
 * (`cd /home/lan/bai-tap && npm test` → `cd . && npm test`, a listing of absolute files → relative ones).
 * A longer name that merely starts the same (`bai-tap-2`) is left alone.
 */
function scrubCwd(text: string, cwd: string | null): string {
  if (!cwd) return text;
  const trimmed = cwd.replace(/[\\/]+$/, '');
  if (trimmed === '') return text;
  let out = text;
  for (const form of new Set([trimmed, normalize(trimmed)])) {
    const base = escapeRegExp(form);
    out = out.replace(new RegExp(`${base}[\\\\/]`, 'g'), '').replace(new RegExp(`${base}(?![\\w.-])`, 'g'), '.');
  }
  return out;
}

/** Every absolute folder Claude Code reports (`cwd`, `scratchpad_dir`) is taken out of any kept text. */
const scrubAll = (text: string, roots: (string | null)[]): string => roots.reduce<string>((out, root) => scrubCwd(out, root), text);

const lineCount = (text: string) => (text === '' ? 0 : text.split(/\r?\n/).length);

/** How many lines `Read` returned, from whichever field the tool response carries; null when it cannot be told. */
function readLineCount(response: unknown): number | null {
  if (typeof response === 'string') return lineCount(response);
  if (!isObject(response)) return null;
  const file = isObject(response.file) ? response.file : response;
  if (typeof file.numLines === 'number') return file.numLines;
  if (typeof file.content === 'string') return lineCount(file.content);
  if (typeof response.content === 'string') return lineCount(response.content);
  return null;
}

/** Tools that run a command line, each with its own shell: `Bash` (macOS, Linux) and `PowerShell` (Windows). */
const SHELL_TOOLS = new Set(['bash', 'powershell']);

/**
 * Does this tool call run a command? By name, or by shape (`tool_input.command` is a string), so a shell this code has
 * not heard of yet still shows its command line instead of an empty row.
 */
const isShellTool = (toolName: string, input: Json): boolean => SHELL_TOOLS.has(toolName.toLowerCase()) || typeof input.command === 'string';

function toolTarget(toolName: string, input: Json, response: unknown, cwd: string | null): string | null {
  if (isShellTool(toolName, input)) return str(input.command);
  const path = str(input.file_path) ?? str(input.notebook_path) ?? str(input.path);
  if (path === null) return null;
  const rel = relativePath(path, cwd);
  if (toolName !== 'Read') return rel;
  const lines = readLineCount(response);
  return lines === null ? rel : `${rel} · ${lines} dòng`;
}

/** The tool's own output as text. `Read` never gets here: its output is the file's content. */
function outputText(toolName: string, input: Json, response: unknown): string {
  if (typeof response === 'string') return response;
  if (!isObject(response)) return response === undefined || response === null ? '' : JSON.stringify(response);
  // A shell reports `stdout` / `stderr`. If a shell's response has neither (a shape not seen yet), keep it as JSON rather than lose it.
  if (isShellTool(toolName, input) && (typeof response.stdout === 'string' || typeof response.stderr === 'string')) {
    return [str(response.stdout), str(response.stderr)].filter(Boolean).join('\n');
  }
  return JSON.stringify(response);
}

function changeText(toolName: string, input: Json): string | null {
  if (toolName === 'ExitPlanMode') return str(input.plan);
  if (toolName === 'Write') return str(input.content);
  if (toolName !== 'Edit') return null;
  const prefix = (text: string, mark: string) => text.split(/\r?\n/).map(l => `${mark} ${l}`).join('\n');
  const oldText = str(input.old_string);
  const newText = str(input.new_string);
  if (oldText === null && newText === null) return null;
  return [oldText === null ? null : prefix(oldText, '-'), newText === null ? null : prefix(newText, '+')].filter(Boolean).join('\n');
}

const clipOrNull = (text: string | null) => (text && text.trim() !== '' ? clip(text) : null);

const cutNote = (text: string): string => (text.length > NOTE_MAX_CHARS ? `${text.slice(0, NOTE_MAX_CHARS - 1)}…` : text);
const noteOrNull = (text: string | null): string | null => (text && text.trim() !== '' ? cutNote(text.trim()) : null);

/** `AskUserQuestion`: what Claude asked, one line per question. */
function questionsText(input: Json): string | null {
  if (!Array.isArray(input.questions)) return null;
  const lines = input.questions.map(q => (isObject(q) ? str(q.question) : null)).filter((q): q is string => q !== null);
  return lines.length > 0 ? lines.join('\n') : null;
}

/** `AskUserQuestion`: "question → the member's choice" pairs, from `tool_input.answers` (or the same map in `tool_response`). */
function answersNote(input: Json, response: unknown): string | null {
  const answers = isObject(input.answers) ? input.answers : isObject(response) && isObject(response.answers) ? response.answers : null;
  if (!answers) return null;
  const pairs = Object.entries(answers).map(([q, a]) => `${q} → ${typeof a === 'string' ? a : JSON.stringify(a)}`);
  return pairs.length > 0 ? pairs.join('\n') : null;
}

/** `ExitPlanMode`: the plan Claude put forward, the one useful field of its response (the rest is an absolute file path). */
const planOutput = (response: unknown): string | null => (isObject(response) ? str(response.plan) : null);

/**
 * Keeps only what the mentor reviews and drops the rest of Claude Code's hook JSON (`transcript_path`, `cwd`,
 * `scratchpad_dir`, `last_assistant_message`, `compact_summary`, ...): a whitelist, never a blacklist. Returns null for anything
 * that is not one of our eight hooks or that is malformed (PRODUCT.md §7.34c, §7.35, architecture.md §11.8, §11.9).
 */
export function filterHookEvent(raw: unknown): TrainingEventDraft | null {
  const kind = hookKind(raw);
  if (kind === null || !isObject(raw)) return null;
  const base = {
    claudeSessionId: str(raw.session_id) ?? '',
    permissionMode: str(raw.permission_mode),
    promptId: str(raw.prompt_id),
  };
  const cwd = str(raw.cwd);
  const roots = [cwd, str(raw.scratchpad_dir)];
  const scrub = (text: string) => scrubAll(text, roots);

  if (kind === 'prompt') return { kind: 'prompt', ...base, prompt: raw.prompt as string };
  if (kind === 'notification') return { kind: 'notice', ...base, subtype: noticeSubtype(raw)! };
  if (kind === 'compact') {
    const manual = raw.trigger === 'manual';
    return { kind: 'session', ...base, subtype: manual ? 'compact_manual' : 'compact_auto', note: manual ? noteOrNull(str(raw.custom_instructions)) : null };
  }
  if (kind === 'session_end') {
    const subtype: SessionSubtype = raw.reason === 'clear' ? 'clear' : 'exit';
    return { kind: 'session', ...base, subtype, note: null };
  }
  if (kind === 'model_switch') return { kind: 'session', ...base, subtype: 'model_switch', note: noteOrNull(`${raw.from_model as string} → ${raw.to_model as string}`) };

  const toolName = raw.tool_name as string;
  const input = isObject(raw.tool_input) ? raw.tool_input : {};
  const isQuestion = toolName === 'AskUserQuestion';
  const target = isQuestion ? questionsText(input) : toolTarget(toolName, input, raw.tool_response, cwd);
  const scrubbedTarget = target === null ? null : scrub(target);
  if (kind === 'permission') {
    return { kind: 'permission', ...base, toolName, toolTarget: scrubbedTarget, change: clipOrNull(scrubOrNull(changeText(toolName, input), scrub)) };
  }

  const ok = kind === 'tool_ok';
  const error = str(raw.error);
  const plan = toolName === 'ExitPlanMode' ? planOutput(raw.tool_response) : null;
  return {
    kind: 'tool',
    ...base,
    toolName,
    ok,
    durationMs: typeof raw.duration_ms === 'number' && Number.isFinite(raw.duration_ms) ? Math.round(raw.duration_ms) : null,
    toolTarget: scrubbedTarget,
    errorExcerpt: !ok && error ? scrub(error.split(/\r?\n/).slice(0, ERROR_EXCERPT_LINES).join('\n')) : null,
    output:
      plan !== null
        ? clipOrNull(scrub(plan))
        : NO_OUTPUT_TOOLS.has(toolName)
          ? null
          : clipOrNull(scrub(outputText(toolName, input, raw.tool_response))),
    change: clipOrNull(changeText(toolName, input)),
    note: isQuestion ? noteOrNull(answersNote(input, raw.tool_response)) : null,
  };
}

const scrubOrNull = (text: string | null, scrub: (t: string) => string): string | null => (text === null ? null : scrub(text));
