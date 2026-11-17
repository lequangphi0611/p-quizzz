import type { LeaderboardEntry, SubmittedEntry } from '../../../shared/api/index.js';
import { Icon } from '../ui/Icon.js';

const MEDAL = ['var(--medal-gold)', 'var(--medal-silver)', 'var(--medal-bronze)'];
const fmt = (n: number) => String(n).replace('.', ',');

// Pure presentation. `size="screen"` is the projector variant (S14). `hidden`: the mentor holds scores back
// (PRODUCT.md §7.25), so only who has submitted is listed, by submission time, with no rank or score.
export function LeaderboardView({ entries, provisional, highlightName, size = 'md', limit, title = 'Bảng xếp hạng', columns = 1, hidden = false, submitted = [] }: {
  entries: LeaderboardEntry[]; provisional: boolean; highlightName?: string; size?: 'md' | 'screen'; limit?: number; title?: string;
  /** Two columns for a long ranking on the projector. */
  columns?: 1 | 2;
  hidden?: boolean;
  submitted?: SubmittedEntry[];
}) {
  const big = size === 'screen';
  if (hidden) return <HeldView submitted={submitted} highlightName={highlightName} big={big} limit={limit} columns={columns} />;
  const rows = limit ? entries.slice(0, limit) : entries;
  const c = big
    ? { bg: 'transparent', row: 'var(--screen-panel)', line: 'var(--screen-line)', text: 'var(--screen-text)', meta: 'var(--screen-meta)' }
    : { bg: 'var(--surface-card)', row: 'transparent', line: 'var(--border-hairline)', text: 'var(--text-title)', meta: 'var(--text-meta)' };
  return (
    <section aria-label={title} style={{ background: c.bg, border: big ? 0 : '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: big ? 'none' : 'var(--shadow-card)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: big ? '0 0 24px' : '14px 16px', borderBottom: big ? 0 : '1px solid ' + c.line }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: big ? 16 : 8, font: big ? '800 48px/1.1 var(--font-sans)' : 'var(--type-h2)', fontSize: big ? 48 : 17, color: c.text }}>
          <Icon name="trophy" size={big ? 44 : 18} color="var(--medal-gold)" />{title}
        </div>
        <span style={{ padding: big ? '8px 18px' : '3px 10px', borderRadius: 'var(--radius-pill)', font: 'var(--type-label)', fontSize: big ? 24 : 12, whiteSpace: 'nowrap', background: provisional ? (big ? 'var(--screen-line)' : 'var(--ink-100)') : 'var(--correct-surface)', color: provisional ? c.meta : 'var(--correct-600)' }}>
          {provisional ? 'Tạm tính' : 'Kết quả chính thức'}
        </span>
      </div>
      {rows.length === 0 && <div style={{ padding: big ? 40 : 24, textAlign: 'center', font: 'var(--type-body)', fontSize: big ? 32 : 15, color: c.meta }}>Chưa có ai nộp bài.</div>}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: big ? 10 : 0, gridTemplateColumns: columns === 2 ? '1fr 1fr' : undefined, columnGap: columns === 2 ? 32 : undefined, gridAutoFlow: columns === 2 ? 'row' : undefined }}>
        {rows.map((e, i) => {
          const me = !!highlightName && e.displayName === highlightName;
          const top = e.rank <= 3;
          return (
            <li key={e.displayName} aria-current={me ? 'true' : undefined} style={{ display: 'grid', gridTemplateColumns: (big ? '88px' : '44px') + ' 1fr auto', alignItems: 'center', gap: big ? 20 : 10, padding: big ? '14px 28px' : '10px 16px', background: me ? 'var(--sun-100)' : c.row, borderTop: !big && i ? '1px solid ' + c.line : 0, borderRadius: big ? 'var(--radius-lg)' : 0, boxShadow: me && !big ? 'inset 3px 0 0 var(--sun-500)' : 'none' }}>
              <span className="pq-tabular" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: big ? 64 : 30, height: big ? 64 : 30, borderRadius: '50%', font: 'var(--type-score)', fontSize: big ? 30 : 14, background: top ? MEDAL[e.rank - 1] : 'transparent', color: top ? '#fff' : me ? 'var(--sun-ink)' : c.meta }}>{e.rank}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, font: big ? '700 40px/1.2 var(--font-sans)' : 'var(--type-ui)', fontSize: big ? 40 : 15, color: me ? 'var(--ink-900)' : c.text }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.displayName}</span>
                {me && <span style={{ flex: 'none', font: 'var(--type-label)', fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--sun-400)', color: 'var(--sun-ink)' }}>Bạn</span>}
              </span>
              <span className="pq-tabular" style={{ font: 'var(--type-score)', fontSize: big ? 40 : 16, color: me ? 'var(--ink-900)' : c.text }}>
                {fmt(e.score)}<span style={{ color: me ? 'var(--sun-ink)' : c.meta, fontWeight: 500 }}>/{fmt(e.maxScore)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// Scores held back: names of who has handed in (in submission order), no rank number and no score.
function HeldView({ submitted, highlightName, big, limit, columns }: { submitted: SubmittedEntry[]; highlightName?: string; big: boolean; limit?: number; columns: 1 | 2 }) {
  const rows = limit ? submitted.slice(0, limit) : submitted;
  const more = submitted.length - rows.length;
  const c = big
    ? { bg: 'transparent', row: 'var(--screen-panel)', line: 'var(--screen-line)', text: 'var(--screen-text)', meta: 'var(--screen-meta)' }
    : { bg: 'var(--surface-card)', row: 'transparent', line: 'var(--border-hairline)', text: 'var(--text-title)', meta: 'var(--text-meta)' };
  return (
    <section aria-label="Đã nộp bài" style={{ background: c.bg, border: big ? 0 : '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: big ? 'none' : 'var(--shadow-card)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: big ? '0 0 24px' : '14px 16px', borderBottom: big ? 0 : '1px solid ' + c.line, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: big ? 16 : 8, font: big ? '800 48px/1.1 var(--font-sans)' : 'var(--type-h2)', fontSize: big ? 48 : 17, color: c.text }}>
          <Icon name="circle-check" size={big ? 44 : 18} color={big ? 'var(--sun-400)' : 'var(--brand-600)'} />Đã nộp bài
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: big ? '8px 18px' : '3px 10px', borderRadius: 'var(--radius-pill)', font: 'var(--type-label)', fontSize: big ? 24 : 12, whiteSpace: 'nowrap', background: big ? 'var(--screen-line)' : 'var(--ink-100)', color: c.meta }}>
          <Icon name="lock" size={big ? 22 : 12} />Điểm chưa công bố
        </span>
      </div>
      {rows.length === 0 && <div style={{ padding: big ? 40 : 24, textAlign: 'center', font: 'var(--type-body)', fontSize: big ? 32 : 15, color: c.meta }}>Chưa có ai nộp bài.</div>}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: big ? 10 : 0, gridTemplateColumns: columns === 2 ? '1fr 1fr' : undefined, columnGap: columns === 2 ? 32 : undefined }}>
        {rows.map((e, i) => {
          const me = !!highlightName && e.displayName === highlightName;
          return (
            <li key={e.displayName} aria-current={me ? 'true' : undefined} style={{ display: 'flex', alignItems: 'center', gap: big ? 20 : 10, padding: big ? '14px 28px' : '10px 16px', background: me ? 'var(--sun-100)' : c.row, borderTop: !big && i ? '1px solid ' + c.line : 0, borderRadius: big ? 'var(--radius-lg)' : 0, boxShadow: me && !big ? 'inset 3px 0 0 var(--sun-500)' : 'none', font: big ? '700 40px/1.2 var(--font-sans)' : 'var(--type-ui)', fontSize: big ? 40 : 15, color: me ? 'var(--ink-900)' : c.text, minWidth: 0 }}>
              <Icon name="check" size={big ? 32 : 16} color={big ? 'var(--sun-400)' : 'var(--brand-600)'} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.displayName}</span>
              {me && <span style={{ flex: 'none', font: 'var(--type-label)', fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--sun-400)', color: 'var(--sun-ink)' }}>Bạn</span>}
            </li>
          );
        })}
      </ol>
      {more > 0 && <div style={{ padding: big ? '16px 28px 0' : '8px 16px 12px', font: 'var(--type-meta)', fontSize: big ? 28 : 13, color: c.meta }}>và {more} người khác</div>}
    </section>
  );
}
