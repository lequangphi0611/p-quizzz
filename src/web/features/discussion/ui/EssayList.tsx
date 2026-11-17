import type { DiscussionAnswer, DiscussionQuestion } from '../../../../shared/api/index.js';
import { Markdown } from '../../../shared/ui/Markdown.js';
import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { EssayCard } from './EssayCard.js';
import { QHeader, RubricPanel, WorkButton } from './parts.js';
import { st } from './styles.js';

export function EssayList({ q, index, revealed, onToggle, work, onToggleWork, papers, blanks, lastOpened, locked, zeroing, onOpen, onZeroBlanks }: {
  q: DiscussionQuestion; index: number; revealed: boolean; onToggle: () => void; work: boolean; onToggleWork: () => void; papers: DiscussionAnswer[]; blanks: DiscussionAnswer[]; lastOpened: number | null; locked: boolean; zeroing: boolean;
  onOpen: (i: number) => void; onZeroBlanks: () => void;
}) {
  // Progress counts blanks too (they need a score before finalizing), matching the question nav and the header.
  const all = [...papers, ...blanks];
  const graded = all.filter(p => p.manualScore !== null).length;
  const done = graded === all.length;
  const blanksUngraded = blanks.filter(b => b.manualScore === null).length;
  // Cards come in one by one when the work is shown, not again when coming back from a paper (lastOpened is set then).
  const stagger = lastOpened === null;
  // Same count as the multiple-choice footer ("30 bài · 3 bỏ trống"): every counted paper, blanks included.
  const countLine = <span style={{ font: '500 28px/1.3 var(--font-sans)', color: 'var(--screen-meta)' }}><b style={{ font: '700 30px/1 var(--font-mono)', color: 'var(--screen-text)' }}>{all.length}</b> bài · <span style={st.mono}>{blanks.length}</span> bỏ trống</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, height: '100%', minHeight: 0 }}>
      {/* The top row takes what it needs and shrinks (each column then scrolls inside it) so the papers keep at least
          one row of cards; a long prompt or rubric never spills over the papers or the key hints. Revealing the rubric
          widens it: the class is reading the model answer then, and model answers are often code. */}
      <div style={{ flex: '0 1 auto', display: 'grid', gridTemplateColumns: revealed ? 'minmax(0,1fr) minmax(0,2.2fr)' : 'minmax(0,1fr) minmax(0,720px)', gridTemplateRows: 'minmax(0,1fr)', gap: 48, alignItems: 'start', minHeight: 0 }}>
        <div className="pq-scroll" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 20, alignContent: 'start', minWidth: 0, minHeight: 0, maxHeight: '100%', overflow: 'auto' }}>
          <QHeader q={q} index={index} />
          <h1 style={st.prompt}><Markdown inlineOnly size="screen" source={q.prompt} /></h1>
          {q.body && <Markdown size="screen" source={q.body} />}
          {all.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...st.body28, color: done ? 'var(--screen-correct)' : 'var(--screen-text)' }}>
              <Icon name={done ? 'circle-check' : 'pencil'} size={28} style={{ color: done ? undefined : 'var(--sun-400)' }} />Đã chấm <b style={st.mono}>{graded}/{all.length}</b>
              {!locked && !done && <span style={{ color: 'var(--screen-meta)', fontSize: 24 }}>· {work ? 'mở một bài để chấm' : 'hiện bài làm để chấm'}</span>}
            </div>
          )}
        </div>
        <RubricPanel q={q} revealed={revealed} onToggle={onToggle} />
      </div>
      {!work
        ? (
          <div key="wh" style={{ ...st.hiddenPanel, flex: '1 1 0', minHeight: 210, alignContent: 'center', justifyItems: 'center', textAlign: 'center', gap: 22 }}>
            <span style={{ width: 96, height: 96, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--screen-panel)', border: '2px solid var(--screen-line)', color: 'var(--screen-meta)' }}><Icon name="eye-off" size={44} /></span>
            <span style={{ font: '700 40px/1.2 var(--font-sans)', color: 'var(--screen-text)' }}>Bài làm của lớp đang ẩn</span>
            {countLine}
            <WorkButton shown={false} onToggle={onToggleWork} />
          </div>
        )
        : (
          <div key="ws" style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '1 1 0', ...st.reveal }}>
            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ ...st.panelLabel, color: 'var(--screen-text)' }}><Icon name="users" size={26} style={{ color: 'var(--sun-400)' }} />Bài làm của lớp</span>
              {countLine}
              <span style={{ marginLeft: 'auto' }}><WorkButton shown onToggle={onToggleWork} size="xl" /></span>
            </div>
            <div role="list" aria-label="Bài tự luận ẩn danh" className="pq-scroll" style={{ flex: '1 1 0', minHeight: 210, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 16, overflow: 'auto', padding: 8, margin: -8, alignContent: 'start' }}>
              {papers.map((p, i) => (
                <div role="listitem" key={p.answerId} style={{ display: 'grid', animation: stagger ? `pq-reveal var(--dur-slow) var(--ease-standard) calc(var(--dur-fast) * ${Math.min(i, 12) * 0.4}) both` : undefined }}>
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
        )}
    </div>
  );
}
