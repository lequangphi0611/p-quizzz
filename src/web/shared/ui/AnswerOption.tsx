import { useState } from 'react';
import { Markdown } from './Markdown.js';
import { Icon } from './Icon.js';

export type OptionResult = 'correct' | 'wrong' | 'missed' | 'neutral';

// One answer row. Interactive when no `result` is given (exam taking); read-only for preview/review.
export function AnswerOption({ kind = 'single', text, selected = false, result, onClick, disabled = false, chosenLabel = 'Bạn chọn' }: {
  kind?: 'single' | 'multi'; text: string; selected?: boolean; result?: OptionResult; onClick?: () => void; disabled?: boolean;
  /** Tag on a wrong pick: "Bạn chọn" to the member, "Đã chọn" when the mentor reads someone else's attempt. */
  chosenLabel?: string;
}) {
  const [hover, setHover] = useState(false);
  let bg = 'var(--paper)', border = 'var(--border-strong)', dash = 'solid', mark = 'var(--ink-300)', fill = 'transparent';
  let tag: [string, string, string] | null = null;
  if (selected) { bg = 'var(--selected-bg)'; border = 'var(--selected-border)'; mark = 'var(--brand-600)'; fill = 'var(--brand-600)'; }
  if (result === 'correct') { bg = 'var(--correct-surface)'; border = 'var(--correct-500)'; mark = fill = 'var(--correct-600)'; tag = ['circle-check', 'Đúng', 'var(--correct-600)']; }
  if (result === 'wrong') { bg = 'var(--wrong-surface)'; border = 'var(--wrong-500)'; mark = fill = 'var(--wrong-600)'; tag = ['circle-x', chosenLabel, 'var(--wrong-600)']; }
  if (result === 'missed') { bg = 'var(--paper)'; border = 'var(--correct-500)'; dash = 'dashed'; mark = 'var(--correct-600)'; fill = 'transparent'; tag = ['check', 'Đáp án đúng', 'var(--correct-600)']; }
  if (result === 'neutral') { bg = 'var(--paper)'; border = 'var(--border-hairline)'; mark = 'var(--ink-300)'; fill = 'transparent'; }
  const isOn = selected || result === 'correct' || result === 'wrong';
  const interactive = !result && !disabled;
  const hovering = interactive && hover && !selected;
  return (
    <button type="button" onClick={interactive ? onClick : undefined} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} role={kind === 'multi' ? 'checkbox' : 'radio'} aria-checked={isOn}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, padding: '12px 14px', textAlign: 'left', background: hovering ? 'var(--ink-050)' : bg, border: `1.5px ${dash} ${hovering ? 'var(--ink-400)' : border}`, borderRadius: 'var(--radius-md)', cursor: interactive ? 'pointer' : 'default', font: 'var(--type-body)', fontSize: 16, color: 'var(--text-title)', transition: 'background var(--dur-fast), border-color var(--dur-fast)' }}>
      <span style={{ flex: 'none', width: 22, height: 22, display: 'grid', placeItems: 'center', borderRadius: kind === 'multi' ? 6 : '50%', border: '2px solid ' + mark, background: kind === 'multi' && isOn ? fill : 'transparent', color: '#fff' }}>
        {kind === 'multi' && isOn && <Icon name="check" size={14} />}
        {kind === 'single' && isOn && <span style={{ width: 10, height: 10, borderRadius: '50%', background: fill }} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}><Markdown inlineOnly source={text} /></span>
      {tag && <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--type-label)', color: tag[2] }}><Icon name={tag[0]} size={14} />{tag[1]}</span>}
    </button>
  );
}
