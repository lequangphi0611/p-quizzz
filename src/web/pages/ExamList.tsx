import { useState } from 'react';
import { useLoaderData, useNavigate, useRevalidator } from 'react-router';
import type { ExamSummary } from '../../shared/api/index.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { th, td } from '../components/ui/tableStyles.js';
import { api, ApiError } from '../lib/api.js';
import { formatDate } from '../lib/format.js';

export const examListLoader = () => api.get<ExamSummary[]>('/api/admin/exams');

export function ExamList() {
  const exams = useLoaderData() as ExamSummary[];
  const nav = useNavigate();
  const { revalidate } = useRevalidator();
  const [error, setError] = useState('');
  const [target, setTarget] = useState<ExamSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!target) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/api/admin/exams/${target.id}`);
      await revalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xoá được đề');
    } finally {
      setDeleting(false);
      setTarget(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>Đề thi</h1>
        <Button icon="upload" onClick={() => nav('/admin/exams/import')}>Import đề (.md)</Button>
      </div>

      {error && <ErrorMessage message={error} />}

      {exams.length === 0 ? (
        <Card>
          <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
            <div style={{ font: 'var(--type-question)', color: 'var(--text-title)' }}>Chưa có đề nào</div>
            <p style={{ font: 'var(--type-body)', color: 'var(--text-meta)', margin: 0 }}>Import file Markdown đề đã duyệt để bắt đầu.</p>
            <Button icon="upload" onClick={() => nav('/admin/exams/import')}>Import đề đầu tiên</Button>
          </div>
        </Card>
      ) : (
        <Card padding={0}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
              <thead>
                <tr><th style={th}>Tên đề</th><th style={th}>Số câu</th><th style={th}>Tổng điểm</th><th style={th}>Loại</th><th style={th}>Số phiên</th><th style={th}>Ngày tạo</th><th style={th} /></tr>
              </thead>
              <tbody>
                {exams.map(e => {
                  const used = e.sessionCount > 0;
                  return (
                    <tr key={e.id}>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--text-title)' }}><a href={`/admin/exams/${e.id}`} onClick={ev => { ev.preventDefault(); nav(`/admin/exams/${e.id}`); }}>{e.title}</a></td>
                      <td className="pq-tabular" style={td}>{e.questionCount}</td>
                      <td className="pq-tabular" style={td}>{e.totalPoints}</td>
                      <td style={td}>{e.hasEssay ? 'Có tự luận' : 'Trắc nghiệm'}</td>
                      <td className="pq-tabular" style={td}>{e.sessionCount}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-meta)' }}>{formatDate(e.createdAt)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <Button size="sm" icon="play" onClick={() => nav(`/admin/sessions?examId=${e.id}`)}>Mở phiên thi</Button>
                          {used ? (
                            <span title="Đề đã được dùng cho phiên thi, không xoá được"><Button size="sm" variant="ghost" icon="trash-2" disabled>Xoá</Button></span>
                          ) : (
                            <Button size="sm" variant="ghost" icon="trash-2" onClick={() => setTarget(e)}>Xoá</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog open={!!target} tone="danger" title={`Xoá đề "${target?.title ?? ''}"?`} confirmLabel="Xoá đề" busy={deleting} onCancel={() => setTarget(null)} onConfirm={remove}>
        Đề và toàn bộ câu hỏi sẽ bị xoá, không thể hoàn tác.
      </ConfirmDialog>
    </div>
  );
}
