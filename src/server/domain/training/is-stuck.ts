/** How many failures in a row, on the same target, make the flag go up. */
export const STUCK_REPEAT = 3;

/** What `isStuck` needs of a tool call. */
export interface ToolOutcome {
  ok: boolean;
  toolTarget: string | null;
}

/**
 * "Possibly stuck": the member's latest tool calls (oldest first; prompts are not in this list, so a prompt in between
 * never breaks the run) end with at least `STUCK_REPEAT` failures in a row on the same target. One success breaks the run.
 * A call with no target (null) is never "the same" as another: we cannot tell. A hint for the mentor, not a score.
 */
export function isStuck(recentTools: ToolOutcome[]): boolean {
  const last = recentTools[recentTools.length - 1];
  if (!last || last.ok || last.toolTarget === null) return false;
  let run = 0;
  for (let i = recentTools.length - 1; i >= 0; i--) {
    const call = recentTools[i]!;
    if (call.ok || call.toolTarget !== last.toolTarget) break;
    run++;
  }
  return run >= STUCK_REPEAT;
}
