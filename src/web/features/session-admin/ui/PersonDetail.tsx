import type { ParticipantReview } from '../../../../shared/api/index.js';
import { ReviewQuestions } from '../../../components/ReviewQuestions.js';
import { Card } from '../../../components/ui/Card.js';
import { ErrorMessage } from '../../../components/ui/ErrorMessage.js';
import { Spinner } from '../../../components/ui/Spinner.js';
import { formatPoints } from '../../../shared/format/points.js';
import { useParticipantReview } from '../application/session-admin-context.js';
import { MEMBERSHIP_LABEL } from '../domain/session-review.js';

// One person's attempt, loaded when selected.
export function PersonDetail({ participantId }: { participantId: number }) {
  const { data, error } = useParticipantReview(participantId);

  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Spinner block label="Đang tải bài làm…" />;

  const m = MEMBERSHIP_LABEL[data.participant.status];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-title)' }}>{data.participant.displayName}</h2>
          <span style={{ font: 'var(--type-label)', color: m.color }}>{m.label}</span>
          {data.attempt && (
            <span className="pq-tabular" style={{ marginLeft: 'auto', font: '700 28px/1 var(--font-mono)' }}>
              {formatPoints(data.attempt.score)}<span style={{ fontSize: 16, color: 'var(--text-faint)' }}>/{formatPoints(data.attempt.maxScore)}</span>
            </span>
          )}
        </div>
        {data.participant.status === 'kicked' && <p style={{ margin: '8px 0 0', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Người này bị loại khỏi phiên nên bài không được tính vào kết quả.</p>}
        {data.attempt && !data.attempt.official && <p style={{ margin: '8px 0 0', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Điểm tạm tính — tự luận chưa chấm xong hoặc chưa chốt kết quả.</p>}
      </Card>
      {!data.attempt ? (
        <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>
          {data.state === 'doing' ? 'Người này đang làm bài, chưa nộp.' : 'Người này không làm bài trong phiên.'}
        </p></Card>
      ) : (
        <ReviewQuestions review={data.attempt} viewer="mentor" />
      )}
    </div>
  );
}
