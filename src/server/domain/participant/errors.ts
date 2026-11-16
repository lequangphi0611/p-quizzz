import { DomainError } from '../errors.js';

export class ParticipantNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy người tham gia');
  }
}

export class NameTakenError extends DomainError {
  /** `identity_in_use` only on the join path: that is where the member can ask the mentor to let them back in (PRODUCT.md §7.23). */
  constructor(code?: 'identity_in_use') {
    super('conflict', 'Tên đã có người dùng', code);
  }
}

/** The email a member typed is on this session's list and someone already joined with it. */
export class EmailTakenError extends DomainError {
  constructor() {
    super('conflict', 'Email này đã có người vào phòng', 'identity_in_use');
  }
}

export class InvalidEmailError extends DomainError {
  constructor(message = 'Email chưa đúng định dạng') {
    super('invalid', message);
  }
}

/**
 * One message for every email that is not on the list: never says which emails are, or why this one is not (sloppy
 * typing, other domain...), so the list cannot be probed (PRODUCT.md §7.22e). The HTTP layer counts it towards the
 * per-address limit, like a wrong room code.
 */
export class NotInRosterError extends DomainError {
  constructor() {
    super('forbidden', 'Email này không có trong danh sách của phòng. Kiểm tra lại, hoặc nhắn mentor.');
  }
}

export class SessionNotOpenError extends DomainError {
  constructor() {
    super('conflict', 'Phiên thi không mở');
  }
}

/** The only `forbidden` a join can raise: the HTTP layer counts it towards the per-address limit. */
export class WrongRoomCodeError extends DomainError {
  constructor() {
    super('forbidden', 'Mã phòng không đúng');
  }
}

export class ParticipantKickedError extends DomainError {
  constructor() {
    super('conflict', 'Người này đã bị mời ra khỏi phiên');
  }
}

export class SessionFinalizedError extends DomainError {
  constructor() {
    super('conflict', 'Phiên đã chốt kết quả, không sửa danh sách người tham gia được');
  }
}

export class NotPendingError extends DomainError {
  constructor() {
    super('conflict', 'Chỉ duyệt được người đang chờ duyệt');
  }
}

export class SessionClosedForApprovalError extends DomainError {
  constructor() {
    super('conflict', 'Phiên thi đã đóng, không duyệt thêm người được');
  }
}

// Authentication of a member by token.
export class NotJoinedError extends DomainError {
  constructor() {
    super('unauthenticated', 'Bạn chưa vào phiên thi');
  }
}

export class KickedOutError extends DomainError {
  constructor() {
    super('forbidden', 'Bạn đã bị mời ra khỏi phiên');
  }
}
