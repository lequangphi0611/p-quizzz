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
import { AccessCard } from './AccessCard.js';
import { JoinCard } from './JoinCard.js';
import { ParticipantsCard } from './ParticipantsCard.js';
import { PendingCard } from './PendingCard.js';
import { AddEmailsDialog, SaveGroupDialog } from './RosterDialogs.js';
import { SaveGroupBanner } from './SaveGroupBanner.js';

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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" icon="presentation" onClick={() => window.open(`/screen/${detail.id}`, '_blank')}>Mở màn hình chiếu</Button>
          {finished && (
            <>
              <Button variant="secondary" icon="message-square" onClick={() => nav(`/admin/sessions/${detail.id}/discuss`)}>Thảo luận</Button>
              <Button variant="secondary" icon="list-checks" onClick={() => nav(`/admin/sessions/${detail.id}/review`)}>Xem lại phiên</Button>
            </>
          )}
          {detail.status === 'closed' && detail.exam.hasEssay && <Button variant="secondary" icon="pencil" onClick={() => nav(`/admin/sessions/${detail.id}/grading`)}>Chấm tự luận</Button>}
          {spec && (
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
      {detail.roster && shouldRemindToSave(detail, reminderOff) && (
        <SaveGroupBanner count={detail.roster.size} onSave={() => ctrl.openDialog({ kind: 'saveGroup' })} onLater={() => { writePref(PREF_KEYS.saveReminderOff(detail.id), '1'); setReminderOff(true); }} />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <ParticipantsCard status={detail.status} active={active} working={working} finalized={finalized} showEmail={detail.access === 'roster'} onRename={(id, name) => ctrl.rename(id, name)} onResolveEdit={(id, decision) => void ctrl.resolveEdit(id, decision)} onKick={p => ctrl.openDialog({ kind: 'kick', p })} />
        <div style={{ display: 'grid', gap: 20, flex: '1 1 300px', maxWidth: 420 }}>
          <JoinCard status={detail.status} roomCode={detail.roomCode} />
          <AccessCard detail={detail} working={working} onAdd={() => ctrl.openDialog({ kind: 'addRoster' })} onSave={() => ctrl.openDialog({ kind: 'saveGroup' })} />
          {pending.length > 0 && <PendingCard status={detail.status} pending={pending} working={working} onApprove={id => void ctrl.approve(id)} onApproveAll={() => void ctrl.approveAll(pending)} onReject={p => ctrl.openDialog({ kind: 'kick', p })} />}
        </div>
      </div>

      <AddEmailsDialog key={dialog?.kind === 'addRoster' ? 'open' : 'closed'} open={dialog?.kind === 'addRoster'} busy={working} onCancel={() => ctrl.closeDialog()} onSubmit={emails => void ctrl.addRoster(emails)} />
      <SaveGroupDialog key={dialog?.kind === 'saveGroup' ? 'open' : 'closed'} open={dialog?.kind === 'saveGroup'} busy={working} count={detail.roster?.size ?? 0} onCancel={() => ctrl.closeDialog()} onSubmit={name => void ctrl.saveGroup(name)} />

      <ConfirmDialog open={dialog?.kind === 'action' && !!spec?.confirm} tone={spec?.variant ?? 'primary'} title={spec?.confirm?.title ?? ''} confirmLabel={spec?.confirm?.confirmLabel} busy={working} onCancel={() => ctrl.closeDialog()} onConfirm={() => ctrl.doAction()}>
        {spec?.confirm?.body(active.length)}
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
