import { useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import type { ExamDetail as ExamDetailData } from '../../../../shared/api/index.js';
import { QuestionPreview } from '../../../shared/ui/QuestionPreview.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { useDeleteExam } from '../application/exam-context.js';
import { countByType, attemptRuleLabel, typeCountsLabel } from '../domain/exam-summary.js';
import { formatDate } from '../../../shared/format/date.js';

export function ExamDetailPage() {
  const exam = useLoaderData() as ExamDetailData;
  const nav = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const { remove: removeExam, deleting, error } = useDeleteExam();
  const used = exam.sessionCount > 0;

  async function remove() {
    if (await removeExam(exam.id)) nav('/admin/exams', { replace: true });
    else setConfirming(false);
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
          <div>{attemptRuleLabel(exam.hasEssay)}</div>
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
