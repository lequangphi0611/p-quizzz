import { useState } from 'react';
import { useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';
import type { ExamDetail as ExamDetailData } from '../../shared/api/index.js';
import { QuestionPreview } from '../components/QuestionPreview.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { Icon } from '../components/ui/Icon.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { api, ApiError } from '../lib/api.js';
import { countByType, retakeLabel, typeCountsLabel } from '../lib/exam-summary.js';
import { formatDate } from '../lib/format.js';

export const examDetailLoader = ({ params }: LoaderFunctionArgs) => api.get<ExamDetailData>(`/api/admin/exams/${params.id}`);

export function ExamDetail() {
  const exam = useLoaderData() as ExamDetailData;
  const nav = useNavigate();
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const used = exam.sessionCount > 0;

  async function remove() {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/api/admin/exams/${exam.id}`);
      nav('/admin/exams', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xoá được đề');
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <button onClick={() => nav('/admin/exams')} style={{ justifySelf: 'start', display: 'inline-flex', gap: 6, alignItems: 'center', background: 'none', border: 0, padding: 0, color: 'var(--text-meta)', font: 'var(--type-meta)', cursor: 'pointer' }}><Icon name="arrow-left" size={14} />Đề thi</button>

      <Card
        title={exam.title}
        subtitle={exam.description}
        actions={
          <>
            <Button size="sm" icon="play" onClick={() => nav(`/admin/sessions?examId=${exam.id}`)}>Mở phiên thi</Button>
            <span title={used ? 'Đề đã được dùng cho phiên thi, không xoá được' : undefined}>
              <Button size="sm" variant="secondary" icon="trash-2" disabled={used} onClick={() => setConfirming(true)}>Xoá</Button>
            </span>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 4, font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
          <div><b className="pq-tabular">{exam.questionCount}</b> câu ({typeCountsLabel(countByType(exam.questions))}) · tổng <b className="pq-tabular">{exam.totalPoints}</b> điểm</div>
          <div>{retakeLabel(exam.hasEssay)}</div>
          <div>Tạo {formatDate(exam.createdAt)} · đã dùng cho {exam.sessionCount} phiên</div>
        </div>
      </Card>

      {error && <ErrorMessage message={error} />}

      {exam.questions.map((q, i) => <QuestionPreview key={q.id} index={i} question={q} />)}

      <ConfirmDialog open={confirming} tone="danger" title={`Xoá đề "${exam.title}"?`} confirmLabel="Xoá đề" busy={deleting} onCancel={() => setConfirming(false)} onConfirm={remove}>
        Đề và toàn bộ câu hỏi sẽ bị xoá, không thể hoàn tác.
      </ConfirmDialog>
    </div>
  );
}
