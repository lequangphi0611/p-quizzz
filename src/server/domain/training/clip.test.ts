import { describe, expect, it } from 'vitest';
import { clip, CLIP_PART_BYTES } from './clip.js';

const lines = (n: number, make = (i: number) => `line ${i}`) => Array.from({ length: n }, (_, i) => make(i + 1)).join('\n');
const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('clip', () => {
  it('keeps a short text whole: no tail, nothing omitted', () => {
    expect(clip('a\nb\nc')).toEqual({ head: 'a\nb\nc', tail: null, omittedLines: 0 });
    expect(clip(lines(400))).toMatchObject({ tail: null, omittedLines: 0 });
  });

  it('10 000 lines → the first 200 and the last 200, 9 600 omitted', () => {
    const c = clip(lines(10_000));
    expect(c.omittedLines).toBe(9600);
    expect(c.head.split('\n')).toHaveLength(200);
    expect(c.head.startsWith('line 1\n')).toBe(true);
    expect(c.tail!.split('\n')).toHaveLength(200);
    expect(c.tail!.endsWith('line 10000')).toBe(true);
  });

  it('401 lines are just over the limit: one line is omitted', () => {
    const c = clip(lines(401));
    expect(c.omittedLines).toBe(1);
    expect(c.tail!.split('\n')).toHaveLength(200);
  });

  it('each part stays under 32 KB, and the lines dropped to fit count as omitted', () => {
    const wide = (i: number) => `${i}:`.padEnd(500, 'x');
    const text = lines(300, wide);
    const c = clip(text);
    expect(bytes(c.head)).toBeLessThanOrEqual(CLIP_PART_BYTES);
    expect(bytes(c.tail!)).toBeLessThanOrEqual(CLIP_PART_BYTES);
    expect(c.head.split('\n').length + c.tail!.split('\n').length + c.omittedLines).toBe(300);
    expect(c.omittedLines).toBeGreaterThan(0);
  });

  it('cuts a line longer than 2 000 characters and marks it', () => {
    const c = clip(`${'y'.repeat(5000)}\nshort`);
    expect(c.head.split('\n')[0]).toBe(`${'y'.repeat(2000)}…`);
    expect(c.head.endsWith('short')).toBe(true);
  });

  it('never splits a multi-byte character when a single line fills the budget', () => {
    const c = clip(lines(500, () => 'đ'.repeat(2000)));
    for (const part of [c.head, c.tail!]) {
      expect(part).not.toContain('\uFFFD');
      expect(bytes(part)).toBeLessThanOrEqual(CLIP_PART_BYTES);
    }
  });

  it('reads CRLF as line breaks', () => {
    expect(clip('a\r\nb')).toEqual({ head: 'a\nb', tail: null, omittedLines: 0 });
  });
});
