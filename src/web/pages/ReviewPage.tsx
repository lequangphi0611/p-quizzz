import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { ReviewView } from '../../shared/api/index.js';
import { QuestionPreview, type PreviewQuestion } from '../components/QuestionPreview.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { Spinner } from '../components/ui/Spinner.js';
import { MemberLayout } from '../layouts/MemberLayout.js';
import { api, ApiError } from '../lib/api.js';
import { formatPoints } from '../lib/exam-progress.js';

// "/review/:attemptId" — the member's own attempt with the answer key. The server only answers once the session
// has closed (403 before that), so nobody reads the answers while others are still working.
export function ReviewPage() {
  const { attemptId } = useParams();
  const nav = useNavigate();
  const [review, setReview] = useState<ReviewView | null>(null);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);

  useEffect(() => {
    let live = true;
    api.get<ReviewView>(`/api/me/attempts/${attemptId}/review`)
      .then(r => { if (live) setReview(r); })
      .catch(err => { if (live) setError({ message: err instanceof ApiError ? err.message : 'Không tải được bài làm', status: err instanceof ApiError ? err.status : 0 }); });
    return () => { live = false; };
  }, [attemptId]);

  const back = <Button variant="ghost" size="sm" icon="arrow-left" onClick={() => nav('/')}>Kết quả</Button>;

  let body;
  if (error) {
    body = (
      <div style={{ display: 'grid', gap: 12 }}>
        <ErrorMessage title={error.status === 403 ? 'Chưa xem được' : 'Không tải được bài làm'} message={error.message} />
        {back}
      </div>
    );
  } else if (!review) {
    body = <Spinner block label="Đang tải bài làm…" />;
  } else {
    body = (
      <div style={{ display: 'grid', gap: 16 }}>
        <div>{back}</div>
        <Card>
          <div style={{ display: 'grid', gap: 6, justifyItems: 'center', textAlign: 'center', padding: '8px 0' }}>
            <span style={{ font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--text-faint)' }}>Lượt {review.attemptNo}</span>
            <span className="pq-tabular" style={{ font: '700 48px/1 var(--font-mono)', color: 'var(--text-title)' }}>
              {formatPoints(review.score)}<span style={{ fontSize: 24, color: 'var(--text-faint)' }}>/{formatPoints(review.maxScore)}</span>
            </span>
            <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', font: 'var(--type-label)', fontSize: 12, background: review.official ? 'var(--correct-surface)' : 'var(--ink-100)', color: review.official ? 'var(--correct-600)' : 'var(--text-meta)' }}>
              {review.official ? 'Kết quả chính thức' : 'Tạm tính — chờ chấm tự luận'}
            </span>
          </div>
        </Card>
        {review.questions.map((q, i) => {
          const question: PreviewQuestion = {
            type: q.type, prompt: q.prompt, body: q.body, points: q.points, explanation: q.explanation,
            options: q.options.map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
          };
          return (
            <QuestionPreview key={q.id} index={i} mode="review" question={question}
              selectedIds={q.selectedOptionIds ?? []} answerText={q.textAnswer ?? undefined}
              manualScore={q.type === 'essay' ? q.score : undefined} feedback={q.feedback} />
          );
        })}
        <div>{back}</div>
      </div>
    );
  }
  return <MemberLayout>{body}</MemberLayout>;
}
