import { cap, type FlagRule } from './flag-event.js';

/** Claude Code modes where it stops asking before editing or running things. */
export const AUTO_MODES = new Set(['acceptEdits', 'bypassPermissions', 'dontAsk', 'auto']);

/** "Chế độ tự chấp nhận": the first event of each stretch in such a mode. Down when the mentor allowed it for this training. */
export const autoAccept: FlagRule = (events, ctx) => {
  if (ctx.allowAutoAccept) return null;
  const ids: number[] = [];
  let inAuto = false;
  for (const e of events) {
    if (e.permissionMode === null) continue;
    const auto = AUTO_MODES.has(e.permissionMode);
    if (auto && !inAuto) ids.push(e.id);
    inAuto = auto;
  }
  return ids.length > 0 ? { code: 'auto_accept', eventIds: cap(ids) } : null;
};
