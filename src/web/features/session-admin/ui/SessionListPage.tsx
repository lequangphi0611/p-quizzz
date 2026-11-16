import { useState } from 'react';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import { th, td } from '../../../shared/ui/tableStyles.js';
import { formatDate } from '../../../shared/format/date.js';
import type { SessionListData } from '../application/session-admin-loaders.js';
import { CreateSessionForm } from './CreateSessionForm.js';

export function SessionListPage() {
  const { sessions, exams } = useLoaderData() as SessionListData;
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
          <CreateSessionForm exams={exams} initialExamId={preselected} onCancel={() => setCreating(false)} />
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
