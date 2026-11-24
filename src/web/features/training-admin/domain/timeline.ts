import type { TrainingEventRow } from '../../../../shared/api/index.js';
import { dayKeyOf } from './days.js';

/** The same failing command this many times in a row is flagged (mirrors the server's `STUCK_REPEAT`, PRODUCT.md §7.34). */
export const STUCK_REPEAT = 3;

/** A tool event inside a run of the same failing command. */
export interface StuckRun {
  /** The first line of the run: it carries the chip. */
  start: boolean;
  /** How many times the same command failed in a row. */
  length: number;
  /** The run reaches the member's latest command and the server still flags the member: "có thể đang kẹt". */
  active: boolean;
}

/** A row under a prompt: a tool call, a permission request, a session marker (/clear, /compact, model) or a notice. Only tool rows can carry a stuck run. */
export interface TimelineTool { event: TrainingEventRow; run: StuckRun | null }

export type TimelineItem =
  | { kind: 'day'; key: string; dayKey: string; startedAt: number }
  /** `continuedFrom` is set on the repeat of a session that runs past midnight: the moment its previous turn started, on an earlier day. */
  | { kind: 'session'; key: string; index: number; claudeSessionId: string; startedAt: number; continuedFrom?: number }
  | { kind: 'turn'; key: string; prompt: TrainingEventRow | null; promptNumber: number | null; tools: TimelineTool[] };

/** Marks every run of ≥ STUCK_REPEAT consecutive failures with the same target. Prompts between do not cut a run; a success does. */
function markRuns(events: readonly TrainingEventRow[], memberStuck: boolean): Map<number, StuckRun> {
  const tools = events.filter(e => e.kind === 'tool');
  const marks = new Map<number, StuckRun>();
  let i = 0;
  while (i < tools.length) {
    const first = tools[i]!;
    if (first.ok !== false || first.toolTarget === undefined) { i++; continue; }
    let j = i + 1;
    while (j < tools.length && tools[j]!.ok === false && tools[j]!.toolTarget === first.toolTarget) j++;
    const length = j - i;
    if (length >= STUCK_REPEAT) {
      const active = memberStuck && j === tools.length;
      for (let k = i; k < j; k++) marks.set(tools[k]!.id, { start: k === i, length, active });
    }
    i = j;
  }
  return marks;
}

/**
 * Groups a member's events (oldest first) into turns: a prompt and the commands that followed it. A new Claude Code session
 * (`claudeSessionId` changes) starts a new turn and, when the member has more than one, a divider. Commands that arrive before
 * any prompt form a turn without one.
 */
export function buildTimeline(events: readonly TrainingEventRow[], opts: { memberStuck: boolean }): TimelineItem[] {
  const marks = markRuns(events, opts.memberStuck);
  const sessions = [...new Set(events.map(e => e.claudeSessionId))];
  const dividers = sessions.length > 1;
  const items: TimelineItem[] = [];
  let currentSession: string | null = null;
  let turn: Extract<TimelineItem, { kind: 'turn' }> | null = null;
  let pendingDivider: Extract<TimelineItem, { kind: 'session' }> | null = null;
  let lastDay: string | null = null;
  let lastTurnAt: number | null = null; // when the previous turn of the current session started
  let promptNumber = 0;
  // A turn belongs to the day of its first event (its prompt), however late its commands run. The day strip goes before the
  // turn and before the session divider that opens it.
  const open = (e: TrainingEventRow, prompt: TrainingEventRow | null, number: number | null) => {
    const dayKey = dayKeyOf(e.receivedAt);
    const newDay = dayKey !== lastDay;
    if (newDay) { lastDay = dayKey; items.push({ kind: 'day', key: `d${dayKey}`, dayKey, startedAt: e.receivedAt }); }
    if (pendingDivider) { items.push(pendingDivider); pendingDivider = null; }
    // A session that runs past midnight is announced again at the top of the next day; its number stays the one of the whole training.
    else if (newDay && dividers && lastTurnAt !== null && currentSession !== null) {
      items.push({ kind: 'session', key: `s${e.id}c`, index: sessions.indexOf(currentSession) + 1, claudeSessionId: currentSession, startedAt: e.receivedAt, continuedFrom: lastTurnAt });
    }
    lastTurnAt = e.receivedAt;
    turn = { kind: 'turn', key: `t${e.id}`, prompt, promptNumber: number, tools: [] };
    items.push(turn);
  };
  for (const e of events) {
    if (e.claudeSessionId !== currentSession) {
      currentSession = e.claudeSessionId;
      turn = null;
      lastTurnAt = null;
      if (dividers) pendingDivider = { kind: 'session', key: `s${e.id}`, index: sessions.indexOf(currentSession) + 1, claudeSessionId: currentSession, startedAt: e.receivedAt };
    }
    if (e.kind === 'prompt') {
      promptNumber++;
      open(e, e, promptNumber);
    } else {
      if (!turn) open(e, null, null);
      turn!.tools.push({ event: e, run: marks.get(e.id) ?? null });
    }
  }
  return items;
}

/** The commands and permission requests that have an output or a change to open, in timeline order: what J / K step through. */
export const openableEvents = (events: readonly TrainingEventRow[]): TrainingEventRow[] =>
  events.filter(e => (e.kind === 'tool' || e.kind === 'permission') && (e.hasOutput || e.hasChange));

/** The next (`1`) or previous (`-1`) command with something to open, relative to `currentId`; null at either end. */
export function stepEvent(events: readonly TrainingEventRow[], currentId: number, step: 1 | -1): TrainingEventRow | null {
  const openable = openableEvents(events);
  const at = openable.findIndex(e => e.id === currentId);
  if (at < 0) return null;
  return openable[at + step] ?? null;
}

/** The key of the turn an event sits in (null if it is not in any). */
export function turnKeyOf(events: readonly TrainingEventRow[], eventId: number): string | null {
  const hit = buildTimeline(events, { memberStuck: false }).find(i => i.kind === 'turn' && (i.prompt?.id === eventId || i.tools.some(t => t.event.id === eventId)));
  return hit?.key ?? null;
}
