import { DomainError } from '../errors.js';

export class GroupNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy nhóm');
  }
}

export class GroupNameTakenError extends DomainError {
  constructor() {
    super('conflict', 'Đã có một nhóm tên này');
  }
}

export class EmptyEmailListError extends DomainError {
  constructor() {
    super('invalid', 'Nhóm cần ít nhất một email hợp lệ');
  }
}

export class InvalidEmailsError extends DomainError {
  constructor(readonly bad: string[]) {
    super('invalid', `Email chưa đúng định dạng: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}`);
  }
}

export class NotRosterSessionError extends DomainError {
  constructor() {
    super('conflict', 'Phiên này không giới hạn theo danh sách email');
  }
}

export class RosterAlreadySavedError extends DomainError {
  constructor() {
    super('conflict', 'Danh sách này đã được lưu thành nhóm');
  }
}
