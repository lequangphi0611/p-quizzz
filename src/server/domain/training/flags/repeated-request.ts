import { cap, type FlagEvent, type FlagRule } from './flag-event.js';

/** Prompts in a row that repeat each other before the flag goes up. */
export const REPEATED_PROMPTS = 3;
export const SIMILAR_THRESHOLD = 0.8;
const SHORT_PROMPT_CHARS = 80;
const STILL_BROKEN = /(vẫn|còn|lại)\s+(bị\s+)?(lỗi|không|sai|fail)|chưa\s+(được|chạy|xong|sửa)|\b(still|again)\b.*\b(fail|error|broken|wrong|not work)|doesn'?t work|not working|không (được|chạy)/i;

const words = (text: string): Set<string> => new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));

/** Share of words two prompts have in common (Jaccard). Two empty prompts count as the same. */
export function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 && wb.size === 0) return 1;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / (wa.size + wb.size - common);
}

const repeats = (prev: string, next: string): boolean =>
  similarity(prev, next) >= SIMILAR_THRESHOLD || (next.length <= SHORT_PROMPT_CHARS && STILL_BROKEN.test(next));

/** "Lặp yêu cầu": `REPEATED_PROMPTS` prompts in a row where each nearly repeats the one before, or only says that it still fails. */
export const repeatedRequest: FlagRule = events => {
  const prompts = events.filter((e): e is FlagEvent & { prompt: string } => e.kind === 'prompt' && e.prompt !== null);
  const hits: number[] = [];
  let run: number[] = [];
  prompts.forEach((p, i) => {
    run = i > 0 && repeats(prompts[i - 1]!.prompt, p.prompt) ? [...(run.length > 0 ? run : [prompts[i - 1]!.id]), p.id] : [];
    if (run.length === REPEATED_PROMPTS) hits.push(...run);
    else if (run.length > REPEATED_PROMPTS) hits.push(p.id);
  });
  return hits.length > 0 ? { code: 'repeated_request', eventIds: cap(hits) } : null;
};
