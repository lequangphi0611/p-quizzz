import type { DiscussionAnswer, DiscussionQuestion } from '../../../../shared/api/index.js';
import { Markdown } from '../../../components/Markdown.js';
import { Button } from '../../../components/ui/Button.js';
import { Icon } from '../../../components/ui/Icon.js';
import { EssayCard } from './EssayCard.js';
import { QHeader, RubricPanel } from './parts.js';
import { st } from './styles.js';

export function EssayList({ q, index, revealed, onToggle, papers, blanks, lastOpened, locked, zeroing, onOpen, onZeroBlanks }: {
  q: DiscussionQuestion; index: number; revealed: boolean; onToggle: () => void; papers: DiscussionAnswer[]; blanks: DiscussionAnswer[]; lastOpened: number | null; locked: boolean; zeroing: boolean;
  onOpen: (i: number) => void; onZeroBlanks: () => void;
}) {
  // Progress counts blanks too (they need a score before finalizing), matching the question nav and the header.
  const all = [...papers, ...blanks];
  const graded = all.filter(p => p.manualScore !== null).length;
  const done = graded === all.length;
  const blanksUngraded = blanks.filter(b => b.manualScore === null).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,720px)', gap: 48, alignItems: 'start', maxHeight: '48%', minHeight: 0 }}>
        <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
          <QHeader q={q} index={index} />
          <h1 style={st.prompt}><Markdown inlineOnly size="screen" source={q.prompt} /></h1>
          {q.body && <Markdown size="screen" source={q.body} />}
          {all.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...st.body28, color: done ? 'var(--screen-correct)' : 'var(--screen-text)' }}>
              <Icon name={done ? 'circle-check' : 'pencil'} size={28} style={{ color: done ? undefined : 'var(--sun-400)' }} />Đã chấm <b style={st.mono}>{graded}/{all.length}</b>
              {!locked && !done && <span style={{ color: 'var(--screen-meta)', fontSize: 24 }}>· mở một bài để chấm</span>}
            </div>
          )}
        </div>
        <RubricPanel q={q} revealed={revealed} onToggle={onToggle} />
      </div>
      <div role="list" aria-label="Bài tự luận ẩn danh" className="pq-scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 16, overflow: 'auto', minHeight: 0, padding: 8, margin: -8, alignContent: 'start' }}>
        {papers.map((p, i) => (
          <div role="listitem" key={p.answerId} style={{ display: 'grid' }}>
            <EssayCard number={i + 1} excerpt={p.textAnswer ?? ''} status={p.manualScore !== null ? 'graded' : 'ungraded'} score={p.manualScore} maxScore={q.points} current={lastOpened === i} onClick={() => onOpen(i)} />
          </div>
        ))}
        {blanks.length > 0 && (
          <div role="listitem" style={{ ...st.hiddenPanel, padding: '18px 22px', gap: 12 }}>
            <span style={{ font: '700 30px/1 var(--font-sans)' }}><span style={st.mono}>{blanks.length}</span> bài bỏ trống</span>
            {blanksUngraded === 0
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 22px/1.3 var(--font-sans)', color: 'var(--screen-correct)', ...st.reveal }}><Icon name="circle-check" size={22} />Đã chấm</span>
              : <span style={{ font: '400 22px/1.3 var(--font-sans)', color: 'var(--screen-meta)' }}>Không có nội dung</span>}
            {blanksUngraded > 0 && !locked && <Button tone="screen" variant="secondary" size="xl" loading={zeroing} onClick={onZeroBlanks} style={{ alignSelf: 'end' }}>Chấm 0 cho {blanksUngraded} bài</Button>}
          </div>
        )}
        {papers.length === 0 && blanks.length === 0 && <span style={{ ...st.body28, color: 'var(--screen-meta)' }}>Không có bài nào cho câu này.</span>}
      </div>
    </div>
  );
}
