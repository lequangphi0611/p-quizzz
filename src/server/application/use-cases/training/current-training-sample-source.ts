import type { ExampleSample } from '../../../domain/training/example-draft.js';
import { pickSamples, type SampleCandidate } from '../../../domain/training/example-draft.js';
import type { ExampleSampleSource } from '../../ports/example-sample-source.js';
import type { TrainingEventReader } from '../../ports/training-event-repository.js';
import { TimelineCache } from './teaching-examples.js';

/** Option A of S45: the examples the mentor has finished in this very training. */
export class CurrentTrainingSampleSource implements ExampleSampleSource {
  constructor(private readonly deps: { events: TrainingEventReader }) {}

  async samplesFor(input: { trainingId: number; excludeEventId: number; maxChars: number }): Promise<ExampleSample[]> {
    const records = await this.deps.events.listTeachingExamples(input.trainingId);
    const cache = new TimelineCache(this.deps.events);
    const candidates: SampleCandidate[] = await Promise.all(
      records.map(async r => {
        const d = await cache.defaults(r.memberId, r.eventId);
        return {
          eventId: r.eventId, origin: r.origin, updatedAt: r.updatedAt,
          label: r.label, topic: r.topic, comment: r.comment, betterPrompt: r.betterPrompt,
          editedPrompt: r.editedPrompt, editedContext: r.editedContext, defaultPrompt: d.prompt, defaultContext: d.context,
        };
      }),
    );
    return pickSamples(candidates, input.excludeEventId, input.maxChars);
  }
}
