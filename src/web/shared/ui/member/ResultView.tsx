import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { MeResponse } from '../../../../shared/api/index.js';
import { Button } from '../Button.js';
import { Icon } from '../Icon.js';
import { StatusBadge } from '../StatusBadge.js';
import { formatPoints } from '../../format/points.js';
import { Chip, HeroIcon, InfoBox, InfoRow, MemberPage, OfficialChip, PageCard, mText, useIsDesk } from './member-shell.js';

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * After submitting. While the session runs: "Đã nộp bài" with the automatic score only. Once it is over: the score
 * (official after finalize), the multiple-choice / essay split and "Xem lại bài". `autoSubmitted`: the mentor closed
 * the session while this member was still working, so the attempt was submitted for them. While the mentor holds
 * scores back (PRODUCT.md §7.25) the running card says so instead of showing a score; closing always publishes them.
 */
export function ResultView({ me, ended, autoSubmitted = false, endedByTimer = false, canReopen = false, onAnotherRoom, children }: { me: MeResponse; ended: boolean; autoSubmitted?: boolean; endedByTimer?: boolean; canReopen?: boolean; onAnotherRoom?: () => void; children?: ReactNode }) {
  const desk = useIsDesk();
  const nav = useNavigate();
  const { session, attempt, participant } = me;
  const done = attempt.submitted[0] ?? null; // one attempt per session (PRODUCT.md §4.4)
  const official = session.status === 'finalized';
  const reviewable = session.status === 'closed' || session.status === 'finalized';
  const essayMax = done ? Math.max(0, session.totalPoints - done.maxScore) : 0;
  const essayShown = official && done?.essayScore != null;
  const autoScore = done?.score ?? 0; // null only while held back, which never happens once the session has ended
  const held = !ended && (session.scoresHidden || done?.score === null);
  const total = done ? autoScore + (official ? done.essayScore ?? 0 : 0) : 0;
  const reviewBtn = done && reviewable ? <Button size="lg" block icon="eye" onClick={() => nav(`/review/${done.id}`)}>Xem lại bài</Button> : undefined;

  let card: ReactNode;
  if (!done) {
    card = (
      <PageCard desk={desk} center>
        <HeroIcon name="clock" tone="ink" />
        <h1 style={mText.h1}>Phiên đã kết thúc</h1>
        <p style={mText.meta}>Bạn chưa làm bài trong phiên này.</p>
      </PageCard>
    );
  } else if (held) {
    card = (
      <PageCard desk={desk}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><HeroIcon name="circle-check" /><div style={{ display: 'grid', gap: 2 }}><h1 style={mText.h1}>Đã nộp bài</h1><p style={mText.meta}>Lúc {timeOf(done.submittedAt)}</p></div></div>
        <div role="status" style={{ display: 'flex', gap: 12, padding: 20, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
          <Icon name="eye-off" size={20} style={{ marginTop: 2, color: 'var(--text-meta)' }} />
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ ...mText.label, color: 'var(--text-title)' }}>Điểm sẽ được công bố sau</span>
            <span style={mText.meta}>Mentor đang giữ điểm và bảng xếp hạng cho tới khi cả lớp làm xong. Bài của bạn đã được lưu, không cần làm gì thêm.</span>
          </div>
        </div>
        <p style={{ ...mText.meta, display: 'flex', gap: 8 }}><Icon name="lock" size={15} style={{ marginTop: 2 }} /><span>Điểm hiện khi mentor bấm công bố hoặc khi đóng phiên. Đáp án và lời giải mở khi mentor đóng phiên.</span></p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border-hairline)', flexWrap: 'wrap', ...mText.meta }}><StatusBadge status="running" label="Phiên đang diễn ra" /><span>Trang tự cập nhật khi có điểm.</span></div>
      </PageCard>
    );
  } else if (!ended) {
    card = (
      <PageCard desk={desk}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><HeroIcon name="circle-check" /><div style={{ display: 'grid', gap: 2 }}><h1 style={mText.h1}>Đã nộp bài</h1><p style={mText.meta}>Lúc {timeOf(done.submittedAt)}</p></div></div>
        <div style={{ display: 'grid', gap: 10, padding: 20, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span style={mText.label}>{essayMax > 0 ? 'Điểm phần trắc nghiệm' : 'Điểm bài làm'}</span><Chip icon="hourglass">Tạm tính</Chip></div>
          <span className="pq-tabular" style={{ font: '700 48px/1 var(--font-mono)', color: 'var(--text-title)' }}>{formatPoints(autoScore)}<span style={{ fontSize: 24, color: 'var(--text-meta)' }}> / {formatPoints(done.maxScore)} điểm</span></span>
          {essayMax > 0 && <p style={{ ...mText.meta, display: 'flex', gap: 8 }}><Icon name="pencil" size={15} style={{ marginTop: 2 }} /><span>Còn câu tự luận ({formatPoints(essayMax)} điểm) chờ mentor chấm. Tổng tạm tính <b style={mText.mono}>{formatPoints(autoScore)}/{formatPoints(session.totalPoints)}</b>.</span></p>}
        </div>
        <p style={{ ...mText.meta, display: 'flex', gap: 8 }}><Icon name="lock" size={15} style={{ marginTop: 2 }} /><span>Đáp án, lời giải và điểm từng câu sẽ mở khi mentor đóng phiên. Muốn làm lại, nhờ mentor mở phiên mới.</span></p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border-hairline)', flexWrap: 'wrap', ...mText.meta }}><StatusBadge status="running" label="Phiên đang diễn ra" /><span>Trang tự cập nhật khi có kết quả.</span></div>
      </PageCard>
    );
  } else {
    card = (
      <PageCard desk={desk}>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}><StatusBadge status={official ? 'finalized' : 'closed'} label={official ? 'Đã chốt kết quả' : 'Đã đóng'} /><h1 style={mText.h1}>Phiên đã kết thúc</h1></div>
        <div style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><span style={mText.label}>Điểm của bạn</span><OfficialChip official={official} /></div>
          <span className="pq-tabular" style={{ font: '700 64px/1 var(--font-mono)', color: 'var(--text-title)', animation: 'pq-pop-in var(--dur-pop) var(--ease-pop)' }}>{formatPoints(total)}<span style={{ fontSize: 28, color: 'var(--text-meta)' }}> / {formatPoints(session.totalPoints)}</span></span>
        </div>
        {essayMax > 0 && (
          <InfoBox>
            <InfoRow icon="list-checks" k="Trắc nghiệm" v={<span style={mText.mono}>{formatPoints(autoScore)} / {formatPoints(done.maxScore)}</span>} />
            <InfoRow icon="pencil" k="Tự luận" v={essayShown ? <span style={mText.mono}>{formatPoints(done.essayScore!)} / {formatPoints(essayMax)}</span> : <Chip tone="ink" icon="hourglass">Chờ chấm</Chip>} />
          </InfoBox>
        )}
        {!official && <p style={mText.meta}>Điểm chính thức có khi mentor chấm xong{essayMax > 0 ? ' tự luận' : ''} và chốt kết quả. Trang tự cập nhật.</p>}
        {desk && reviewBtn}
      </PageCard>
    );
  }

  return (
    <MemberPage desk={desk} title={session.title} name={participant.displayName} maxW={520} footer={desk ? undefined : reviewBtn}>
      {ended && autoSubmitted && done && (
        <div role="status" style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--brand-050)', border: '1px solid var(--brand-200)', color: 'var(--brand-800)', font: 'var(--type-ui)', fontSize: 14 }}>
          <Icon name="info" size={18} style={{ marginTop: 1 }} /><span>{endedByTimer ? 'Đã hết giờ làm bài.' : 'Mentor đã đóng phiên khi bạn đang làm.'} Bài đã được <b>nộp tự động</b> với các câu đã lưu.</span>
        </div>
      )}
      {card}
      {children}
      {ended && onAnotherRoom && (
        <div style={{ display: 'grid', gap: 4, justifyItems: 'center', textAlign: 'center' }}>
          <Button variant="ghost" icon="door-open" onClick={onAnotherRoom}>Vào phòng khác</Button>
          {/* Only promise what this browser can keep: a private window or blocked site data loses the result on leaving. */}
          <span style={mText.meta}>{canReopen
            ? 'Kết quả phiên này vẫn mở lại được ở mục “Phiên của bạn trên máy này”.'
            : 'Trình duyệt này không lưu được phiên (có thể do chế độ ẩn danh), rời trang này sẽ không mở lại được kết quả.'}</span>
        </div>
      )}
    </MemberPage>
  );
}
