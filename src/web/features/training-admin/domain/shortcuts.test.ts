import { describe, expect, it } from 'vitest';
import { shortcutFor } from './shortcuts.js';

describe('shortcutFor', () => {
  it('H hides the content, whatever is open', () => {
    expect(shortcutFor({ key: 'h' }, { panelOpen: false, dialogOpen: true })).toBe('toggle-hidden');
  });
  it('D goes to the next AI draft, but not while a dialog or the commands popup is open, nor with Ctrl / Cmd / Alt', () => {
    expect(shortcutFor({ key: 'd' }, { panelOpen: false })).toBe('next-draft');
    expect(shortcutFor({ key: 'D' }, { panelOpen: true })).toBe('next-draft');
    expect(shortcutFor({ key: 'd' }, { panelOpen: false, dialogOpen: true })).toBeNull();
    expect(shortcutFor({ key: 'd' }, { panelOpen: false, turnOpen: true })).toBeNull();
    expect(shortcutFor({ key: 'd', ctrlKey: true }, { panelOpen: false })).toBeNull();
  });
  it('N is not ours: the notification bell keeps it', () => {
    expect(shortcutFor({ key: 'n' }, { panelOpen: false })).toBeNull();
    expect(shortcutFor({ key: 'N' }, { panelOpen: true })).toBeNull();
  });
  it('J / K step only with the panel open, Esc closes the panel or the popup', () => {
    expect(shortcutFor({ key: 'j' }, { panelOpen: false })).toBeNull();
    expect(shortcutFor({ key: 'j' }, { panelOpen: true })).toBe('next');
    expect(shortcutFor({ key: 'k' }, { panelOpen: true })).toBe('prev');
    expect(shortcutFor({ key: 'Escape' }, { panelOpen: false, turnOpen: true })).toBe('close');
  });
});
