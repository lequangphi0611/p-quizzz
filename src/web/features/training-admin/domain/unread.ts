import type { TrainingEventRow, TrainingMemberRow } from '../../../../shared/api/index.js';
import type { Turn } from './timeline.js';

/**
 * What the mentor has read of one member, kept in this browser only (PRODUCT.md §7.38d). The unit is a turn: a prompt and every
 * event that followed it in its Claude Code session.
 */
export interface MemberRead {
  /** The server time of the member's last event when this browser first saw them: anything received up to then is "already read". */
  baselineAt: number;
  /** The member's `promptCount` at that moment. */
  baselinePromptCount: number;
  /** Prompts received after the baseline whose turn was read (the member list subtracts them). */
  readPromptCount: number;
  /** Per turn (`turnKey` = id of its first event): the biggest event id the mentor has read. */
  turns: Record<string, number>;
}

export interface ReadState { members: Record<string, MemberRead> }

export const emptyReadState = (): ReadState => ({ members: {} });

export const turnReadKey = (t: Pick<Turn, 'firstId'>): string => String(t.firstId);

/** Ensures every member of the list has a record: the first time this browser sees a member, all they have sent so far counts as read. Returns `state` itself when nothing was added. */
export function withBaselines(state: ReadState, members: readonly Pick<TrainingMemberRow, 'id' | 'lastSeenAt' | 'promptCount'>[]): ReadState {
  let next: ReadState | null = null;
  for (const m of members) {
    if (state.members[String(m.id)]) continue;
    next ??= { members: { ...state.members } };
    next.members[String(m.id)] = { baselineAt: m.lastSeenAt ?? 0, baselinePromptCount: m.promptCount, readPromptCount: 0, turns: {} };
  }
  return next ?? state;
}

/** Notices ("Claude đang chờ") are not content: they never make a turn "new". */
const counts = (e: TrainingEventRow) => e.kind !== 'notice';

const eventsOf = (t: Turn): TrainingEventRow[] => (t.prompt ? [t.prompt, ...t.tools.map(x => x.event)] : t.tools.map(x => x.event));

/** The biggest event id of the turn: what reading the turn marks as read. */
export const maxEventId = (t: Turn): number => eventsOf(t).reduce((m, e) => Math.max(m, e.id), 0);

/** What is new in a turn: its prompt (the whole turn is new), or only events that came after the prompt was read. */
export type TurnNewness = { kind: 'none' } | { kind: 'prompt' } | { kind: 'events'; events: TrainingEventRow[] };

const NONE: TurnNewness = { kind: 'none' };

export function turnNewness(turn: Turn, read: MemberRead | undefined): TurnNewness {
  if (!read) return NONE;
  const mark = read.turns[turnReadKey(turn)] ?? 0;
  const unread = (e: TrainingEventRow) => counts(e) && e.id > mark && e.receivedAt > read.baselineAt;
  if (turn.prompt && unread(turn.prompt)) return { kind: 'prompt' };
  const events = turn.tools.map(x => x.event).filter(unread);
  return events.length > 0 ? { kind: 'events', events } : NONE;
}

/** Turns with something unread, in the order given. */
export const unreadTurns = (turns: readonly Turn[], read: MemberRead | undefined): Turn[] => turns.filter(t => turnNewness(t, read).kind !== 'none');

/** The "N mới" of a collapsed day or block, and of the chip: how many turns have something unread. */
export const unreadTurnCount = (turns: readonly Turn[], read: MemberRead | undefined): number => unreadTurns(turns, read).length;

/** The new commands and requests of an old prompt, which is what "· N mới" counts (notices and session rows are not shown as strips). */
export const newCommandsOf = (n: TurnNewness): TrainingEventRow[] => (n.kind === 'events' ? n.events.filter(e => e.kind === 'tool' || e.kind === 'permission') : []);

/** Marks turns read up to the ids given. Never lowers a mark. Returns `state` itself when nothing changes. */
export function markTurnsRead(state: ReadState, memberId: number, marks: readonly { turn: Turn; maxId: number }[]): ReadState {
  const read = state.members[String(memberId)];
  if (!read) return state;
  let turns = read.turns;
  let readPromptCount = read.readPromptCount;
  for (const { turn, maxId } of marks) {
    const key = turnReadKey(turn);
    const had = turns[key];
    if (had !== undefined && had >= maxId) continue;
    if (turns === read.turns) turns = { ...turns };
    turns[key] = maxId;
    // The first time a turn is read counts its prompt, if the prompt came after the baseline.
    if (had === undefined && turn.prompt && turn.prompt.receivedAt > read.baselineAt) readPromptCount++;
  }
  if (turns === read.turns) return state;
  return { members: { ...state.members, [String(memberId)]: { ...read, turns, readPromptCount } } };
}

/**
 * "Đánh dấu đã đọc hết": every loaded turn is read. When the whole timeline is loaded the record is also settled at the number of
 * prompts **in the loaded events** (not at the member's `promptCount`, which is refreshed separately and may be a prompt ahead or
 * behind), so the list shows only the prompts that are not loaded yet, whichever answer arrived first.
 */
export function markAllRead(state: ReadState, member: Pick<TrainingMemberRow, 'id'>, turns: readonly Turn[], complete: boolean): ReadState {
  const next = markTurnsRead(state, member.id, turns.map(turn => ({ turn, maxId: maxEventId(turn) })));
  const read = next.members[String(member.id)];
  if (!read || !complete) return next;
  return { members: { ...next.members, [String(member.id)]: { ...read, baselinePromptCount: turns.filter(t => t.prompt !== null).length, readPromptCount: 0 } } };
}

/** Puts a member's record back exactly as it was (the undo of "Đánh dấu đã đọc hết"). */
export function restoreMemberRead(state: ReadState, memberId: number, record: MemberRead | undefined): ReadState {
  const members = { ...state.members };
  if (record) members[String(memberId)] = record; else delete members[String(memberId)];
  return { members };
}

/**
 * The number beside a member in the list: new prompts not read yet. Only prompts count: new events inside an old prompt do not.
 * Never below zero; null when there is nothing to show.
 */
export function unreadPromptCount(member: Pick<TrainingMemberRow, 'id' | 'promptCount'>, state: ReadState): number {
  const read = state.members[String(member.id)];
  if (!read) return 0;
  return Math.max(0, member.promptCount - read.baselinePromptCount - read.readPromptCount);
}

/** `99+` from 100 on. */
export const newBadgeText = (n: number): string => `${n >= 100 ? '99+' : n} mới`;
