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
