import type { FlagCode } from '../../../../shared/api/training.js';

export type { FlagCode };

/** One stored event as the flag rules read it. Text fields are bounded by the repository: flags never need a whole output. */
export interface FlagEvent {
  id: number;
  kind: 'prompt' | 'tool' | 'permission' | 'session' | 'notice';
  /** Epoch milliseconds. */
  at: number;
  claudeSessionId: string;
  permissionMode: string | null;
  prompt: string | null;
  toolName: string | null;
  toolTarget: string | null;
  ok: boolean | null;
  durationMs: number | null;
  subtype: string | null;
  /** The first characters of what the call would change (edits are stored as `- old` / `+ new` lines). */
  changeText: string | null;
  /** The first characters of the tool's output. Never set for `Read`. */
  outputText: string | null;
}

/** A flag that went up, with the events that justify it, so the mentor can jump to them. */
export interface FlagHit {
  code: FlagCode;
  eventIds: number[];
}

export interface FlagContext {
  /** The mentor allowed auto-accept / bypass for this training: the mode flag stays down. */
  allowAutoAccept: boolean;
  /** `inferPermissionDecision` over the same events. */
  decisions: ReadonlyMap<number, PermissionDecisionInfo>;
}

export type PermissionDecision = 'allowed' | 'denied' | 'pending';

export interface PermissionDecisionInfo {
  decision: PermissionDecision;
  /** Estimated time from the request to the member's answer (only when `allowed`); network jitter makes it approximate. */
  decisionMs: number | null;
}

export type FlagRule = (events: readonly FlagEvent[], ctx: FlagContext) => FlagHit | null;

/** How much of a change / output the flag rules may read. */
export const FLAG_TEXT_CHARS = 4000;

/** Most events listed as evidence for one flag. */
export const MAX_EVIDENCE = 20;
export const cap = (ids: number[]): number[] => ids.slice(0, MAX_EVIDENCE);

export const SHELL_TOOLS = new Set(['bash', 'powershell']);
export const EDIT_TOOLS = new Set(['edit', 'write', 'multiedit', 'notebookedit']);
export const isShell = (e: FlagEvent) => e.kind === 'tool' && e.toolName !== null && SHELL_TOOLS.has(e.toolName.toLowerCase());
export const isEdit = (e: FlagEvent) => e.kind === 'tool' && e.ok === true && e.toolName !== null && EDIT_TOOLS.has(e.toolName.toLowerCase());

/** Events of each Claude Code session, each group oldest first (the order of `events` is kept). */
export function bySession(events: readonly FlagEvent[]): FlagEvent[][] {
  const groups = new Map<string, FlagEvent[]>();
  for (const e of events) {
    const g = groups.get(e.claudeSessionId);
    if (g) g.push(e);
    else groups.set(e.claudeSessionId, [e]);
  }
  return [...groups.values()];
}

/**
 * Run a rule that reads a sequence ("in a row", "since the last ...") on each Claude Code session separately (PRODUCT.md §7.38c):
 * a member may keep several sessions open, and one session's events must not break or extend another's run. The flag is up when
 * it is up in at least one session; the evidence is merged, oldest first.
 */
export const perSession = (rule: FlagRule): FlagRule => (events, ctx) => {
  let code: FlagHit['code'] | null = null;
  const ids: number[] = [];
  for (const group of bySession(events)) {
    const hit = rule(group, ctx);
    if (hit) {
      code = hit.code;
      ids.push(...hit.eventIds);
    }
  }
  return code ? { code, eventIds: cap([...ids].sort((a, b) => a - b)) } : null;
};
