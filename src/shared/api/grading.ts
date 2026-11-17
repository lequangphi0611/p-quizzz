import { z } from 'zod';

export const MAX_FEEDBACK_LENGTH = 2000;

// PUT /api/admin/answers/:id/grade. The upper bound (the question's points) is checked server-side per answer.
export const GradeBody = z.object({
  score: z
    .number({ error: 'Điểm không hợp lệ' })
    .finite('Điểm không hợp lệ')
    .min(0, 'Điểm không được âm')
    .refine(n => (n * 2) % 1 === 0, 'Điểm phải là bội số của 0,5'),
  feedback: z.string({ error: 'Nhận xét không hợp lệ' }).max(MAX_FEEDBACK_LENGTH, 'Nhận xét tối đa 2.000 ký tự').optional(),
  // How the mentor used the AI suggestion (PRODUCT.md §7.28): one tap, or edited first. Absent = graded by hand.
  aiUse: z.enum(['accepted', 'edited']).optional(),
});

// POST /api/admin/sessions/:id/questions/:questionId/ai-suggest. Absent = every answer still to send; ids = retry those.
export const AiSuggestBody = z.object({ answerIds: z.array(z.number().int().positive()).max(1000).optional() }).optional();

export type AiSuggestionStatus = 'queued' | 'running' | 'done' | 'failed';

export interface AiCriterionDto {
  label: string; // "T1"… when the rubric was split into criteria
  score: number;
  max: number;
  note: string;
}

/** The AI's suggestion for one answer. Mentor only, never a score (PRODUCT.md §7.28). */
export interface AiSuggestionDto {
  status: AiSuggestionStatus;
  score: number | null;
  feedback: string | null; // shown to the member only if the mentor keeps it
  criteria: AiCriterionDto[];
  suspicious: boolean;
  suspiciousReason: string | null;
  suspiciousLines: number[]; // 1-based lines of the answer
  error: string | null; // short Vietnamese reason when failed
  used: 'accepted' | 'edited' | null;
}

export interface GradingAnswer {
  answerId: number;
  participantId: number;
  displayName: string;
  textAnswer: string | null; // null / blank = the member left it empty
  manualScore: number | null; // null = not graded yet
  feedback: string | null;
  aiSuggestion: AiSuggestionDto | null;
}

export interface GradingQuestion {
  id: number;
  position: number;
  prompt: string;
  body: string;
  points: number;
  explanation: string | null; // model answer / rubric (mentor only)
  hasRubric: boolean; // without one the AI does not grade the question
  rubric: { criteria: { text: string; points: number }[]; model: string } | null; // split into T1…Tn when possible
  ai: { queued: number; running: number; done: number; failed: number };
  answers: GradingAnswer[]; // the counted attempt of every active participant
}

export interface GradingView {
  sessionId: number;
  status: 'closed' | 'finalized';
  graded: number; // essay answers graded so far…
  total: number; // …out of all essay answers that count
  aiGrader: { available: boolean }; // the mentor's machine has the AI set up (never the configuration itself)
  questions: GradingQuestion[];
}

export interface GradeResponse {
  answer: GradingAnswer;
  graded: number;
  total: number;
}
