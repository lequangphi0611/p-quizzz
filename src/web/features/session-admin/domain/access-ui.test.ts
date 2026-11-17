import { describe, expect, it } from 'vitest';
import { parseEmailList } from '../../../../shared/email-list.js';
import { accessBlocker, accessLabel, buildAccess, isAccessChoice, shouldRemindToSave } from './access-ui.js';

describe('access ui', () => {
  it('what blocks creating: a group not chosen, or a typed list with no valid email', () => {
    expect(accessBlocker('free', null, parseEmailList(''))).toBe('');
    expect(accessBlocker('group', null, parseEmailList(''))).toBe('Chọn một nhóm');
    expect(accessBlocker('group', 3, parseEmailList(''))).toBe('');
    expect(accessBlocker('temp', null, parseEmailList('bad@'))).toBe('Dán ít nhất một email hợp lệ');
    expect(accessBlocker('temp', null, parseEmailList('a@x.com'))).toBe('');
  });

  it('builds what the server takes: free, a group id, or the clean emails of the typed list', () => {
    expect(buildAccess('free', 3, parseEmailList('a@x.com'))).toEqual({ kind: 'free' });
    expect(buildAccess('group', 3, parseEmailList(''))).toEqual({ kind: 'group', groupId: 3 });
    expect(buildAccess('temp', null, parseEmailList('A@x.com\nb@x.com\na@x.com\nbad@'))).toEqual({ kind: 'emails', emails: ['a@x.com', 'b@x.com'] });
  });

  it('labels: Tự do / Chỉ nhóm / Danh sách tạm', () => {
    expect(accessLabel({ access: 'free', rosterSource: null })).toBe('Tự do');
    expect(accessLabel({ access: 'roster', rosterSource: 'group' })).toBe('Chỉ nhóm');
    expect(accessLabel({ access: 'roster', rosterSource: 'temp' })).toBe('Danh sách tạm');
  });

  it('remind to save only an unsaved typed list of a session that is over, unless put off', () => {
    expect(shouldRemindToSave({ rosterSource: 'temp', status: 'finalized' }, false)).toBe(true);
    expect(shouldRemindToSave({ rosterSource: 'temp', status: 'closed' }, true)).toBe(false);
    expect(shouldRemindToSave({ rosterSource: 'temp', status: 'running' }, false)).toBe(false);
    expect(shouldRemindToSave({ rosterSource: 'group', status: 'closed' }, false)).toBe(false);
    expect(shouldRemindToSave({ rosterSource: null, status: 'closed' }, false)).toBe(false);
  });

  it('only the three known choices are accepted from storage', () => {
    expect(isAccessChoice('group')).toBe(true);
    expect(isAccessChoice('x')).toBe(false);
    expect(isAccessChoice(null)).toBe(false);
  });
});
