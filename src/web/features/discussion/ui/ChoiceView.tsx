import type { DiscussionQuestion } from '../../../../shared/api/index.js';
import { Markdown } from '../../../shared/ui/Markdown.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { commonMistakeId, optionLetter, percent } from '../domain/discussion-ui.js';
import { OptionTally } from './OptionTally.js';
import { QHeader, RevealButton, WorkButton } from './parts.js';
import { st } from './styles.js';

/**
 * A single / multi choice question on the projector. Two independent covers (S25): the class's work (bars, counts,
 * "Nhầm phổ biến", "x/y làm đúng") and the answer (correct option + explanation). Each button sits in the area it opens:
 * "Hiện đáp án" at the bottom of the left column, "Hiện bài làm" at the bottom of the right one. While the work is
 * hidden only the number of papers and blanks shows. The common-mistake flag and "x/y làm đúng" need both open.
 */
export function ChoiceView({ q, index, submitted, revealed, onToggle, work, onToggleWork }: {
  q: DiscussionQuestion; index: number; submitted: number; revealed: boolean; onToggle: () => void; work: boolean; onToggleWork: () => void;
}) {
  const flagged = work ? commonMistakeId(q, submitted) : null;
  const both = work && revealed;
  const multiNote: [string, string, boolean] | null = q.type !== 'multi' ? null
    : !work ? ['list-checks', 'Chọn nhiều đáp án — có thể có hơn một phương án đúng', false]
    : revealed ? ['list-checks', 'Phải chọn đúng đủ các đáp án mới có điểm', true]
    : ['info', 'Mỗi bài có thể chọn nhiều phương án — tỉ lệ tính riêng từng phương án', false];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,800px) minmax(0,1fr)', gap: 64, height: '100%', minHeight: 0 }}>
      <div className="pq-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 28, minHeight: 0, overflow: 'auto' }}>
        <QHeader q={q} index={index} />
        <h1 style={st.prompt}><Markdown inlineOnly size="screen" source={q.prompt} /></h1>
        {q.body && <Markdown size="screen" source={q.body} />}
        <div style={{ marginTop: 'auto' }}>
          {revealed
            ? (
              <section key="exp" aria-label="Giải thích" style={{ ...st.panel, ...st.reveal, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <span style={st.panelLabel}><Icon name="key-round" size={24} />Giải thích</span>
                  <RevealButton revealed onToggle={onToggle} size="xl" />
                </div>
                {q.explanation ? <Markdown size="screen" source={q.explanation} /> : <span style={{ ...st.body28, color: 'var(--screen-meta)' }}>Đề không có giải thích cho câu này.</span>}
              </section>
            )
            : (
              <div key="hid" style={{ ...st.hiddenPanel, gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--screen-meta)', font: '500 28px/1.3 var(--font-sans)' }}><Icon name="eye-off" size={30} />Đáp án và giải thích đang ẩn</div>
                <div><RevealButton revealed={false} onToggle={onToggle} /></div>
              </div>
            )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
        <div role="list" aria-label={work ? 'Lựa chọn của cả lớp' : 'Các phương án'} className="pq-scroll" style={{ display: 'grid', gap: 12, overflow: 'auto', minHeight: 0 }}>
          {q.options.map((o, i) => <OptionTally key={o.id} kind={q.type === 'multi' ? 'multi' : 'single'} letter={optionLetter(i)} text={o.text} count={o.count} total={submitted} revealed={revealed} correct={o.isCorrect} flag={flagged === o.id ? 'common' : undefined} tally={work} stagger={i} />)}
        </div>
        {multiNote && (
          <div key={multiNote[1]} style={{ display: 'flex', alignItems: 'center', gap: 12, font: '500 26px/1.3 var(--font-sans)', color: multiNote[2] ? 'var(--screen-text)' : 'var(--screen-meta)', ...st.reveal }}>
            <Icon name={multiNote[0]} size={28} style={{ color: multiNote[2] || !work ? 'var(--sun-400)' : undefined }} />{multiNote[1]}
          </div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, paddingTop: 20, borderTop: '2px solid var(--screen-line)' }}>
          <div key={both ? 'r' : 'h'} aria-live="polite" style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', ...st.body28 }}>
            {both
              ? <><span style={{ ...st.big, color: 'var(--screen-correct)' }}>{q.correctCount}<span style={{ fontSize: 36, color: 'var(--screen-meta)' }}>/{submitted}</span></span><span>làm đúng <b style={st.mono}>({percent(q.correctCount, submitted)}%)</b>{q.type === 'multi' ? ' trọn bộ' : ''}</span><span style={{ color: 'var(--screen-meta)' }}>· <span style={st.mono}>{q.blankCount}</span> bỏ trống</span></>
              : <><span style={st.big}>{submitted}</span><span>bài</span><span style={{ color: 'var(--screen-meta)' }}>· <span style={st.mono}>{q.blankCount}</span> bỏ trống</span></>}
          </div>
          <WorkButton shown={work} onToggle={onToggleWork} />
        </div>
      </div>
    </div>
  );
}
