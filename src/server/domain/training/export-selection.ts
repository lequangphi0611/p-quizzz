/** What the export needs to know of an event to decide whose turn it is in: no text, so a whole timeline is cheap to read. */
export interface EventSkeleton {
  id: number;
  kind: 'prompt' | 'tool' | 'permission' | 'session' | 'notice';
  claudeSessionId: string;
  /** `session` events (`clear`, `exit`, ...): how a Claude Code session ended. */
  subtype: string | null;
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

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** What the labels of a session's blocks need from the **whole** training, so a partial export says the same as the mentor's screen (S43). */
export interface SessionContext {
  /** The last `/clear` or exit of each session, over the whole training. */
  endedBy: ReadonlyMap<string, 'clear' | 'exit'>;
  /** The days each session has a turn (the day of the turn's prompt), oldest first: a moment of each day, keyed by `yyyy-mm-dd`. */
  days: ReadonlyMap<string, readonly { key: string; at: Date }[]>;
}

export function sessionContext(skeleton: readonly EventSkeleton[]): SessionContext {
  const endedBy = new Map<string, 'clear' | 'exit'>();
  const days = new Map<string, { key: string; at: Date }[]>();
  const seen = new Set<string>();
  for (const e of skeleton) {
    if (e.kind === 'session' && (e.subtype === 'clear' || e.subtype === 'exit')) endedBy.set(e.claudeSessionId, e.subtype);
    if (e.kind === 'prompt' || !seen.has(e.claudeSessionId)) {
      seen.add(e.claudeSessionId);
      const list = days.get(e.claudeSessionId) ?? [];
      const key = dayKey(e.receivedAt);
      if (!list.some(d => d.key === key)) list.push({ key, at: e.receivedAt });
      days.set(e.claudeSessionId, list);
    }
  }
  for (const list of days.values()) list.sort((a, b) => (a.key < b.key ? -1 : 1));
  return { endedBy, days };
}
