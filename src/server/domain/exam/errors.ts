import { DomainError } from '../errors.js';

export class ExamNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy đề');
  }
}

export class ExamInUseError extends DomainError {
  constructor() {
    super('conflict', 'Đề đã được dùng cho phiên thi, không xoá được');
  }
}
