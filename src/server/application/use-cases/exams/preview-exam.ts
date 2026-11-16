import { parseExam, type ParseResult } from '../../../../shared/exam-format/index.js';

/** Parses exam Markdown for the mentor to review. Saves nothing. */
export class PreviewExam {
  execute(markdown: string): ParseResult {
    return parseExam(markdown);
  }
}
