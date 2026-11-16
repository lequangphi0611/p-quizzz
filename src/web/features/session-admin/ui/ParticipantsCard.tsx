import { Fragment } from 'react';
import type { SessionDetail, SessionParticipantDetail } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { th, td } from '../../../shared/ui/tableStyles.js';
import { formatProgressScore, progressLabelOf } from '../domain/session-ui.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { formatClock } from '../../../shared/format/date.js';
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
            {active.map(p => {
              const req = p.progress.editRequest?.status === 'pending' ? p.progress.editRequest : null;
              const prog = progressLabelOf(p.progress);
              // A pending request sticks to its person's row: same background, no rule between, a sun bar on the left.
              const bar = req ? { boxShadow: 'inset 3px 0 0 var(--sun-500)' } : {};
              const cell = req ? { ...td, borderBottom: 0 } : td;
              return (
                <Fragment key={p.id}>
                  <tr style={req ? { background: 'var(--sun-100)' } : undefined}>
                    <td style={{ ...cell, ...bar }}><NameCell p={p} disabled={working} readOnly={finalized} onSave={name => onRename(p.id, name)} /></td>
                    {showProgress && <>
                      <td style={{ ...cell, color: prog.color, fontWeight: req ? 600 : undefined }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{prog.icon && <Icon name={prog.icon} size={14} />}{prog.label}</span></td>
                      <td className="pq-tabular" style={{ ...cell, fontFamily: 'var(--font-mono)' }}>{formatProgressScore(p.progress)}</td>
                    </>}
                    <td style={{ ...cell, textAlign: 'right' }}>
                      {!finalized && <Button size="sm" variant="ghost" icon="user-x" disabled={working} onClick={() => onKick(p)}>Kick</Button>}
                    </td>
                  </tr>
                  {req && (
                    <tr style={{ background: 'var(--sun-100)' }}>
                      <td colSpan={showProgress ? 4 : 2} style={{ ...td, ...bar, whiteSpace: 'normal', paddingTop: 0, color: 'var(--sun-ink)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 300px', minWidth: 0, display: 'grid', gap: 4 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--type-meta)', fontWeight: 700 }}><Icon name="pencil" size={14} />Xin sửa bài tự luận · {formatClock(req.requestedAt)}</span>
                            <span style={{ font: 'var(--type-ui)', overflowWrap: 'anywhere', textWrap: 'pretty' }}>“{req.reason}”</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                            <Button size="sm" icon="check" disabled={working} onClick={() => onResolveEdit(p.id, 'approve')}>Duyệt</Button>
                            <Button size="sm" variant="secondary" icon="x" disabled={working} onClick={() => onResolveEdit(p.id, 'reject')}>Từ chối</Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
