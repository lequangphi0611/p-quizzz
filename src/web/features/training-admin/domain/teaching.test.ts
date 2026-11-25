import { describe, expect, it } from 'vitest';
import type { TeachingExampleRow } from '../../../../shared/api/index.js';
import { NO_CONSENT_REASON, editedFieldCount, findName, highlightSegments, itemStatus, nameHits, replaceName, reviewedCount, sortReviewItems, editedContextOf, editedPromptOf, emptyTeachingForm, isDirty, reviewBody, reviewItemOf, teachingBody, teachingFileName, teachingFormError, teachingLockReason } from './teaching.js';

const row = (over: Partial<TeachingExampleRow> = {}): TeachingExampleRow => ({
  eventId: 7, memberId: 1, memberName: 'An', label: 'good', topic: 'verify', comment: 'ok', betterPrompt: null, editedPrompt: null, editedContext: null, reviewed: false,
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

  it('finds the name of any member in the prompt, context, comment or better version, ignoring case', () => {
    const item = { ...reviewItemOf(row({ comment: 'Bạn Thanh Tùng hay quên.', betterPrompt: 'nhờ lan xem' })), promptDraft: 'Thanh Tùng đây: sửa giúp', contextDraft: '✓ Read /Thanh Tùng/x' };
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

  it('finds a name as a whole word with the same accents, in any case, and a phrase as a phrase', () => {
    expect(findName('Lan đây, lan ơi, LAN!', 'Lan')).toEqual([[0, 3], [9, 12], [17, 20]]);
    expect(findName('Thanh Tùng đây', 'Thanh Tùng')).toEqual([[0, 10]]);
    expect(findName('thanh   tùng đây', 'Thanh Tùng')).toEqual([[0, 12]]); // any run of spaces
    expect(findName('Thanh Tùng'.normalize('NFD'), 'Thanh Tùng')).toHaveLength(1); // typed decomposed
    expect(findName('abc', 'A')).toEqual([]); // too short
  });

  it('does not find a short name inside another word, or in a word that only differs by accents', () => {
    expect(findName('Thanh toán giỏ hàng', 'An')).toEqual([]);
    expect(findName('chạy lại lần nữa', 'Lan')).toEqual([]);
    expect(findName('plan, Langs, lang', 'Lan')).toEqual([]);
    expect(findName('Thanh tung đây', 'Thanh Tùng')).toEqual([]);
    expect(nameHits({ ...reviewItemOf(row()), commentDraft: 'Thanh toán giỏ hàng, chạy lại lần nữa' }, ['An', 'Lan'])).toEqual([]);
  });

  it('replaces only the whole-word matches and leaves everything else as it was', () => {
    expect(replaceName('Thanh toán giỏ hàng', 'An', '[bạn]')).toBe('Thanh toán giỏ hàng');
    expect(replaceName('chạy lại lần nữa', 'Lan', '[bạn]')).toBe('chạy lại lần nữa');
    expect(replaceName('Lan đây, lan ơi, plan', 'Lan', '[bạn]')).toBe('[bạn] đây, [bạn] ơi, plan');
    expect(replaceName('Thanh Tùng đây, Thanh tung nữa', 'Thanh Tùng', '[bạn]')).toBe('[bạn] đây, Thanh tung nữa');
    expect(replaceName('Đạt và đạt, Dat', 'Đạt', 'X')).toBe('X và X, Dat');
  });

  it('skips a name the mentor dismissed for this example', () => {
    const item = { ...reviewItemOf(row()), promptDraft: 'Lan đây', dismissed: ['lan'] };
    expect(nameHits(item, ['Lan'])).toEqual([]);
  });

  it('cuts a draft into plain, name and masked pieces', () => {
    const segs = highlightSegments('Read ~/bai-tap của Lan [đã che]', ['Lan']);
    expect(segs.map(s => [s.kind, s.text])).toEqual([['plain', 'Read '], ['masked', '~'], ['plain', '/bai-tap của '], ['name', 'Lan'], ['plain', ' '], ['masked', '[đã che]']]);
    expect(highlightSegments('', ['Lan'])).toEqual([]);
    expect(highlightSegments('a ~ b', []).every(s => s.kind === 'plain' || s.text === '~')).toBe(true);
  });

  it('says where each example stands in the list, and counts the reviewed ones and the changed fields', () => {
    const plain = reviewItemOf(row());
    expect(itemStatus(plain, [])).toEqual({ tone: 'plain', text: 'Chưa rà' });
    expect(itemStatus({ ...plain, reviewed: true }, [])).toEqual({ tone: 'ok', text: 'Đã rà' });
    const edited = { ...plain, reviewed: true, promptDraft: 'mới', contextDraft: '' };
    expect(editedFieldCount(edited)).toBe(2);
    expect(itemStatus(edited, [])).toEqual({ tone: 'ok', text: 'Đã rà · 2 trường đã sửa' });
    expect(itemStatus(plain, [{ name: 'Lan' }])).toEqual({ tone: 'warn', text: '1 chỗ nghi là tên · chưa rà' });
    expect(reviewedCount([plain, { ...plain, reviewed: true }])).toBe(1);
  });

  it('lists by topic, then label (good first), then id', () => {
    const mk = (eventId: number, topic: 'verify' | 'other', label: 'good' | 'needs_work') => reviewItemOf(row({ eventId, topic, label }));
    expect(sortReviewItems([mk(1, 'other', 'good'), mk(2, 'verify', 'needs_work'), mk(3, 'verify', 'good'), mk(4, 'other', 'good')]).map(i => i.eventId)).toEqual([3, 2, 1, 4]);
  });
});
