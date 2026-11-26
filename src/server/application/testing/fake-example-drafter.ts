import type { ExampleDraftInput, TeachingExampleDrafter } from '../ports/teaching-example-drafter.js';
import type { RawExampleDraft } from '../../domain/training/example-draft.js';

/** Test double for the AI: never reaches a real one. Remembers what it was asked, and answers (or fails) as the test says. */
export class FakeExampleDrafter implements TeachingExampleDrafter {
  readonly inputs: ExampleDraftInput[] = [];
  isAvailable = true;
  /** What `draft` returns, or throws when it is an error. A function lets a test hold the run until it wants it to end. */
  answer: RawExampleDraft | Error | (() => Promise<RawExampleDraft>) = {
    label: 'needs_work', topic: 'verify', comment: 'Chưa nói cách kiểm tra', betterPrompt: 'Prompt tốt hơn', suspicious: false, suspiciousReason: '', suspiciousQuote: '', model: 'fake',
  };

  async available() {
    return this.isAvailable;
  }

  async concurrency() {
    return 1;
  }

  async draft(input: ExampleDraftInput): Promise<RawExampleDraft> {
    this.inputs.push(input);
    const a = this.answer;
    if (a instanceof Error) throw a;
    return typeof a === 'function' ? a() : a;
  }
}
