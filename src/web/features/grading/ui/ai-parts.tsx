import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import type { AiCriterionDto, GradingQuestion } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { formatPoints as F } from '../../../shared/format/points.js';
import { aiCounts, criterionTone, type AiCounts, type StripMode } from '../domain/ai-ui.js';

// Pieces of the "AI chấm nháp" design (PRODUCT.md §7.28): pills, progress, the AI strip, question chips, criteria.

export const aig = {
  label: { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--text-meta)' } as CSSProperties,
  meta: { margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)', textWrap: 'pretty' } as CSSProperties,
  mono: { fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' } as CSSProperties,
  sr: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as CSSProperties,
  linkBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 0', background: 'none', border: 0, cursor: 'pointer', font: 'var(--type-meta)', fontWeight: 600, color: 'var(--text-link)' } as CSSProperties,
};

const PILL: Record<'graded' | 'todo' | 'ai' | 'flag' | 'err', [string, string, string]> = {
  graded: ['var(--correct-surface)', 'var(--correct-600)', '1px solid var(--correct-border)'],
  todo: ['var(--ink-100)', 'var(--ink-700)', '1px solid var(--ink-300)'],
  ai: ['var(--paper)', 'var(--ink-700)', '1.5px dashed var(--ink-400)'],
  flag: ['var(--warn-surface)', 'var(--warn-600)', '1px solid var(--warn-border)'],
  err: ['var(--wrong-surface)', 'var(--wrong-600)', '1px solid var(--wrong-border)'],
};

export function Pill({ kind, icon, children }: { kind: keyof typeof PILL; icon?: string; children: ReactNode }) {
  const [bg, fg, border] = PILL[kind];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: bg, color: fg, border, font: 'var(--type-label)', whiteSpace: 'nowrap', flex: 'none' }}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function ProgressBar({ value, max, width = 160 }: { value: number; max: number; width?: number }) {
  return (
    <span role="progressbar" aria-label="Tiến độ AI gợi ý" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value} trên ${max} bài`}
      style={{ width, height: 6, borderRadius: 99, background: 'var(--ink-200)', overflow: 'hidden', flex: 'none' }}>
      <span style={{ display: 'block', width: `${max ? (value / max) * 100 : 0}%`, height: '100%', background: 'var(--ink-700)', borderRadius: 99, transition: 'width var(--dur-slow) var(--ease-standard)' }} />
    </span>
  );
}

/** The AI controls, at the bottom of the sticky question card. */
export function AiStrip({ mode, c, busy, onRun, onStop, onRetry, onShowFlagged }: { mode: StripMode; c: AiCounts; busy: boolean; onRun: () => void; onStop: () => void; onRetry: () => void; onShowFlagged: () => void }) {
  const wrap = (children: ReactNode, bg = 'var(--ink-050)') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minHeight: 52, padding: '8px 20px', background: bg, borderTop: '1px solid var(--border-hairline)', font: 'var(--type-meta)', color: 'var(--text-body)' }}>{children}</div>
  );
  const ic = (n: string, color = 'var(--ink-700)') => <Icon name={n} size={16} color={color} style={{ flex: 'none' }} />;
  switch (mode) {
    case 'off':
      return wrap(<>{ic('sparkles', 'var(--ink-500)')}<span style={{ color: 'var(--text-meta)' }}>Muốn AI chấm nháp?</span><Link to="/admin/ai-grader-help" style={aig.linkBtn}>Xem hướng dẫn bật</Link></>, 'var(--paper)');
    case 'norubric':
      return wrap(<><Button size="sm" variant="secondary" icon="lock" disabled>AI chấm nháp</Button><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }}>{ic('info')}<span>Câu này chưa có rubric, AI không chấm được. Thêm rubric vào đề rồi import lại.</span></span></>);
    case 'allgraded':
      return wrap(<>{ic('circle-check', 'var(--correct-600)')}<span>Bạn đã chấm hết bài của câu này, không còn bài để gửi AI.</span>{c.sent > 0 && <span style={{ color: 'var(--text-meta)' }}>· AI đã gợi ý {c.ok}/{c.sent} bài</span>}</>);
    case 'ready':
      return wrap(<><Button size="sm" icon="sparkles" loading={busy} onClick={onRun}>AI chấm nháp</Button><span>Gửi <b style={aig.mono}>{c.toSend}</b> bài chưa chấm (ẩn danh) cho AI. Bạn vẫn xác nhận từng bài.</span>{c.blank > 0 && <span style={{ color: 'var(--text-meta)' }}>· Bài bỏ trống không gửi.</span>}</>);
    case 'final':
      return wrap(<>{ic('lock')}<span><b>Phiên đã chốt.</b> {c.sent > 0 ? <>Gợi ý AI ({c.ok}/{c.sent} bài) chỉ còn để so với điểm đã chốt.</> : 'Không còn thao tác chấm.'}</span></>);
    case 'running':
      return wrap(<>
        <Icon name="loader-circle" size={16} spin color="var(--ink-700)" />
        <span style={{ fontWeight: 600, color: 'var(--text-title)' }}>AI đang gợi ý <span style={aig.mono}>{c.ok + c.err}/{c.sent}</span></span>
        <ProgressBar value={c.ok + c.err} max={c.sent} />
        <span style={{ color: 'var(--text-meta)' }}><span style={aig.mono}>{c.queued}</span> bài đang chờ · chạy nền, bạn vẫn chấm tay hoặc đổi câu được</span>
        <span style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" icon="x" loading={busy} onClick={onStop}>Dừng</Button>
      </>);
    default:
      return wrap(<>
        {ic('sparkles')}
        <span style={{ fontWeight: 600, color: 'var(--text-title)' }}>AI đã gợi ý <span style={aig.mono}>{c.ok}/{c.sent}</span></span>
        {c.sugPending > 0 && <span>· <span style={aig.mono}>{c.sugPending}</span> gợi ý chờ bạn xác nhận</span>}
        {c.flagPending > 0 && (
          <button type="button" onClick={onShowFlagged} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, border: '1px solid var(--warn-border)', background: 'var(--warn-surface)', color: 'var(--warn-600)', font: 'var(--type-label)', cursor: 'pointer' }}>
            <Icon name="shield-alert" size={13} />{c.flagPending} bài nghi ngờ · xem
          </button>
        )}
        {c.errPending > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--wrong-600)', fontWeight: 600 }}><Icon name="circle-alert" size={14} />{c.errPending} bài lỗi</span>}
        <span style={{ flex: 1 }} />
        {c.errPending > 0 && <Button size="sm" variant="secondary" icon="rotate-ccw" loading={busy} onClick={onRetry}>Thử lại các bài lỗi</Button>}
        {c.toSend > 0 && <Button size="sm" variant="secondary" icon="sparkles" loading={busy} onClick={onRun}>Gửi {c.toSend} bài còn lại</Button>}
        {c.errPending === 0 && c.sugPending === 0 && c.toSend === 0 && <span style={{ color: 'var(--text-meta)' }}>Đã xác nhận hết gợi ý.</span>}
      </>);
  }
}

/** Essay question chips with a small AI summary (colour always comes with an icon, the label reads it all). */
export function QuestionChips({ questions, current, onSelect, ai }: { questions: GradingQuestion[]; current: number; onSelect: (i: number) => void; ai: boolean }) {
  return (
    <nav aria-label="Câu tự luận" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {questions.map((q, i) => {
        const c = aiCounts(q);
        const cur = i === current;
        const done = c.graded === c.total;
        const ind: ReactNode[] = [];
        if (ai && c.running) ind.push(<Icon key="r" name="loader-circle" size={13} spin />);
        if (ai && c.flagPending) ind.push(<Icon key="f" name="shield-alert" size={13} color="var(--warn-600)" />);
        if (ai && c.sugPending) ind.push(<span key="s" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, font: '700 11px/1 var(--font-mono)' }}><Icon name="sparkles" size={12} />{c.sugPending}</span>);
        const label = `Câu ${q.position}, đã chấm ${c.graded} trên ${c.total}` + (ai && c.running ? ', AI đang chạy' : '') + (ai && c.sugPending ? `, ${c.sugPending} gợi ý chưa xác nhận` : '') + (ai && c.flagPending ? ', có bài nghi ngờ' : '');
        const box = ind.length > 0 || done;
        return (
          <button key={q.id} type="button" onClick={() => onSelect(i)} aria-current={cur ? 'true' : undefined} aria-label={label} title={label}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 6px 0 14px', borderRadius: 'var(--radius-pill)', border: '1.5px solid ' + (cur ? 'var(--brand-600)' : 'var(--border-strong)'), background: cur ? 'var(--brand-600)' : 'var(--paper)', color: cur ? '#fff' : 'var(--ink-900)', font: 'var(--type-ui)', fontWeight: 600, cursor: 'pointer', flex: 'none' }}>
            Câu {q.position}
            <span style={{ ...aig.mono, fontSize: 13, fontWeight: 500, opacity: cur ? 0.9 : 0.75 }}>{c.graded}/{c.total}</span>
            <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 26, padding: box ? '0 8px' : 0, borderRadius: 99, background: box ? 'var(--paper)' : 'transparent', color: 'var(--ink-700)', border: box && !cur ? '1px solid var(--ink-200)' : 0 }}>
              {done && ind.length === 0 ? <Icon name="circle-check" size={13} color="var(--correct-600)" /> : ind}
            </span>
          </button>
        );
      })}
      {ai && (
        <span aria-hidden="true" style={{ marginLeft: 'auto', display: 'flex', gap: 14, ...aig.meta, fontSize: 12 }}>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon name="sparkles" size={12} />gợi ý chưa xác nhận</span>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon name="shield-alert" size={12} color="var(--warn-600)" />có bài nghi ngờ</span>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon name="loader-circle" size={12} />AI đang chạy</span>
        </span>
      )}
    </nav>
  );
}

const TONE = { full: ['circle-check', 'var(--correct-600)'], partial: ['circle-dot', 'var(--warn-600)'], none: ['circle-x', 'var(--wrong-600)'] } as const;

/** Per-criterion reasons, numbered like the rubric pinned above (T1…). */
export function AiCriteria({ criteria, compact = false }: { criteria: AiCriterionDto[]; compact?: boolean }) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: compact ? 6 : 8 }}>
      {criteria.map((c, i) => {
        const [icon, color] = TONE[criterionTone(c.score, c.max)];
        return (
          <li key={i} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 8, alignItems: 'start', font: 'var(--type-meta)', color: 'var(--text-body)' }}>
            <span style={{ ...aig.mono, fontWeight: 700, fontSize: 12, color: 'var(--ink-600)', paddingTop: 1, minWidth: 20 }}>{/^T\d+$/.test(c.label) ? c.label : `T${i + 1}`}</span>
            <span style={{ minWidth: 0, textWrap: 'pretty' }}>{/^T\d+$/.test(c.label) ? c.note : <><b>{c.label}.</b> {c.note}</>}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color, fontWeight: 700, ...aig.mono, fontSize: 12, whiteSpace: 'nowrap' }}>
              <Icon name={icon} size={13} />{F(c.score)}/{F(c.max)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
