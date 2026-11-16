import { describe, expect, it } from 'vitest';
import { cleanEmails } from './emails.js';
import { EmptyEmailListError, InvalidEmailsError } from './errors.js';

describe('cleanEmails', () => {
  it('normalizes and de-duplicates, keeping the order typed', () => {
    expect(cleanEmails([' Phi78@Gmail.com', 'minh@x.vn', 'phi78@gmail.com', ''])).toEqual(['phi78@gmail.com', 'minh@x.vn']);
  });
  it('refuses anything that is not an email, naming it (a typo must not silently lock someone out)', () => {
    expect(() => cleanEmails(['a@x.com', 'phi89@'])).toThrow(InvalidEmailsError);
    expect(() => cleanEmails(['a@x.com', 'phi89@'])).toThrow('phi89@');
  });
  it('needs at least one email', () => {
    expect(() => cleanEmails([])).toThrow(EmptyEmailListError);
    expect(() => cleanEmails(['  ', ''])).toThrow(EmptyEmailListError);
  });
});
