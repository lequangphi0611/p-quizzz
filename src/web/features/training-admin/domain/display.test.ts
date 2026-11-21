import { describe, expect, it } from 'vitest';
import { changeLines, clipView, omittedLabel } from './clip-view.js';
import { connectionLabel } from './connection-label.js';
import { formatDuration } from './duration.js';
import { BOTTOM_THRESHOLD_PX, isNearBottom } from './scroll.js';
import { isTypingTarget, shortcutFor } from './shortcuts.js';
import { toolLabel } from './tool-label.js';
import { memberCountLabel, trainingStatusIcon, trainingStatusLabel } from './training-ui.js';

describe('connectionLabel', () => {
  it('tells four states apart by words, icon and border, not colour alone', () => {
    const labels = [
      connectionLabel({ connection: 'waiting', stillSending: false }),
      connectionLabel({ connection: 'connected', stillSending: false }),
      connectionLabel({ connection: 'uninstalled', stillSending: false }),
      connectionLabel({ connection: 'connected', stillSending: true }),
    ];
    expect(labels.map(l => l.text)).toEqual(['Chưa nhận tín hiệu', 'Đã nhận tín hiệu', 'Đã gỡ', 'Vẫn gửi sau khi dừng']);
    expect(new Set(labels.map(l => l.icon)).size).toBe(4);
    expect(labels.map(l => l.border)).toEqual(['dashed', 'solid', 'solid', 'solid']);
  });

  it('still sending wins over a stored "uninstalled"', () => {
    expect(connectionLabel({ connection: 'uninstalled', stillSending: true }).key).toBe('still-sending');
  });
});

describe('formatDuration', () => {
  it('shows ms under a second, one decimal under ten seconds, whole seconds, then minutes', () => {
    expect(formatDuration(48)).toBe('48 ms');
    expect(formatDuration(999)).toBe('999 ms');
    expect(formatDuration(3200)).toBe('3,2 s');
    expect(formatDuration(1000)).toBe('1,0 s');
    expect(formatDuration(12_400)).toBe('12 s');
    expect(formatDuration(65_000)).toBe('1 phút 05 s');
    expect(formatDuration(120_000)).toBe('2 phút 00 s');
  });

  it('rounds up across a boundary without printing 10,0 s or 60 s', () => {
    expect(formatDuration(9_960)).toBe('10 s');
    expect(formatDuration(59_700)).toBe('1 phút 00 s');
  });

  it('is empty for a nonsense value', () => {
    expect(formatDuration(-1)).toBe('');
    expect(formatDuration(Number.NaN)).toBe('');
  });
});

describe('toolLabel', () => {
  it('abbreviates PowerShell to PS in any letter case, and keeps the full name for hover', () => {
    expect(toolLabel('PowerShell')).toEqual({ label: 'PS', full: 'PowerShell' });
    expect(toolLabel('powershell')).toEqual({ label: 'PS', full: 'powershell' });
  });

  it('leaves every other tool as it is', () => {
    for (const name of ['Bash', 'Edit', 'Write', 'Read', 'NotebookEdit', 'mcp__x__y']) expect(toolLabel(name)).toEqual({ label: name, full: name });
  });
});

describe('clipView', () => {
  it('shows head, the omitted-lines divider and tail', () => {
    expect(clipView({ head: 'a', tail: 'z', omittedLines: 9600 })).toEqual({ head: 'a', omitted: '… đã lược bỏ 9.600 dòng …', tail: 'z' });
  });

  it('has no divider when nothing was left out', () => {
    expect(clipView({ head: 'a', tail: null, omittedLines: 0 })).toEqual({ head: 'a', omitted: null, tail: null });
  });

  it('says "1 dòng" for one line', () => {
    expect(omittedLabel(1)).toBe('… đã lược bỏ 1 dòng …');
  });
});

describe('changeLines', () => {
  it('marks removed and added lines', () => {
    expect(changeLines('- old\n+ new\n  same')).toEqual([
      { kind: 'del', text: '- old' },
      { kind: 'add', text: '+ new' },
      { kind: 'plain', text: '  same' },
    ]);
  });
});

describe('isNearBottom', () => {
  it('is true within 80px of the end and false beyond', () => {
    expect(BOTTOM_THRESHOLD_PX).toBe(80);
    expect(isNearBottom({ scrollTop: 920, clientHeight: 500, scrollHeight: 1500 })).toBe(true);
    expect(isNearBottom({ scrollTop: 920 - 1, clientHeight: 500, scrollHeight: 1500 })).toBe(false);
    expect(isNearBottom({ scrollTop: 0, clientHeight: 500, scrollHeight: 300 })).toBe(true);
  });
});

describe('shortcutFor', () => {
  it('H toggles, J/K/Esc work only with the panel open', () => {
    expect(shortcutFor({ key: 'h' }, { panelOpen: false })).toBe('toggle-hidden');
    expect(shortcutFor({ key: 'H' }, { panelOpen: true })).toBe('toggle-hidden');
    expect(shortcutFor({ key: 'j' }, { panelOpen: false })).toBeNull();
    expect(shortcutFor({ key: 'j' }, { panelOpen: true })).toBe('next');
    expect(shortcutFor({ key: 'K' }, { panelOpen: true })).toBe('prev');
    expect(shortcutFor({ key: 'Escape' }, { panelOpen: true })).toBe('close');
    expect(shortcutFor({ key: 'Escape' }, { panelOpen: false })).toBeNull();
  });

  it('ignores keys pressed with a modifier (Ctrl+H is the browser history)', () => {
    expect(shortcutFor({ key: 'h', ctrlKey: true }, { panelOpen: true })).toBeNull();
    expect(shortcutFor({ key: 'j', metaKey: true }, { panelOpen: true })).toBeNull();
  });

  it('keys typed in a field are text', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'textarea' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('training labels', () => {
  it('names the three states of a training', () => {
    expect(trainingStatusLabel('open')).toBe('Đang thu');
    expect(trainingStatusLabel('stopped')).toBe('Đã dừng thu');
    expect(trainingStatusLabel('ended')).toBe('Đã kết thúc');
    expect(new Set((['open', 'stopped', 'ended'] as const).map(trainingStatusIcon)).size).toBe(3);
    expect(memberCountLabel(20)).toBe('20 người');
  });
});
