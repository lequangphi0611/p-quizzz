import { describe, expect, it } from 'vitest';
import { isValidEmail, normalizeDomain, normalizeEmail, parseEmailList } from './email-list.js';

describe('normalizeEmail / isValidEmail', () => {
  it('trims and lower-cases, nothing else (no accent folding)', () => {
    expect(normalizeEmail('  Phi78@Gmail.COM ')).toBe('phi78@gmail.com');
    expect(normalizeEmail('Đạt@x.vn')).toBe('đạt@x.vn');
  });
  it('accepts a plain address, refuses the obvious mistakes', () => {
    expect(isValidEmail('phi78@gmail.com')).toBe(true);
    expect(isValidEmail('a.b+tag@mail.company.vn')).toBe(true);
    for (const bad of ['phi89@', '@gmail.com', 'phi89@gmail', 'a b@x.com', 'a@@x.com', 'a@x..', '']) expect(isValidEmail(bad), bad).toBe(false);
    expect(isValidEmail(`${'a'.repeat(250)}@x.com`)).toBe(false);
  });
  it('normalizeDomain drops a leading @ and case', () => expect(normalizeDomain(' @Company.VN ')).toBe('company.vn'));
});

describe('parseEmailList', () => {
  it('one email per line, or several separated by commas, semicolons or spaces', () => {
    const r = parseEmailList('a@x.com\nb@x.com, c@x.com;d@x.com e@x.com');
    expect(r.valid.map(v => v.email)).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com']);
    expect(r.valid.map(v => v.line)).toEqual([1, 2, 2, 2, 2]);
  });

  it('Phi78@Gmail.com and phi78@gmail.com are one person: the later one is a duplicate, with the line it repeats', () => {
    const r = parseEmailList('phi78@gmail.com\nPhi78@Gmail.com\n  phi78@gmail.com  ');
    expect(r.valid).toHaveLength(1);
    expect(r.duplicates).toEqual([
      { email: 'phi78@gmail.com', line: 2, raw: 'Phi78@Gmail.com', firstLine: 1 },
      { email: 'phi78@gmail.com', line: 3, raw: 'phi78@gmail.com', firstLine: 1 },
    ]);
  });

  it('a line without @ gets the default domain; the result is the full email and says so', () => {
    const r = parseEmailList('minh\nlinh@company.vn', '@company.vn');
    expect(r.valid).toEqual([
      { email: 'minh@company.vn', line: 1, raw: 'minh', addedDomain: true },
      { email: 'linh@company.vn', line: 2, raw: 'linh@company.vn', addedDomain: false },
    ]);
    expect(r.invalid).toEqual([]);
  });

  it('without a default domain, a line without @ is invalid, with the line number to fix', () => {
    const r = parseEmailList('ok@x.com\nminh\nphi89@\n');
    expect(r.valid.map(v => v.email)).toEqual(['ok@x.com']);
    expect(r.invalid.map(i => [i.line, i.raw, i.reason])).toEqual([[2, 'minh', 'missing_at'], [3, 'phi89@', 'format']]);
  });

  it('ignores blank lines and wrapping like "Name <a@x.com>" brackets and quotes', () => {
    const r = parseEmailList('\n<a@x.com>\n"b@x.com"\n\n');
    expect(r.valid.map(v => v.email)).toEqual(['a@x.com', 'b@x.com']);
    expect(r.invalid).toEqual([]);
  });

  it('copes with a few hundred lines', () => {
    const text = Array.from({ length: 300 }, (_, i) => `u${i}@x.com`).join('\n');
    expect(parseEmailList(text).valid).toHaveLength(300);
  });
});
