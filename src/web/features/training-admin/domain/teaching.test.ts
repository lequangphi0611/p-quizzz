import { describe, expect, it } from 'vitest';
import type { TeachingExampleRow } from '../../../../shared/api/index.js';
import { NO_CONSENT_REASON, nameHits, editedContextOf, editedPromptOf, emptyTeachingForm, isDirty, reviewBody, reviewItemOf, teachingBody, teachingFileName, teachingFormError, teachingLockReason } from './teaching.js';

const row = (over: Partial<TeachingExampleRow> = {}): TeachingExampleRow => ({
  eventId: 7, memberId: 1, memberName: 'An', label: 'good', topic: 'verify', comment: 'ok', betterPrompt: null, editedPrompt: null, editedContext: null,
  defaultPrompt: 'gốc', defaultContext: '✓ Bash ls', updatedAt: 1, ...over,
});

describe('teaching examples (web domain)', () => {
  it('locks the button for a member who did not agree, with the reason from the contract', () => {
    expect(teachingLockReason({ teachingConsent: false })).toBe('Bạn này không đồng ý cho dùng làm ví dụ');
    expect(NO_CONSENT_REASON).toBe('Bạn này không đồng ý cho dùng làm ví dụ');
    expect(teachingLockReason({ teachingConsent: true })).toBeNull();
  });

  it('needs a label and a comment, and keeps the limits of the server', () => {
    const f = emptyTeachingForm();
    expect(teachingFormError(f)).toMatch(/nhãn/i);
    expect(teachingFormError({ ...f, label: 'good' })).toMatch(/nhận xét/i);
    expect(teachingFormError({ ...f, label: 'good', comment: '   ' })).toMatch(/nhận xét/i);
    expect(teachingFormError({ ...f, label: 'good', comment: 'ok' })).toBe('');
    expect(teachingFormError({ ...f, label: 'good', comment: 'x'.repeat(2001) })).toMatch(/2000/);
    expect(teachingFormError({ ...f, label: 'good', comment: 'ok', betterPrompt: 'y'.repeat(4001) })).toMatch(/4000/);
  });

  it('builds the body: trimmed comment, an empty better prompt is null, edits are carried over', () => {
    expect(teachingBody({ label: 'needs_work', topic: 'risk', comment: ' x ', betterPrompt: '  ' })).toEqual({ label: 'needs_work', topic: 'risk', comment: 'x', betterPrompt: null, editedPrompt: null, editedContext: null });
    expect(teachingBody({ label: 'good', topic: 'other', comment: 'x', betterPrompt: 'tốt' }, { editedPrompt: 'a', editedContext: '' })).toMatchObject({ betterPrompt: 'tốt', editedPrompt: 'a', editedContext: '' });
  });

  it('starts from the stored edit or else the masked original, and a draft equal to the original is "not edited"', () => {
    const plain = reviewItemOf(row());
    expect([plain.promptDraft, plain.contextDraft]).toEqual(['gốc', '✓ Bash ls']);
    expect(isDirty(plain)).toBe(false);
    const edited = reviewItemOf(row({ editedPrompt: 'đã sửa', editedContext: '' }));
    expect([edited.promptDraft, edited.contextDraft]).toEqual(['đã sửa', '']); // an empty context is a real edit: no commands in the file
    expect(isDirty(edited)).toBe(false);

    const changed = { ...plain, promptDraft: 'mới' };
    expect(isDirty(changed)).toBe(true);
    expect(reviewBody(changed)).toMatchObject({ editedPrompt: 'mới', editedContext: null, label: 'good', topic: 'verify' });
    expect(editedPromptOf({ ...changed, promptDraft: 'gốc' })).toBeNull();
    expect(editedContextOf({ ...plain, contextDraft: '' })).toBe('');
  });

  it('names the file without accents', () => {
    expect(teachingFileName('Claude Code buổi 4: ví dụ')).toBe('vi-du-claude-code-buoi-4-vi-du.md');
    expect(teachingFileName('???')).toBe('vi-du-training.md');
  });

  it('finds the name of any member in the prompt, context, comment or better version, ignoring case and accents', () => {
    const item = { ...reviewItemOf(row({ comment: 'Bạn Thanh Tùng hay quên.', betterPrompt: 'nhờ lan xem' })), promptDraft: 'Thanh Tùng đây: sửa giúp', contextDraft: '✓ Read /home/thanh tung/x' };
    const hits = nameHits(item, ['Thanh Tùng', 'Lan', 'Mai']);
    expect(hits).toEqual(expect.arrayContaining([
      { field: 'prompt', name: 'Thanh Tùng' }, { field: 'context', name: 'Thanh Tùng' }, { field: 'comment', name: 'Thanh Tùng' }, { field: 'better', name: 'Lan' },
    ]));
    expect(hits).toHaveLength(4);
    expect(nameHits(reviewItemOf(row()), ['Thanh Tùng', 'Mai'])).toEqual([]);
    expect(nameHits(item, ['A', ' '])).toEqual([]); // too short to mean anything
  });

  it('a fixed comment or better version makes the draft dirty and goes in the body', () => {
    const base = reviewItemOf(row({ comment: 'cũ', betterPrompt: null }));
    expect(isDirty(base)).toBe(false);
    expect(isDirty({ ...base, commentDraft: 'mới' })).toBe(true);
    expect(reviewBody({ ...base, commentDraft: ' mới ', betterDraft: 'tốt' })).toMatchObject({ comment: 'mới', betterPrompt: 'tốt' });
    expect(isDirty({ ...base, betterDraft: '  ' })).toBe(false);
  });
});
