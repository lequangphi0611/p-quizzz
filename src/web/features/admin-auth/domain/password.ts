import { MIN_PASSWORD_LENGTH } from '../../../../shared/api/index.js';

/** The message for a password pair that cannot be used to set up the mentor account; '' when fine. Login needs none. */
export function setupPasswordProblem(password: string, repeat: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) return `Mật khẩu tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`;
  if (password !== repeat) return 'Hai mật khẩu chưa khớp';
  return '';
}
