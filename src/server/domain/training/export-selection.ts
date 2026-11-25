/** What the export needs to know of an event to decide whose turn it is in: no text, so a whole timeline is cheap to read. */
export interface EventSkeleton {
  id: number;
  kind: 'prompt' | 'tool' | 'permission' | 'session' | 'notice';
  claudeSessionId: string;
  receivedAt: Date;
}

/**
 * Which events an export of `[from, to)` holds (PRODUCT.md §7.37a, §7.38e). A turn is a prompt and the events of the same Claude
 * Code session that follow it up to that session's next prompt; it belongs to the day of its prompt, however late its commands
 * run. So a command at 00:05 under a prompt of 23:40 goes in the file of the earlier day, and the events of a session whose
 * prompt is before the range are left out of the later one. Events before a session's first prompt form a turn that belongs
 * to the time of its first event. `skeleton` is every event of the member, oldest first.
 */
export function selectExportEventIds(skeleton: readonly EventSkeleton[], range: { from: Date; to: Date }): number[] {
  const inRange = (d: Date) => d >= range.from && d < range.to;
  const turnOwned = new Map<string, boolean>(); // per session: is its current turn in the range
  const ids: number[] = [];
  for (const e of skeleton) {
    if (e.kind === 'prompt' || !turnOwned.has(e.claudeSessionId)) turnOwned.set(e.claudeSessionId, inRange(e.receivedAt));
    if (turnOwned.get(e.claudeSessionId)) ids.push(e.id);
  }
  return ids;
}

/** The number of each Claude Code session over the whole training, 1-based, by the order of its first event (the same numbers the mentor's screen shows). */
export function sessionNumbers(skeleton: readonly Pick<EventSkeleton, 'claudeSessionId'>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of skeleton) if (!out.has(e.claudeSessionId)) out.set(e.claudeSessionId, out.size + 1);
  return out;
}
