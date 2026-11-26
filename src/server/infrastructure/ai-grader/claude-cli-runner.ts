import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GraderConfig } from './grader-config.js';

// Runs the Claude CLI installed on the mentor's machine (docs/architecture.md §11.6, §11.12). Shared by every AI feature
// (grading, example drafts). Safety: no shell, the text goes through stdin (never argv), an empty temp dir as cwd (no CLAUDE.md,
// no repo files), and no tools or MCP servers for the model.

export type CliFailureReason = 'timeout' | 'bad_output' | 'process_failed';

/** A failed run. Each adapter maps it to the error type of its own port; `message` is set only when it differs from that reason's default. */
export class CliRunFailure extends Error {
  constructor(
    readonly reason: CliFailureReason,
    message?: string,
  ) {
    super(message ?? reason);
    this.name = 'CliRunFailure';
    this.hasCustomMessage = message !== undefined;
  }

  readonly hasCustomMessage: boolean;
}

/** Appended after the mentor's own args, always. */
export function fixedArgs(schema: object, systemPrompt: string): string[] {
  return [
    '-p',
    '--tools',
    '',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(schema),
    '--system-prompt',
    systemPrompt,
  ];
}

const MAX_OUTPUT = 2_000_000;
const START_FAILED = 'Không chạy được lệnh AI (kiểm tra cấu hình)';

type Envelope = { type?: unknown; is_error?: boolean; structured_output?: unknown; result?: unknown; modelUsage?: Record<string, unknown> };

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isObject(v: unknown): v is Envelope {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** With `--verbose`, `--output-format json` prints an array of every event; the envelope is its last `result` item. */
function resultIn(v: unknown): Envelope | undefined {
  if (Array.isArray(v)) {
    for (let i = v.length - 1; i >= 0; i--) {
      const e: unknown = v[i];
      if (isObject(e) && e.type === 'result') return e;
    }
    return undefined;
  }
  return isObject(v) ? v : undefined;
}

/**
 * The result envelope in stdout. A wrapper script around the CLI may print its own log lines to stdout,
 * so when the whole output is not JSON, take the last line holding the CLI's one-line `type: "result"` object
 * (or the `--verbose` event array).
 */
export function findEnvelope(stdout: string): Envelope | undefined {
  const whole = resultIn(tryParse(stdout.trim()));
  if (whole) return whole;
  const lines = stdout.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim();
    if (!line.startsWith('{') && !line.startsWith('[')) continue;
    const found = resultIn(tryParse(line));
    if (found?.type === 'result') return found;
  }
  return undefined;
}

/** The CLI's `--output-format json` result: the structured output, or JSON inside the text result. Not yet checked against any schema. */
export function readCliResult(stdout: string): { body: unknown; model: string | null } {
  const envelope = findEnvelope(stdout);
  if (!envelope) throw new CliRunFailure('bad_output');
  if (envelope.is_error) throw new CliRunFailure('process_failed');
  let body = envelope.structured_output;
  if (body === undefined && typeof envelope.result === 'string') {
    const m = /\{[\s\S]*\}/.exec(envelope.result);
    try {
      body = m ? JSON.parse(m[0]) : undefined;
    } catch {
      body = undefined;
    }
  }
  const model = envelope.modelUsage ? (Object.keys(envelope.modelUsage)[0] ?? null) : null;
  return { body, model };
}

export interface RunClaudeCliInput {
  config: Pick<GraderConfig, 'command' | 'args' | 'timeoutSeconds'>;
  schema: object;
  systemPrompt: string;
  /** The whole user prompt. Goes through stdin only. */
  stdin: string;
}

/** Runs the CLI once from an empty temp directory and returns what it produced. Throws `CliRunFailure`. */
export async function runClaudeCli(input: RunClaudeCliInput): Promise<{ body: unknown; model: string | null }> {
  const { config } = input;
  const cwd = await mkdtemp(join(tmpdir(), 'pq-ai-'));
  try {
    const stdout = await run(config.command, [...config.args, ...fixedArgs(input.schema, input.systemPrompt)], input.stdin, cwd, config.timeoutSeconds * 1000);
    return readCliResult(stdout);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

function run(command: string, args: string[], stdin: string, cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, { cwd, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      reject(new CliRunFailure('process_failed', START_FAILED));
      return;
    }
    const out: Buffer[] = [];
    let size = 0;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (b: Buffer) => {
      size += b.length;
      if (size > MAX_OUTPUT) child.kill('SIGKILL');
      else out.push(b);
    });
    child.stderr.resume(); // drained, never logged: it may echo the mentor's configuration
    child.on('error', () => {
      clearTimeout(timer);
      reject(new CliRunFailure('process_failed', START_FAILED));
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) return reject(new CliRunFailure('timeout'));
      if (code !== 0) return reject(new CliRunFailure('process_failed'));
      resolve(Buffer.concat(out).toString('utf8'));
    });
    child.stdin.on('error', () => {}); // the CLI may exit before reading everything; 'close' reports it
    child.stdin.end(stdin, 'utf8');
  });
}
