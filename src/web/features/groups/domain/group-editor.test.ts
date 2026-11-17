import { describe, expect, it } from 'vitest';
import { draftOfGroup, emailsToSave, isDirty, parseDraft, saveBlocker } from './group-editor.js';

describe('group editor', () => {
  it('a saved group opens as one email per line', () => {
    expect(draftOfGroup({ name: 'Lớp', emails: ['a@x.com', 'b@x.com'] })).toEqual({ name: 'Lớp', defaultDomain: '', text: 'a@x.com\nb@x.com' });
  });

  it('saves the clean emails only: duplicates merged, bad lines left out, default domain applied', () => {
    const d = { name: 'Lớp', defaultDomain: 'x.com', text: 'a@x.com\nb\nA@x.com\nphi89@' };
    expect(emailsToSave(parseDraft(d))).toEqual(['a@x.com', 'b@x.com']);
  });

  it('says what blocks saving: name, then no valid email; bad lines alone do not block', () => {
    const ok = { name: 'Lớp', defaultDomain: '', text: 'a@x.com\nbad@' };
    expect(saveBlocker(ok, parseDraft(ok))).toBe('');
    expect(saveBlocker({ ...ok, name: '  ' }, parseDraft(ok))).toBe('Nhập tên nhóm');
    const none = { ...ok, text: 'bad@' };
    expect(saveBlocker(none, parseDraft(none))).toBe('Cần ít nhất một email hợp lệ');
    expect(saveBlocker({ ...ok, name: 'x'.repeat(61) }, parseDraft(ok))).toContain('tối đa');
  });

  it('dirty when anything differs from what was loaded', () => {
    const saved = { name: 'A', defaultDomain: '', text: 'a@x.com' };
    expect(isDirty(saved, saved)).toBe(false);
    expect(isDirty({ ...saved, text: 'a@x.com\nb@x.com' }, saved)).toBe(true);
  });
});
