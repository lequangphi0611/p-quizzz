import { DomainError } from '../errors.js';

export class TrainingNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy buổi training');
  }
}

export class TrainingMemberNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy học viên trong buổi training');
  }
}

/** A step taken out of order (stop a stopped training, end an open one, ...). */
export class TrainingStateError extends DomainError {
  constructor(message: string) {
    super('conflict', message);
  }
}

/** No (valid) member token: never joined, withdrew, was removed, or the training ended and its data is gone. */
export class TrainingNotJoinedError extends DomainError {
  constructor() {
    super('unauthenticated', 'Bạn chưa vào buổi training');
  }
}

/** The removal check was asked for its verdict before the quiet period was over. */
export class TrainingCheckTooEarlyError extends DomainError {
  constructor() {
    super('conflict', 'Chờ thêm vài giây rồi bấm kiểm tra lại', 'too_early');
  }
}
