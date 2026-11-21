import { useEffect } from 'react';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { TrainingDetail } from '../../../../shared/api/index.js';
import { formatDate } from '../../../shared/format/date.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Kbd } from '../../../shared/ui/Kbd.js';
import { useTraining } from '../application/use-training.js';
import type { TrainingController, TrainingState } from '../application/training-controller.js';
import { memberCountLabel } from '../domain/training-ui.js';
import { flagTotals } from '../domain/flags.js';
import { uninstallProgress } from '../domain/members.js';
import { FlagChip, TrainingStatusBadge, visuallyHidden } from './chips.js';
import { EventPanel } from './EventPanel.js';
import { MembersTable } from './MembersTable.js';
import { RoomCodeCard, RoomCodeInline } from './RoomCode.js';
import { Timeline } from './Timeline.js';
import { TrainingDialogs } from './TrainingDialogs.js';
import { useTrainingShortcuts } from './use-training-shortcuts.js';

// "/admin/trainings/:id": one AI training for the mentor (PRODUCT.md §7.34). The loader's answer seeds the page, which then
// follows the training live. The key restarts the page when the address points at another training.
export function TrainingPage() {
  const initial = useLoaderData() as TrainingDetail;
  return <TrainingView key={initial.id} initial={initial} />;
}

/** Keeps `?hv=<memberId>` in the address, so F5 keeps the choice. Written with history.replaceState: going through the router would run the loader again on every pick. */
function useMemberInUrl(memberId: number | null) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if ((Number(url.searchParams.get('hv')) || null) === memberId) return;
    if (memberId === null) url.searchParams.delete('hv'); else url.searchParams.set('hv', String(memberId));
    try { window.history.replaceState(window.history.state, '', url); } catch { /* the address just stays as it was */ }
  }, [memberId]);
}

function TrainingView({ initial }: { initial: TrainingDetail }) {
  const [params] = useSearchParams();
  const { state, ctrl } = useTraining(initial, Number(params.get('hv')) || null);
  const nav = useNavigate();
  const { detail } = state;
  useMemberInUrl(state.selectedId);

  // Esc and the close button hand the focus back to the button that opened the panel.
  const closePanel = () => {
    const p = ctrl.getState().panel;
    ctrl.closePanel();
    if (p) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-trigger="${p.eventId}-${p.kind}"]`)?.focus());
  };
  useTrainingShortcuts(ctrl, closePanel);

  const live = detail.status !== 'ended';
  const stopped = detail.status === 'stopped';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Header state={state} ctrl={ctrl} onBack={() => nav('/admin/trainings')} />
      {/* Words for a screen reader when a member or the training changes state. The table above is not a live region. */}
      <div role="status" aria-live="polite" style={visuallyHidden}>{state.announcement}</div>
      {state.offline && (
        <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--warn-surface)', border: '1px solid var(--warn-border)', color: 'var(--warn-600)', font: 'var(--type-meta)', fontSize: 14, fontWeight: 600 }}>
          <Icon name="cloud-off" size={18} />Mất kết nối với máy chủ. Dữ liệu bên dưới có thể đã cũ, đang thử lại…
        </div>
      )}
      {stopped && <StoppedBanner detail={detail} />}
      {!live ? <EndedCard state={state} onBack={() => nav('/admin/trainings')} /> : detail.members.length === 0 ? (
        detail.status === 'open' && detail.roomCode ? <RoomCodeCard roomCode={detail.roomCode} /> : (
          <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>Không có học viên nào trong buổi này.</p></Card>
        )
      ) : (
        <>
          <ClassSummary detail={detail} />
          <Workspace state={state} ctrl={ctrl} closePanel={closePanel} />
        </>
      )}
      <TrainingDialogs state={state} ctrl={ctrl} />
    </div>
  );
}

function Header({ state, ctrl, onBack }: { state: TrainingState; ctrl: TrainingController; onBack: () => void }) {
  const { detail, hidden } = state;
  const open = detail.status === 'open';
  const stopped = detail.status === 'stopped';
  const n = detail.status === 'ended' ? state.endedMemberCount : detail.members.length;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div>
        <button type="button" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'var(--type-meta)', fontWeight: 600, color: 'var(--text-link)' }}>
          <Icon name="arrow-left" size={14} />Buổi training AI
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0, overflowWrap: 'anywhere', minWidth: 0 }}>{detail.name}</h1>
        <TrainingStatusBadge status={detail.status} size="lg" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {detail.status !== 'ended' && (
            <Button variant="secondary" icon={hidden ? 'eye' : 'eye-off'} pressed={hidden} shortcut="H" onClick={() => ctrl.toggleHidden()}>{hidden ? 'Hiện nội dung' : 'Ẩn nội dung'}</Button>
          )}
          {detail.status !== 'ended' && detail.members.length > 0 && <Button variant="secondary" icon="download" onClick={() => void ctrl.openReport()}>Xuất báo cáo</Button>}
          {open && <Button variant="secondary" icon="square" onClick={() => ctrl.askStop()}>Dừng thu</Button>}
          {stopped && <Button variant="danger" icon="trash-2" onClick={() => ctrl.askEnd()}>Kết thúc</Button>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="clock" size={14} />Tạo lúc {formatDate(detail.createdAt)}</span>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="users" size={14} />{n === null ? '—' : memberCountLabel(n)}</span>
        {open && detail.roomCode && detail.members.length > 0 && <RoomCodeInline roomCode={detail.roomCode} />}
      </div>
    </div>
  );
}

// After "Dừng thu": the code is gone; how many machines removed the hook, how many still send. Counts only: names are in the table.
function StoppedBanner({ detail }: { detail: TrainingDetail }) {
  const p = uninstallProgress(detail);
  return (
    <>
      <div role="alert" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--sun-100)', border: '1px solid var(--sun-200)', color: 'var(--ink-900)' }}>
        <Icon name="info" size={20} style={{ marginTop: 2, color: 'var(--sun-ink)' }} />
        <div style={{ display: 'grid', gap: 4, font: 'var(--type-body)' }}>
          <strong>Đã dừng thu. Máy chủ không nhận thêm gì nữa và mã phòng đã hết hiệu lực.</strong>
          <span style={{ color: 'var(--ink-800)' }}>Nhắc lớp gỡ đoạn cấu hình khỏi máy của mình. Dữ liệu đã thu vẫn xem được; xem xong thì bấm <b>Kết thúc</b> để xoá hẳn.</span>
        </div>
      </div>
      {p && (
        <div aria-live="polite" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Stat icon="check" tone="muted" text={`Đã gỡ ${p.done}/${p.total}`} />
          {p.stillSending > 0 && <Stat icon="triangle-alert" tone="warn" text={`Còn ${p.stillSending} máy vẫn gửi`} hint="Nhắc lớp gỡ cấu hình." />}
        </div>
      )}
    </>
  );
}

// How many members have each flag: counts only, no names, no comparison, no ranking (PRODUCT.md §7.35d). Hidden when no flag is up.
function ClassSummary({ detail }: { detail: TrainingDetail }) {
  const totals = flagTotals(detail);
  if (totals.length === 0) return null;
  return (
    <section aria-label="Tổng hợp lớp" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', border: '1px solid var(--border-hairline)' }}>
      <strong style={{ font: 'var(--type-ui)', fontSize: 14, color: 'var(--text-title)' }}>Tổng hợp lớp</strong>
      {totals.map(t => (
        <span key={t.code} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FlagChip code={t.code} />
          <span style={{ font: 'var(--type-meta)', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-800)', fontWeight: 600 }}>{t.count}/{t.total} bạn</span>
        </span>
      ))}
      <span style={{ font: 'var(--type-meta)', fontSize: 12.5, color: 'var(--text-meta)' }}>Chỉ đếm, không có tên. Cờ là gợi ý, không phải điểm.</span>
    </section>
  );
}

function Stat({ icon, text, hint, tone }: { icon: string; text: string; hint?: string; tone: 'muted' | 'warn' }) {
  const warn = tone === 'warn';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-md)', background: warn ? 'var(--warn-surface)' : 'var(--ink-100)', border: `1px solid ${warn ? 'var(--warn-border)' : 'var(--ink-300)'}`, color: warn ? 'var(--warn-600)' : 'var(--ink-800)', font: 'var(--type-ui)', fontWeight: 700, fontSize: 16 }}>
      <Icon name={icon} size={18} />{text}{hint && <span style={{ font: 'var(--type-meta)', fontWeight: 500 }}>· {hint}</span>}
    </span>
  );
}

function EndedCard({ state, onBack }: { state: TrainingState; onBack: () => void }) {
  const { detail, endedMemberCount } = state;
  const row = (label: string, value: string) => (<><dt style={{ color: 'var(--text-meta)' }}>{label}</dt><dd style={{ margin: 0, fontWeight: 600, color: 'var(--text-title)' }}>{value}</dd></>);
  return (
    <Card title="Buổi này đã kết thúc" subtitle="Dữ liệu đã được xoá">
      <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 24px', margin: 0, font: 'var(--type-body)' }}>
          {row('Tên buổi', detail.name)}
          {row('Tạo lúc', formatDate(detail.createdAt))}
          {detail.stoppedAt !== null && row('Dừng thu lúc', formatDate(detail.stoppedAt))}
          {detail.endedAt !== null && row('Kết thúc lúc', formatDate(detail.endedAt))}
          {row('Số người', endedMemberCount === null ? '—' : String(endedMemberCount))}
        </dl>
        <p style={{ margin: 0, display: 'flex', gap: 10, font: 'var(--type-body)', color: 'var(--text-body)' }}>
          <Icon name="lock" size={18} style={{ marginTop: 3, flex: 'none' }} />
          Toàn bộ prompt, lệnh và output đã bị xoá vĩnh viễn khi bấm Kết thúc. Trang này chỉ còn tên buổi, thời gian và số người; không khôi phục được.
        </p>
        <div><Button variant="secondary" icon="arrow-left" onClick={onBack}>Về danh sách</Button></div>
      </div>
    </Card>
  );
}

// Members on one side, the picked member's timeline on the other; with the output panel open the members shrink to names.
// The workspace has a fixed height so the timeline scrolls inside it (new events follow the end while the mentor is there).
function Workspace({ state, ctrl, closePanel }: { state: TrainingState; ctrl: TrainingController; closePanel: () => void }) {
  const { detail, selectedId, timeline, panel, hidden, markError } = state;
  const member = detail.members.find(m => m.id === selectedId);
  const panelOpen = panel !== null && !hidden;
  const panelEvent = panel ? timeline?.events.find(e => e.id === panel.eventId) : undefined;
  const now = Date.now();
  return (
    <div style={{ display: 'grid', gap: 16, height: 'clamp(520px, calc(100vh - 330px), 860px)', gridTemplateColumns: panelOpen ? '220px minmax(0, 1fr) minmax(380px, 430px)' : 'minmax(0, 1.2fr) minmax(0, 1fr)' }}>
      <MembersTable members={detail.members} selectedId={selectedId} onSelect={id => ctrl.select(id)} onPurge={id => ctrl.askPurge(id)} compact={panelOpen} now={now} />
      {member && timeline ? (
        <Timeline member={member} timeline={timeline} panel={hidden ? null : panel} hidden={hidden} markError={markError} ctrl={ctrl} now={now} canRemove={detail.status !== 'ended'}
          onOpen={(id, kind) => void ctrl.openDetail(id, kind)} onRemove={() => ctrl.askRemove(member.id)} />
      ) : (
        <Card style={{ display: 'grid', placeItems: 'center', textAlign: 'center', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'grid', gap: 8, justifyItems: 'center', color: 'var(--text-meta)', font: 'var(--type-body)', maxWidth: 340 }}>
            <Icon name="list" size={28} />
            <strong style={{ color: 'var(--text-title)' }}>Chọn một học viên</strong>
            <span>Bấm tên ở bảng bên trái (hoặc dùng <Kbd>↑</Kbd> <Kbd>↓</Kbd> rồi <Kbd>Enter</Kbd>) để xem prompt và lệnh của họ.</span>
          </div>
        </Card>
      )}
      {panelOpen && panel && (
        <EventPanel panel={panel} event={panelEvent} onKind={k => void ctrl.openDetail(panel.eventId, k)} onClose={closePanel} onRetry={() => ctrl.retryPanel()} onStep={d => ctrl.step(d)} />
      )}
    </div>
  );
}
