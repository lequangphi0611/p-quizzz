import { useLoaderData, useNavigate } from 'react-router';
import type { SessionDetail } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import { useSessionDetail } from '../application/session-admin-context.js';
import { ACTION_FOR_STATUS } from '../domain/session-ui.js';
import { JoinCard } from './JoinCard.js';
import { ParticipantsCard } from './ParticipantsCard.js';
import { PendingCard } from './PendingCard.js';

// "/admin/sessions/:id" — the mentor's control page: lifecycle step, who is in, who waits, how to join.
function SessionDetailView({ initial }: { initial: SessionDetail }) {
  const nav = useNavigate();
  const { state, ctrl } = useSessionDetail(initial);
  const { detail, error, working, dialog } = state;
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
        <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>{detail.exam.title}</h1>
        <StatusBadge status={detail.status} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" icon="presentation" onClick={() => window.open('/screen', '_blank')}>Mở màn hình chiếu</Button>
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <ParticipantsCard status={detail.status} active={active} working={working} finalized={finalized} onRename={(id, name) => ctrl.rename(id, name)} onResolveEdit={(id, decision) => void ctrl.resolveEdit(id, decision)} onKick={p => ctrl.openDialog({ kind: 'kick', p })} />
        <div style={{ display: 'grid', gap: 20, flex: '1 1 300px', maxWidth: 420 }}>
          <JoinCard status={detail.status} roomCode={detail.roomCode} />
          {pending.length > 0 && <PendingCard status={detail.status} pending={pending} working={working} onApprove={id => void ctrl.approve(id)} onApproveAll={() => void ctrl.approveAll(pending)} onReject={p => ctrl.openDialog({ kind: 'kick', p })} />}
        </div>
      </div>

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
