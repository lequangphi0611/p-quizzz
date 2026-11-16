import { Fragment } from 'react';
import type { SessionDetail, SessionParticipantDetail } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { th, td } from '../../../shared/ui/tableStyles.js';
import { PROGRESS_LABEL, formatProgressScore } from '../domain/session-ui.js';
import { NameCell } from './NameCell.js';

/** Admitted members with their progress (after start), rename and kick. */
export function ParticipantsCard({ status, active, working, finalized, onRename, onKick, onResolveEdit }: {
  status: SessionDetail['status']; active: SessionParticipantDetail[]; working: boolean; finalized: boolean;
  onRename: (id: number, name: string) => Promise<boolean>; onKick: (p: SessionParticipantDetail) => void;
  /** Approve or reject a request to edit essays after submitting (PRODUCT.md §7.21). */
  onResolveEdit: (id: number, decision: 'approve' | 'reject') => void;
}) {
  const showProgress = status !== 'draft' && status !== 'lobby';
  return (
    <Card padding={0} style={{ flex: '1 1 520px', minWidth: 0, overflowX: 'auto' }}>
      <div style={{ padding: '16px 16px 6px', font: 'var(--type-h2)', fontSize: 16, color: 'var(--text-title)' }}>Người tham gia · {active.length}</div>
      {active.length === 0 ? (
        <p style={{ margin: 0, padding: '8px 16px 20px', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
          {status === 'draft' ? 'Mở phòng chờ để member bắt đầu vào.' : 'Chưa có ai vào phiên.'}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Tên</th>{showProgress && <><th style={th}>Tiến độ</th><th style={th}>Điểm tạm tính</th></>}<th style={th} /></tr></thead>
          <tbody>
            {active.map(p => (<Fragment key={p.id}>
              <tr>
                <td style={td}><NameCell p={p} disabled={working} readOnly={finalized} onSave={name => onRename(p.id, name)} /></td>
                {showProgress && <>
                  <td style={{ ...td, color: PROGRESS_LABEL[p.progress.state].color }}>{PROGRESS_LABEL[p.progress.state].label}</td>
                  <td className="pq-tabular" style={{ ...td, fontFamily: 'var(--font-mono)' }}>{formatProgressScore(p.progress)}</td>
                </>}
                <td style={{ ...td, textAlign: 'right' }}>
                  {!finalized && <Button size="sm" variant="ghost" icon="user-x" disabled={working} onClick={() => onKick(p)}>Kick</Button>}
                </td>
              </tr>
              {p.progress.editRequest?.status === 'pending' && (
                <tr>
                  <td colSpan={showProgress ? 4 : 2} style={{ ...td, whiteSpace: 'normal', background: 'var(--sun-100)', color: 'var(--sun-ink)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ flex: '1 1 260px', minWidth: 0, overflowWrap: 'anywhere' }}><b>{p.displayName}</b> xin sửa bài tự luận. Lý do: “{p.progress.editRequest.reason}”</span>
                      <span style={{ display: 'inline-flex', gap: 8 }}>
                        <Button size="sm" icon="check" disabled={working} onClick={() => onResolveEdit(p.id, 'approve')}>Duyệt</Button>
                        <Button size="sm" variant="secondary" icon="x" disabled={working} onClick={() => onResolveEdit(p.id, 'reject')}>Từ chối</Button>
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
