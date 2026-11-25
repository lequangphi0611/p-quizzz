import { cap, perSession, type FlagRule } from './flag-event.js';

/** Automatic compactions without a `/clear` in between before the flag goes up: the conversation keeps growing on its own. */
export const AUTO_COMPACT_LIMIT = 2;

const autoCompactIn: FlagRule = events => {
  let run: number[] = [];
  let hit: number[] | null = null;
  for (const e of events) {
    if (e.kind !== 'session') continue;
    if (e.subtype === 'clear') run = [];
    else if (e.subtype === 'compact_auto') {
      run.push(e.id);
      if (run.length >= AUTO_COMPACT_LIMIT) hit = [...run];
    }
  }
  return hit ? { code: 'auto_compact_repeated', eventIds: cap(hit) } : null;
};

/** Per Claude Code session (PRODUCT.md §7.38c). */
export const autoCompactRepeated: FlagRule = perSession(autoCompactIn);
