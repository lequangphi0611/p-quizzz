import type { TrainingEventRow } from '../../../../shared/api/index.js';

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
  | { kind: 'session'; key: string; index: number; claudeSessionId: string; startedAt: number }
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
  let promptNumber = 0;
  for (const e of events) {
    if (e.claudeSessionId !== currentSession) {
      currentSession = e.claudeSessionId;
      turn = null;
      if (dividers) items.push({ kind: 'session', key: `s${e.id}`, index: sessions.indexOf(currentSession) + 1, claudeSessionId: currentSession, startedAt: e.receivedAt });
    }
    if (e.kind === 'prompt') {
      promptNumber++;
      turn = { kind: 'turn', key: `t${e.id}`, prompt: e, promptNumber, tools: [] };
      items.push(turn);
    } else {
      if (!turn) { turn = { kind: 'turn', key: `t${e.id}`, prompt: null, promptNumber: null, tools: [] }; items.push(turn); }
      turn.tools.push({ event: e, run: marks.get(e.id) ?? null });
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
