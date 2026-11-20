import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { QuestionNav } from '../../../shared/ui/QuestionNav.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { mText, useIsDesk } from '../../../shared/ui/member/member-shell.js';
import { useSharedSession } from '../application/use-shared.js';
import { clockOf, listPath, longDate, questionFromHash } from '../domain/shared-view.js';
import { ConnectionError, InvalidLink, SharedFrame, StateCard } from './SharedFrame.js';
import { SharedQuestionCard } from './SharedQuestionCard.js';

// "/shared/:token/sessions/:sessionId": one shared session, all questions on one scrolling page with a question index
// (design S31). `#cau-<n>` opens at question n.
export function SharedSessionPage() {
  const { token = '', sessionId } = useParams();
  const id = Number(sessionId);
  const nav = useNavigate();
  const loc = useLocation() as { state: { fromList?: boolean } | null; hash: string };
  const desk = useIsDesk();
  const { load, retry, retrying } = useSharedSession(token, id);
  const [cur, setCur] = useState(0);
  const [indexOpen, setIndexOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  // Back to the list: the browser keeps its scroll when we came from it; otherwise go there and focus this row.
  const back = () => (loc.state?.fromList ? nav(-1) : nav(listPath(token), { state: { focusSession: id } }));
  const backButton = <Button variant="secondary" icon="arrow-left" onClick={back}>Danh sách phiên</Button>;

  const scrollTo = (i: number) => {
    const el = refs.current[i];
    if (!el) return;
    const box = mainRef.current;
    if (box && desk) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 24;
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72 });
    el.querySelector<HTMLElement>('[id$="-tieu-de"]')?.focus({ preventScroll: true });
  };
  const jump = (i: number) => {
    setCur(i);
    setIndexOpen(false);
    history.replaceState(history.state, '', `#cau-${i + 1}`);
    scrollTo(i);
  };
  // The current question is the last one whose top has passed near the top of the scrolling area: the main pane
  // on desktop, the window on a phone.
  const onScroll = () => {
    if (load.state !== 'ready') return;
    const box = desk ? mainRef.current : null;
    if (desk && !box) return;
    const top = box ? box.getBoundingClientRect().top : 0;
    let c = 0;
    refs.current.forEach((el, i) => { if (el && el.getBoundingClientRect().top - top < 120) c = i; });
    setCur(prev => (prev === c ? prev : c));
  };
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  const count = load.state === 'ready' ? load.data.questions.length : 0;
  // On a phone the window scrolls, so follow it there (desktop listens on the main pane through SharedFrame).
  useEffect(() => {
    if (desk || load.state !== 'ready') return;
    const handler = () => onScrollRef.current();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [desk, load.state]);
  useEffect(() => {
    if (load.state !== 'ready') return;
    const at = questionFromHash(loc.hash, count);
    if (at !== null) { setCur(at); setTimeout(() => scrollTo(at), 0); }
  }, [load.state]);

  if (load.state === 'failed' && load.failure === 'invalid') return <SharedFrame desk={desk}><InvalidLink /></SharedFrame>;
  if (load.state === 'failed' && load.failure === 'unshared') {
    return (
      <SharedFrame desk={desk}>
        <StateCard heading="h1" icon="eye-off" title="Phiên này không còn được chia sẻ" text="Mentor đã ngừng chia sẻ phiên này. Các phiên khác có thể vẫn đang được chia sẻ trong danh sách." action={<Button icon="arrow-left" onClick={() => nav(listPath(token))}>Về danh sách phiên</Button>} />
      </SharedFrame>
    );
  }
  if (load.state === 'loading') return <SharedFrame desk={desk}><div>{backButton}</div><Spinner block label="Đang tải phiên…" /></SharedFrame>;
  if (load.state === 'failed') return <SharedFrame desk={desk}><div>{backButton}</div><ConnectionError what="phiên này" onRetry={retry} retrying={retrying} /></SharedFrame>;

  const v = load.data;
  refs.current.length = v.questions.length;
  const meta = [v.startedAt === null ? null : `${longDate(v.startedAt)} · ${clockOf(v.startedAt)}`, `${v.questionCount} câu`, `${v.submitted} bài nộp`].filter(Boolean).join(' · ');
  const head = (
    <div style={{ display: 'grid', gap: 10 }}>
      {!desk && <div>{backButton}</div>}
      <h1 tabIndex={-1} data-pq-focus="" style={{ ...mText.h1, outline: 'none', overflowWrap: 'anywhere' }}>{v.examTitle}</h1>
      <p style={mText.meta}>{meta}</p>
      <p role="note" style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--ink-200)', font: 'var(--type-ui)', fontSize: 14, color: 'var(--ink-700)' }}>
        <Icon name="eye" size={16} style={{ marginTop: 2, flex: 'none' }} />
        <span><b>Bạn đang xem lại, không có điểm.</b> Đây là đề, đáp án và lời giải của phiên này, kèm tỉ lệ chung cả lớp đã chọn — không có bài làm của ai.</span>
      </p>
      {v.submitted === 0 && <p style={mText.meta}>Phiên không có bài nộp nào nên không có tỉ lệ chọn. Đáp án và lời giải vẫn đầy đủ.</p>}
    </div>
  );
  const cards = v.questions.map((q, i) => (
    <div key={q.id} id={`cau-${i + 1}`} ref={el => { refs.current[i] = el; }} style={{ minWidth: 0, scrollMarginTop: 72 }}>
      <SharedQuestionCard q={q} index={i} submitted={v.submitted} />
    </div>
  ));
  const index = <QuestionNav count={v.questions.length} current={cur} answered={[]} onSelect={jump} />;

  if (desk) {
    const sidebar = (
      <>
        <div style={{ padding: '20px 20px 12px' }}>{backButton}</div>
        <div style={{ padding: '4px 20px', display: 'grid', gap: 10 }}><span style={mText.label}>Mục lục</span>{index}</div>
        <div style={{ marginTop: 'auto', padding: '14px 20px 18px', borderTop: '1px solid var(--border-hairline)' }}>
          <Button variant="ghost" onClick={() => jump(0)}>Lên đầu trang</Button>
        </div>
      </>
    );
    return <SharedFrame desk sidebar={sidebar} mainRef={mainRef} onMainScroll={onScroll}>{head}{cards}</SharedFrame>;
  }
  return (
    <SharedFrame desk={false}>
      {head}
      <Card padding={12}>
        <button type="button" aria-expanded={indexOpen} onClick={() => setIndexOpen(o => !o)} style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 0, padding: '0 4px', font: 'var(--type-ui)', fontWeight: 600, color: 'var(--text-title)', cursor: 'pointer' }}>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Icon name="list" size={16} />Mục lục · Câu {cur + 1}/{v.questions.length}</span>
          <Icon name="chevron-down" size={16} style={{ transform: indexOpen ? 'rotate(180deg)' : 'none' }} />
        </button>
        {indexOpen && <div style={{ paddingTop: 10 }}>{index}</div>}
      </Card>
      {cards}
    </SharedFrame>
  );
}
