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

/** A prompt and the events of the same Claude Code session that followed it (PRODUCT.md §7.38a). */
export interface Turn {
  kind: 'turn';
  key: string;
  /** Id of the first event (the prompt, or the first command of a turn with no prompt): the turn's identity in the read store. */
  firstId: number;
  prompt: TrainingEventRow | null;
  /** Numbered over the whole training (not per session, not per day). */
  promptNumber: number | null;
  claudeSessionId: string;
  /** The session's number over the whole training (order of its first event). */
  sessionIndex: number;
  tools: TimelineTool[];
}

export type TimelineItem = { kind: 'day'; key: string; dayKey: string; startedAt: number } | Turn;

/** The number of each Claude Code session of the training, 1-based, in the order its first event arrived. */
export function sessionIndexes(events: readonly TrainingEventRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of events) if (!out.has(e.claudeSessionId)) out.set(e.claudeSessionId, out.size + 1);
  return out;
}

/**
 * Marks every run of ≥ STUCK_REPEAT consecutive failures with the same target, session by session (PRODUCT.md §7.38c): a prompt
 * or a command of another Claude Code session never cuts a run. A success in the same session does.
 */
function markRuns(events: readonly TrainingEventRow[], memberStuck: boolean): Map<number, StuckRun> {
  const bySession = new Map<string, TrainingEventRow[]>();
  for (const e of events) {
    if (e.kind !== 'tool') continue;
    const list = bySession.get(e.claudeSessionId);
    if (list) list.push(e); else bySession.set(e.claudeSessionId, [e]);
  }
  const marks = new Map<number, StuckRun>();
  for (const tools of bySession.values()) {
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
  }
  return marks;
}

/**
 * Groups a member's events (oldest first) into turns: a prompt and the commands that followed it **in the same Claude Code
 * session**. The member may keep several sessions open at once, so each session has its own open turn and an event joins its own
 * session's turn, never the turn another session just opened. Commands that arrive before a session's first prompt form a turn
 * without a prompt. Turns come in the order they opened, each after the strip of its day (the day of its first event, however late
 * its commands run).
 */
export function buildTimeline(events: readonly TrainingEventRow[], opts: { memberStuck: boolean }): TimelineItem[] {
  const marks = markRuns(events, opts.memberStuck);
  const sessions = sessionIndexes(events);
  const items: TimelineItem[] = [];
  const open = new Map<string, Turn>();
  let lastDay: string | null = null;
  let promptNumber = 0;
  const openTurn = (e: TrainingEventRow, prompt: TrainingEventRow | null, number: number | null): Turn => {
    const dayKey = dayKeyOf(e.receivedAt);
    if (dayKey !== lastDay) { lastDay = dayKey; items.push({ kind: 'day', key: `d${dayKey}`, dayKey, startedAt: e.receivedAt }); }
    const turn: Turn = { kind: 'turn', key: `t${e.id}`, firstId: e.id, prompt, promptNumber: number, claudeSessionId: e.claudeSessionId, sessionIndex: sessions.get(e.claudeSessionId)!, tools: [] };
    open.set(e.claudeSessionId, turn);
    items.push(turn);
    return turn;
  };
  for (const e of events) {
    if (e.kind === 'prompt') { promptNumber++; openTurn(e, e, promptNumber); continue; }
    const turn = open.get(e.claudeSessionId) ?? openTurn(e, null, null);
    turn.tools.push({ event: e, run: marks.get(e.id) ?? null });
  }
  return items;
}

/** The key of the turn an event sits in (null if it is not in any). */
export function turnKeyOf(events: readonly TrainingEventRow[], eventId: number): string | null {
  const hit = buildTimeline(events, { memberStuck: false }).find(i => i.kind === 'turn' && (i.prompt?.id === eventId || i.tools.some(t => t.event.id === eventId)));
  return hit?.key ?? null;
}
