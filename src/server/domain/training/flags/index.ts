import { autoAccept } from './auto-accept.js';
import { autoCompactRepeated } from './auto-compact-repeated.js';
import { dangerousCommand } from './dangerous-command.js';
import { editedNotVerified } from './edited-not-verified.js';
import { fastApprovals } from './fast-approvals.js';
import type { FlagEvent, FlagHit, FlagRule } from './flag-event.js';
import { inferPermissionDecision } from './infer-permission-decision.js';
import { longWithoutVerify } from './long-without-verify.js';
import { possibleSecret } from './possible-secret.js';
import { repeatedFailure } from './repeated-failure.js';
import { repeatedRequest } from './repeated-request.js';
import { touchesTests } from './touches-tests.js';

import type { PermissionDecisionInfo } from './flag-event.js';

export type { FlagCode, FlagContext, FlagEvent, FlagHit, PermissionDecisionInfo } from './flag-event.js';
export { inferPermissionDecision } from './infer-permission-decision.js';
export { isVerifyCommand } from './is-verify-command.js';

/** In the order the mentor sees the chips. */
const RULES: readonly FlagRule[] = [
  repeatedFailure, longWithoutVerify, editedNotVerified, autoAccept, fastApprovals,
  repeatedRequest, autoCompactRepeated, dangerousCommand, touchesTests, possibleSecret,
];

/** What a member's whole timeline (oldest event first) says: the flags that are up, each with the events behind it, and the inferred answer to each permission request. */
export function analyzeEvents(events: readonly FlagEvent[], options: { allowAutoAccept: boolean }): { flags: FlagHit[]; decisions: Map<number, PermissionDecisionInfo> } {
  const decisions = inferPermissionDecision(events);
  const ctx = { allowAutoAccept: options.allowAutoAccept, decisions };
  return { flags: RULES.map(rule => rule(events, ctx)).filter((h): h is FlagHit => h !== null), decisions };
}

export const computeFlags = (events: readonly FlagEvent[], options: { allowAutoAccept: boolean }): FlagHit[] => analyzeEvents(events, options).flags;
