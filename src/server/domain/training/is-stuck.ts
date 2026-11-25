/** How many failures in a row, on the same target, make the flag go up. */
export const STUCK_REPEAT = 3;

/** What `isStuck` needs of a tool call. */
export interface ToolOutcome {
  ok: boolean;
  toolTarget: string | null;
}

/** A tool call with the Claude Code session it ran in. */
export interface SessionToolOutcome extends ToolOutcome {
  claudeSessionId: string;
}

/**
 * One session's latest tool calls (oldest first; prompts are not in this list, so a prompt in between
 * never breaks the run) end with at least `STUCK_REPEAT` failures in a row on the same target. One success breaks the run.
 * A call with no target (null) is never "the same" as another: we cannot tell. A hint for the mentor, not a score.
 */
export function isStuckInSession(recentTools: ToolOutcome[]): boolean {
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

/**
 * "Possibly stuck" for a member (PRODUCT.md §7.38c): at least one Claude Code session is stuck on its own latest tool calls.
 * `tools` are the member's tool calls, oldest first, from every session; a success or another target in session B never
 * breaks a run in session A.
 */
export function isStuck(tools: readonly SessionToolOutcome[]): boolean {
  const bySession = new Map<string, ToolOutcome[]>();
  for (const t of tools) {
    const list = bySession.get(t.claudeSessionId);
    if (list) list.push(t);
    else bySession.set(t.claudeSessionId, [t]);
  }
  for (const list of bySession.values()) if (isStuckInSession(list.slice(-STUCK_REPEAT))) return true;
  return false;
}
