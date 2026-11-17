import type { DiscussionQuestion } from '../../../../shared/api/index.js';
import { Markdown } from '../../../shared/ui/Markdown.js';
import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { formatPoints } from '../../../shared/format/points.js';
import { TYPE_LABEL, st } from './styles.js';

export function QHeader({ q, index }: { q: DiscussionQuestion; index: number }) {
  return <div style={st.meta}><span style={{ color: 'var(--sun-400)' }}>Câu {index + 1}</span><span>·</span><span>{TYPE_LABEL[q.type]}</span><span>·</span><span>{formatPoints(q.points)} điểm</span></div>;
}

export function RevealButton({ revealed, onToggle, size = 'xxl' }: { revealed: boolean; onToggle: () => void; size?: 'xl' | 'xxl' }) {
  return revealed
    ? <Button tone="screen" variant="secondary" size={size} icon="eye-off" shortcut="Space" onClick={onToggle}>Ẩn đáp án</Button>
    : <Button tone="screen" variant="primary" size={size} icon="key-round" shortcut="Space" onClick={onToggle}>Hiện đáp án</Button>;
}

/** S25: shows / hides the class's work (tallies, essay papers). Secondary and placed in the area it opens, so it is
 *  never mistaken for "Hiện đáp án" (different place, colour, icon and key). */
export function WorkButton({ shown, onToggle, size = 'xxl' }: { shown: boolean; onToggle: () => void; size?: 'xl' | 'xxl' }) {
  return shown
    ? <Button tone="screen" variant="ghost" size={size} icon="eye-off" shortcut="B" onClick={onToggle} style={{ border: '2px solid var(--screen-line-strong)' }}>Ẩn bài làm</Button>
    : <Button tone="screen" variant="secondary" size={size} icon="users" shortcut="B" onClick={onToggle}>Hiện bài làm</Button>;
}

// The exam format keeps "model answer + rubric" as one Markdown block (docs/exam-format.md), so it is shown as one panel.
export function RubricPanel({ q, revealed, onToggle }: { q: DiscussionQuestion; revealed: boolean; onToggle: () => void }) {
  if (!revealed) {
    return (
      <div style={st.hiddenPanel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--screen-meta)', font: '500 26px/1.3 var(--font-sans)' }}><Icon name="eye-off" size={28} />Đáp án mẫu &amp; rubric đang ẩn</div>
        <div><RevealButton revealed={false} onToggle={onToggle} size="xl" /></div>
      </div>
    );
  }
  return (
    <section aria-label="Đáp án mẫu và rubric" style={{ ...st.panel, ...st.reveal, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, maxHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={st.panelLabel}><Icon name="key-round" size={24} />Đáp án mẫu &amp; rubric</span>
        <Button tone="screen" variant="ghost" size="xl" icon="eye-off" ariaLabel="Ẩn đáp án (Space)" onClick={onToggle} style={{ marginLeft: 'auto' }} />
      </div>
      <div className="pq-scroll" style={{ overflow: 'auto', minHeight: 0, flex: '0 1 auto' }}>
        {q.explanation ? <Markdown size="screen" className="pq-md-rubric" source={q.explanation} /> : <span style={{ ...st.body28, color: 'var(--screen-meta)' }}>Đề không có đáp án mẫu cho câu này.</span>}
      </div>
    </section>
  );
}
