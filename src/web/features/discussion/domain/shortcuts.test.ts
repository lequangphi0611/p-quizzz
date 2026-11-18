import { describe, expect, it } from 'vitest';
import { discussionKeyAction, type KeyContext } from './shortcuts.js';

const ctx = (o: Partial<KeyContext> = {}): KeyContext => ({ dialog: false, finalizing: false, ready: true, hasPapers: true, mode: 'list', fullscreen: false, ...o });
const k = (key: string, c: Partial<KeyContext> = {}, extra: object = {}) => discussionKeyAction({ key, tag: 'BODY', ...extra }, ctx(c));

describe('discussionKeyAction', () => {
  it('maps arrows, space and J/K', () => {
    expect(k('ArrowRight')).toEqual({ kind: 'question', delta: 1 });
    expect(k('ArrowLeft')).toEqual({ kind: 'question', delta: -1 });
    expect(k(' ')).toEqual({ kind: 'toggleAnswer' });
    expect(k('j')).toEqual({ kind: 'paper', dir: 1 });
    expect(k('K')).toEqual({ kind: 'paper', dir: -1 });
    expect(k('j', { hasPapers: false })).toBeNull();
  });
  it('is off while typing or with a modifier', () => {
    expect(discussionKeyAction({ key: 'j', tag: 'TEXTAREA' }, ctx())).toBeNull();
    expect(discussionKeyAction({ key: 'ArrowLeft', tag: 'INPUT' }, ctx())).toBeNull();
    expect(k('ArrowRight', {}, { altKey: true })).toBeNull();
  });
  it('Esc: closes the dialog (not while finalizing) or leaves a paper (not in fullscreen)', () => {
    expect(k('Escape', { dialog: true })).toEqual({ kind: 'closeDialog' });
    expect(k('Escape', { dialog: true, finalizing: true })).toBeNull();
    expect(k('ArrowRight', { dialog: true })).toBeNull();
    expect(k('Escape', { mode: 'paper' })).toEqual({ kind: 'backToList' });
    expect(k('Escape', { mode: 'paper', fullscreen: true })).toBeNull();
    expect(k('Escape')).toBeNull();
  });
  it('does nothing before the data is ready', () => expect(k('ArrowRight', { ready: false })).toBeNull());
  it('S toggles the "Cần bàn trước" order, not while typing a score/feedback or with a modifier (Ctrl+S)', () => {
    expect(k('s')).toEqual({ kind: 'toggleOrder' });
    expect(k('S')).toEqual({ kind: 'toggleOrder' });
    expect(discussionKeyAction({ key: 's', tag: 'TEXTAREA' }, ctx())).toBeNull();
    expect(k('s', {}, { ctrlKey: true })).toBeNull();
    expect(k('s', { ready: false })).toBeNull();
    expect(k('s', { dialog: true })).toBeNull();
  });
});
