import type { CreateExamResponse, ExamDetail, ExamSummary } from '../../../../shared/api/index.js';
import type { ParseResult } from '../../../../shared/exam-format/index.js';
import type { HttpClient } from '../../../shared/api-client/http-client.js';
import type { ExamLibraryGateway } from '../application/exam-gateway.js';

export class HttpExamLibraryGateway implements ExamLibraryGateway {
  constructor(private http: HttpClient) {}
  previewExam(markdown: string): Promise<ParseResult> { return this.http.post<ParseResult>('/api/admin/exams/preview', { markdown }); }
  importExam(markdown: string): Promise<CreateExamResponse> { return this.http.post<CreateExamResponse>('/api/admin/exams', { markdown }); }
  listExams(): Promise<ExamSummary[]> { return this.http.get<ExamSummary[]>('/api/admin/exams'); }
  getExam(id: number): Promise<ExamDetail> { return this.http.get<ExamDetail>(`/api/admin/exams/${id}`); }
  async deleteExam(id: number): Promise<void> { await this.http.delete(`/api/admin/exams/${id}`); }
}
