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

export class AnotherSessionActiveError extends DomainError {
  constructor() {
    super('conflict', 'Đang có phiên thi khác hoạt động');
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
