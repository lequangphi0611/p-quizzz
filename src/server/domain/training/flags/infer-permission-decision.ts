import { bySession, type FlagEvent, type PermissionDecisionInfo } from './flag-event.js';

/**
 * Claude Code never says whether the member allowed a request (PRODUCT.md §7.35b), so it is inferred, per `permission` event:
 *  - `allowed`: a `tool` event with the same tool and target ran before the member's next prompt (or the next `/clear`, exit);
 *    `decisionMs` ≈ when the tool finished minus its duration minus when the request arrived (never below 0). Each tool event
 *    answers one request, so two identical requests need two runs.
 *  - `pending`: nothing happened since the request: the member may still be deciding.
 *  - `denied`: the turn moved on without it (a prompt, another tool, a new session) and the tool never ran.
 * Each Claude Code session is read on its own (PRODUCT.md §7.38c): a prompt or tool in another session never means "moved on".
 * Events must be oldest first.
 */
export function inferPermissionDecision(events: readonly FlagEvent[]): Map<number, PermissionDecisionInfo> {
  const out = new Map<number, PermissionDecisionInfo>();
  for (const group of bySession(events)) inferInSession(group, out);
  return out;
}

function inferInSession(events: readonly FlagEvent[], out: Map<number, PermissionDecisionInfo>): void {
  const used = new Set<number>();
  events.forEach((p, i) => {
    if (p.kind !== 'permission') return;
    let moved = false;
    let matched: FlagEvent | null = null;
    for (let j = i + 1; j < events.length; j++) {
      const e = events[j]!;
      if (e.kind === 'prompt' || (e.kind === 'session' && (e.subtype === 'clear' || e.subtype === 'exit'))) {
        moved = true;
        break;
      }
      if (e.kind === 'tool') {
        if (!used.has(e.id) && e.toolName === p.toolName && e.toolTarget === p.toolTarget) {
          matched = e;
          break;
        }
        moved = true; // Claude went on with something else, in this turn
      }
    }
    if (matched) {
      used.add(matched.id);
      out.set(p.id, { decision: 'allowed', decisionMs: Math.max(0, matched.at - (matched.durationMs ?? 0) - p.at) });
    } else {
      out.set(p.id, { decision: moved ? 'denied' : 'pending', decisionMs: null });
    }
  });
}
