import { describe, expect, it, vi } from 'vitest';
import { copyText } from './copy-text.js';

describe('copyText', () => {
  it('uses the Clipboard API when there is one', async () => {
    const writeText = vi.fn(async () => {});
    const execCopy = vi.fn(() => true);
    expect(await copyText('abc', { clipboard: { writeText }, execCopy })).toBe(true);
    expect(writeText).toHaveBeenCalledWith('abc');
    expect(execCopy).not.toHaveBeenCalled();
  });

  it('falls back to the old way when the Clipboard API is missing (plain http on the LAN)', async () => {
    const execCopy = vi.fn(() => true);
    expect(await copyText('abc', { execCopy })).toBe(true);
    expect(execCopy).toHaveBeenCalledWith('abc');
  });

  it('falls back when the Clipboard API refuses (permission)', async () => {
    const execCopy = vi.fn(() => true);
    const writeText = vi.fn(async () => { throw new Error('denied'); });
    expect(await copyText('abc', { clipboard: { writeText }, execCopy })).toBe(true);
    expect(execCopy).toHaveBeenCalled();
  });

  it('says false (never throws) when nothing works, so the text can be selected by hand', async () => {
    expect(await copyText('abc', {})).toBe(false);
    expect(await copyText('abc', { execCopy: () => false })).toBe(false);
    expect(await copyText('abc', { execCopy: () => { throw new Error('boom'); } })).toBe(false);
  });
});
