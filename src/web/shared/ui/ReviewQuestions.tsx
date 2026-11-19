import type { ReviewView } from '../../../shared/api/index.js';
import { QuestionPreview, type PreviewQuestion } from './QuestionPreview.js';

// The questions of one attempt with the person's choices, the key and the scores. Used by the member's own review
// and by the mentor's view of anyone's attempt, so both always look the same.
export function ReviewQuestions({ review, viewer = 'member' }: { review: ReviewView; viewer?: 'member' | 'mentor' }) {
  return (
    <>
      {review.questions.map((q, i) => {
        const question: PreviewQuestion = {
          type: q.type, prompt: q.prompt, body: q.body, points: q.points, explanation: q.explanation, requireReason: q.requireReason,
          options: q.options.map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
        };
        return (
          <QuestionPreview key={q.id} index={i} mode="review" question={question}
            selectedIds={q.selectedOptionIds ?? []} answerText={q.textAnswer ?? undefined} reasonText={q.reasonText} reasonLabel={viewer === 'mentor' ? 'Lý do' : 'Lý do của bạn'}
            manualScore={q.type === 'essay' ? q.score : undefined} feedback={q.feedback} chosenLabel={viewer === 'mentor' ? 'Đã chọn' : undefined} />
        );
      })}
    </>
  );
}
