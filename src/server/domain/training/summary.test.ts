import { describe, expect, it } from 'vitest';
import { buildSummary, SUMMARY_LINE_CHARS } from './summary.js';

describe('buildSummary', () => {
  it('a failed call shows its error excerpt', () => {
    expect(buildSummary({ ok: false, errorExcerpt: 'Exit code 2\nls: cannot access /nope', outputEnd: 'ignored' })).toBe('Exit code 2\nls: cannot access /nope');
  });

  it('a failed call with no error text has no summary', () => {
    expect(buildSummary({ ok: false, errorExcerpt: null, outputEnd: null })).toBeNull();
    expect(buildSummary({ ok: false, errorExcerpt: ' \n ', outputEnd: null })).toBeNull();
  });

  it('a successful call shows the last line that has text', () => {
    expect(buildSummary({ ok: true, errorExcerpt: null, outputEnd: 'PASS a\nTests: 3 passed\n\n  \n' })).toBe('Tests: 3 passed');
    expect(buildSummary({ ok: true, errorExcerpt: null, outputEnd: 'one line' })).toBe('one line');
  });

  it('an empty or missing output has no summary', () => {
    expect(buildSummary({ ok: true, errorExcerpt: null, outputEnd: null })).toBeNull();
    expect(buildSummary({ ok: true, errorExcerpt: null, outputEnd: '' })).toBeNull();
    expect(buildSummary({ ok: true, errorExcerpt: null, outputEnd: '\n  \n' })).toBeNull();
  });

  it('cuts a long line', () => {
    const s = buildSummary({ ok: true, errorExcerpt: null, outputEnd: 'x'.repeat(500) })!;
    expect(s).toBe(`${'x'.repeat(SUMMARY_LINE_CHARS)}…`);
    expect(buildSummary({ ok: false, errorExcerpt: `${'e'.repeat(500)}\nshort`, outputEnd: null })!.split('\n')[0]).toBe(`${'e'.repeat(SUMMARY_LINE_CHARS)}…`);
  });
});
