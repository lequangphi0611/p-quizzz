import { z } from 'zod';
import { EssayGraderError, type EssayGrader, type EssayGradingInput } from '../../application/ports/essay-grader.js';
import type { RawSuggestion } from '../../domain/grading/ai-suggestion.js';
import { CliRunFailure, fixedArgs as cliFixedArgs, readCliResult, runClaudeCli } from './claude-cli-runner.js';
import { loadGraderConfig, type ConfigResult } from './grader-config.js';
import { buildGradingPrompt, OUTPUT_SCHEMA, SYSTEM_PROMPT } from './prompts.js';

// Grades with the Claude CLI installed on the mentor's machine (docs/architecture.md §11.6). The run itself (no shell, stdin, empty
// temp dir, no tools) is `claude-cli-runner.ts`, shared with the example drafter.

/** Appended after the mentor's own args, always. */
export function fixedArgs(): string[] {
  return cliFixedArgs(OUTPUT_SCHEMA, SYSTEM_PROMPT);
}

const Suggestion = z.object({
  score: z.number(),
  feedback: z.string(),
  criteria: z.array(z.object({ label: z.string(), score: z.number(), max: z.number(), note: z.string() })),
  suspicious: z.boolean(),
  suspiciousReason: z.string().nullable().optional(),
  suspiciousLines: z.array(z.number()).default([]),
});

/** The CLI's `--output-format json` result: the structured output, or JSON inside the text result. */
export function parseCliOutput(stdout: string): RawSuggestion {
  let result;
  try {
    result = readCliResult(stdout);
  } catch (err) {
    throw asGraderError(err);
  }
  return toSuggestion(result);
}

function toSuggestion(result: { body: unknown; model: string | null }): RawSuggestion {
  const parsed = Suggestion.safeParse(result.body);
  if (!parsed.success) throw new EssayGraderError('bad_output');
  return { ...parsed.data, suspiciousReason: parsed.data.suspiciousReason || null, model: result.model };
}

function asGraderError(err: unknown): unknown {
  return err instanceof CliRunFailure ? new EssayGraderError(err.reason, err.hasCustomMessage ? err.message : undefined) : err;
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

    let result;
    try {
      result = await runClaudeCli({ config: cfg, schema: OUTPUT_SCHEMA, systemPrompt: SYSTEM_PROMPT, stdin: buildGradingPrompt(input) });
    } catch (err) {
      throw asGraderError(err);
    }
    return toSuggestion(result);
  }
}
