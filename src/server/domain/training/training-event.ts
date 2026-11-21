import type { Clip } from './clip.js';

/** What one hook call becomes once filtered: only fields the mentor reviews (PRODUCT.md §7.34c). */
export type TrainingEventDraft = PromptDraft | ToolDraft;

interface DraftBase {
  /** Claude Code's own session id: lets the mentor tell two conversations of one member apart. */
  claudeSessionId: string;
}

export interface PromptDraft extends DraftBase {
  kind: 'prompt';
  prompt: string;
}

export interface ToolDraft extends DraftBase {
  kind: 'tool';
  toolName: string;
  ok: boolean;
  durationMs: number | null;
  /** `Bash` / `PowerShell` (any tool that runs a command): the command line. Files: a path relative to the exercise folder (`Read` adds ` · N dòng`). Else null. */
  toolTarget: string | null;
  /** First lines of the tool's error (failed calls only). */
  errorExcerpt: string | null;
  /** Never set for `Read` (the output is the file itself). */
  output: Clip | null;
  change: Clip | null;
}
