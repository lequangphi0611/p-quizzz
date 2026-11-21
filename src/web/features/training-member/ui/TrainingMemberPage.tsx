import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { roomFromSearch } from '../../../shared/room/room-code.js';
import { Chip, MemberPage, useIsDesk } from '../../../shared/ui/member/member-shell.js';
import { selectCheckSecondsLeft, selectScreen, selectWaitingHint } from '../application/training-member-controller.js';
import { useNow, useTrainingMember } from '../application/use-training-member.js';
import { TRAINING_ROOM_NOT_FOUND } from '../domain/join-failure.js';
import type { TrainingScreen } from '../domain/training-screen.js';
import { ConsentScreen } from './ConsentScreen.js';
import { InstallScreen } from './InstallScreen.js';
import { RecordingScreen, WithdrawDialog } from './RecordingScreen.js';
import { CheckFailedScreen, CheckScreen, RemoveScreen, RemovedScreen } from './RemovalScreens.js';
import { EndedScreen, LoadingScreen, LostScreen, OfflineBanner, OfflineScreen } from './StatusScreens.js';

// `/training/:id` — an AI training from the member's side (S36): consent, install, recording, removal.
// The room code arrives as `?room=<code>` (set by the first page when the code turned out to be a training's, like a join link).
// Nothing on any screen shows what was collected: the member API never returns it.

/** Wider column for the steps that carry code blocks; the status screens stay narrow. */
const WIDTH: Record<TrainingScreen, number> = {
  loading: 640, offline: 640, lost: 640, consent: 640, install: 800, recording: 640, remove: 800, check: 640, 'check-failed': 800, removed: 640, ended: 640,
};

/** Said to screen readers when the state changes (a live region that exists before its text does, so the change is announced). */
const ANNOUNCEMENT: Partial<Record<TrainingScreen, string>> = {
  recording: 'Đã nhận tín hiệu: máy mentor đang nhận dữ liệu từ Claude Code của bạn.',
  removed: 'Kiểm tra xong: đã gỡ, máy mentor không còn nhận được tín hiệu.',
  'check-failed': 'Kiểm tra xong: vẫn còn nhận được tín hiệu, cấu hình chưa được gỡ hết.',
};

const hidden = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 } as const;

export function TrainingMemberPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const trainingId = Number(id);
  const valid = Number.isInteger(trainingId) && trainingId > 0;
  return valid ? <TrainingMemberView key={trainingId} trainingId={trainingId} roomCode={roomFromSearch(`?${search.toString()}`)} /> : <BadAddress />;
}

function BadAddress() {
  const nav = useNavigate();
  const desk = useIsDesk();
  return <MemberPage desk={desk} maxW={640}><LostScreen desk={desk} message="Địa chỉ này không phải của một buổi training." onHome={() => nav('/', { replace: true })} /></MemberPage>;
}

function TrainingMemberView({ trainingId, roomCode }: { trainingId: number; roomCode: string }) {
  const { state, ctrl } = useTrainingMember(trainingId, roomCode);
  const nav = useNavigate();
  const desk = useIsDesk();
  const screen = selectScreen(state);
  const host = window.location.host;
  const now = useNow(screen === 'install' || screen === 'check');
  const [withdrawing, setWithdrawing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const goHome = () => nav('/', { replace: true });

  // The code in the address has done its job once the member is in (like the exam join form does).
  const hasToken = state.token !== null;
  useEffect(() => { if (hasToken && roomCode) nav(`/training/${trainingId}`, { replace: true }); }, [hasToken, roomCode, trainingId, nav]);

  // Keyboard and screen-reader users land at the top of the new screen, not on a button that just disappeared.
  const main = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    main.current?.focus({ preventScroll: true });
  }, [screen]);

  const name = state.me?.training.name ?? state.room.title ?? undefined;
  const displayName = state.me?.member.displayName;

  const withdraw = async () => {
    if (await ctrl.withdraw()) { setLeaving(true); goHome(); }
  };
  const closeWithdraw = () => { ctrl.clearWithdrawError(); setWithdrawing(false); };

  const status = ((): ReactNode => {
    if (screen === 'install') return <Chip tone="ink" icon="circle-dot">Chưa nhận tín hiệu</Chip>;
    if (screen === 'recording') return <Chip tone="brand" icon="wifi">Đã nhận tín hiệu</Chip>;
    if (screen === 'removed') return <Chip tone="ink" icon="check">Đã gỡ</Chip>;
    return undefined;
  })();

  const body = ((): ReactNode => {
    if (leaving) return <LoadingScreen host={host} />;
    switch (screen) {
      case 'loading': return <LoadingScreen host={host} />;
      case 'offline': return <OfflineScreen desk={desk} host={host} onRetry={() => void ctrl.refresh()} />;
      case 'lost': return <LostScreen desk={desk} message={state.room.error?.status === 429 ? state.room.error.message : state.roomCode ? TRAINING_ROOM_NOT_FOUND : 'Mở trang đầu, nhập mã phòng mentor đưa, rồi tiếp tục từ đó.'} onHome={goHome} />;
      case 'consent': return <ConsentScreen desk={desk} title={state.room.title ?? ''} busy={state.join.busy} error={state.join.error} onJoin={ctrl.join} onDecline={goHome} />;
      case 'install': return <InstallScreen config={state.hookConfig.value} configStatus={state.hookConfig.status} onRetryConfig={ctrl.retryHookConfig} showHint={selectWaitingHint(state, now)} onWithdraw={() => setWithdrawing(true)} />;
      case 'recording': return <RecordingScreen desk={desk} trainingName={name ?? ''} displayName={displayName ?? ''} onWithdraw={() => setWithdrawing(true)} />;
      case 'remove': return <RemoveScreen host={host} busy={state.check.phase === 'starting'} message={state.check.message} onCheck={() => void ctrl.startCheck()} />;
      case 'check': return <CheckScreen desk={desk} secondsLeft={selectCheckSecondsLeft(state, now)} busy={state.check.phase === 'finishing'} message={state.check.message} onDone={() => void ctrl.finishCheck()} />;
      case 'check-failed': return <CheckFailedScreen host={host} busy={state.check.phase === 'starting'} onRetry={() => void ctrl.startCheck()} />;
      case 'removed': return <RemovedScreen desk={desk} onHome={goHome} />;
      case 'ended': return <EndedScreen desk={desk} onHome={goHome} />;
    }
  })();

  return (
    <MemberPage desk={desk} title={name} name={displayName} status={status} maxW={WIDTH[screen]}>
      <div aria-live="polite" style={hidden}>{leaving ? '' : ANNOUNCEMENT[screen] ?? ''}</div>
      <div ref={main} tabIndex={-1} data-pq-focus style={{ outline: 'none', boxShadow: 'none', display: 'grid', gap: 16, minWidth: 0 }}>
        {state.offline && screen !== 'offline' && screen !== 'loading' && screen !== 'ended' && <OfflineBanner />}
        {body}
      </div>
      <WithdrawDialog open={withdrawing && !leaving} host={host} busy={state.withdraw.busy} error={state.withdraw.error} onConfirm={() => void withdraw()} onCancel={closeWithdraw} />
    </MemberPage>
  );
}
