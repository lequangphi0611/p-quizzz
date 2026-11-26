import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The AI command of the e2e server (never a real AI: the fake CLI). The server reads this file on every use, so a spec can switch the AI on and
// off or change how slow it is without restarting the server. The path depends on the port only, so the config and the specs agree on it.

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const AI_CONFIG_DIR = join(tmpdir(), `pq-e2e-ai-${PORT}`);
export const AI_CONFIG_PATH = join(AI_CONFIG_DIR, 'ai-grader.json');

export interface FakeAi {
  /** `ok` | `slow` (sleeps `delay` ms) | `fail` | `hang` ... see fake-claude-cli.mjs. */
  mode?: string;
  delay?: number;
}

/** Writes the config of the fake CLI; `null` removes the file (the AI is "not set up"). */
export function writeAiConfig(ai: FakeAi | null = { mode: 'slow', delay: 700 }): void {
  if (ai === null) { rmSync(AI_CONFIG_PATH, { force: true }); return; }
  mkdirSync(AI_CONFIG_DIR, { recursive: true });
  writeFileSync(AI_CONFIG_PATH, JSON.stringify({
    command: process.execPath,
    args: [resolve('src/server/infrastructure/ai-grader/testing/fake-claude-cli.mjs'), '--fake-mode', ai.mode ?? 'slow', '--fake-delay', String(ai.delay ?? 700)],
    maxAnswerChars: 1000,
  }));
}
