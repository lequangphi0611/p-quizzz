import type { TrainingReadStore } from '../application/training-read-store.js';
import { emptyReadState, type MemberRead, type ReadState } from '../domain/unread.js';

const PREFIX = 'pq:mentor:training-read:';
const keyOf = (trainingId: number) => `${PREFIX}${trainingId}`;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/** Keeps only what has the right shape: a record damaged by hand or by an older version is dropped member by member, never thrown on. */
function parseMember(v: unknown): MemberRead | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  const baselineAt = num(r.baselineAt);
  const baselinePromptCount = num(r.baselinePromptCount);
  const readPromptCount = num(r.readPromptCount) ?? 0;
  if (baselineAt === null || baselinePromptCount === null || typeof r.turns !== 'object' || r.turns === null) return null;
  const turns: Record<string, number> = {};
  for (const [k, id] of Object.entries(r.turns)) { const n = num(id); if (n !== null) turns[k] = n; }
  return { baselineAt, baselinePromptCount, readPromptCount, turns };
}

export function parseReadState(raw: string | null): ReadState {
  if (!raw) return emptyReadState();
  try {
    const data = JSON.parse(raw) as { members?: unknown };
    if (typeof data !== 'object' || data === null || typeof data.members !== 'object' || data.members === null) return emptyReadState();
    const members: Record<string, MemberRead> = {};
    for (const [id, m] of Object.entries(data.members)) { const rec = parseMember(m); if (rec) members[id] = rec; }
    return { members };
  } catch {
    return emptyReadState();
  }
}

/** localStorage, key `pq:mentor:training-read:<trainingId>`. Storage can throw (private mode, blocked): never break the page. */
export class LocalStorageTrainingReadStore implements TrainingReadStore {
  load(trainingId: number): ReadState {
    try { return parseReadState(localStorage.getItem(keyOf(trainingId))); } catch { return emptyReadState(); }
  }
  save(trainingId: number, state: ReadState): void {
    try { localStorage.setItem(keyOf(trainingId), JSON.stringify(state)); } catch { /* not remembered; the page still works */ }
  }
  clear(trainingId: number): void {
    try { localStorage.removeItem(keyOf(trainingId)); } catch { /* ignore */ }
  }
  clearExcept(liveTrainingIds: readonly number[]): void {
    try {
      const keep = new Set(liveTrainingIds.map(keyOf));
      const stale: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX) && !keep.has(k)) stale.push(k);
      }
      for (const k of stale) localStorage.removeItem(k);
    } catch { /* ignore */ }
  }
}
