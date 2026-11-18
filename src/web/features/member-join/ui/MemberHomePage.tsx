import { useState, type ReactNode } from 'react';
import type { MeResponse } from '../../../../shared/api/index.js';
import { Leaderboard } from '../../../shared/leaderboard/Leaderboard.js';
import { roomFromSearch } from '../../../shared/room/room-code.js';
import { Button } from '../../../shared/ui/Button.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import { HeroIcon, InfoBox, InfoRow, MemberPage, PageCard, mText, useIsDesk } from '../../../shared/ui/member/member-shell.js';
import { NameChip } from '../../../shared/ui/member/MemberLayout.js';
import { ResultView } from '../../../shared/ui/member/ResultView.js';
import { selectCanReopen, selectRoom, selectScreen } from '../application/member-home-controller.js';
import { useMemberHome } from '../application/member-home-context.js';
import { ConnLost } from './ConnLost.js';
import { formatMinutes } from '../../../shared/format/countdown.js';
import { JoinForm } from './JoinForm.js';
import { MemberLobby } from './Lobby.js';
import { MySessionsList } from './MySessionsList.js';
import { RejoinWait, Replaced } from './RejoinPanels.js';

// "/" — decides what a member sees from three facts: which room code was found, do I hold a token, what does /api/me say.
/** The exam screen is another feature's: the app composes it in (features never import each other). */
export type ExamScreen = (props: { me: MeResponse; onChanged: () => Promise<void>; leaderboard: ReactNode }) => ReactNode;

export function MemberHomePage({ examScreen }: { examScreen: ExamScreen }) {
  const { state, ctrl, followedId } = useMemberHome();
  const { me, autoSubmitted } = state;
  // From a join link: /?room=482913. Dropped once the member leaves a session, so the code form does not reopen it at once.
  const [linkRoom, setLinkRoom] = useState(() => roomFromSearch(window.location.search));
  const screen = selectScreen(state);
  const title = me?.session.title ?? selectRoom(state)?.title;
  const name = me && (screen === 'pending' || screen === 'lobby') ? me.participant.displayName : undefined;
  const desk = useIsDesk();

  if (screen === 'running') {
    return examScreen({ me: me!, onChanged: ctrl.refreshMe, leaderboard: <Leaderboard sessionId={me!.session.id} highlightName={me!.participant.displayName} /> });
  }
  if (screen === 'ended') {
    return <ResultView me={me!} ended autoSubmitted={autoSubmitted} endedByTimer={state.endedByTimer} canReopen={selectCanReopen(state)} onAnotherRoom={() => { setLinkRoom(''); ctrl.leaveEnded(); }}><Leaderboard sessionId={me!.session.id} highlightName={me!.participant.displayName} /></ResultView>;
  }

  const page = (body: ReactNode, opts: { maxW?: number; status?: ReactNode } = {}) => (
    <MemberPage desk={desk} title={title} name={name} maxW={opts.maxW ?? 440} status={opts.status}>{body}</MemberPage>
  );
  switch (screen) {
    case 'loading':
      return page(<PageCard desk={desk} center><Spinner block label="Đang kết nối tới máy mentor…" /><span style={{ ...mText.meta, ...mText.mono }}>{window.location.host}</span></PageCard>);
    case 'error':
      return page(<ConnLost onRetry={() => followedId !== null && void ctrl.fetchMe(followedId)} desk={desk} />);
    case 'rejoin':
      return page(<RejoinWait desk={desk} state={state.rejoin ?? 'pending'} offline={state.rejoinOffline} title={title}
        onCancel={() => void ctrl.cancelRejoin()} onBack={() => ctrl.backFromRejoin()} />);
    case 'replaced':
      return page(<Replaced desk={desk} onLeave={() => ctrl.leave()} />);
    case 'code':
    case 'join':
      return page(<>
        <JoinForm desk={desk} state={state} linkRoom={linkRoom} ctrl={ctrl} />
        {screen === 'code' && <MySessionsList desk={desk} sessions={state.mine} ctrl={ctrl} />}
      </>);
    case 'pending':
    case 'lobby': {
      const pending = screen === 'pending';
      const inLobby = me!.session.status === 'lobby'; // pending before the start: the mentor lets people into the room first
      if (inLobby) return <MemberLobby me={me!} desk={desk} onReady={ctrl.setReady} />;
      return page(
        <PageCard desk={desk} center>
          <StatusBadge status={pending && !inLobby ? 'running' : 'lobby'} label={pending && !inLobby ? 'Phiên đang diễn ra' : 'Phòng chờ'} />
          <HeroIcon name={pending ? 'hourglass' : 'users'} tone={pending ? 'warn' : 'brand'} />
          <div style={{ display: 'grid', gap: 6 }}>
            <h1 style={mText.h1}>{pending ? 'Chờ mentor duyệt' : 'Chờ mentor bắt đầu'}</h1>
            <p style={mText.meta}>{pending ? (inLobby ? 'Mentor sẽ duyệt tên bạn để vào phòng. Giữ trang này mở — màn hình tự chuyển khi được duyệt.' : 'Phiên đã bắt đầu trước khi bạn vào. Mentor cần duyệt thì bạn mới làm bài được.') : 'Giữ trang này mở — màn hình tự chuyển khi phiên bắt đầu.'}</p>
          </div>
          <InfoBox>
            <InfoRow icon="file-text" k="Đề" v={me!.session.title} />
            <InfoRow icon="user" k="Tên của bạn" v={<NameChip name={me!.participant.displayName} />} />
            {me!.session.timer && <InfoRow icon="hourglass" k="Thời gian làm bài" v={formatMinutes(me!.session.timer.limitMinutes)} />}
            {!pending && <InfoRow icon="users" k="Đã vào phòng" v={<span style={mText.mono}>{me!.session.participantCount} người</span>} />}
          </InfoBox>
          {pending && <Spinner label="Đang chờ duyệt…" />}
        </PageCard>,
        { maxW: 480 },
      );
    }
    case 'kicked':
      return page(
        <PageCard desk={desk} center>
          <HeroIcon name="user-x" tone="ink" />
          <h1 style={mText.h1}>Bạn đã được mời ra khỏi phiên</h1>
          <p style={mText.meta}>Mentor đã mời bạn ra khỏi phiên{title ? ` “${title}”` : ''}. Nếu có nhầm lẫn, hãy báo mentor. Bạn có thể xin vào lại bằng cách nhập tên và mã phòng lần nữa.</p>
          <Button variant="secondary" size="lg" icon="arrow-left" block={!desk} onClick={() => ctrl.leaveKicked()}>
            Về trang vào phòng
          </Button>
        </PageCard>,
      );
  }
}
