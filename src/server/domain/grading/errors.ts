import { DomainError } from '../errors.js';

export class AnswerNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy bài làm');
  }
}

export class NotEssayError extends DomainError {
  constructor() {
    super('invalid', 'Chỉ chấm tay được câu tự luận');
  }
}

export class GradingNotOpenError extends DomainError {
  constructor() {
    super('conflict', 'Chỉ chấm được sau khi đóng phiên');
  }
}

export class ResultsFinalizedError extends DomainError {
  constructor() {
    super('conflict', 'Phiên đã chốt kết quả, không sửa điểm được');
  }
}

export class NotSubmittedYetError extends DomainError {
  constructor() {
    super('conflict', 'Bài này chưa được nộp');
  }
}

export class ScoreOutOfRangeError extends DomainError {
  constructor(max: number) {
    super('invalid', `Điểm phải từ 0 đến ${String(max).replace('.', ',')}`);
  }
}

export class DiscussionNotOpenError extends DomainError {
  constructor() {
    super('conflict', 'Chỉ thảo luận được sau khi đóng phiên');
  }
}

export class NoRubricError extends DomainError {
  constructor() {
    super('conflict', 'Câu này chưa có rubric, AI không chấm được. Thêm rubric vào đề rồi import lại.');
  }
}

export class AiUnavailableError extends DomainError {
  constructor() {
    super('conflict', 'AI chấm nháp chưa được bật trên máy này');
  }
}

export class QuestionNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'Không tìm thấy câu hỏi');
  }
}
