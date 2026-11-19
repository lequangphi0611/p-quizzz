import { REASON_MISSING_CODE } from '../../../shared/api/attempts.js';
import { DomainError } from '../errors.js';

/** Someone else's attempt looks exactly like a missing one. */
export class AttemptNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy lượt làm bài');
  }
}

export class SessionNotRunningError extends DomainError {
  constructor(message = 'Phiên thi đã đóng') {
    super('conflict', message);
  }
}

export class AwaitingApprovalError extends DomainError {
  constructor() {
    super('conflict', 'Bạn đang chờ mentor duyệt');
  }
}

export class AttemptInProgressError extends DomainError {
  constructor() {
    super('conflict', 'Bạn đang có một lượt làm dở');
  }
}

export class AlreadyAttemptedError extends DomainError {
  constructor() {
    super('conflict', 'Bạn đã nộp bài. Muốn làm lại, nhờ mentor mở phiên thi mới');
  }
}

export class AttemptAlreadySubmittedError extends DomainError {
  constructor() {
    super('conflict', 'Lượt này đã nộp');
  }
}

export class InvalidAnswerError extends DomainError {
  constructor(message: string) {
    super('invalid', message);
  }
}

export class AnswersNotYetVisibleError extends DomainError {
  constructor() {
    super('forbidden', 'Đáp án sẽ hiện khi phiên thi kết thúc');
  }
}

export class AttemptNotSubmittedError extends DomainError {
  constructor() {
    super('conflict', 'Lượt này chưa được nộp');
  }
}

export class EditRequestNotAllowedError extends DomainError {
  constructor(message: string) {
    super('conflict', message);
  }
}

export class NoPendingEditRequestError extends DomainError {
  constructor() {
    super('conflict', 'Không có yêu cầu sửa bài nào đang chờ');
  }
}

export class EditLockedError extends DomainError {
  constructor() {
    super('conflict', 'Bài đã nộp: chỉ sửa được câu tự luận');
  }
}

/** Manual submit with picks that still lack a reason (PRODUCT.md §7.32b). Carries the question ids so the member can jump to them. */
export class ReasonMissingError extends DomainError {
  constructor(questionIds: readonly number[]) {
    super('conflict', `Còn ${questionIds.length} câu đã chọn đáp án nhưng chưa ghi lý do`, REASON_MISSING_CODE, { questionIds: [...questionIds] });
  }
}
