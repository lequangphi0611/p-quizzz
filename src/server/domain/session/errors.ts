import { DomainError } from '../errors.js';

export class SessionNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy phiên');
  }
}

export class InvalidSessionTransitionError extends DomainError {
  constructor(verb: string, statusLabel: string) {
    super('conflict', `Không thể ${verb} khi phiên đang ở trạng thái "${statusLabel}"`);
  }
}

export class SessionEndedError extends DomainError {
  constructor() {
    super('conflict', 'Phiên đã kết thúc, không thêm email được nữa');
  }
}

export class UngradedEssaysError extends DomainError {
  constructor(readonly missing: number) {
    super('conflict', `Còn ${missing} bài tự luận chưa chấm điểm`);
  }
}

export class UnsupportedSessionModeError extends DomainError {
  constructor(mode: string) {
    super('invalid', `Chế độ "${mode}" chưa được hỗ trợ`);
  }
}

export class ScoreVisibilityLockedError extends DomainError {
  constructor(reason: 'submitted' | 'ended' | 'released') {
    const why = {
      submitted: 'Đã có người nộp bài, không đổi cách hiện điểm được nữa',
      ended: 'Phiên đã kết thúc, điểm đã được công bố',
      released: 'Điểm đã được công bố, không ẩn lại được',
    }[reason];
    super('conflict', why);
  }
}

export class ScoresNotHeldError extends DomainError {
  constructor() {
    super('conflict', 'Phiên này không giữ điểm, không có gì để công bố');
  }
}
