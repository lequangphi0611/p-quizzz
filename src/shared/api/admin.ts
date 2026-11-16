import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 6;

export const PasswordBody = z.object({
  password: z.string().min(MIN_PASSWORD_LENGTH, `Mật khẩu tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`),
});

export interface AdminStatus {
  setupDone: boolean;
  loggedIn: boolean;
}
