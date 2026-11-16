import { describe, expect, it } from 'vitest';
import { plainPrompt } from './review-mark.js';

describe('plainPrompt', () => {
  it('flattens a Markdown prompt to one plain line', () => {
    expect(plainPrompt('Khi nào dùng `merge`,\n**khi nào** `rebase`?')).toBe('Khi nào dùng merge, khi nào rebase?');
  });
});
