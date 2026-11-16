import { DomainError } from '../errors.js';

export class ParticipantNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy người tham gia');
  }
}

export class NameTakenError extends DomainError {
  constructor() {
    super('conflict', 'Tên đã có người dùng');
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
