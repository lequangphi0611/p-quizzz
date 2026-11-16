import { describe, expect, it } from 'vitest';
import { formatPoints } from './points.js';

describe('formatPoints', () => {
  it('uses a decimal comma', () => expect(formatPoints(7.5)).toBe('7,5'));
  it('keeps whole numbers plain', () => expect(formatPoints(3)).toBe('3'));
});
