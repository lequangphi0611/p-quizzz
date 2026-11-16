import type { DiscussionAnswer, DiscussionQuestion } from '../../../../shared/api/index.js';
import { Markdown } from '../../../components/Markdown.js';
import { Button } from '../../../components/ui/Button.js';
import { Icon } from '../../../components/ui/Icon.js';
import { TextField } from '../../../components/ui/TextField.js';
import { formatPoints } from '../../../shared/format/points.js';
import { SaveIndicator } from '../../../shared/ui/SaveIndicator.js';
import type { Draft } from '../domain/grade-draft.js';
import { RubricPanel } from './parts.js';
import { ScoreField } from './ScoreField.js';
import { st } from './styles.js';

export function PaperView({ q, index, revealed, onToggle, papers, paperIdx, draft, locked, onScore, onFeedback, onCommitScore, onCommitFeedback, onNav, onBack }: {
  q: DiscussionQuestion; index: number; revealed: boolean; onToggle: () => void; papers: DiscussionAnswer[]; paperIdx: number; draft: Draft; locked: boolean;
  onScore: (v: string) => void; onFeedback: (v: string) => void; onCommitScore: (v: string, enter: boolean) => void; onCommitFeedback: () => void; onNav: (d: number) => void; onBack: () => void;
}) {
  const p = papers[paperIdx]!;
  const graded = p.manualScore !== null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,680px)', gap: 40, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Button tone="screen" variant="ghost" size="xl" icon="arrow-left" onClick={onBack}>Danh sách bài</Button>
          <span style={{ font: '800 44px/1 var(--font-sans)', letterSpacing: '-0.01em' }}>Bài <span style={st.mono}>#{paperIdx + 1}</span></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-pill)', font: '600 22px/1 var(--font-sans)', border: '2px solid ' + (graded ? 'var(--screen-correct-border)' : 'var(--sun-500)'), background: graded ? 'var(--screen-correct-surface)' : 'var(--screen-pending-surface)', color: graded ? 'var(--screen-correct)' : 'var(--sun-400)' }}>
            <Icon name={graded ? 'circle-check' : 'hourglass'} size={22} />{graded ? <>Đã chấm <b style={st.mono}>{formatPoints(p.manualScore!)}/{formatPoints(q.points)}</b></> : 'Chưa chấm'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', font: '600 28px/1.35 var(--font-sans)', color: 'var(--screen-meta)' }}>
          <span style={{ color: 'var(--sun-400)', flex: 'none' }}>Câu {index + 1}</span>
          <span style={{ color: '#DDE1E7', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Markdown inlineOnly size="screen" source={q.prompt} /></span>
        </div>
        <div tabIndex={0} aria-label={`Nội dung bài #${paperIdx + 1}`} className="pq-scroll" style={{ ...st.panel, flex: 1, minHeight: 0, overflow: 'auto', padding: '26px 32px', font: '400 28px/1.6 var(--font-mono)', color: '#fff', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.textAnswer}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <Button tone="screen" variant="secondary" size="xl" icon="chevron-left" shortcut="K" disabled={paperIdx === 0} onClick={() => onNav(-1)}>Bài trước</Button>
          <span style={{ font: '700 30px/1 var(--font-mono)', minWidth: 200, textAlign: 'center' }}>Bài #{paperIdx + 1} <span style={{ color: 'var(--screen-meta)' }}>/ {papers.length}</span></span>
          <Button tone="screen" variant="secondary" size="xl" iconRight="chevron-right" shortcut="J" disabled={paperIdx === papers.length - 1} onClick={() => onNav(1)}>Bài sau</Button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
        <RubricPanel q={q} revealed={revealed} onToggle={onToggle} />
        <div style={{ ...st.panel, marginTop: 'auto', display: 'grid', gap: 18, flex: 'none' }}>
          <ScoreField value={draft.value} max={q.points} error={draft.error} locked={locked} onChange={onScore} onCommit={onCommitScore} />
          {locked
            ? (p.feedback ? <div style={{ display: 'grid', gap: 8 }}><span style={{ font: 'var(--type-label)', fontSize: 22, color: 'var(--screen-meta)' }}>Nhận xét</span><span style={st.body28}>{p.feedback}</span></div> : null)
            : <div onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') onCommitFeedback(); }}><TextField size="screen" label="Nhận xét (tuỳ chọn)" placeholder="Ghi chú ngắn cho bài này" maxLength={2000} value={draft.feedback} onChange={onFeedback} onBlur={onCommitFeedback} /></div>}
          {!locked && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <SaveIndicator size="screen" state={draft.save} onRetry={() => onCommitScore(draft.value, false)} />
              <span style={{ font: '400 20px/1.2 var(--font-sans)', color: 'var(--screen-meta)' }}><kbd style={st.kbd}>Enter</kbd> lưu &amp; sang bài chưa chấm</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
