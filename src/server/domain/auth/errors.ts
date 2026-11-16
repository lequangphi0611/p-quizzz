import { DomainError } from '../errors.js';

export class AdminAlreadySetupError extends DomainError {
  constructor() {
    super('conflict', 'Đã thiết lập mật khẩu rồi');
  }
}

/** Same message whether the password is wrong, missing or not set up yet. */
export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('unauthenticated', 'Sai mật khẩu');
  }
}
