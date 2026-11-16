import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH } from '../../../../shared/api/index.js';
import { setupPasswordProblem } from './password.js';

describe('setupPasswordProblem', () => {
  const ok = 'x'.repeat(MIN_PASSWORD_LENGTH);
  it('needs the minimum length first, then a matching repeat', () => {
    expect(setupPasswordProblem('x'.repeat(MIN_PASSWORD_LENGTH - 1), 'x'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(`Mật khẩu tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
    expect(setupPasswordProblem(ok, ok + 'y')).toBe('Hai mật khẩu chưa khớp');
    expect(setupPasswordProblem(ok, ok)).toBe('');
  });
});
