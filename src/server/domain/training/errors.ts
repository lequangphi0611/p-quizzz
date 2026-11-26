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
    super('invalid', 'Chỉ chọn được prompt làm ví dụ', 'not_a_prompt');
  }
}

/** The member did not tick the teaching consent (S44, PRODUCT.md §7.39a). */
export class TeachingConsentMissingError extends DomainError {
  constructor() {
    super('conflict', 'Bạn này không đồng ý cho dùng làm ví dụ', 'no_teaching_consent');
  }
}

/** Some examples are not marked reviewed: the file is not built (S44, PRODUCT.md §7.39j). */
export class TeachingExamplesNotReviewedError extends DomainError {
  constructor(unreviewed: number) {
    super('invalid', `Còn ${unreviewed} ví dụ chưa rà. Rà hết rồi mới tải được file.`, 'examples_not_reviewed', { unreviewed });
  }
}

/** No example to put in the file (S44). */
export class TeachingExamplesEmptyError extends DomainError {
  constructor() {
    super('not_found', 'Chưa có ví dụ nào để xuất', 'no_examples');
  }
}

/** The mentor has not set up the AI command: no draft can be asked for (S45, 503 `ai_unavailable`). */
export class ExampleDraftUnavailableError extends DomainError {
  constructor() {
    super('unavailable', 'AI chưa được bật trên máy này', 'ai_unavailable');
  }
}

/** The prompt already has a saved example: the mentor judged it, so the AI is not asked again (S45, 409 `example_exists`). */
export class TeachingExampleExistsError extends DomainError {
  constructor() {
    super('conflict', 'Prompt này đã có ví dụ, nên không viết nháp lại. Bỏ ví dụ trước nếu muốn làm lại', 'example_exists');
  }
}

/** The prompt has no AI draft (S45, 404 `no_draft`). */
export class ExampleDraftNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Prompt này chưa có nháp', 'no_draft');
  }
}
