import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../shared/ui/Icon.js';
import type { MentorNoticesState } from '../application/use-mentor-notices.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { RejoinRequestCard } from '../../../shared/ui/RejoinRequestCard.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { SessionSlot } from '../../../shared/ui/SessionSlot.js';
import { isBellShortcut } from '../../../shared/ui/session-shortcuts.js';
import { attentionFirst, EDIT_OUTCOME, needsAttention, NOTICE_TEXT, type MentorNotice } from '../domain/mentor-notices.js';
import type { DesktopNotifyStatus } from './useDesktopNotify.js';

const time = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

// Bell in the mentor header: a count of unread joins/submissions across ALL open sessions (each notice names its
// session), and a dropdown listing them. Pending joiners can be approved right here without leaving the page.
// Keys: N opens/closes it, ↑/↓ move through the list, Enter opens the highlighted notice's session, Esc closes.
export interface DesktopNotifyControl { status: DesktopNotifyStatus; enable: () => void; disable: () => void }

export function NotificationBell({ state, desktop, onOpenSession }: { state: MentorNoticesState; desktop?: DesktopNotifyControl; onOpenSession: (id: number) => void }) {
  const { sessions, notices: allNotices, unread, pending, editPending, rejoinPending, handledRejoin, seen, markAllSeen, approve: approveRemote, resolveEdit, answerRejoin } = state;
  const [impostor, setImpostor] = useState<MentorNotice | null>(null);
  const [filter, setFilter] = useState<'all' | number>('all');
  const activeFilter = filter !== 'all' && sessions.some(x => x.id === filter) ? filter : 'all'; // a closed session drops out of the filter
  const notices = activeFilter === 'all' ? allNotices : allNotices.filter(n => n.sessionId === activeFilter);
  const ordered = attentionFirst(notices);
  const [cursor, setCursor] = useState(-1);
  const attention = pending + editPending + rejoinPending; // things only the mentor can unblock
  const [open, setOpen] = useState(false);
  const [approving, setApproving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const seenWhenOpened = useRef(seen); // keep "new" highlights while the list stays open

  const openSession = (id: number) => { setOpen(false); onOpenSession(id); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isBellShortcut(e)) { e.preventDefault(); setOpen(o => !o); setCursor(-1); return; }
      if (!open) return;
      if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(ordered.length - 1, c + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
      else if (e.key === 'Enter' && cursor >= 0 && ordered[cursor] && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); openSession(ordered[cursor]!.sessionId); }
    };
    const onDown = (e: MouseEvent) => { if (open && !root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  });

  // Everything visible while the list is open counts as read (also new items arriving meanwhile).
  useEffect(() => { if (open) markAllSeen(); }, [open, markAllSeen]);

  function toggle() {
    if (!open) { seenWhenOpened.current = seen; setError(null); setCursor(-1); }
    setOpen(o => !o);
  }

  async function approve(participantId: number) {
    setApproving(participantId);
    setError(null);
    try { await approveRemote(participantId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không duyệt được'); }
    finally { setApproving(null); }
  }

  async function rejoin(n: MentorNotice, answer: 'keep' | 'takeover' | 'reject') {
    setApproving(n.participantId);
    setError(null);
    try { await answerRejoin(n, answer); setImpostor(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không xử lý được yêu cầu vào lại'); setImpostor(null); }
    finally { setApproving(null); }
  }

  async function resolve(participantId: number, decision: 'approve' | 'reject') {
    setApproving(participantId);
    setError(null);
    try { await resolveEdit(participantId, decision); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không xử lý được yêu cầu'); }
    finally { setApproving(null); }
  }

  const label = unread > 0 ? `Thông báo: ${unread} mới` : attention > 0 ? `Thông báo: ${attention} việc đang chờ bạn` : 'Thông báo';
  return (
    <div ref={root} style={{ position: 'relative' }}>
      <button onClick={toggle} aria-label={label} title={label} aria-expanded={open} aria-haspopup="dialog"
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: open ? 'var(--ink-800)' : 'none', border: 0, borderRadius: 'var(--radius-sm)', color: unread > 0 || attention > 0 ? '#fff' : 'var(--ink-300)', cursor: 'pointer' }}>
        <Icon name="bell" size={18} />
        {unread > 0 ? (
          <span aria-hidden="true" style={{ position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 'var(--radius-pill)', background: 'var(--sun-400)', color: 'var(--ink-900)', font: '700 11px/18px var(--font-sans)', textAlign: 'center' }}>{unread > 99 ? '99+' : unread}</span>
        
        ) : attention > 0 ? (
          <span aria-hidden="true" style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: 'var(--sun-400)' }} />
        ) : null}
      </button>

      {open && (
        <div role="dialog" aria-label="Thông báo" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, width: 360, maxWidth: 'calc(100vw - 32px)', background: 'var(--paper)', color: 'var(--text-body)', borderRadius: 'var(--radius-md, 10px)', boxShadow: '0 12px 32px rgba(15,23,42,.22)', border: '1px solid var(--border-hairline)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)', display: 'grid', gap: 2 }}>
            <span style={{ font: 'var(--type-ui)', fontWeight: 700, color: 'var(--text-title)' }}>Thông báo</span>
            <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>{sessions.length > 0 ? `${sessions.length} phiên đang mở · N để đóng · Esc` : 'Không có phiên nào đang mở'}</span>
            {sessions.length > 1 && (
              <div style={{ marginTop: 8, overflowX: 'auto' }}>
                <SegmentedControl size="sm" ariaLabel="Lọc thông báo theo phiên" value={activeFilter} onChange={setFilter}
                  items={[{ value: 'all' as const, label: 'Tất cả', count: unread }, ...sessions.map(x => ({ value: x.id as number | 'all', label: x.name, slot: x.slot, count: x.unread }))]} />
              </div>
            )}
          </div>

          {sessions.filter(x => x.pending + x.editPending + x.rejoinPending > 0 && (activeFilter === 'all' || x.id === activeFilter)).map(x => (
            <button key={x.id} onClick={() => openSession(x.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--sun-100)', color: 'var(--sun-ink)', border: 0, borderBottom: '1px solid var(--border-hairline)', font: 'var(--type-meta)', cursor: 'pointer', textAlign: 'left' }}>
              <Icon name="hourglass" size={16} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{x.pending + x.editPending + x.rejoinPending} việc đang chờ bạn</b>{sessions.length > 1 && <> · <SessionSlot n={x.slot} size={16} /> {x.name}</>}<br />
                {[x.pending > 0 && `${x.pending} vào phòng`, x.rejoinPending > 0 && `${x.rejoinPending} xin vào lại`, x.editPending > 0 && `${x.editPending} sửa bài`].filter(Boolean).join(' · ')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600, flex: 'none' }}>Mở phiên<Icon name="chevron-right" size={14} /></span>
            </button>
          ))}
          {error && <div role="alert" style={{ padding: '8px 16px', font: 'var(--type-meta)', color: 'var(--wrong-600)', borderBottom: '1px solid var(--border-hairline)' }}>{error}</div>}

          {sessions.length > 0 && notices.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 360, overflowY: 'auto' }}>
              {ordered.map((n, i) => {
                if (n.kind === 'rejoin' && n.rejoin) {
                  return (
                    <li key={n.key} aria-current={i === cursor ? 'true' : undefined} style={{ display: 'grid', gap: 6, padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)', background: i === cursor ? 'var(--ink-100)' : undefined, boxShadow: 'inset 3px 0 0 var(--sun-500)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--type-meta)', fontWeight: 700, color: 'var(--sun-ink)' }}><Icon name="door-open" size={14} />Xin vào lại</span>
                      {sessions.length > 1 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--type-meta)', color: 'var(--text-faint)' }}><SessionSlot n={n.slot} size={16} />{n.sessionName}</span>}
                      <RejoinRequestCard layout="bell" busy={approving !== null}
                        request={{ id: n.rejoin.requestId, requestedAt: n.at, claimantName: n.rejoin.claimantName, holderName: n.rejoin.holderName, holderEmail: n.rejoin.holderEmail, holderOnline: n.rejoin.holderOnline, holderLastSeenAt: n.rejoin.holderLastSeenAt }}
                        onKeep={() => void rejoin(n, 'keep')} onReject={() => void rejoin(n, 'reject')} onImpostor={() => setImpostor(n)} />
                    </li>
                  );
                }
                const meta = NOTICE_TEXT[n.kind];
                const fresh = n.at > (seenWhenOpened.current[n.sessionId] ?? 0);
                const out = n.kind === 'edit' && n.editStatus && n.editStatus !== 'pending' ? EDIT_OUTCOME[n.editStatus] : null;
                const editing = n.kind === 'edit' && n.editStatus === 'pending';
                return (
                  <li key={n.key} aria-current={i === cursor ? 'true' : undefined} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0,1fr) auto', gap: 10, alignItems: 'start', padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)', background: i === cursor ? 'var(--ink-100)' : fresh ? 'var(--brand-050)' : undefined, boxShadow: needsAttention(n) ? 'inset 3px 0 0 var(--sun-500)' : undefined }}>
                    <span style={{ paddingTop: 2 }}><Icon name={meta.icon} size={16} color={n.kind === 'edit' && !editing ? 'var(--ink-500)' : meta.color} /></span>
                    <div style={{ display: 'grid', gap: 4, minWidth: 0, font: 'var(--type-meta)', gridColumn: editing ? '2 / 4' : undefined }}>
                      <span><strong style={{ color: 'var(--text-title)', wordBreak: 'break-word' }}>{n.displayName}</strong> {n.kind === 'pending' ? 'đang chờ vào phòng' : n.kind === 'start-soon' ? `sắp tự bắt đầu lúc ${time(n.startAt ?? n.at)}, còn ${n.waiting} người chờ duyệt` : meta.text}</span>
                      {n.kind === 'start-soon' && <span style={{ color: 'var(--text-body)' }}>Người chưa duyệt vào sau sẽ mất giờ. Duyệt ngay ở trên, hoặc mở phòng để lùi giờ.</span>}
                      {n.kind === 'start-dropped' && <span style={{ color: 'var(--text-body)' }}>Phòng vẫn đang chờ, học viên thấy “Chờ mentor bắt đầu”. Mở phòng để hẹn lại hoặc bắt đầu.</span>}
                      {(n.kind === 'start-soon' || n.kind === 'start-dropped') && (
                        // No "Bắt đầu ngay" here: the bell gathers every room, so it is too easy to start the wrong one (PRODUCT.md §7.31g).
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <Button size="sm" variant="secondary" icon={n.kind === 'start-dropped' ? 'calendar' : 'door-open'} onClick={() => openSession(n.sessionId)}>{n.kind === 'start-dropped' ? 'Hẹn lại' : 'Mở phòng'}</Button>
                        </div>
                      )}
                      {n.kind === 'edit' && n.reason && <span style={{ color: 'var(--text-body)', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>“{n.reason}”</span>}
                      {out && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, color: out.color }}><Icon name={out.icon} size={13} />{out.label}{n.resolvedAt ? ` · ${time(n.resolvedAt)}` : ''}</span>}
                      <span style={{ color: 'var(--text-faint)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        {sessions.length > 1 && <><SessionSlot n={n.slot} size={16} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.sessionName}</span><span>·</span></>}
                        <span style={{ whiteSpace: 'nowrap' }}>{time(n.at)}{fresh ? ' · mới' : ''}</span>
                      </span>
                      {editing && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <Button size="sm" icon="check" disabled={approving !== null} onClick={() => void resolve(n.participantId, 'approve')}>Duyệt</Button>
                          <Button size="sm" variant="secondary" icon="x" disabled={approving !== null} onClick={() => void resolve(n.participantId, 'reject')}>Từ chối</Button>
                        </div>
                      )}
                    </div>
                    {n.kind === 'pending' && <Button size="sm" icon="check" loading={approving === n.participantId} disabled={approving !== null} onClick={() => void approve(n.participantId)}>Duyệt</Button>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p style={{ margin: 0, padding: '20px 16px', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>{sessions.length > 0 ? 'Chưa có ai vào phiên.' : 'Thông báo người vào phiên và nộp bài sẽ hiện ở đây khi bạn mở phòng chờ.'}</p>
          )}

          {sessions.length === 1 && (
            <button onClick={() => openSession(sessions[0]!.id)} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 0, color: 'var(--text-link)', font: 'var(--type-meta)', fontWeight: 600, cursor: 'pointer' }}>Xem điều khiển phiên</button>
          )}
          {handledRejoin.length > 0 && (
            <ul aria-label="Đã xử lý" style={{ listStyle: 'none', margin: 0, padding: '8px 16px', borderTop: '1px solid var(--border-hairline)', display: 'grid', gap: 4, font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
              {handledRejoin.slice(0, 3).map(h => <li key={`${h.key}:${h.at}`}>{h.text} · {time(h.at)}</li>)}
            </ul>
          )}
          {desktop && <DesktopRow desktop={desktop} />}
        </div>
      )}

      <ConfirmDialog open={impostor !== null} tone="danger" title="Mời người đang giữ chỗ ra?" confirmLabel={impostor?.rejoin ? `Mời ra, cho “${impostor.rejoin.claimantName}” vào` : 'Xác nhận'} cancelLabel="Quay lại" busy={approving !== null}
        onCancel={() => setImpostor(null)} onConfirm={() => impostor && void rejoin(impostor, 'takeover')}>
        {impostor?.rejoin && (
          <div style={{ display: 'grid', gap: 8 }}>
            <span>“{impostor.rejoin.holderName}” sẽ bị mời ra và <b>mất lượt làm bài</b>. Không hoàn tác được.</span>
            <span>“{impostor.rejoin.claimantName}” vào như người mới, với email của chỗ này.</span>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

const linkBtn = { background: 'none', border: 0, padding: 0, color: 'var(--text-link)', font: 'var(--type-meta)', fontWeight: 600, cursor: 'pointer' } as const;

// Footer switch for OS notifications about pending joiners.
function DesktopRow({ desktop }: { desktop: DesktopNotifyControl }) {
  const { status, enable, disable } = desktop;
  const port = location.port ? `:${location.port}` : '';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border-hairline)', background: 'var(--surface-page)', font: 'var(--type-meta)', fontSize: 12, color: 'var(--text-meta)' }}>
      <Icon name="monitor" size={14} style={{ marginTop: 2 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        {status === 'on' && <>Đang bật thông báo desktop khi có người chờ duyệt. <button onClick={disable} style={linkBtn}>Tắt</button></>}
        {status === 'off' && <>Báo lên màn hình máy tính khi có người chờ duyệt, kể cả lúc bạn ở ứng dụng khác. <button onClick={enable} style={linkBtn}>Bật thông báo desktop</button></>}
        {status === 'denied' && <>Trình duyệt đang chặn thông báo của trang này. Cho phép lại trong cài đặt trang (biểu tượng ổ khoá/thông tin cạnh thanh địa chỉ), rồi tải lại trang.</>}
        {status === 'unsupported' && <>Thông báo desktop chỉ dùng được khi mở trang quản trị bằng <strong>http://localhost{port}</strong> (trình duyệt chặn khi mở bằng địa chỉ IP).</>}
      </span>
    </div>
  );
}
