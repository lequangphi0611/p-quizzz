import type { AiSuggestionDto } from '../../../../shared/api/index.js';
import type { AiSuggestion } from '../../../domain/grading/ai-suggestion.js';

/** The mentor's view of a suggestion. Built field by field: nothing else of the row leaves the server. */
export const toAiSuggestionDto = (s: AiSuggestion | undefined | null): AiSuggestionDto | null =>
  s
    ? {
        status: s.status,
        score: s.score,
        feedback: s.feedback,
        criteria: s.criteria ?? [],
        suspicious: s.suspicious,
        suspiciousReason: s.suspiciousReason,
        suspiciousLines: s.suspiciousLines ?? [],
        error: s.error,
        used: s.used,
      }
    : null;
