import { describe, expect, it } from 'vitest';
import { answerLabel, isBlank } from './grading-ui.js';

describe('helpers', () => {
  it('isBlank covers null, empty and whitespace-only answers', () => {
    expect(isBlank({ textAnswer: null })).toBe(true);
    expect(isBlank({ textAnswer: '  \n ' })).toBe(true);
    expect(isBlank({ textAnswer: 'x' })).toBe(false);
  });
  it('answerLabel hides names when grading blind', () => {
    expect(answerLabel({ displayName: 'An' }, 2, false)).toBe('An');
    expect(answerLabel({ displayName: 'An' }, 2, true)).toBe('Bài #3');
  });
});
