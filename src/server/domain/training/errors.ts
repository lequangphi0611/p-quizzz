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

/** Only a prompt can become a teaching example (S44). */
export class TeachingExampleNotPromptError extends DomainError {
  constructor() {
    super('invalid', 'Chỉ chọn được prompt làm ví dụ dạy lớp sau', 'not_a_prompt');
  }
}

/** The member did not tick the teaching consent (S44, PRODUCT.md §7.39a). */
export class TeachingConsentMissingError extends DomainError {
  constructor() {
    super('conflict', 'Bạn này không đồng ý cho dùng làm ví dụ', 'no_teaching_consent');
  }
}

/** The "Tôi đã rà" tick is missing (S44, PRODUCT.md §7.39c). */
export class TeachingReviewNotConfirmedError extends DomainError {
  constructor() {
    super('invalid', 'Cần rà lại các ví dụ và tick xác nhận trước khi tải', 'review_not_confirmed');
  }
}

/** No example to put in the file (S44). */
export class TeachingExamplesEmptyError extends DomainError {
  constructor() {
    super('not_found', 'Chưa có ví dụ nào để xuất', 'no_examples');
  }
}
