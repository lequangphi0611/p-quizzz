import type { ExampleSample, RawExampleDraft } from '../../domain/training/example-draft.js';

export type { ExampleSample, RawExampleDraft };

/** What the AI sees for one prompt (PRODUCT.md §7.40e). Never a name, an email, an id or a time. */
export interface ExampleDraftInput {
  /** The prompt to draft an example for, secrets and home folders masked. */
  prompt: string;
  /** Up to two prompts of the same Claude Code session just before it, oldest first, masked. */
  earlierPrompts: string[];
  /** What Claude Code ran after the prompt, one command per line (`✓|✗ <tool> <target>`), no output. */
  turnActivity: string;
  /** Examples the mentor already finished in this training. */
  samples: ExampleSample[];
}

export type ExampleDrafterFailure = 'unavailable' | 'timeout' | 'too_long' | 'bad_output' | 'process_failed';

const MESSAGES: Record<ExampleDrafterFailure, string> = {
  unavailable: 'AI chưa được bật',
  timeout: 'Quá thời gian',
  too_long: 'Prompt quá dài để AI đọc',
  bad_output: 'AI trả kết quả không hợp lệ',
  process_failed: 'Mất kết nối tới AI',
};

/** A failed run. `message` is short Vietnamese for the mentor and never contains the configuration. */
export class ExampleDrafterError extends Error {
  constructor(
    readonly reason: ExampleDrafterFailure,
    message = MESSAGES[reason],
  ) {
    super(message);
    this.name = 'ExampleDrafterError';
  }
}

/** Drafts the label, topic, comment and better prompt of one teaching example with an AI (docs/architecture.md §11.12). The domain checks the result. */
export interface TeachingExampleDrafter {
  /** Whether the mentor has set the AI command up. Cheap. */
  available(): Promise<boolean>;
  /** How many drafts may run at once (the mentor's setting; 1 when there is none). */
  concurrency(): Promise<number>;
  draft(input: ExampleDraftInput): Promise<RawExampleDraft>;
}

/** Runs queued drafts in the background (keyed by event id). */
export interface ExampleDraftQueue {
  enqueue(eventIds: number[]): void;
}
