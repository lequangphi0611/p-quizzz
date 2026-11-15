import { useState } from 'react';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { ExamSummary, SessionDetail, SessionSummary } from '../../shared/api/index.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { Icon } from '../components/ui/Icon.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { th, td } from '../components/ui/tableStyles.js';
import { api, ApiError } from '../lib/api.js';
import { formatDate } from '../lib/format.js';

interface Data { sessions: SessionSummary[]; exams: ExamSummary[] }
export const sessionListLoader = async (): Promise<Data> => {
  const [sessions, exams] = await Promise.all([api.get<SessionSummary[]>('/api/admin/sessions'), api.get<ExamSummary[]>('/api/admin/exams')]);
  return { sessions, exams };
};

const selectStyle = { width: '100%', height: 44, padding: '0 12px', font: 'var(--type-body)', fontSize: 16, color: 'var(--text-title)', background: 'var(--paper)', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)' } as const;

function CreateForm({ exams, initialExamId, onCancel }: { exams: ExamSummary[]; initialExamId: number | null; onCancel: () => void }) {
  const nav = useNavigate();
  const [examId, setExamId] = useState<number | ''>(exams.some(e => e.id === initialExamId) ? initialExamId! : '');
  const [shuffle, setShuffle] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    if (examId === '' || busy) return;
    setBusy(true);
    setError('');
    try {
      const s = await api.post<SessionDetail>('/api/admin/sessions', { examId, shuffle });
      nav(`/admin/sessions/${s.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được phiên');
      setBusy(false);
    }
  }

  return (
    <Card title="Tạo phiên thi" tone="brand">
      <div style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' }}>Đề thi</span>
          <select value={examId} onChange={e => setExamId(e.target.value ? Number(e.target.value) : '')} style={selectStyle}>
            <option value="">Chọn đề…</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.title} · {e.questionCount} câu</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, font: 'var(--type-ui)', color: 'var(--text-title)', cursor: 'pointer' }}>
          <input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand-600)' }} />
          Trộn thứ tự câu hỏi và đáp án cho từng người
        </label>
        {error && <ErrorMessage message={error} />}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon="plus" loading={busy} disabled={examId === ''} onClick={create}>Tạo phiên</Button>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>Huỷ</Button>
        </div>
      </div>
    </Card>
  );
}

export function SessionList() {
  const { sessions, exams } = useLoaderData() as Data;
  const nav = useNavigate();
  const [params] = useSearchParams();
  const preselected = Number(params.get('examId')) || null;
  const [creating, setCreating] = useState(preselected !== null); // coming from "Mở phiên thi" in the exam list

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>Phiên thi</h1>
        {!creating && <Button icon="plus" onClick={() => setCreating(true)}>Tạo phiên</Button>}
      </div>

      {creating && (
        exams.length === 0 ? (
          <ErrorMessage tone="warning" message="Chưa có đề nào để tạo phiên. Hãy import một đề trước." onRetry={() => nav('/admin/exams/import')} retryLabel="Import đề" />
        ) : (
          <CreateForm exams={exams} initialExamId={preselected} onCancel={() => setCreating(false)} />
        )
      )}

      {sessions.length === 0 ? (
        <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>Chưa có phiên thi nào.</p></Card>
      ) : (
        <Card padding={0}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead><tr><th style={th}>Đề</th><th style={th}>Trạng thái</th><th style={th}>Số người</th><th style={th}>Tạo lúc</th><th style={th} /></tr></thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/admin/sessions/${s.id}`)}>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--text-title)' }}>{s.examTitle}</td>
                    <td style={td}><StatusBadge status={s.status} /></td>
                    <td className="pq-tabular" style={{ ...td, fontFamily: 'var(--font-mono)' }}>{s.participantCount}</td>
                    <td style={{ ...td, color: 'var(--text-meta)' }}>{formatDate(s.createdAt)}</td>
                    <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      {/* One click from the list: finished sessions go straight to the review, others to the control page. */}
                      {s.status === 'closed' || s.status === 'finalized' ? (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <Button size="sm" variant="secondary" icon="message-square" onClick={() => nav(`/admin/sessions/${s.id}/discuss`)}>Thảo luận</Button>
                          <Button size="sm" variant="secondary" icon="list-checks" onClick={() => nav(`/admin/sessions/${s.id}/review`)}>Xem lại</Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="secondary" icon="chevron-right" onClick={() => nav(`/admin/sessions/${s.id}`)}>Điều khiển</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
