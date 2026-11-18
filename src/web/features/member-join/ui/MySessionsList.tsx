import { useEffect, useState } from 'react';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import { PageCard, mText } from '../../../shared/ui/member/member-shell.js';
import type { MemberHomeController } from '../application/member-home-controller.js';
import type { MySession } from '../domain/my-sessions.js';

const STATUS_LABEL = { draft: 'Nháp', lobby: 'Phòng chờ', running: 'Đang diễn ra', closed: 'Đã kết thúc', finalized: 'Đã chốt kết quả' } as const;

const joinedLabel = (ms: number) => ms > 0
  ? `Vào lúc ${new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
  : '';

/**
 * "Phiên của bạn trên máy này" (PRODUCT.md §7.29), under the room-code form: sessions this browser joined and can
 * still open (the result and "Xem lại bài" once a session has ended). Exam title only, never the mentor's session name.
 * Hidden when there is nothing to list.
 */
export function MySessionsList({ desk, sessions, ctrl }: { desk: boolean; sessions: MySession[]; ctrl: MemberHomeController }) {
  const [forgetting, setForgetting] = useState<MySession | null>(null);
  const count = sessions.length;
  useEffect(() => { if (count > 0) void ctrl.refreshMine(); }, [ctrl, count > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  if (count === 0) return null;

  return (
    <section aria-labelledby="pq-my-sessions">
      <PageCard desk={desk}>
        <div style={{ display: 'grid', gap: 4 }}>
          <h2 id="pq-my-sessions" style={{ ...mText.label, color: 'var(--text-title)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Icon name="monitor" size={16} />Phiên của bạn trên máy này
          </h2>
          <p style={mText.meta}>Mở lại để xem kết quả và xem lại bài của bạn.</p>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {sessions.map(s => (
            <li key={s.sessionId} style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-md)', background: 'var(--paper)' }}>
              <button type="button" onClick={() => ctrl.openMine(s.sessionId)}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px 12px 14px', background: 'transparent', border: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', borderRadius: 'var(--radius-md)' }}>
                <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
                  <span style={{ font: 'var(--type-ui)', fontWeight: 600, color: 'var(--text-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || 'Phiên đã tham gia'}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', ...mText.meta }}>
                    {s.status && <StatusBadge status={s.status} label={STATUS_LABEL[s.status]} />}
                    <span>{joinedLabel(s.joinedAt)}</span>
                  </span>
                </span>
                <Icon name="chevron-right" size={18} style={{ color: 'var(--text-meta)' }} />
              </button>
              <Button variant="ghost" icon="trash-2" ariaLabel={`Xoá “${s.title || 'phiên này'}” khỏi máy này`} onClick={() => setForgetting(s)} style={{ marginRight: 6 }} />
            </li>
          ))}
        </ul>
      </PageCard>
      <ConfirmDialog open={!!forgetting} tone="danger" title="Xoá khỏi máy này?" confirmLabel="Xoá khỏi máy này"
        onCancel={() => setForgetting(null)}
        onConfirm={() => { if (forgetting) ctrl.forgetMine(forgetting.sessionId); setForgetting(null); }}>
        Máy này sẽ quên phiên “{forgetting?.title || 'này'}”. Bạn sẽ <b>không mở lại được</b> kết quả và bài làm của phiên này từ máy này nữa. Bài làm vẫn được lưu ở máy mentor.
      </ConfirmDialog>
    </section>
  );
}
