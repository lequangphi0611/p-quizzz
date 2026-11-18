import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatPoints } from '../../../shared/format/points.js';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { QuestionPreview } from '../../../shared/ui/QuestionPreview.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import { WIDE_MIN } from '../../../shared/ui/member/breakpoints.js';
import { MemberLayout } from '../../../shared/ui/member/MemberLayout.js';
import { MemberPage, OfficialChip, mText, useIsDesk } from '../../../shared/ui/member/member-shell.js';
import { SideNav, StripNav } from '../../../shared/ui/member/question-nav.js';
import { Switch } from '../../../shared/ui/member/Switch.js';
import { useReview } from '../application/use-review.js';
import { notCorrectIndexes, reviewMark } from '../domain/review-mark.js';

// "/review/:attemptId" — the member's own attempt with the answer key. The server only answers once the session
// has closed (403 before that), so nobody reads the answers while others are still working.
export function ReviewPage() {
  const { attemptId } = useParams();
  const nav = useNavigate();
  const desk = useIsDesk();
  const wide = useMediaQuery(`(min-width: ${WIDE_MIN}px)`);
  const { review, error } = useReview(attemptId);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [cur, setCur] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  const marks = useMemo(() => (review ? review.questions.map(reviewMark) : []), [review]);
  const wrongIdx = useMemo(() => notCorrectIndexes(marks), [marks]);
  const shown = useMemo(() => (review ? review.questions.map((_, i) => i).filter(i => !onlyWrong || wrongIdx.includes(i)) : []), [review, onlyWrong, wrongIdx]);

  const scrollTo = (i: number) => {
    const el = refs.current[i];
    if (!el) return;
    const box = mainRef.current;
    if (box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 24;
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72 });
  };
  const jump = (i: number) => {
    setCur(i);
    if (!refs.current[i]) { setOnlyWrong(false); setTimeout(() => scrollTo(i), 0); } // hidden by the filter: show all, then go
    else scrollTo(i);
  };
  // Keep the list in step with what is on screen (desktop: the main area scrolls on its own).
  const onScroll = () => {
    const box = mainRef.current;
    if (!box || shown.length === 0) return;
    let c = shown[0]!;
    for (const i of shown) { const el = refs.current[i]; if (el && el.getBoundingClientRect().top - box.getBoundingClientRect().top < 120) c = i; }
    if (c !== cur) setCur(c);
  };

  const back = () => nav('/');
  if (error || !review) {
    const body = error
      ? <><ErrorMessage title={error.status === 403 ? 'Chưa xem được' : 'Không tải được bài làm'} message={error.message} /><Button variant="secondary" icon="arrow-left" onClick={back}>Về trang kết quả</Button></>
      : <Spinner block label="Đang tải bài làm…" />;
    return <MemberPage desk={desk} maxW={520}>{body}</MemberPage>;
  }

  const filter = <Switch on={onlyWrong} onChange={setOnlyWrong}>Chỉ câu chưa đúng ({wrongIdx.length})</Switch>;
  const scoreBlock = (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={mText.label}>Điểm</span><OfficialChip official={review.official} /></div>
      <span className="pq-tabular" style={{ font: '700 36px/1 var(--font-mono)', color: 'var(--text-title)' }}>{formatPoints(review.score)}<span style={{ fontSize: 20, color: 'var(--text-meta)' }}> / {formatPoints(review.maxScore)}</span></span>
    </div>
  );
  const cards = shown.map(i => {
    const q = review.questions[i]!;
    refs.current.length = review.questions.length;
    return (
      <div key={q.id} ref={el => { refs.current[i] = el; }} style={{ minWidth: 0, scrollMarginTop: 72, display: 'grid', gap: 8 }}>
        {q.aiAssisted && (
          <p style={{ ...mText.meta, margin: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <Icon name="sparkles" size={14} style={{ marginTop: 2, flex: 'none' }} />
            <span>Bài tự luận được AI hỗ trợ chấm nháp; điểm và nhận xét do mentor xác nhận.</span>
          </p>
        )}
        <QuestionPreview index={i} mode="review" pendingLabel="Chờ chấm"
          question={{ type: q.type, prompt: q.prompt, body: q.body, points: q.points, explanation: q.explanation, options: q.options.map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })) }}
          selectedIds={q.selectedOptionIds ?? []} answerText={q.textAnswer ?? undefined} manualScore={q.type === 'essay' ? q.score : undefined} feedback={q.feedback} />
      </div>
    );
  });
  // Cards not rendered (filtered out) must not keep stale refs.
  for (let i = 0; i < review.questions.length; i++) if (!shown.includes(i)) refs.current[i] = null;
  const status = <StatusBadge status={review.official ? 'finalized' : 'closed'} label={review.official ? 'Đã chốt kết quả' : 'Đã đóng'} />;

  if (desk) {
    const sidebar = (
      <>
        <div style={{ padding: '20px 20px 8px', display: 'grid', gap: 12 }}>{scoreBlock}{filter}</div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px' }}><SideNav questions={review.questions} current={cur} marks={marks} onSelect={jump} /></div>
        <div style={{ padding: '14px 20px 18px', borderTop: '1px solid var(--border-hairline)' }}><Button variant="secondary" block icon="arrow-left" onClick={back}>Về trang kết quả</Button></div>
      </>
    );
    return (
      <MemberLayout variant="wide" status={status} sidebar={sidebar} compact={!wide} mainRef={mainRef} onMainScroll={onScroll}>
        <div style={{ padding: wide ? '40px 48px 64px' : '28px 24px 48px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 20 }}>
            <div style={{ display: 'grid', gap: 4 }}><h1 tabIndex={-1} data-pq-focus="" style={{ ...mText.h1, outline: 'none' }}>Xem lại bài</h1><p style={mText.meta}>Lựa chọn của bạn, đáp án đúng, lời giải và điểm từng câu.</p></div>
            {cards}
            {shown.length === 0 && <p style={mText.meta}>Bạn làm đúng tất cả các câu.</p>}
          </div>
        </div>
      </MemberLayout>
    );
  }
  return (
    <MemberLayout>
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        <h1 style={mText.h1}>Xem lại bài</h1>
        <Card padding={16}><div style={{ display: 'grid', gap: 12 }}>{scoreBlock}<StripNav count={review.questions.length} current={cur} marks={marks} onSelect={jump} />{filter}</div></Card>
        {cards}
        {shown.length === 0 && <p style={mText.meta}>Bạn làm đúng tất cả các câu.</p>}
        <Button variant="secondary" size="lg" block icon="arrow-left" onClick={back}>Về trang kết quả</Button>
      </div>
    </MemberLayout>
  );
}
