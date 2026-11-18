import { useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import type { SessionDetail } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { SessionSlot } from '../../../shared/ui/SessionSlot.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import { useSessionDetail } from '../application/session-admin-context.js';
import { ACTION_FOR_STATUS } from '../domain/session-ui.js';
import { readPref, writePref, PREF_KEYS } from '../../../shared/storage/prefs.js';
import { shouldRemindToSave } from '../domain/access-ui.js';
import { massDisconnect } from '../domain/disconnect-summary.js';
import { formatClock } from '../../../shared/format/date.js';
import { RejoinRequestsBlock } from './RejoinRequestsBlock.js';
import { AccessCard } from './AccessCard.js';
import { JoinCard } from './JoinCard.js';
import { ParticipantsCard } from './ParticipantsCard.js';
import { PendingCard } from './PendingCard.js';
import { AddEmailsDialog, SaveGroupDialog } from './RosterDialogs.js';
import { SaveGroupBanner } from './SaveGroupBanner.js';
import { ScoresCard } from './ScoresCard.js';
import { TimeLimitCard } from './TimeLimitCard.js';
import { StartCard } from './StartCard.js';
import { earlyStartWarning } from '../domain/start-ui.js';
import { Countdown } from '../../../shared/ui/Countdown.js';
import { useCountdown } from '../../../shared/hooks/useCountdown.js';

// "/admin/sessions/:id" — the mentor's control page: lifecycle step, who is in, who waits, how to join.
function SessionDetailView({ initial }: { initial: SessionDetail }) {
  const nav = useNavigate();
  const { state, ctrl } = useSessionDetail(initial);
  const { detail, error, working, dialog, notice } = state;
  const [reminderOff, setReminderOff] = useState(() => readPref(PREF_KEYS.saveReminderOff(initial.id)) === '1');
  const spec = ACTION_FOR_STATUS[detail.status];
  const active = detail.participants.filter(p => p.status === 'active');
  const pending = detail.participants.filter(p => p.status === 'pending');
  const finalized = detail.status === 'finalized'; // results are official: no more renaming or kicking
  const finished = detail.status === 'closed' || finalized;
  const kicking = dialog?.kind === 'kick' ? dialog.p : null;
  const open = detail.status === 'lobby' || detail.status === 'running';
  const mass = open ? massDisconnect(detail.participants, Date.now()) : null;
  const impostor = dialog?.kind === 'impostor' ? dialog.request : null;
  const holderOf = (participantId: number) => detail.participants.find(p => p.id === participantId);
  const left = useCountdown(detail.status === 'running' ? detail.timer : null);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <button onClick={() => nav('/admin/sessions')} style={{ justifySelf: 'start', display: 'inline-flex', gap: 6, alignItems: 'center', background: 'none', border: 0, padding: 0, color: 'var(--text-meta)', font: 'var(--type-meta)', cursor: 'pointer' }}>
        <Icon name="arrow-left" size={14} />Phiên thi
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {detail.slot !== null && <SessionSlot n={detail.slot} size={28} />}
        <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0, overflowWrap: 'anywhere' }}>{detail.name}</h1>
          {detail.name !== detail.exam.title && <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Đề: {detail.exam.title}</span>}
        </div>
        <StatusBadge status={detail.status} />
        {left !== null && <Countdown ms={left} size="sm" announce={false} />}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" icon="presentation" onClick={() => window.open(`/screen/${detail.id}`, '_blank')}>Mở màn hình chiếu</Button>
          {finished && (
            <>
              <Button variant="secondary" icon="message-square" onClick={() => nav(`/admin/sessions/${detail.id}/discuss`)}>Thảo luận</Button>
              <Button variant="secondary" icon="list-checks" onClick={() => nav(`/admin/sessions/${detail.id}/review`)}>Xem lại phiên</Button>
            </>
          )}
          {detail.status === 'closed' && detail.exam.hasEssay && <Button variant="secondary" icon="pencil" onClick={() => nav(`/admin/sessions/${detail.id}/grading`)}>Chấm tự luận</Button>}
          {spec && !detail.start?.countdownEndsAt && (
            <Button icon={spec.icon} variant={spec.variant} loading={working && !dialog} onClick={() => (spec.confirm ? ctrl.openDialog({ kind: 'action' }) : void ctrl.doAction())}>{spec.label}</Button>
          )}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {notice && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--correct-surface, var(--brand-050))', color: 'var(--correct-600)', font: 'var(--type-ui)' }}>
          <Icon name="circle-check" size={16} /><span style={{ flex: 1 }}>{notice}</span><Button size="sm" variant="ghost" onClick={() => ctrl.dismissNotice()}>Đóng</Button>
        </div>
      )}
      {mass && (
        <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--warn-surface, var(--sun-100))', color: 'var(--sun-ink)', border: '1px solid var(--sun-300)', font: 'var(--type-ui)' }}>
          <Icon name="wifi-off" size={18} style={{ marginTop: 2 }} />
          <span><b>{mass.count} người ngắt kết nối cùng lúc ({formatClock(mass.since)})</b> — thường do Wi-Fi của lớp. Bài của họ vẫn được giữ. Ai chỉ mất mạng rồi có lại thì trình duyệt tự nối lại; ai phải mở bằng máy khác sẽ gửi yêu cầu xin vào lại cho bạn.</span>
        </div>
      )}
      <RejoinRequestsBlock detail={detail} working={working} onKeep={id => void ctrl.answerRejoin(id, 'keep')} onReject={id => void ctrl.answerRejoin(id, 'reject')}
        onImpostor={id => { const r = detail.rejoinRequests.find(x => x.id === id); if (r) ctrl.openDialog({ kind: 'impostor', request: r }); }} />
      {detail.roster && shouldRemindToSave(detail, reminderOff) && (
        <SaveGroupBanner count={detail.roster.size} onSave={() => ctrl.openDialog({ kind: 'saveGroup' })} onLater={() => { writePref(PREF_KEYS.saveReminderOff(detail.id), '1'); setReminderOff(true); }} />
      )}

      {(detail.status === 'draft' || detail.status === 'lobby') && (
        <StartCard detail={detail} working={working} onSchedule={at => void ctrl.setStartSchedule(at)} onAutoStart={(on, min) => void ctrl.setAutoStart(on, min)}
          onStartNow={() => ctrl.openDialog({ kind: 'action' })} onCancel={() => void ctrl.cancelCountdown()} />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <ParticipantsCard status={detail.status} questionCount={detail.exam.questionCount} active={active} working={working} finalized={finalized} showEmail={detail.access === 'roster'} onAllow={p => void ctrl.allowRejoin(p.id, p.displayName)} onRename={(id, name) => ctrl.rename(id, name)} onResolveEdit={(id, decision) => void ctrl.resolveEdit(id, decision)} onKick={p => ctrl.openDialog({ kind: 'kick', p })} />
        <div style={{ display: 'grid', gap: 20, flex: '1 1 300px', maxWidth: 420 }}>
          <JoinCard status={detail.status} roomCode={detail.roomCode} />
          <TimeLimitCard detail={detail} left={left} working={working} onSave={m => void ctrl.setTimeLimit(m)} onExtend={m => void ctrl.extendTime(m)} />
          <ScoresCard detail={detail} working={working} onChange={v => void ctrl.setScoreVisibility(v)} onRelease={() => ctrl.openDialog({ kind: 'releaseScores' })} />
          <AccessCard detail={detail} working={working} onAdd={() => ctrl.openDialog({ kind: 'addRoster' })} onSave={() => ctrl.openDialog({ kind: 'saveGroup' })} />
          {pending.length > 0 && <PendingCard status={detail.status} pending={pending} working={working} onApprove={id => void ctrl.approve(id)} onApproveAll={() => void ctrl.approveAll(pending)} onReject={p => ctrl.openDialog({ kind: 'kick', p })} />}
        </div>
      </div>

      <AddEmailsDialog key={dialog?.kind === 'addRoster' ? 'open' : 'closed'} open={dialog?.kind === 'addRoster'} busy={working} onCancel={() => ctrl.closeDialog()} onSubmit={emails => void ctrl.addRoster(emails)} />
      <SaveGroupDialog key={dialog?.kind === 'saveGroup' ? 'open' : 'closed'} open={dialog?.kind === 'saveGroup'} busy={working} count={detail.roster?.size ?? 0} onCancel={() => ctrl.closeDialog()} onSubmit={name => void ctrl.saveGroup(name)} />

      <ConfirmDialog open={dialog?.kind === 'action' && !!spec?.confirm} tone={spec?.variant ?? 'primary'} title={spec?.confirm?.title ?? ''} confirmLabel={spec?.confirm?.confirmLabel} busy={working} onCancel={() => ctrl.closeDialog()} onConfirm={() => ctrl.doAction()}>
        {spec?.confirm?.body(active.length)}
        {detail.status === 'lobby' && earlyStartWarning(detail, Date.now()) && <p style={{ margin: '8px 0 0', color: 'var(--warn-600)', fontWeight: 600 }}>{earlyStartWarning(detail, Date.now())}</p>}
      </ConfirmDialog>

      <ConfirmDialog open={dialog?.kind === 'releaseScores'} title="Công bố điểm?" confirmLabel="Công bố điểm" busy={working} onCancel={() => ctrl.closeDialog()} onConfirm={() => void ctrl.releaseScores()}>
        {detail.status === 'running' && active.some(p => p.progress.state !== 'submitted')
          ? `Còn ${active.filter(p => p.progress.state !== 'submitted').length} người chưa nộp. Họ sẽ thấy bảng xếp hạng trong lúc đang làm. Công bố rồi không ẩn lại được.`
          : 'Học viên và màn chiếu sẽ thấy điểm và bảng xếp hạng ngay. Công bố rồi không ẩn lại được.'}
      </ConfirmDialog>

      <ConfirmDialog open={impostor !== null} tone="danger" title="Mời người đang giữ chỗ ra?" confirmLabel={impostor ? `Mời ra, cho “${impostor.claimantName}” vào` : 'Xác nhận'} cancelLabel="Quay lại" busy={working}
        onCancel={() => ctrl.closeDialog()} onConfirm={() => impostor && void ctrl.answerRejoin(impostor.id, 'takeover')}>
        {impostor && (
          <div style={{ display: 'grid', gap: 8 }}>
            <span>“{holderOf(impostor.participantId)?.displayName ?? 'Người đang giữ chỗ'}” sẽ bị mời ra và <b>mất lượt làm bài</b>. Không hoàn tác được.</span>
            <span>“{impostor.claimantName}” vào như người mới, với email của chỗ này.</span>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog open={kicking !== null} tone="danger" title={kicking ? `${kicking.status === 'pending' ? 'Từ chối' : 'Kick'} ${kicking.displayName}?` : ''} confirmLabel={kicking?.status === 'pending' ? 'Từ chối' : 'Kick'} busy={working} onCancel={() => ctrl.closeDialog()} onConfirm={() => ctrl.kickConfirmed()}>
        {kicking?.status === 'pending' ? 'Người này sẽ không vào được phiên (họ có thể xin vào lại bằng cách nhập tên và mã phòng).' : 'Người này sẽ bị loại khỏi phiên và không xuất hiện trên bảng xếp hạng.'}
      </ConfirmDialog>
    </div>
  );
}

export function SessionDetailPage() {
  const initial = useLoaderData() as SessionDetail;
  return <SessionDetailView key={initial.id} initial={initial} />;
}
