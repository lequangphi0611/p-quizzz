import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { formatPoints } from '../../format/points.js';
import { plainPrompt, type ReviewMark, type ReviewMarkKind } from './review-mark.js';

// Question navigation of the member screens: a sidebar list on desktop, a strip of cells on phones.

const MARK: Record<ReviewMarkKind, { icon: string; fg: string; bg: string; bd: string; label: string }> = {
  correct: { icon: 'circle-check', fg: 'var(--correct-600)', bg: 'var(--correct-surface)', bd: 'var(--correct-border)', label: 'Đúng' },
  wrong: { icon: 'circle-x', fg: 'var(--wrong-600)', bg: 'var(--wrong-surface)', bd: 'var(--wrong-border)', label: 'Sai' },
  partial: { icon: 'circle-dot', fg: 'var(--warn-600)', bg: 'var(--warn-surface)', bd: 'var(--warn-border)', label: 'Một phần' },
  pending: { icon: 'hourglass', fg: 'var(--ink-700)', bg: 'var(--ink-100)', bd: 'var(--ink-300)', label: 'Chờ chấm' },
};

export interface NavQuestion { prompt: string; points: number }

// Taking: a `{reason}` question with a pick but no reason yet (PRODUCT.md §7.32b). Shown instead of "đã trả lời".
const NEEDS_REASON = { icon: 'message-square', fg: 'var(--warn-600)', bg: 'var(--warn-surface)', bd: 'var(--warn-border)', label: 'Thiếu lý do' };

function SideRow({ i, q, cur, done, mark, needsReason = false, onSelect }: { i: number; q: NavQuestion; cur: boolean; done: boolean; mark?: ReviewMark; needsReason?: boolean; onSelect: (i: number) => void }) {
  const [hover, setHover] = useState(false);
  const m = mark ? MARK[mark.kind] : needsReason && !cur ? NEEDS_REASON : undefined;
  const badge = m ? { bg: m.bg, fg: m.fg, bd: '1.5px solid ' + m.bd }
    : cur ? { bg: 'var(--brand-600)', fg: '#fff', bd: '1.5px solid var(--brand-600)' }
    : done ? { bg: 'var(--brand-100)', fg: 'var(--brand-700)', bd: '1.5px solid var(--brand-200)' }
    : { bg: 'var(--paper)', fg: 'var(--ink-700)', bd: '1.5px dashed var(--ink-400)' };
  return (
    <button type="button" onClick={() => onSelect(i)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-current={cur ? 'step' : undefined}
      aria-label={`Câu ${i + 1}, ${formatPoints(q.points)} điểm, ${mark ? mark.text : needsReason ? 'thiếu lý do' : done ? 'đã trả lời' : 'chưa trả lời'}`}
      style={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', gap: 12, alignItems: 'center', width: '100%', minHeight: 56, padding: '8px 12px', border: '1px solid ' + (cur ? 'var(--brand-200)' : 'transparent'), borderRadius: 'var(--radius-md)', background: cur ? 'var(--brand-050)' : hover ? 'var(--ink-050)' : 'transparent', textAlign: 'left', cursor: 'pointer', transition: 'background var(--dur-fast)' }}>
      <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-sm)', background: badge.bg, color: badge.fg, border: badge.bd, font: '700 14px/1 var(--font-mono)', boxSizing: 'border-box' }}>{i + 1}</span>
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <span style={{ font: '600 14px/1.3 var(--font-sans)', color: 'var(--text-title)', whiteSpace: 'nowrap' }}>Câu {i + 1}<span style={{ fontWeight: 400, color: 'var(--text-meta)' }}> · {formatPoints(q.points)}đ</span></span>
          {m || needsReason ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--type-label)', color: (m ?? NEEDS_REASON).fg, whiteSpace: 'nowrap' }}><Icon name={(m ?? NEEDS_REASON).icon} size={13} />{mark ? mark.text : NEEDS_REASON.label}</span>
            : done ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--type-label)', color: 'var(--brand-700)', whiteSpace: 'nowrap' }}><Icon name="check" size={13} />Đã trả lời</span>
            : <span style={{ font: 'var(--type-label)', color: 'var(--ink-600)', whiteSpace: 'nowrap' }}>Chưa trả lời</span>}
        </span>
        <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plainPrompt(q.prompt)}</span>
      </span>
    </button>
  );
}

/** Desktop sidebar list of questions (taking: answered / not; review: per-question mark). */
export function SideNav({ questions, current, answered = [], needsReason = [], marks, onSelect }: { questions: NavQuestion[]; current: number; answered?: number[]; needsReason?: number[]; marks?: ReviewMark[]; onSelect: (i: number) => void }) {
  const set = new Set(answered);
  const missing = new Set(needsReason);
  return <nav aria-label="Danh sách câu" style={{ display: 'grid', gap: 2 }}>{questions.map((q, i) => <SideRow key={i} i={i} q={q} cur={i === current} done={set.has(i)} needsReason={missing.has(i)} mark={marks?.[i]} onSelect={onSelect} />)}</nav>;
}

export function NavCell({ i, cur, done, mark, needsReason = false, fill = false, onSelect }: { i: number; cur: boolean; done: boolean; mark?: ReviewMark; needsReason?: boolean; fill?: boolean; onSelect: (i: number) => void }) {
  const m = mark ? MARK[mark.kind] : needsReason && !cur ? NEEDS_REASON : undefined;
  const s = m ? [m.bg, m.fg, 'solid ' + m.bd] : cur ? ['var(--brand-600)', '#fff', 'solid var(--brand-600)'] : done ? ['var(--brand-100)', 'var(--brand-700)', 'solid var(--brand-200)'] : ['var(--paper)', 'var(--ink-700)', 'dashed var(--ink-400)'];
  return (
    <button type="button" onClick={() => onSelect(i)} aria-current={cur ? 'step' : undefined} aria-label={`Câu ${i + 1}${m ? ', ' + m.label : needsReason ? ', thiếu lý do' : done ? ', đã trả lời' : ', chưa trả lời'}`}
      style={{ position: 'relative', flex: 'none', width: fill ? '100%' : 44, height: fill ? 56 : 44, borderRadius: 'var(--radius-sm)', font: '700 15px/1 var(--font-mono)', cursor: 'pointer', scrollSnapAlign: 'center', background: s[0], color: s[1], border: '1.5px ' + s[2], boxShadow: cur && !m ? 'var(--shadow-press)' : 'none', outline: cur && m ? '2px solid var(--brand-500)' : 'none', outlineOffset: 2 }}>
      {i + 1}
      {(done || m) && <span aria-hidden="true" style={{ position: 'absolute', top: 3, right: 3, display: 'flex' }}><Icon name={m ? m.icon : 'check'} size={11} /></span>}
    </button>
  );
}

/** Phone: one row of 44px cells that keeps the current question centred, plus a button that opens the full list. */
export function StripNav({ count, current, answered = [], needsReason = [], marks, onSelect, onOpenAll }: { count: number; current: number; answered?: number[]; needsReason?: number[]; marks?: ReviewMark[]; onSelect: (i: number) => void; onOpenAll?: () => void }) {
  const set = new Set(answered);
  const missing = new Set(needsReason);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const r = ref.current;
    const c = r?.children[current] as HTMLElement | undefined;
    if (r && c) r.scrollLeft = c.offsetLeft - r.clientWidth / 2 + c.offsetWidth / 2;
  }, [current]);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
      <nav ref={ref} aria-label="Danh sách câu" style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, overflowX: 'auto', scrollSnapType: 'x proximity', padding: '2px 2px 4px', scrollbarWidth: 'none' }}>
        {Array.from({ length: count }, (_, i) => <NavCell key={i} i={i} cur={i === current} done={set.has(i)} needsReason={missing.has(i)} mark={marks?.[i]} onSelect={onSelect} />)}
      </nav>
      {onOpenAll && <Button variant="secondary" size="lg" icon="list" ariaLabel="Mở danh sách câu" onClick={onOpenAll} style={{ width: 44, height: 44 }} />}
    </div>
  );
}

