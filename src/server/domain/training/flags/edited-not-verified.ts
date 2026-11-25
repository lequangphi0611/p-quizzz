import { isVerifyCommand } from './is-verify-command.js';
import { cap, isEdit, isShell, type FlagEvent, type FlagRule } from './flag-event.js';

/** Turns that changed files and ended with no check before the next prompt, before the (soft) flag goes up. */
export const EDITED_NOT_VERIFIED_TURNS = 2;

const isCheck = (e: FlagEvent) => isShell(e) && e.toolTarget !== null && isVerifyCommand(e.toolTarget);

/**
 * "Sửa xong chưa chạy kiểm tra": a hint only, because the member may have run the checks in another window, which the app never sees.
 * A turn is what one Claude Code session does between two of its own prompts; it counts when it edited a file, no check ran at
 * all (passed or failed) and its session got another prompt after it.
 *
 * The check is NOT per session (PRODUCT.md §7.38c): a member's sessions share one folder, so a check run in session B while
 * session A was in its turn also covers A's edits. Only the turns are cut per session, so another session's prompt never ends
 * a turn early.
 */
export const editedNotVerified: FlagRule = events => {
  const evidence: number[] = [];
  const firstIndex = new Map<string, number>();
  const promptIndexes = new Map<string, number[]>();
  events.forEach((e, i) => {
    if (!firstIndex.has(e.claudeSessionId)) firstIndex.set(e.claudeSessionId, i);
    if (e.kind === 'prompt') promptIndexes.set(e.claudeSessionId, [...(promptIndexes.get(e.claudeSessionId) ?? []), i]);
  });
  let turns = 0;
  for (const [session, start] of firstIndex) {
    const bounds = [start, ...(promptIndexes.get(session) ?? [])];
    for (let k = 0; k + 1 < bounds.length; k++) {
      const [from, to] = [bounds[k]!, bounds[k + 1]!];
      let lastEdit: FlagEvent | null = null;
      let checked = false;
      for (let i = from; i < to; i++) {
        const e = events[i]!;
        if (isCheck(e)) checked = true;
        else if (e.claudeSessionId === session && isEdit(e)) lastEdit = e;
      }
      if (lastEdit && !checked) {
        turns++;
        evidence.push(lastEdit.id);
      }
    }
  }
  return turns >= EDITED_NOT_VERIFIED_TURNS ? { code: 'edited_not_verified', eventIds: cap(evidence.sort((a, b) => a - b)) } : null;
};
