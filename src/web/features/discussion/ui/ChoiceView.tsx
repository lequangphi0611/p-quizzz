import type { DiscussionQuestion } from '../../../../shared/api/index.js';
import { Markdown } from '../../../shared/ui/Markdown.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { commonMistakeId, optionLetter, percent } from '../domain/discussion-ui.js';
import { OptionTally } from './OptionTally.js';
import { QHeader, RevealButton } from './parts.js';
import { st } from './styles.js';

export function ChoiceView({ q, index, submitted, revealed, onToggle }: { q: DiscussionQuestion; index: number; submitted: number; revealed: boolean; onToggle: () => void }) {
  const flagged = commonMistakeId(q, submitted);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,800px) minmax(0,1fr)', gap: 64, height: '100%', minHeight: 0 }}>
      <div className="pq-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 28, minHeight: 0, overflow: 'auto' }}>
        <QHeader q={q} index={index} />
        <h1 style={st.prompt}><Markdown inlineOnly size="screen" source={q.prompt} /></h1>
        {q.body && <Markdown size="screen" source={q.body} />}
        {revealed
          ? <div key="exp" style={{ ...st.panel, ...st.reveal, display: 'grid', gap: 12 }}><div style={st.panelLabel}><Icon name="info" size={24} />Giải thích</div>{q.explanation ? <Markdown size="screen" source={q.explanation} /> : <span style={{ ...st.body28, color: 'var(--screen-meta)' }}>Đề không có giải thích cho câu này.</span>}</div>
          : <div key="hid" style={{ ...st.hiddenPanel, gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 14, color: 'var(--screen-meta)', font: '500 26px/1.3 var(--font-sans)' }}><Icon name="eye-off" size={28} />Đáp án và giải thích đang ẩn</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
        <div role="list" aria-label="Lựa chọn của cả lớp" className="pq-scroll" style={{ display: 'grid', gap: 12, overflow: 'auto', minHeight: 0 }}>
          {q.options.map((o, i) => <OptionTally key={o.id} kind={q.type === 'multi' ? 'multi' : 'single'} letter={optionLetter(i)} text={o.text} count={o.count} total={submitted} revealed={revealed} correct={o.isCorrect} flag={flagged === o.id ? 'common' : undefined} />)}
        </div>
        {q.type === 'multi' && (
          <div key={revealed ? 'r' : 'h'} style={{ display: 'flex', alignItems: 'center', gap: 12, font: '500 26px/1.3 var(--font-sans)', color: revealed ? 'var(--screen-text)' : 'var(--screen-meta)', ...(revealed ? st.reveal : null) }}>
            <Icon name={revealed ? 'list-checks' : 'info'} size={28} style={{ color: revealed ? 'var(--sun-400)' : undefined }} />
            {revealed ? 'Phải chọn đúng đủ các đáp án mới có điểm' : 'Mỗi bài có thể chọn nhiều phương án — tỉ lệ tính riêng từng phương án'}
          </div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, paddingTop: 20, borderTop: '2px solid var(--screen-line)' }}>
          <div key={revealed ? 'r' : 'h'} aria-live="polite" style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', ...st.body28 }}>
            {revealed
              ? <><span style={{ ...st.big, color: 'var(--screen-correct)' }}>{q.correctCount}<span style={{ fontSize: 36, color: 'var(--screen-meta)' }}>/{submitted}</span></span><span>làm đúng <b style={st.mono}>({percent(q.correctCount, submitted)}%)</b>{q.type === 'multi' ? ' trọn bộ' : ''}</span><span style={{ color: 'var(--screen-meta)' }}>· <span style={st.mono}>{q.blankCount}</span> bỏ trống</span></>
              : <><span style={st.big}>{submitted}</span><span>bài</span><span style={{ color: 'var(--screen-meta)' }}>· <span style={st.mono}>{q.blankCount}</span> bỏ trống</span></>}
          </div>
          <RevealButton revealed={revealed} onToggle={onToggle} />
        </div>
      </div>
    </div>
  );
}
