import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { EssayGraderError, type EssayGrader, type EssayGradingInput } from '../../application/ports/essay-grader.js';
import type { RawSuggestion } from '../../domain/grading/ai-suggestion.js';
import { loadGraderConfig, type ConfigResult } from './grader-config.js';
import { buildGradingPrompt, OUTPUT_SCHEMA, SYSTEM_PROMPT } from './prompts.js';

// Grades with the Claude CLI installed on the mentor's machine (docs/architecture.md §11.6).
// Safety: no shell, the essay goes through stdin (never argv), an empty temp dir as cwd (no CLAUDE.md, no repo files),
// and no tools or MCP servers for the model.

/** Appended after the mentor's own args, always. */
export function fixedArgs(): string[] {
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
    JSON.stringify(OUTPUT_SCHEMA),
    '--system-prompt',
    SYSTEM_PROMPT,
  ];
}

const Suggestion = z.object({
  score: z.number(),
  feedback: z.string(),
  criteria: z.array(z.object({ label: z.string(), score: z.number(), max: z.number(), note: z.string() })),
  suspicious: z.boolean(),
  suspiciousReason: z.string().nullable().optional(),
  suspiciousLines: z.array(z.number()).default([]),
});

const MAX_OUTPUT = 2_000_000;

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
function findEnvelope(stdout: string): Envelope | undefined {
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

/** The CLI's `--output-format json` result: the structured output, or JSON inside the text result. */
export function parseCliOutput(stdout: string): RawSuggestion {
  const envelope = findEnvelope(stdout);
  if (!envelope) throw new EssayGraderError('bad_output');
  if (envelope.is_error) throw new EssayGraderError('process_failed');
  let body = envelope.structured_output;
  if (body === undefined && typeof envelope.result === 'string') {
    const m = /\{[\s\S]*\}/.exec(envelope.result);
    try {
      body = m ? JSON.parse(m[0]) : undefined;
    } catch {
      body = undefined;
    }
  }
  const parsed = Suggestion.safeParse(body);
  if (!parsed.success) throw new EssayGraderError('bad_output');
  const model = envelope.modelUsage ? (Object.keys(envelope.modelUsage)[0] ?? null) : null;
  return { ...parsed.data, suspiciousReason: parsed.data.suspiciousReason || null, model };
}

export class ClaudeCliGrader implements EssayGrader {
  constructor(private readonly configPath: string, private readonly load: (path: string) => Promise<ConfigResult> = loadGraderConfig) {}

  async available(): Promise<boolean> {
    return (await this.load(this.configPath)).ok;
  }

  /** Background concurrency from the mentor's config (1 when it is missing). */
  async concurrency(): Promise<number> {
    const c = await this.load(this.configPath);
    return c.ok ? c.config.concurrency : 1;
  }

  async suggest(input: EssayGradingInput): Promise<RawSuggestion> {
    const loaded = await this.load(this.configPath);
    if (!loaded.ok) throw new EssayGraderError('unavailable', loaded.problem);
    const cfg = loaded.config;
    if (input.answerText.length > cfg.maxAnswerChars) throw new EssayGraderError('too_long');

    const cwd = await mkdtemp(join(tmpdir(), 'pq-ai-'));
    try {
      const stdout = await run(cfg.command, [...cfg.args, ...fixedArgs()], buildGradingPrompt(input), cwd, cfg.timeoutSeconds * 1000);
      return parseCliOutput(stdout);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }
}

function run(command: string, args: string[], stdin: string, cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, { cwd, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      reject(new EssayGraderError('process_failed', 'Không chạy được lệnh AI (kiểm tra cấu hình)'));
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
      reject(new EssayGraderError('process_failed', 'Không chạy được lệnh AI (kiểm tra cấu hình)'));
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) return reject(new EssayGraderError('timeout'));
      if (code !== 0) return reject(new EssayGraderError('process_failed'));
      resolve(Buffer.concat(out).toString('utf8'));
    });
    child.stdin.on('error', () => {}); // the CLI may exit before reading everything; 'close' reports it
    child.stdin.end(stdin, 'utf8');
  });
}
