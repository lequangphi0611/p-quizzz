import { useState, type ReactNode } from 'react';
import type { MeResponse } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { countReasonOf, formatClockTime, startRuleOf } from '../../../shared/format/start.js';
import { useCountdown } from '../../../shared/hooks/useCountdown.js';
import { useOnline } from '../../../shared/hooks/useOnline.js';
import { useReducedMotion, useStartNotices } from '../../../shared/hooks/useStartNotices.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import { MemberLayout } from '../../../shared/ui/member/MemberLayout.js';
import { RulesCard } from '../../../shared/ui/member/RulesCard.js';
import { mText } from '../../../shared/ui/member/member-shell.js';
import { COUNT_REASON, GoRing, NoSchedule, NoticeStack, ReadyMeter, StartClock, WhoLine } from '../../../shared/ui/start/StartParts.js';

// The lobby (PRODUCT.md §7.31, Design System 7 "Phòng chờ mới"): the rules, "Sẵn sàng X/Y", who decides the start, the
// scheduled time, then the 10-second countdown. Waiting for approval and waiting for the start never look alike.

type ReadyState = 'idle' | 'ready' | 'locked' | 'pending' | 'offline';

function StateTag({ kind }: { kind: 'pending' | 'lobby' | 'count' }) {
  const k = {
    pending: ['hourglass', 'var(--warn-surface)', 'var(--warn-600)', 'var(--warn-border)', 'Chờ duyệt'],
    lobby: ['circle-check', 'var(--sun-100)', 'var(--sun-ink)', 'var(--sun-200)', 'Đã duyệt · chờ bắt đầu'],
    count: ['play', 'var(--brand-100)', 'var(--brand-700)', 'var(--brand-200)', 'Sắp bắt đầu'],
  }[kind];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: k[1], color: k[2], border: `1px solid ${k[3]}`, font: 'var(--type-label)', whiteSpace: 'nowrap', flex: 'none' }}><Icon name={k[0]!} size={13} />{k[4]}</span>;
}

function ReadyControl({ state, phone, busy, onReady }: { state: ReadyState; phone: boolean; busy: boolean; onReady: (ready: boolean) => void }) {
  if (state === 'ready') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span role="status" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '0 14px', borderRadius: 'var(--radius-md)', background: 'var(--correct-surface)', border: '1.5px solid var(--correct-border)', color: 'var(--correct-600)', font: '700 16px/1.2 var(--font-sans)', boxSizing: 'border-box' }}><Icon name="circle-check" size={20} />Bạn đã sẵn sàng</span>
        <Button variant="secondary" size="lg" icon="x" loading={busy} onClick={() => onReady(false)}>Huỷ sẵn sàng</Button>
      </div>
    );
  }
  const box = (icon: string, text: string, dashed = false) => (
    <span role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '0 14px', borderRadius: 'var(--radius-md)', background: dashed ? 'none' : 'var(--surface-sunken)', border: dashed ? '1.5px dashed var(--ink-300)' : 0, color: 'var(--ink-700)', font: '600 14px/1.3 var(--font-sans)' }}><Icon name={icon} size={16} />{text}</span>
  );
  if (state === 'locked') return box('lock', 'Đang đếm ngược — không đổi sẵn sàng được nữa');
  if (state === 'pending') return box('lock', 'Nút Sẵn sàng mở khi mentor duyệt bạn', true);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <Button size="lg" block icon="check" loading={busy} disabled={state === 'offline'} onClick={() => onReady(true)}>{state === 'offline' ? 'Sẵn sàng · chờ có mạng' : 'Sẵn sàng'}</Button>
      {!phone && <span style={{ ...mText.meta, textAlign: 'center' }}>Đọc luật xong thì bấm. Bấm lại để huỷ.</span>}
    </div>
  );
}

function Reconnect({ counting }: { counting: boolean }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'var(--warn-surface)', border: '1px solid var(--warn-border)', borderRadius: 'var(--radius-md)', color: 'var(--warn-600)', font: 'var(--type-ui)', fontSize: 14 }}>
      <span style={{ marginTop: 1, display: 'flex' }}><Spinner size={16} /></span>
      <span style={{ minWidth: 0 }}><b>Đang kết nối lại…</b> {counting ? 'Đếm ngược vẫn chạy theo giờ đã hẹn. Có mạng lại bạn vào thẳng câu 1.' : 'Có mạng lại, màn hình tự nhảy đúng trạng thái hiện tại.'}</span>
    </div>
  );
}

export function MemberLobby({ me, desk, onReady }: { me: MeResponse; desk: boolean; onReady: (ready: boolean) => Promise<void> }) {
  const phone = !desk;
  const online = useOnline();
  const reduced = useReducedMotion();
  const start = me.session.start;
  const left = useCountdown(start ? { remainingMs: start.startsInMs, endsAt: start.startsAt } : null);
  const { notices, dismiss, changedAt } = useStartNotices(start, me.session.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = me.participant.status === 'pending';
  const counting = !!start?.countdownEndsAt;
  const limit = me.session.timer?.limitMinutes ?? null;
  const offline = !online;

  async function ready(value: boolean) {
    if (busy) return;
    setBusy(true); setError('');
    try { await onReady(value); } catch (err) { setError(err instanceof ApiError ? err.message : 'Không đổi được trạng thái sẵn sàng'); } finally { setBusy(false); }
  }

  const readyState: ReadyState = pending ? 'pending' : counting ? 'locked' : offline ? 'offline' : me.participant.ready ? 'ready' : 'idle';
  const control = <ReadyControl state={readyState} phone={phone} busy={busy} onReady={v => void ready(v)} />;
  const meter = start && <ReadyMeter ready={start.ready.count} total={start.ready.total} size={phone ? 'sm' : 'md'} />;
  const rule = start ? startRuleOf(start) : 'manual';

  let panel: ReactNode;
  if (start && counting) {
    const reason = COUNT_REASON[countReasonOf(start)];
    const n = Math.ceil((left ?? 0) / 1000);
    panel = (
      <div style={{ display: 'grid', gap: 14 }}>
        <div aria-live="assertive" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Phiên bắt đầu sau 10 giây.</div>
        <div style={{ display: 'grid', justifyItems: 'center', gap: phone ? 12 : 16, padding: phone ? '20px 16px' : '28px 24px', borderRadius: 'var(--radius-lg)', background: 'var(--brand-600)', color: '#fff', textAlign: 'center' }}>
          <span style={{ font: `700 ${phone ? 15 : 17}px/1.2 var(--font-sans)`, letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase' }}>{n > 0 ? 'Bắt đầu sau' : 'Vào bài'}</span>
          <GoRing n={n} d={phone ? 148 : 196} reduced={reduced} center={n > 0 ? undefined : 'Vào bài'} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--paper)', color: 'var(--brand-700)', font: '700 14px/1.3 var(--font-sans)', maxWidth: '100%', textAlign: 'left' }}>
            <Icon name={reason[0]} size={15} style={{ flex: 'none' }} />
            {reason[1]}{countReasonOf(start) === 'early' && start.scheduledAt !== null ? ` — giờ hẹn là ${formatClockTime(start.scheduledAt)}` : countReasonOf(start) === 'all' ? ` · ${start.ready.count}/${start.ready.total}` : ''}
          </span>
          <span style={{ font: '400 14px/1.45 var(--font-sans)', color: '#fff', textWrap: 'pretty' }}>{offline ? 'Đang mất mạng — vẫn đếm theo giờ đã hẹn.' : `Câu 1 hiện khi về 0.${limit !== null ? ` Giờ làm bài ${limit} phút tính từ lúc đó.` : ''}`}</span>
        </div>
        {meter}
        {!phone && control}
      </div>
    );
  } else {
    const clock = start?.scheduledAt != null
      ? <StartClock at={start.scheduledAt} leftMs={left} size={phone ? 'sm' : 'md'} changed={changedAt !== null && Date.now() - changedAt < 15_000} offline={offline} limitMinutes={limit} note={!pending} />
      : <NoSchedule limited={limit !== null} />;
    const who = start && <WhoLine rule={rule} at={start.scheduledAt} leftMs={left} min={start.readyMin} offline={offline} timeShown />;
    panel = (
      <div style={{ display: 'grid', gap: phone ? 14 : 18 }}>
        <span><StateTag kind={pending ? 'pending' : 'lobby'} /></span>
        {pending && (
          <div style={{ display: 'grid', gap: 4 }}>
            <h1 style={{ ...mText.h1, fontSize: phone ? 20 : 24 }}>Đang chờ mentor duyệt</h1>
            <p style={mText.meta}>Bạn đã vào phòng nhưng chưa được duyệt. Trong lúc chờ, đọc trước luật làm bài. Màn hình tự chuyển khi được duyệt.</p>
          </div>
        )}
        {clock}
        {pending ? who : <div style={{ display: 'grid', gap: 10, paddingTop: phone ? 12 : 16, borderTop: '1px solid var(--border-hairline)' }}>{meter}{who}</div>}
        {!phone && control}
      </div>
    );
  }

  const stack = <NoticeStack items={notices} onDismiss={dismiss} />;
  const err = error && <ErrorMessage message={error} />;
  if (phone) {
    return (
      <MemberLayout sessionTitle={me.session.title} displayName={me.participant.displayName} footer={control}>
        <div style={{ display: 'grid', gap: 12, paddingTop: 4 }}>
          {offline && <Reconnect counting={counting} />}
          {stack}
          {err}
          <Card padding={16}>{panel}</Card>
          <RulesCard session={me.session} phone />
        </div>
      </MemberLayout>
    );
  }
  return (
    <MemberLayout variant="wide" sessionTitle={me.session.title} displayName={me.participant.displayName}
      status={pending ? <StateTag kind="pending" /> : <StatusBadge status="lobby" label={counting ? 'Sắp bắt đầu' : 'Phòng chờ'} />}>
      <div style={{ width: '100%', maxWidth: 1120, margin: '0 auto', padding: '32px 40px', boxSizing: 'border-box', display: 'grid', gap: 16 }}>
        {offline && <Reconnect counting={counting} />}
        {stack}
        {err}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,440px) minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
          <Card padding={24}>{panel}</Card>
          <RulesCard session={me.session} />
        </div>
      </div>
    </MemberLayout>
  );
}
