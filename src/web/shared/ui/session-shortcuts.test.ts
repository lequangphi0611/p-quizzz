import { describe, expect, it } from 'vitest';
import { isBellShortcut, isTypingTarget, slotFromShortcut } from './session-shortcuts.js';

const key = (o: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; code: string; key: string }>) => ({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: '', ...o });

describe('slotFromShortcut', () => {
  it('Alt+1…9 gives the slot, from the digit row or the numpad', () => {
    expect(slotFromShortcut(key({ altKey: true, code: 'Digit3', key: '£' }))).toBe(3); // macOS Alt changes `key`, not `code`
    expect(slotFromShortcut(key({ altKey: true, code: 'Numpad9', key: '9' }))).toBe(9);
    expect(slotFromShortcut(key({ altKey: true, key: '1' }))).toBe(1);
  });
  it('needs Alt alone: no 0, no other modifier, no plain digit', () => {
    expect(slotFromShortcut(key({ altKey: true, code: 'Digit0', key: '0' }))).toBeNull();
    expect(slotFromShortcut(key({ code: 'Digit1', key: '1' }))).toBeNull();
    expect(slotFromShortcut(key({ altKey: true, ctrlKey: true, code: 'Digit1', key: '1' }))).toBeNull();
    expect(slotFromShortcut(key({ altKey: true, shiftKey: true, code: 'Digit1', key: '1' }))).toBeNull();
  });
});

describe('isBellShortcut', () => {
  it('plain N outside a text field', () => {
    expect(isBellShortcut({ ...key({ key: 'n' }), target: { tagName: 'BODY' } as unknown as EventTarget })).toBe(true);
    expect(isBellShortcut({ ...key({ key: 'N' }), target: null })).toBe(true);
  });
  it('not while typing, not with a modifier', () => {
    expect(isBellShortcut({ ...key({ key: 'n' }), target: { tagName: 'INPUT' } as unknown as EventTarget })).toBe(false);
    expect(isBellShortcut({ ...key({ key: 'n' }), target: { tagName: 'TEXTAREA' } as unknown as EventTarget })).toBe(false);
    expect(isBellShortcut({ ...key({ key: 'n', ctrlKey: true }), target: null })).toBe(false);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
  });
});
