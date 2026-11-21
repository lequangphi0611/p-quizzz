import { isVerifyCommand } from './is-verify-command.js';
import { cap, isEdit, isShell, type FlagEvent, type FlagRule } from './flag-event.js';

/** Turns that changed files and ended with no check before the next prompt, before the (soft) flag goes up. */
export const EDITED_NOT_VERIFIED_TURNS = 2;

/**
 * "Sửa xong chưa chạy kiểm tra": a hint only, because the member may have run the checks in another window, which the app never sees.
 * A turn is what happens between two prompts; it counts when it edited a file, ran no check at all (passed or failed) and was
 * followed by another prompt.
 */
export const editedNotVerified: FlagRule = events => {
  const evidence: number[] = [];
  let turns = 0;
  let edits: FlagEvent[] = [];
  let checked = false;
  for (const e of events) {
    if (e.kind === 'prompt') {
      if (edits.length > 0 && !checked) {
        turns++;
        evidence.push(edits[edits.length - 1]!.id);
      }
      edits = [];
      checked = false;
    } else if (isEdit(e)) edits.push(e);
    else if (isShell(e) && e.toolTarget !== null && isVerifyCommand(e.toolTarget)) checked = true;
  }
  return turns >= EDITED_NOT_VERIFIED_TURNS ? { code: 'edited_not_verified', eventIds: cap(evidence) } : null;
};
