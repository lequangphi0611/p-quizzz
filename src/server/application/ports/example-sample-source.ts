import type { ExampleSample } from '../../domain/training/example-draft.js';

/**
 * Where the examples a draft learns from come from. Option A reads the finished examples of the current training; option B (a lasting
 * store across trainings) will be another implementation, with no change to the use case, the prompt or the screen.
 */
export interface ExampleSampleSource {
  /** Newest first, at most `maxChars` of text in total, never the example of `excludeEventId`. */
  samplesFor(input: { trainingId: number; excludeEventId: number; maxChars: number }): Promise<ExampleSample[]>;
}
