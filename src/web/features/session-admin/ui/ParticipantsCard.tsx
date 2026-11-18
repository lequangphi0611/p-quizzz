import { Fragment } from 'react';
import type { SessionDetail, SessionParticipantDetail } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { th, td } from '../../../shared/ui/tableStyles.js';
import { formatProgressScore, progressLabelOf } from '../domain/session-ui.js';
import { ConnectionStatus } from '../../../shared/ui/ConnectionStatus.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { allowRemainingMinutes } from '../domain/disconnect-summary.js';
import { formatClock } from '../../../shared/format/date.js';
import { NameCell } from './NameCell.js';

/** Admitted members with their progress (after start), rename and kick. */
export function ParticipantsCard({ status, questionCount, active, working, finalized, showEmail = false, onRename, onKick, onAllow, onResolveEdit }: {
  status: SessionDetail['status']; questionCount: number; active: SessionParticipantDetail[]; working: boolean; finalized: boolean;
  /** Roster sessions: a column with each person's email. Shown to the mentor only (PRODUCT.md §7.24). */
  showEmail?: boolean;
  onRename: (id: number, name: string) => Promise<boolean>; onKick: (p: SessionParticipantDetail) => void;
  /** "Cho vào lại" ahead of time for someone who dropped off (PRODUCT.md §7.23e). */
  onAllow: (p: SessionParticipantDetail) => void;
  /** Approve or reject a request to edit essays after submitting (PRODUCT.md §7.21). */
  onResolveEdit: (id: number, decision: 'approve' | 'reject') => void;
}) {
  const showProgress = status !== 'draft' && status !== 'lobby';
  const open = status === 'lobby' || status === 'running';
  const lobby = status === 'lobby'; // who pressed "Sẵn sàng" (PRODUCT.md §7.31d): the mentor sees names, members only the count
  const now = Date.now();
  return (
    <Card padding={0} style={{ flex: '1 1 520px', minWidth: 0, overflowX: 'auto' }}>
      <div style={{ padding: '16px 16px 6px', font: 'var(--type-h2)', fontSize: 16, color: 'var(--text-title)' }}>Người tham gia · {active.length}</div>
      {active.length === 0 ? (
        <p style={{ margin: 0, padding: '8px 16px 20px', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
          {status === 'draft' ? 'Mở phòng chờ để member bắt đầu vào.' : 'Chưa có ai vào phiên.'}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Tên</th>{showEmail && <th style={th}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Email<span title="Chỉ mentor thấy" style={{ display: 'inline-flex' }}><Icon name="eye-off" size={13} /></span></span></th>}{open && <th style={th}>Kết nối</th>}{lobby && <th style={th}>Sẵn sàng</th>}{showProgress && <><th style={th}>Tiến độ</th><th style={th}>Nộp lúc</th><th style={th}>Điểm tạm tính</th></>}<th style={th} /></tr></thead>
          <tbody>
            {active.map(p => {
              const req = p.progress.editRequest?.status === 'pending' ? p.progress.editRequest : null;
              const prog = progressLabelOf(p.progress, questionCount);
              // A pending request sticks to its person's row: same background, no rule between, a sun bar on the left.
              const bar = req ? { boxShadow: 'inset 3px 0 0 var(--sun-500)' } : {};
              const cell = req ? { ...td, borderBottom: 0 } : td;
              return (
                <Fragment key={p.id}>
                  <tr style={req ? { background: 'var(--sun-100)' } : undefined}>
                    <td style={{ ...cell, ...bar }}><NameCell p={p} disabled={working} readOnly={finalized} onSave={name => onRename(p.id, name)} /></td>
                    {showEmail && <td style={{ ...cell, fontFamily: 'var(--font-mono)', fontSize: 13, overflowWrap: 'anywhere', color: 'var(--text-body)' }}>{p.email ?? '—'}</td>}
                    {open && (
                      <td style={{ ...cell, ...bar }}>
                        <ConnectionStatus online={p.connection.online} lastSeenAt={p.connection.lastSeenAt} />
                        {allowRemainingMinutes(p.rejoinAllowedUntil, now) !== null && <div style={{ font: 'var(--type-meta)', color: 'var(--brand-700)' }}>Cho vào lại · còn {allowRemainingMinutes(p.rejoinAllowedUntil, now)} phút</div>}
                      </td>
                    )}
                    {lobby && (
                      <td style={cell}>
                        {p.readyAt !== null
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--correct-surface)', color: 'var(--correct-600)', border: '1px solid var(--correct-border)', font: 'var(--type-label)' }}><Icon name="check" size={12} />Sẵn sàng</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--type-meta)', color: 'var(--text-faint)' }}><Icon name="minus" size={12} />Chưa</span>}
                      </td>
                    )}
                    {showProgress && <>
                      <td style={{ ...cell, color: prog.color, fontWeight: req ? 600 : undefined }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{prog.icon && <Icon name={prog.icon} size={14} />}{prog.label}</span></td>
                      <td className="pq-tabular" style={{ ...cell, fontFamily: 'var(--font-mono)', color: 'var(--text-body)' }}>{p.progress.submittedAt === null ? '—' : formatClock(p.progress.submittedAt)}</td>
                      <td className="pq-tabular" style={{ ...cell, fontFamily: 'var(--font-mono)' }}>{formatProgressScore(p.progress)}</td>
                    </>}
                    <td style={{ ...cell, textAlign: 'right' }}>
                      {open && !p.connection.online && allowRemainingMinutes(p.rejoinAllowedUntil, now) === null && <Button size="sm" variant="secondary" icon="door-open" disabled={working} onClick={() => onAllow(p)}>Cho vào lại</Button>}
                      {!finalized && <Button size="sm" variant="ghost" icon="user-x" disabled={working} onClick={() => onKick(p)}>Kick</Button>}
                    </td>
                  </tr>
                  {req && (
                    <tr style={{ background: 'var(--sun-100)' }}>
                      <td colSpan={(showProgress ? 5 : 2) + (showEmail ? 1 : 0) + (open ? 1 : 0) + (lobby ? 1 : 0)} style={{ ...td, ...bar, whiteSpace: 'normal', paddingTop: 0, color: 'var(--sun-ink)' }}>
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
