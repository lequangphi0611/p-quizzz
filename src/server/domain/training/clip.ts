import type { Clip } from '../../../shared/api/training.js';

export type { Clip };

export const CLIP_HEAD_LINES = 200;
export const CLIP_TAIL_LINES = 200;
/** Each part (head, tail) stays under this many bytes of UTF-8. */
export const CLIP_PART_BYTES = 32 * 1024;
/** A line longer than this is cut (minified files, base64 blobs). */
export const CLIP_LINE_CHARS = 2000;

const encoder = new TextEncoder();
const byteLength = (s: string) => encoder.encode(s).length;

/** Cuts one line to `CLIP_LINE_CHARS` characters, marking the cut. */
const cutLine = (line: string) => (line.length > CLIP_LINE_CHARS ? `${line.slice(0, CLIP_LINE_CHARS)}…` : line);

/** At most `bytes` bytes of `s`, never splitting a character. */
function cutBytes(s: string, bytes: number, fromEnd: boolean): string {
  let out = '';
  let used = 0;
  const chars = [...s];
  for (const ch of fromEnd ? chars.reverse() : chars) {
    const n = byteLength(ch);
    if (used + n > bytes) break;
    used += n;
    out += ch;
  }
  return fromEnd ? [...out].reverse().join('') : out;
}

/** The first lines that fit in `CLIP_PART_BYTES`, or the last ones when `fromEnd`. Whole lines, except a single line bigger than the budget. */
function fit(lines: string[], fromEnd: boolean): string[] {
  const kept: string[] = [];
  let used = 0;
  for (const line of fromEnd ? [...lines].reverse() : lines) {
    const n = byteLength(line) + 1;
    if (used + n > CLIP_PART_BYTES) {
      if (kept.length === 0) kept.push(cutBytes(line, CLIP_PART_BYTES, fromEnd));
      break;
    }
    used += n;
    kept.push(line);
  }
  return fromEnd ? kept.reverse() : kept;
}

/**
 * Keeps a long output readable and bounded: the first 200 and the last 200 lines, each part under 32 KB, and how many
 * lines were left out. Short enough → everything in `head`, no `tail`, nothing omitted (PRODUCT.md §7.34c).
 */
export function clip(text: string): Clip {
  const lines = text.split(/\r?\n/).map(cutLine);
  if (lines.length <= CLIP_HEAD_LINES + CLIP_TAIL_LINES) {
    const whole = lines.join('\n');
    if (byteLength(whole) <= CLIP_PART_BYTES) return { head: whole, tail: null, omittedLines: 0 };
  }
  const head = fit(lines.slice(0, CLIP_HEAD_LINES), false);
  const rest = lines.slice(CLIP_HEAD_LINES);
  const tail = fit(rest.slice(-CLIP_TAIL_LINES), true);
  return {
    head: head.join('\n'),
    tail: tail.length > 0 ? tail.join('\n') : null,
    omittedLines: lines.length - head.length - tail.length,
  };
}
