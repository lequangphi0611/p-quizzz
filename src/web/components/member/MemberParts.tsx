import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MemberLayout } from '../../layouts/MemberLayout.js';
import { formatPoints } from '../../lib/exam-progress.js';
import { DESK_MIN, plainPrompt, type ReviewMark, type ReviewMarkKind } from '../../lib/member-ui.js';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
import { Icon } from '../ui/Icon.js';
import { Kbd } from '../ui/Kbd.js';

// Building blocks of the member screens (S18, design "member-v2").

export const mText = {
  label: { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--text-meta)' },
  h1: { margin: 0, font: 'var(--type-h1)', color: 'var(--text-title)', textWrap: 'pretty' },
  meta: { margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)', textWrap: 'pretty' },
  mono: { fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' },
} satisfies Record<string, CSSProperties>;

export const useIsDesk = () => useMediaQuery(`(min-width: ${DESK_MIN}px)`);
/** Show key chips only with a real pointer + hover (a keyboard is likely). */
export const useShowKeys = () => useMediaQuery('(hover: hover) and (pointer: fine)');

const MARK: Record<ReviewMarkKind, { icon: string; fg: string; bg: string; bd: string; label: string }> = {
  correct: { icon: 'circle-check', fg: 'var(--correct-600)', bg: 'var(--correct-surface)', bd: 'var(--correct-border)', label: 'Đúng' },
  wrong: { icon: 'circle-x', fg: 'var(--wrong-600)', bg: 'var(--wrong-surface)', bd: 'var(--wrong-border)', label: 'Sai' },
  partial: { icon: 'circle-dot', fg: 'var(--warn-600)', bg: 'var(--warn-surface)', bd: 'var(--warn-border)', label: 'Một phần' },
  pending: { icon: 'hourglass', fg: 'var(--ink-700)', bg: 'var(--ink-100)', bd: 'var(--ink-300)', label: 'Chờ chấm' },
};

/** Simple centred screens: a card in the wide shell on desktop, the narrow column on phones. */
export function MemberPage({ desk, title, name, status, maxW = 480, footer, children }: { desk: boolean; title?: string; name?: string; status?: ReactNode; maxW?: number; footer?: ReactNode; children: ReactNode }) {
  if (desk) {
    return (
      <MemberLayout variant="wide" sessionTitle={title} displayName={name} status={status}>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '48px 32px' }}><div style={{ width: '100%', maxWidth: maxW, display: 'grid', gap: 20, minWidth: 0 }}>{children}</div></div>
      </MemberLayout>
    );
  }
  return <MemberLayout sessionTitle={title} displayName={name} footer={footer}><div style={{ display: 'grid', gap: 20, paddingTop: 4, minWidth: 0 }}>{children}</div></MemberLayout>;
}

export function PageCard({ desk, children, center = false }: { desk: boolean; children: ReactNode; center?: boolean }) {
  return <Card padding={desk ? 32 : 20}><div style={{ display: 'grid', gap: center ? 14 : 20, ...(center ? { justifyItems: 'center', textAlign: 'center' } : null) }}>{children}</div></Card>;
}

export function HeroIcon({ name, tone = 'brand' }: { name: string; tone?: 'brand' | 'ink' | 'warn' | 'wrong' }) {
  const t = { brand: ['var(--brand-050)', 'var(--brand-600)'], ink: ['var(--ink-100)', 'var(--ink-700)'], warn: ['var(--warn-surface)', 'var(--warn-600)'], wrong: ['var(--wrong-surface)', 'var(--wrong-600)'] }[tone];
  return <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: t[0], color: t[1], flex: 'none' }}><Icon name={name} size={28} /></span>;
}

export function Chip({ tone = 'warn', icon, children }: { tone?: 'warn' | 'brand' | 'ink'; icon?: string; children: ReactNode }) {
  const t = { warn: ['var(--warn-surface)', 'var(--warn-600)', 'var(--warn-border)'], brand: ['var(--brand-100)', 'var(--brand-700)', 'var(--brand-200)'], ink: ['var(--ink-100)', 'var(--ink-700)', 'var(--ink-300)'] }[tone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: t[0], color: t[1], border: '1px solid ' + t[2], font: 'var(--type-label)', whiteSpace: 'nowrap' }}>{icon && <Icon name={icon} size={13} />}{children}</span>;
}

/** "Tạm tính" until the mentor finalizes, then "Chính thức". */
export const OfficialChip = ({ official }: { official: boolean }) => (official ? <Chip tone="brand" icon="circle-check">Chính thức</Chip> : <Chip icon="hourglass">Tạm tính</Chip>);

export function InfoRow({ icon, k, v }: { icon: string; k: string; v: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, font: 'var(--type-ui)', fontSize: 14 }}>
      <Icon name={icon} size={16} style={{ color: 'var(--text-meta)' }} /><span style={{ color: 'var(--text-meta)', flex: 'none' }}>{k}</span>
      <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text-title)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  );
}

export const InfoBox = ({ children }: { children: ReactNode }) => <div style={{ width: '100%', display: 'grid', gap: 10, padding: 16, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', textAlign: 'left', boxSizing: 'border-box' }}>{children}</div>;

export function OfflineBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: compact ? '10px 12px' : '10px 24px', background: 'var(--warn-surface)', border: compact ? '1px solid var(--warn-border)' : 0, borderBottom: '1px solid var(--warn-border)', borderRadius: compact ? 'var(--radius-md)' : 0, color: 'var(--warn-600)', font: 'var(--type-ui)', fontSize: 14 }}>
      <Icon name="wifi-off" size={18} style={{ marginTop: 1 }} /><span style={{ minWidth: 0 }}><b>Mất kết nối</b> — bài vẫn được giữ, sẽ lưu lại khi có mạng.</span>
    </div>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  const left = total - done;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ font: 'var(--type-ui)', fontWeight: 600, color: 'var(--text-title)' }}>Đã trả lời <span style={mText.mono}>{done}/{total}</span></span>
        <span style={mText.meta}>{left > 0 ? `Còn ${left} câu` : 'Đủ tất cả'}</span>
      </div>
      <div role="progressbar" aria-label="Tiến độ trả lời" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} style={{ height: 6, borderRadius: 99, background: 'var(--ink-100)', overflow: 'hidden' }}>
        <div style={{ width: (total ? (done / total) * 100 : 0) + '%', height: '100%', borderRadius: 99, background: 'var(--brand-600)', transition: 'width var(--dur-slow) var(--ease-standard)' }} />
      </div>
    </div>
  );
}

export interface NavQuestion { prompt: string; points: number }

function SideRow({ i, q, cur, done, mark, onSelect }: { i: number; q: NavQuestion; cur: boolean; done: boolean; mark?: ReviewMark; onSelect: (i: number) => void }) {
  const [hover, setHover] = useState(false);
  const m = mark && MARK[mark.kind];
  const badge = m ? { bg: m.bg, fg: m.fg, bd: '1.5px solid ' + m.bd }
    : cur ? { bg: 'var(--brand-600)', fg: '#fff', bd: '1.5px solid var(--brand-600)' }
    : done ? { bg: 'var(--brand-100)', fg: 'var(--brand-700)', bd: '1.5px solid var(--brand-200)' }
    : { bg: 'var(--paper)', fg: 'var(--ink-700)', bd: '1.5px dashed var(--ink-400)' };
  return (
    <button type="button" onClick={() => onSelect(i)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-current={cur ? 'step' : undefined}
      aria-label={`Câu ${i + 1}, ${formatPoints(q.points)} điểm, ${mark ? mark.text : done ? 'đã trả lời' : 'chưa trả lời'}`}
      style={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', gap: 12, alignItems: 'center', width: '100%', minHeight: 56, padding: '8px 12px', border: '1px solid ' + (cur ? 'var(--brand-200)' : 'transparent'), borderRadius: 'var(--radius-md)', background: cur ? 'var(--brand-050)' : hover ? 'var(--ink-050)' : 'transparent', textAlign: 'left', cursor: 'pointer', transition: 'background var(--dur-fast)' }}>
      <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-sm)', background: badge.bg, color: badge.fg, border: badge.bd, font: '700 14px/1 var(--font-mono)', boxSizing: 'border-box' }}>{i + 1}</span>
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <span style={{ font: '600 14px/1.3 var(--font-sans)', color: 'var(--text-title)', whiteSpace: 'nowrap' }}>Câu {i + 1}<span style={{ fontWeight: 400, color: 'var(--text-meta)' }}> · {formatPoints(q.points)}đ</span></span>
          {m ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--type-label)', color: m.fg, whiteSpace: 'nowrap' }}><Icon name={m.icon} size={13} />{mark!.text}</span>
            : done ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--type-label)', color: 'var(--brand-700)', whiteSpace: 'nowrap' }}><Icon name="check" size={13} />Đã trả lời</span>
            : <span style={{ font: 'var(--type-label)', color: 'var(--ink-600)', whiteSpace: 'nowrap' }}>Chưa trả lời</span>}
        </span>
        <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plainPrompt(q.prompt)}</span>
      </span>
    </button>
  );
}

/** Desktop sidebar list of questions (taking: answered / not; review: per-question mark). */
export function SideNav({ questions, current, answered = [], marks, onSelect }: { questions: NavQuestion[]; current: number; answered?: number[]; marks?: ReviewMark[]; onSelect: (i: number) => void }) {
  const set = new Set(answered);
  return <nav aria-label="Danh sách câu" style={{ display: 'grid', gap: 2 }}>{questions.map((q, i) => <SideRow key={i} i={i} q={q} cur={i === current} done={set.has(i)} mark={marks?.[i]} onSelect={onSelect} />)}</nav>;
}

function NavCell({ i, cur, done, mark, fill = false, onSelect }: { i: number; cur: boolean; done: boolean; mark?: ReviewMark; fill?: boolean; onSelect: (i: number) => void }) {
  const m = mark && MARK[mark.kind];
  const s = m ? [m.bg, m.fg, 'solid ' + m.bd] : cur ? ['var(--brand-600)', '#fff', 'solid var(--brand-600)'] : done ? ['var(--brand-100)', 'var(--brand-700)', 'solid var(--brand-200)'] : ['var(--paper)', 'var(--ink-700)', 'dashed var(--ink-400)'];
  return (
    <button type="button" onClick={() => onSelect(i)} aria-current={cur ? 'step' : undefined} aria-label={`Câu ${i + 1}${m ? ', ' + m.label : done ? ', đã trả lời' : ', chưa trả lời'}`}
      style={{ position: 'relative', flex: 'none', width: fill ? '100%' : 44, height: fill ? 56 : 44, borderRadius: 'var(--radius-sm)', font: '700 15px/1 var(--font-mono)', cursor: 'pointer', scrollSnapAlign: 'center', background: s[0], color: s[1], border: '1.5px ' + s[2], boxShadow: cur && !m ? 'var(--shadow-press)' : 'none', outline: cur && m ? '2px solid var(--brand-500)' : 'none', outlineOffset: 2 }}>
      {i + 1}
      {(done || m) && <span aria-hidden="true" style={{ position: 'absolute', top: 3, right: 3, display: 'flex' }}><Icon name={m ? m.icon : 'check'} size={11} /></span>}
    </button>
  );
}

/** Phone: one row of 44px cells that keeps the current question centred, plus a button that opens the full list. */
export function StripNav({ count, current, answered = [], marks, onSelect, onOpenAll }: { count: number; current: number; answered?: number[]; marks?: ReviewMark[]; onSelect: (i: number) => void; onOpenAll?: () => void }) {
  const set = new Set(answered);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const r = ref.current;
    const c = r?.children[current] as HTMLElement | undefined;
    if (r && c) r.scrollLeft = c.offsetLeft - r.clientWidth / 2 + c.offsetWidth / 2;
  }, [current]);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
      <nav ref={ref} aria-label="Danh sách câu" style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, overflowX: 'auto', scrollSnapType: 'x proximity', padding: '2px 2px 4px', scrollbarWidth: 'none' }}>
        {Array.from({ length: count }, (_, i) => <NavCell key={i} i={i} cur={i === current} done={set.has(i)} mark={marks?.[i]} onSelect={onSelect} />)}
      </nav>
      {onOpenAll && <Button variant="secondary" size="lg" icon="list" ariaLabel="Mở danh sách câu" onClick={onOpenAll} style={{ width: 44, height: 44 }} />}
    </div>
  );
}

/** Phone bottom sheet: all questions in a 5-column grid, progress and the submit button. */
export function NavSheet({ count, current, answered, onSelect, onClose, onSubmit }: { count: number; current: number; answered: number[]; onSelect: (i: number) => void; onClose: () => void; onSubmit: () => void }) {
  const set = new Set(answered);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--scrim)', display: 'flex', alignItems: 'flex-end', animation: 'pq-fade var(--dur-base) var(--ease-standard)' }}>
      <div role="dialog" aria-modal="true" aria-label="Danh sách câu" style={{ width: '100%', background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '8px 16px calc(16px + env(safe-area-inset-bottom))', boxShadow: 'var(--shadow-dialog)', display: 'grid', gap: 16, animation: 'pq-reveal var(--dur-slow) var(--ease-standard)', boxSizing: 'border-box' }}>
        <span aria-hidden="true" style={{ justifySelf: 'center', width: 36, height: 4, borderRadius: 99, background: 'var(--ink-300)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-title)' }}>Danh sách câu</h2>
          <Button variant="ghost" size="lg" icon="x" ariaLabel="Đóng" onClick={onClose} style={{ width: 44, height: 44 }} />
        </div>
        <Progress done={answered.length} total={count} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 8 }}>
          {Array.from({ length: count }, (_, i) => <NavCell key={i} i={i} fill cur={i === current} done={set.has(i)} onSelect={j => { onSelect(j); onClose(); }} />)}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', ...mText.meta }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--brand-100)', border: '1.5px solid var(--brand-200)' }} />Đã trả lời</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px dashed var(--ink-400)' }} />Chưa trả lời</span>
        </div>
        <Button size="lg" block icon="send" onClick={() => { onClose(); onSubmit(); }}>Nộp bài</Button>
      </div>
    </div>
  );
}

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const rows: [string[], string][] = [[['←', '→'], 'Câu trước / câu sau'], [['1', '…', '9'], 'Chọn phương án (nhiều đáp án: bật / tắt)'], [['↑', '↓'], 'Di chuyển giữa các phương án'], [['Esc'], 'Thoát ô nhập để dùng lại phím tắt'], [['?'], 'Mở bảng này']];
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16, animation: 'pq-fade var(--dur-base) var(--ease-standard)' }}>
      <div role="dialog" aria-modal="true" aria-label="Phím tắt" style={{ width: '100%', maxWidth: 440, background: 'var(--paper)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-dialog)', padding: 24, display: 'grid', gap: 16, animation: 'pq-pop-in var(--dur-slow) var(--ease-standard)', boxSizing: 'border-box' }}>
        <h3 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-title)' }}>Phím tắt</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map(([keys, text]) => (
            <div key={text} style={{ display: 'grid', gridTemplateColumns: '112px minmax(0,1fr)', gap: 12, alignItems: 'center', font: 'var(--type-ui)', fontSize: 14, color: 'var(--text-body)' }}>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{keys.map((key, j) => (key === '…' ? <span key={j} style={mText.meta}>–</span> : <Kbd key={j}>{key}</Kbd>))}</span><span>{text}</span>
            </div>
          ))}
        </div>
        <p style={{ ...mText.meta, display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
          <Icon name="info" size={16} style={{ marginTop: 2 }} /><span>Phím tắt tạm tắt khi con trỏ đang ở ô nhập (ô tự luận, ô tên…). Nộp bài không có phím tắt để tránh bấm nhầm.</span>
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="secondary" shortcut="Esc" onClick={onClose}>Đóng</Button></div>
      </div>
    </div>
  );
}

export function Switch({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 4px', background: 'none', border: 0, cursor: 'pointer', font: 'var(--type-ui)', fontSize: 14, color: 'var(--text-body)' }}>
      <span aria-hidden="true" style={{ width: 36, height: 20, borderRadius: 99, background: on ? 'var(--brand-600)' : 'var(--ink-300)', position: 'relative', transition: 'background var(--dur-fast)', flex: 'none' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left var(--dur-fast) var(--ease-standard)' }} />
      </span>
      {children}
    </button>
  );
}
