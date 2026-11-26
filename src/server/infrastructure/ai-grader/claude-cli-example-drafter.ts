import { z } from 'zod';
import { ExampleDrafterError, type ExampleDraftInput, type TeachingExampleDrafter } from '../../application/ports/teaching-example-drafter.js';
import type { RawExampleDraft } from '../../domain/training/example-draft.js';
import { CliRunFailure, runClaudeCli } from './claude-cli-runner.js';
import { buildExampleDraftPrompt, EXAMPLE_DRAFT_SCHEMA, EXAMPLE_DRAFT_SYSTEM_PROMPT } from './example-draft-prompts.js';
import { loadGraderConfig, type ConfigResult } from './grader-config.js';

// Drafts a teaching example with the Claude CLI on the mentor's machine (docs/architecture.md §11.12): same configuration file and
// same safe way of running as the essay grader (`claude-cli-runner.ts`).

const Draft = z.object({
  label: z.string(),
  topic: z.string(),
  comment: z.string(),
  betterPrompt: z.string().nullish(),
  suspicious: z.boolean(),
  suspiciousReason: z.string().nullish(),
  suspiciousQuote: z.string().nullish(),
});

export class ClaudeCliExampleDrafter implements TeachingExampleDrafter {
  constructor(private readonly configPath: string, private readonly load: (path: string) => Promise<ConfigResult> = loadGraderConfig) {}

  async available(): Promise<boolean> {
    return (await this.load(this.configPath)).ok;
  }

  /** Background concurrency from the mentor's config (1 when it is missing). */
  async concurrency(): Promise<number> {
    const c = await this.load(this.configPath);
    return c.ok ? c.config.concurrency : 1;
  }

  async draft(input: ExampleDraftInput): Promise<RawExampleDraft> {
    const loaded = await this.load(this.configPath);
    if (!loaded.ok) throw new ExampleDrafterError('unavailable', loaded.problem);
    const cfg = loaded.config;
    // The limit is for the prompt itself: the examples around it have their own budget (`pickSamples`).
    if (input.prompt.length > cfg.maxAnswerChars) throw new ExampleDrafterError('too_long');

    let result;
    try {
      result = await runClaudeCli({ config: cfg, schema: EXAMPLE_DRAFT_SCHEMA, systemPrompt: EXAMPLE_DRAFT_SYSTEM_PROMPT, stdin: buildExampleDraftPrompt(input) });
    } catch (err) {
      if (err instanceof CliRunFailure) throw new ExampleDrafterError(err.reason, err.hasCustomMessage ? err.message : undefined);
      throw err;
    }
    const parsed = Draft.safeParse(result.body);
    if (!parsed.success) throw new ExampleDrafterError('bad_output');
    const d = parsed.data;
    return {
      label: d.label,
      topic: d.topic,
      comment: d.comment,
      betterPrompt: d.betterPrompt ?? '',
      suspicious: d.suspicious,
      suspiciousReason: d.suspiciousReason ?? '',
      suspiciousQuote: d.suspiciousQuote ?? '',
      model: result.model,
    };
  }
}
