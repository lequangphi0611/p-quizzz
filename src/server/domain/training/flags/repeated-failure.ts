import { STUCK_REPEAT } from '../is-stuck.js';
import { cap, perSession, type FlagRule } from './flag-event.js';

/** "Lặp lệnh lỗi": the same target failed `STUCK_REPEAT` times or more in a row, anywhere in the timeline (one success breaks the run). */
const repeatedFailureIn: FlagRule = events => {
  let run: number[] = [];
  let target: string | null = null;
  const hits: number[] = [];
  for (const e of events) {
    if (e.kind !== 'tool') continue;
    if (e.ok === false && e.toolTarget !== null && e.toolTarget === target) run.push(e.id);
    else {
      run = e.ok === false && e.toolTarget !== null ? [e.id] : [];
      target = run.length > 0 ? e.toolTarget : null;
    }
    if (run.length === STUCK_REPEAT) hits.push(...run);
    else if (run.length > STUCK_REPEAT) hits.push(e.id);
  }
  return hits.length > 0 ? { code: 'repeated_failure', eventIds: cap(hits) } : null;
};

/** Per Claude Code session (PRODUCT.md §7.38c): a run in one session is not broken by another session's events. */
export const repeatedFailure: FlagRule = perSession(repeatedFailureIn);
