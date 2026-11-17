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
import { InviteDialog } from './InviteDialog.js';
import { SessionCard } from './SessionCard.js';

export function SessionListPage() {
  const { sessions, exams, groups } = useLoaderData() as SessionListData;
  const nav = useNavigate();
  const [params] = useSearchParams();
  const preselected = Number(params.get('examId')) || null;
  const [creating, setCreating] = useState(preselected !== null); // coming from "Mở phiên thi" in the exam list
  const [inviting, setInviting] = useState(false);
  // Sessions in lobby/running side by side (PRODUCT.md §7.5), lowest slot first; everything else is history.
  const open = sessions.filter(s => s.status === 'lobby' || s.status === 'running').sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99) || a.id - b.id);
  const history = sessions.filter(s => s.status !== 'lobby' && s.status !== 'running');

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
          <CreateSessionForm exams={exams} groups={groups} initialExamId={preselected} onCancel={() => setCreating(false)} />
        )
      )}

      {open.length > 0 && (
        <section aria-label="Phiên đang mở" style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, font: 'var(--type-h2)', fontSize: 16, color: 'var(--text-title)' }}>Đang mở · {open.length}</h2>
            <Button size="sm" variant="secondary" icon="send" onClick={() => setInviting(true)}>Gửi lời mời</Button>
          </div>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {open.map(s => <SessionCard key={s.id} session={s} onControl={() => nav(`/admin/sessions/${s.id}`)} onScreen={() => window.open(`/screen/${s.id}`, '_blank')} />)}
          </div>
          {inviting && <InviteDialog sessions={open} onClose={() => setInviting(false)} />}
        </section>
      )}

      {sessions.length === 0 ? (
        <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>Chưa có phiên thi nào. Mỗi phiên đang mở có số thứ tự riêng, nhiều phiên có thể chạy cùng lúc.</p></Card>
      ) : history.length === 0 ? null : (
        <Card padding={0} title="Gần đây" style={{ paddingTop: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead><tr><th style={th}>Phiên</th><th style={th}>Trạng thái</th><th style={th}>Số người</th><th style={th}>Tạo lúc</th><th style={th} /></tr></thead>
              <tbody>
                {history.map(s => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/admin/sessions/${s.id}`)}>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--text-title)' }}>{s.name}<div style={{ font: 'var(--type-meta)', fontWeight: 400, color: 'var(--text-meta)' }}>{s.examTitle}</div></td>
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
