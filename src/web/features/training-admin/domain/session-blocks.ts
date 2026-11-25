import type { TrainingEventRow } from '../../../../shared/api/index.js';
import type { Turn } from './timeline.js';

/**
 * One Claude Code session's part of one day (PRODUCT.md §7.38b): the turns it ran that day, oldest first. A member may keep
 * several sessions open at once; each gets its own block in each day it has a prompt.
 */
export interface SessionBlock {
  /** Stable across reloads: the day and the session number. */
  key: string;
  /** The session's number over the whole training (order of its first event). */
  index: number;
  claudeSessionId: string;
  /** The first and last event of the turns in this block (a turn that crosses midnight keeps its late events here). */
  firstAt: number;
  lastAt: number;
  /** Set when the session also ran on an earlier day: a moment of that day ("tiếp từ dd/mm"). */
  continuedFrom?: number;
  /** Set when the session also runs on a later day: a moment of that day ("tiếp sang dd/mm"). */
  continuesTo?: number;
  /**
   * How the session ended, from its last `/clear` or exit event over the **whole** training, not only this day: a session that
   * runs past midnight may end on a later day. `continuesTo` tells the earlier day's block apart from "chưa kết thúc".
   */
  endedBy: 'clear' | 'exit' | null;
  /** Numbers of the other sessions whose blocks of the same day overlap this block's hours. */
  overlapsWith: number[];
  prompts: number;
  commands: number;
  failed: number;
  turns: Turn[];
}

export const blockKeyOf = (dayKey: string, sessionIndex: number): string => `b${dayKey}-s${sessionIndex}`;

const eventsOfTurn = (t: Turn): TrainingEventRow[] => (t.prompt ? [t.prompt, ...t.tools.map(x => x.event)] : t.tools.map(x => x.event));

/** How each session ended: the last `/clear` or exit event of the session over all the turns given (the one with the biggest id). */
export function endedByOf(allTurns: readonly Turn[]): Map<string, 'clear' | 'exit'> {
  const last = new Map<string, { id: number; by: 'clear' | 'exit' }>();
  for (const t of allTurns) {
    for (const { event: e } of t.tools) {
      if (e.kind !== 'session' || (e.subtype !== 'clear' && e.subtype !== 'exit')) continue;
      const prev = last.get(e.claudeSessionId);
      if (!prev || e.id > prev.id) last.set(e.claudeSessionId, { id: e.id, by: e.subtype });
    }
  }
  return new Map([...last].map(([sid, v]) => [sid, v.by]));
}

/**
 * The session blocks of each day, from the turns of each day (oldest day first, each day's turns in the order they opened).
 * Blocks of a day are ordered by `firstAt`, oldest first. Returns one list per day, in the same order as `days`.
 */
export function buildSessionBlocks(days: readonly { dayKey: string; startedAt: number; turns: readonly Turn[] }[]): SessionBlock[][] {
  const ended = endedByOf(days.flatMap(d => d.turns));
  const lastOfSession = new Map<number, { block: SessionBlock; dayStartedAt: number }>();
  return days.map(day => {
    const bySession = new Map<string, Turn[]>();
    for (const t of day.turns) {
      const list = bySession.get(t.claudeSessionId);
      if (list) list.push(t); else bySession.set(t.claudeSessionId, [t]);
    }
    const blocks: SessionBlock[] = [...bySession.values()].map(turns => {
      const events = turns.flatMap(eventsOfTurn);
      const times = events.map(e => e.receivedAt);
      const tools = events.filter(e => e.kind === 'tool');
      const first = turns[0]!;
      return {
        key: blockKeyOf(day.dayKey, first.sessionIndex), index: first.sessionIndex, claudeSessionId: first.claudeSessionId,
        firstAt: Math.min(...times), lastAt: Math.max(...times), endedBy: ended.get(first.claudeSessionId) ?? null, overlapsWith: [],
        prompts: turns.filter(t => t.prompt).length, commands: tools.length, failed: tools.filter(e => e.ok === false).length, turns,
      };
    }).sort((a, b) => a.firstAt - b.firstAt || a.index - b.index);
    for (const b of blocks) {
      b.overlapsWith = blocks.filter(o => o !== b && o.firstAt <= b.lastAt && b.firstAt <= o.lastAt).map(o => o.index).sort((x, y) => x - y);
      const prev = lastOfSession.get(b.index);
      if (prev) { b.continuedFrom = prev.dayStartedAt; prev.block.continuesTo = day.startedAt; }
      lastOfSession.set(b.index, { block: b, dayStartedAt: day.startedAt });
    }
    return blocks;
  });
}

/** What the header of a block shows at its right end. */
export type BlockEnd = 'clear' | 'exit' | 'open' | 'next';
export const blockEnd = (b: Pick<SessionBlock, 'endedBy' | 'continuesTo'>): BlockEnd => (b.continuesTo !== undefined ? 'next' : b.endedBy ?? 'open');
