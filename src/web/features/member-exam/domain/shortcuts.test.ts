import { describe, expect, it } from 'vitest';
import { questionList, shortcutFor } from './shortcuts.js';

const k = (key: string, extra: Partial<Parameters<typeof shortcutFor>[0]> = {}) => shortcutFor({ key, inField: false, overlay: false, ...extra });

describe('shortcutFor', () => {
  it('maps arrows, digits and ?', () => {
    expect(k('ArrowLeft')).toEqual({ kind: 'prev' });
    expect(k('ArrowRight')).toEqual({ kind: 'next' });
    expect(k('?')).toEqual({ kind: 'help' });
    expect(k('1')).toEqual({ kind: 'pick', index: 0 });
    expect(k('9')).toEqual({ kind: 'pick', index: 8 });
    expect(k('0')).toBeNull();
    expect(k('Enter')).toBeNull(); // submitting has no shortcut
  });
  it('is off while typing, with an overlay open or with a modifier', () => {
    expect(k('ArrowRight', { inField: true })).toBeNull();
    expect(k('2', { inField: true })).toBeNull();
    expect(k('2', { overlay: true })).toBeNull();
    expect(k('ArrowLeft', { altKey: true })).toBeNull();
    expect(k('1', { ctrlKey: true })).toBeNull();
    expect(k('1', { metaKey: true })).toBeNull();
  });
  it('Esc leaves a field or closes an overlay', () => {
    expect(k('Escape', { inField: true })).toEqual({ kind: 'blur' });
    expect(k('Escape', { overlay: true, inField: true })).toEqual({ kind: 'close' });
    expect(k('Escape')).toBeNull();
  });
});

describe('questionList', () => {
  it('lists questions 1-based', () => expect(questionList([1, 3])).toBe('Câu 2, Câu 4'));
});
