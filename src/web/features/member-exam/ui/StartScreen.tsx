import { useEffect, useRef, useState } from 'react';
import type { MeResponse } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { Countdown } from '../../../shared/ui/Countdown.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Kbd } from '../../../shared/ui/Kbd.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import { MemberLayout } from '../../../shared/ui/member/MemberLayout.js';
import { RulesCard } from '../../../shared/ui/member/RulesCard.js';
import { MemberPage, mText, useIsDesk, useShowKeys } from '../../../shared/ui/member/member-shell.js';
import { errorText } from '../application/taking-controller.js';
import { useCountdown } from '../../../shared/hooks/useCountdown.js';
import { formatMinutes } from '../../../shared/format/countdown.js';

/**
 * The session started (PRODUCT.md §7.31f). Whoever was in the room goes straight to question 1: the rules were in the
 * lobby, and a "Bắt đầu làm bài" step would eat into the shared clock. Only a late arrival sees the time left first.
 */
export function StartScreen({ me, onStart }: { me: MeResponse; onStart: () => Promise<void> }) {
  return me.participant.lateJoin ? <LateScreen me={me} onStart={onStart} /> : <EnterNow me={me} onStart={onStart} />;
}

function EnterNow({ me, onStart }: { me: MeResponse; onStart: () => Promise<void> }) {
  const desk = useIsDesk();
  const [failed, setFailed] = useState('');
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    onStart().catch(err => setFailed(errorText(err, 'Không vào được bài')));
  }, [onStart]);
  if (failed) return <LateScreen me={me} onStart={onStart} error={failed} />;
  return (
    <MemberPage desk={desk} title={me.session.title} name={me.participant.displayName} maxW={440}>
      <Card padding={desk ? 32 : 20}><div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}><Spinner block label="Đang vào câu 1…" /></div></Card>
    </MemberPage>
  );
}

function LateScreen({ me, onStart, error: initialError = '' }: { me: MeResponse; onStart: () => Promise<void>; error?: string }) {
  const desk = useIsDesk();
  const showKeys = useShowKeys();
  const { session } = me;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const timeLeft = useCountdown(session.timer);
  async function start() {
    if (busy) return;
    setBusy(true); setError('');
    try { await onStart(); } catch (err) { setError(errorText(err, 'Không bắt đầu được')); setBusy(false); }
  }
  const btn = <Button size="lg" block icon="play" loading={busy} onClick={() => void start()}>Vào làm bài</Button>;
  const head = (
    <Card padding={desk ? 28 : 16}>
      <div style={{ display: 'grid', gap: 14 }}>
        <span><StatusBadge status="running" label="Đang thi" /></span>
        <h1 style={{ ...mText.h1, fontSize: desk ? 24 : 20 }}>{timeLeft !== null ? 'Phiên đã bắt đầu, bạn còn' : 'Phiên đã bắt đầu'}</h1>
        {timeLeft !== null && <span><Countdown ms={timeLeft} size="md" /></span>}
        <p style={mText.meta}>{session.timer ? `Giới hạn ${formatMinutes(session.timer.limitMinutes)} cho cả phòng, tính từ lúc phiên bắt đầu. Đồng hồ đang chạy — vào ngay để không mất thêm giờ.` : 'Vào làm bài khi bạn sẵn sàng.'}</p>
        {showKeys && (
          <p style={{ ...mText.meta, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <Icon name="info" size={14} /> Mẹo: <Kbd>←</Kbd><Kbd>→</Kbd> chuyển câu, <Kbd>1</Kbd>–<Kbd>9</Kbd> chọn phương án.
          </p>
        )}
        {error && <ErrorMessage message={error} />}
        {desk && btn}
      </div>
    </Card>
  );
  if (!desk) return <MemberLayout sessionTitle={session.title} displayName={me.participant.displayName} footer={btn}><div style={{ display: 'grid', gap: 12, paddingTop: 4 }}>{head}<RulesCard session={session} phone compact /></div></MemberLayout>;
  return (
    <MemberLayout variant="wide" sessionTitle={session.title} displayName={me.participant.displayName} status={<StatusBadge status="running" label="Đang thi" />}>
      <div style={{ width: '100%', maxWidth: 1000, margin: '0 auto', padding: '48px 40px', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: 'minmax(0,420px) minmax(0,1fr)', gap: 24, alignItems: 'start' }}>{head}<RulesCard session={session} compact /></div>
    </MemberLayout>
  );
}
