import type { DiscussionQuestion } from '../../../../shared/api/index.js';
import { optionLetter } from './discussion-ui.js';

// "Lý do của lớp" on the projector (S30, PRODUCT.md §7.32e). Pure: groups the anonymous reasons of one question by what
// was picked. Group order never depends on the key: options keep their exam order (single) and combinations sort by
// their letters (multi), so revealing the answer does not move anything.

export interface ReasonGroup {
  /** Stable key: the picked option ids joined by "+". */
  key: string;
  /** Letters of the picked options, e.g. ["A"] or ["A", "C"]. */
  letters: string[];
  /** Single choice: the option text. Multi: one line per picked option. */
  optionTexts: string[];
  /** Counted submissions that picked exactly this (single: this option). 0 = "Không ai chọn" (single only). */
  people: number;
  /** Non-blank reasons, in the server's shuffled order. */
  reasons: string[];
  /** Picked this but wrote no reason (auto-submitted when time ran out or the session closed). */
  noReason: number;
  /** The pick is the full correct answer. Only shown once the mentor reveals the answer. */
  correct: boolean;
}

export interface ReasonBoard {
  groups: ReasonGroup[];
  /** Non-blank reasons over all groups. */
  total: number;
}

export function reasonBoard(q: Pick<DiscussionQuestion, 'type' | 'options' | 'reasons'>): ReasonBoard {
  const index = new Map(q.options.map((o, i) => [o.id, i]));
  const correct = q.options.filter(o => o.isCorrect).map(o => o.id).sort((a, b) => a - b).join('+');
  const byKey = new Map<string, { ids: number[]; reasons: string[]; noReason: number }>();
  for (const r of q.reasons) {
    const ids = r.optionIds.filter(id => index.has(id)).sort((a, b) => index.get(a)! - index.get(b)!);
    if (ids.length === 0) continue;
    const key = [...ids].sort((a, b) => a - b).join('+');
    const g = byKey.get(key) ?? { ids, reasons: [], noReason: 0 };
    if (r.text && r.text.trim()) g.reasons.push(r.text); else g.noReason++;
    byKey.set(key, g);
  }
  const build = (key: string, ids: number[], reasons: string[], noReason: number): ReasonGroup => ({
    key,
    letters: ids.map(id => optionLetter(index.get(id)!)),
    optionTexts: ids.map(id => q.options[index.get(id)!]!.text),
    people: reasons.length + noReason,
    reasons,
    noReason,
    correct: key === correct,
  });

  let groups: ReasonGroup[];
  if (q.type === 'single') {
    groups = q.options.map(o => {
      const key = String(o.id);
      const g = byKey.get(key);
      return build(key, [o.id], g?.reasons ?? [], g?.noReason ?? 0);
    });
  } else {
    const lettersOf = (ids: number[]) => ids.map(id => index.get(id)!);
    groups = [...byKey.entries()]
      .sort(([, a], [, b]) => compareIndexLists(lettersOf(a.ids), lettersOf(b.ids)))
      .map(([key, g]) => build(key, g.ids, g.reasons, g.noReason));
  }
  return { groups, total: groups.reduce((n, g) => n + g.reasons.length, 0) };
}

/** "A+B+C" before "A+C" before "B+D" before "C": letter by letter, a shorter prefix first. */
function compareIndexLists(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}
