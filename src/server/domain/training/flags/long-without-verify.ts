import { isVerifyCommand } from './is-verify-command.js';
import { cap, isEdit, isShell, type FlagEvent, type FlagRule } from './flag-event.js';

/** Edits since the last successful check, and how long they have been piling up, before "lâu chưa qua kiểm tra" goes up. */
export const LONG_UNVERIFIED_EDITS = 5;
export const LONG_UNVERIFIED_MS = 10 * 60 * 1000;

export const isSuccessfulCheck = (e: FlagEvent) => isShell(e) && e.ok === true && e.toolTarget !== null && isVerifyCommand(e.toolTarget);

/**
 * "Lâu chưa qua kiểm tra": NOT per session (PRODUCT.md §7.38c). All of a member's Claude Code sessions work in one shared folder,
 * so a check that passes in session B also verifies what session A edited.
 *
 * At least `LONG_UNVERIFIED_EDITS` edits over at least `LONG_UNVERIFIED_MS`, with no successful check in between. */
export const longWithoutVerify: FlagRule = events => {
  let pending: FlagEvent[] = [];
  let hit: number[] | null = null;
  for (const e of events) {
    if (isSuccessfulCheck(e)) pending = [];
    else if (isEdit(e)) {
      pending.push(e);
      if (pending.length >= LONG_UNVERIFIED_EDITS && e.at - pending[0]!.at >= LONG_UNVERIFIED_MS) hit = pending.map(p => p.id);
    }
  }
  return hit ? { code: 'long_without_verify', eventIds: cap(hit) } : null;
};
