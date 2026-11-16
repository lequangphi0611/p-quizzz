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
import { selectScreen } from '../application/member-home-controller.js';
import { useMemberHome } from '../application/member-home-context.js';
import { ConnLost } from './ConnLost.js';
import { JoinForm } from './JoinForm.js';

// "/" — decides what a member sees from three facts: is there an active session, do I hold a token, what does /api/me say.
/** The exam screen is another feature's: the app composes it in (features never import each other). */
export type ExamScreen = (props: { me: MeResponse; onChanged: () => Promise<void>; leaderboard: ReactNode }) => ReactNode;

export function MemberHomePage({ examScreen }: { examScreen: ExamScreen }) {
  const { state, ctrl, activeId } = useMemberHome();
  const { active, me, activeError, autoSubmitted } = state;
  const [linkRoom] = useState(() => roomFromSearch(window.location.search)); // from a join link: /?room=482913
  const screen = selectScreen(state);
  const title = me?.session.title ?? active?.title;
  const name = me && (screen === 'pending' || screen === 'lobby') ? me.participant.displayName : undefined;
  const desk = useIsDesk();

  if (screen === 'running') {
    return examScreen({ me: me!, onChanged: ctrl.refreshMe, leaderboard: <Leaderboard sessionId={me!.session.id} highlightName={me!.participant.displayName} /> });
  }
  if (screen === 'ended') {
    return <ResultView me={me!} ended autoSubmitted={autoSubmitted}><Leaderboard sessionId={me!.session.id} highlightName={me!.participant.displayName} /></ResultView>;
  }

  const page = (body: ReactNode, opts: { maxW?: number; status?: ReactNode } = {}) => (
    <MemberPage desk={desk} title={title} name={name} maxW={opts.maxW ?? 440} status={opts.status}>{body}</MemberPage>
  );
  switch (screen) {
    case 'loading':
      if (activeError) return page(<ConnLost onRetry={() => void ctrl.fetchActive()} desk={desk} />);
      return page(<PageCard desk={desk} center><Spinner block label="Đang kết nối tới máy mentor…" /><span style={{ ...mText.meta, ...mText.mono }}>{window.location.host}</span></PageCard>);
    case 'error':
      return page(<ConnLost onRetry={() => activeId !== null && void ctrl.fetchMe(activeId)} desk={desk} />);
    case 'none':
      return page(
        <PageCard desk={desk} center>
          <HeroIcon name="clock" tone="ink" />
          <h1 style={mText.h1}>Chưa có phiên nào đang mở</h1>
          <p style={mText.meta}>Khi mentor mở phiên, trang này tự chuyển sang ô nhập mã phòng. Bạn không cần tải lại.</p>
          <Button variant="secondary" size="lg" icon="refresh-cw" block={!desk} onClick={() => void ctrl.fetchActive()}>Kiểm tra lại</Button>
        </PageCard>,
      );
    case 'join':
      return page(<JoinForm desk={desk} session={active!} linkRoom={linkRoom} ctrl={ctrl} />);
    case 'pending':
    case 'lobby': {
      const pending = screen === 'pending';
      const inLobby = me!.session.status === 'lobby'; // pending before the start: the mentor lets people into the room first
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
