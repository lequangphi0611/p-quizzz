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

export class TrainingEventNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy sự kiện');
  }
}

/** The export has nothing to put in the file: no event of the chosen members in the chosen days (S41). */
export class TrainingExportEmptyError extends DomainError {
  constructor() {
    super('not_found', 'Không có dữ liệu trong khoảng này', 'empty_export');
  }
}

/** Too much text for one file: the mentor narrows the days or the members (S41). */
export class TrainingExportTooLargeError extends DomainError {
  constructor(approxBytes: number) {
    super('invalid', `Dữ liệu quá lớn (khoảng ${Math.ceil(approxBytes / (1024 * 1024))} MB). Chọn ít ngày hoặc ít bạn hơn.`, 'export_too_large');
  }
}
